<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { useAppStore } from '@/stores/app.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  Measurement,
  Prompt,
  Target,
  TargetProblemBehavior,
  UsedTargetMeasurement
} from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import AppButton from '@/components/AppButton.vue'
import { promptColors } from '@/lib/data'

const sessionStore = useSessionStore()
const appStore = useAppStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurement_results: Measurement['results']
  target: Target
  is_collapsed: boolean
}
interface Emits {
  (e: 'fetch-session'): void
  (e: 'toggle-saved', bool: boolean): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

interface Trial {
  key: string | number
  target_id?: Target['id']
  prompt_id?: Prompt['id']
  prompt_parent_id?: Prompt['id'] | null
  target_problem_behavior_id?: TargetProblemBehavior['id'] | null
}

const isSaved = ref<boolean>(true)
const page = ref<number>(1)
const submitLoading = ref<boolean>(false)

const activeDisplay = ref<'select-prompt' | 'select-next-task' | 'reselect-task'>('select-prompt')
const editDisplay = ref<'select-prompt' | 'select-next-task' | 'reselect-task'>('select-prompt')

const activeTrial = ref<Trial>({
  key: 0,
  target_id: 0,
  prompt_id: 0,
  prompt_parent_id: null,
  target_problem_behavior_id: null
})
const editTrial = ref<Trial>({
  key: 0,
  target_id: 0,
  prompt_id: 0,
  prompt_parent_id: null,
  target_problem_behavior_id: null
})

const nextTarget = ref<any>()
const deleteTrialKey = ref<null | Trial['key']>(null)

const ratioScores = ref<any[]>([])
const resultsState = ref<Measurement['results']>({})

const isOpenProblemBehavior = ref<boolean>(false)
const isOpenTrialHistory = ref<boolean>(false)
const isOpenEditTrial = ref<boolean>(false)

// state prompts members problem_behaviors from measurement.target
const TAPrompts = ref<Prompt[]>([])
const TAUsedTargets = ref<UsedTargetMeasurement[]>([])
const TAProblemBehaviors = ref<TargetProblemBehavior[]>([])

const currentDisplay = computed({
  // getter
  get() {
    if (isOpenEditTrial.value) {
      return editDisplay.value
    } else {
      return activeDisplay.value
    }
  },
  // setter
  set(val) {
    if (isOpenEditTrial.value) {
      editDisplay.value = val
    } else {
      activeDisplay.value = val
    }
  }
})
const currentTrial = computed({
  // getter
  get() {
    if (isOpenEditTrial.value) {
      return editTrial.value
    } else {
      return activeTrial.value
    }
  },
  // setter
  set(val) {
    if (isOpenEditTrial.value) {
      editTrial.value = val
    } else {
      activeTrial.value = val
    }
  }
})
const currentTrialData = computed(() => {
  return getTrial(currentTrial.value)
})

const perPage = computed<number>(() => (props.is_collapsed ? 3 : 9))
const pageCount = computed<number>(() => {
  const prompts = [...TAPrompts.value]
  const boxes = prompts.length
  return Math.ceil(boxes / perPage.value)
})
const promptBoxesPages = computed<Prompt[][]>(() => {
  const prompts = [...TAPrompts.value]
  const res = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    const arr = [...prompts.slice(start, end)]
    res.push(arr)
  }
  return res
})

watch(
  () => isSaved.value,
  (val) => {
    emit('toggle-saved', val)
  }
)

watch(
  () => props.is_collapsed,
  () => {
    setTimeout(() => {
      const el = `${props.measurement.id}-ta-prompt-boxes-${1}`
      const boxes = document.getElementById(el)
      boxes?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 300)
  }
)

watch(
  () => props.measurement_results,
  (val) => {
    resultsState.value = val
    generateRatioScores()
  },
  { deep: true }
)

watch(
  () => deleteTrialKey.value,
  (val) => {
    if (val === null) isSaved.value = true
    else isSaved.value = false
  }
)

// 🔧 Tambahkan computed untuk monitoring
const hasPendingSync = computed(() => {
  return sessionStore.pending_progress.some(
    (item) => item.key === `update_measurement_${props.measurement.id}`
  )
})

// Watch untuk notifikasi saat sync berhasil
watch(hasPendingSync, (isPending, wasPending) => {
  if (wasPending && !isPending) {
    // Sync completed
    const updated = { ...resultsState.value }
    delete updated._pendingSync
    resultsState.value = updated

    toast.success('Data synced to server')
  }
})

// Auto-save timer
let idleTimer: any = null
const resetIdleTimer = () => {
  clearTimeout(idleTimer)
  if (sessionStore.session?.status !== 'ongoing') return

  // Auto-save setelah 5 detik idle
  idleTimer = setTimeout(() => {
    if (sessionStore.session?.status !== 'ongoing') {
      clearTimeout(idleTimer)
      return
    }

    if (!isSaved.value && currentTrial.value.prompt_id && !isOpenEditTrial.value) {
      console.log('[Component] Auto-saving due to idle')
      onSaveCurrentTrial()
    }
  }, 5000)
}

// Periodic check untuk stuck items
let periodicCheckInterval: any = null

onMounted(async () => {
  const prompts = (props.target?.prompts || [])
    .map((i) => {
      if (props.target.prompting_format === 'classic') {
        const score = i.abbreviation === 'Id' ? 100 : 0
        return { ...i, score }
      }
      return i
    })
    .sort((a, b) => (a?.position || 0) - (b?.position || 0))
    .sort((a, b) => {
      if (a.is_default && a.abbreviation === 'Id') return -1
      if (b.is_default && b.abbreviation === 'Id') return 1

      if (a.is_default && a.abbreviation === 'Ic') return 1
      if (b.is_default && b.abbreviation === 'Ic') return -1
      return (b?.score || 0) - (a?.score || 0)
    })
  const usedTargets = props.measurement?.used_targets || []
  const problems = props.target?.target_problem_behaviors || []

  TAPrompts.value = prompts || []
  TAUsedTargets.value = usedTargets || []
  TAProblemBehaviors.value = problems.sort((a, b) => (a?.position || 0) - (b?.position || 0))
  resultsState.value = props.measurement_results

  generateRatioScores()

  const results = Object.keys(resultsState.value).map((key) => ({
    ...resultsState.value[key],
    key
  }))

  if (results.length) {
    const length = results.length
    const lastTrial = results[length - 1]

    if (!lastTrial.prompt_id) {
      currentTrial.value = lastTrial
    } else {
      const index = TAUsedTargets.value.findIndex((i) => i.target_id === lastTrial.target_id)
      let nextTargetId: number | undefined = 0
      if (index > -1 && index + 1 <= TAUsedTargets.value.length - 1) {
        nextTargetId = TAUsedTargets.value[index + 1].target_id
      } else if (TAUsedTargets.value.length) {
        nextTargetId = TAUsedTargets.value[0].target_id
      }
      const newTrial: Trial = {
        key: Number(lastTrial.key) + 1,
        target_id: nextTargetId,
        prompt_id: 0,
        prompt_parent_id: null,
        target_problem_behavior_id: null
      }
      resultsState.value[newTrial.key] = {
        key: newTrial.key,
        target_id: newTrial.target_id,
        prompt_id: newTrial.prompt_id,
        prompt_parent_id: newTrial.prompt_parent_id,
        target_problem_behavior_id: newTrial.target_problem_behavior_id
      }
      currentTrial.value = newTrial
    }
  } else {
    const newTrial: Trial = {
      key: 1,
      target_id: 0,
      prompt_id: 0,
      prompt_parent_id: null,
      target_problem_behavior_id: null
    }
    if (TAUsedTargets.value.length) {
      newTrial.target_id = TAUsedTargets.value[0].target_id
    }
    resultsState.value[newTrial.key] = {
      key: newTrial.key,
      target_id: newTrial.target_id,
      prompt_id: newTrial.prompt_id,
      prompt_parent_id: newTrial.prompt_parent_id,
      target_problem_behavior_id: newTrial.target_problem_behavior_id
    }
    currentTrial.value = newTrial
  }

  // Restore dari backup jika ada
  const measurementId = Number(props.measurement.id)
  const backup = await sessionStore.restoreFromBackup(measurementId)
  if (backup) {
    if (backup.status === 'pending') {
      resultsState.value = backup.data.results
      toast.info('Data restored from backup`')
    }
  }

  // Setup auto-sync (hanya sekali)
  if (!sessionStore._autoSyncInitialized) {
    sessionStore.setupAutoSync()
  }

  // Process pending items jika online
  if (appStore.network_status.connected && sessionStore.pending_progress.length > 0) {
    console.log('[Component] Processing pending items on mount')
    await sessionStore.resolvePendingProgress()
  }

  // Setup periodic check untuk stuck items
  periodicCheckInterval = setInterval(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    const stuckItems = sessionStore.pending_progress.filter(
      (item) => item.timestamp && item.timestamp < fiveMinutesAgo
    )

    if (stuckItems.length > 0 && appStore.network_status.connected) {
      console.warn('[Component] Found stuck items, triggering sync')
      sessionStore.triggerSync(true)
    }
  }, 60000) // Check setiap 1 menit
})

// Cleanup saat unmount
onUnmounted(() => {
  clearInterval(periodicCheckInterval)
  clearTimeout(idleTimer)

  // Trigger sync sebelum unmount jika ada perubahan
  if (!isSaved.value && appStore.network_status.connected) {
    sessionStore.triggerSync(true)
  }
})

const onScroll = (e: any) => {
  const offsetWidth = e.currentTarget.offsetWidth
  const scrollLeft = e.currentTarget.scrollLeft
  const current = Math.floor(scrollLeft / offsetWidth) + 1
  page.value = current
}

const getColor = (id: number): string => {
  const found = TAPrompts.value.find((i) => i.id === id)
  return found ? found.color || '' : ''
}
const getCode = (id: number, data: 'target' | 'prompt' | 'problem_behavior') => {
  if (data === 'target') {
    const found = TAUsedTargets.value.find((i) => i.target_id === id)
    return found ? found.target_code : ''
  }
  if (data === 'prompt') {
    const found = TAPrompts.value.find((i) => i.id === id)
    return found ? found.abbreviation : ''
  }
  if (data === 'problem_behavior') {
    const found = TAProblemBehaviors.value.find((i) => i.id === id)
    return found ? found.code : ''
  }
  return '-'
}

const getTrial = (trial: Trial) => {
  const defaultTarget = TAUsedTargets.value.length ? TAUsedTargets.value[0] : { target_code: '' }
  const target = TAUsedTargets.value.find((i) => i.target_id === trial.target_id) || defaultTarget
  const prompt = TAPrompts.value.find((i) => i.id === trial.prompt_id) || {
    name: '',
    score: ''
  }
  const problemBehavior = TAProblemBehaviors.value.find(
    (i) => i.id === trial.target_problem_behavior_id
  ) || { code: 'R', code_definition: '' }

  let average = 0
  const ratioScore = ratioScores.value.find((i) => i.target_id === trial.target_id)
  if (ratioScore) {
    average = ratioScore.average
  }
  return {
    ...trial,
    target: target,
    prompt,
    problem_behavior: problemBehavior || { code: 'R', code_definition: '' },
    average
  }
}

const generateRatioScores = () => {
  /**
   * percentage: average all task
   * green ratio: ratio of current task count from the most task count
   * red badge: any problem_behavior(?) yes: put the badge
   */

  let maxRatio = 0
  const results = Object.keys(resultsState.value).map((key) => ({
    ...resultsState.value[key],
    key
  }))

  const targets = [...TAUsedTargets.value].map((i) => {
    const ratios = results.filter((r) => r.target_id === i.target_id)
    const listOfScore: number[] = ratios
      .map((r) => {
        const prompt = TAPrompts.value.find((p) => p.id === r.prompt_id)
        return prompt ? prompt?.score || 0 : -1
      })
      .filter((r) => r !== -1)
    const sum = listOfScore.reduce((sum, i) => (sum += i), 0)
    const average = Math.round(sum / listOfScore.length || 0)

    if (listOfScore.length > maxRatio) maxRatio = listOfScore.length
    return { ...i, sum, average, count: listOfScore.length, ratios }
  })

  const assignedMaxRatio = targets.map((i) => {
    return { ...i, max_ratio: maxRatio }
  })
  ratioScores.value = [...assignedMaxRatio]
}

const onOpenTrialHistory = () => {
  isOpenTrialHistory.value = true
}

const onCloseTrialHistory = () => {
  isOpenTrialHistory.value = false
  deleteTrialKey.value = null

  setTheLastTrial()
}

const setTheLastTrial = () => {
  const data = resultsState.value
  if (activeDisplay.value === 'select-prompt') {
    const filtered = Object.values(data).filter((i: any) => i.prompt_id && i.target_id)
    const newKey = filtered.length + 1
    currentTrial.value = {
      key: newKey,
      target_id: currentTrial.value.target_id,
      prompt_id: currentTrial.value.prompt_id,
      prompt_parent_id: currentTrial.value.prompt_parent_id,
      target_problem_behavior_id: currentTrial.value.target_problem_behavior_id
    }
  }
  if (activeDisplay.value === 'select-next-task') {
    const results = Object.keys(data).map((key) => ({ ...data[key], key }))

    const index = results.findIndex((i) => Number(i.key) === Number(currentTrial.value.key))
    if (index > -1) {
      currentTrial.value = results[index]
    } else {
      currentTrial.value = results[results.length - 1]
    }
  }
}

// onSaveCurrentTrial dengan proper error handling
const onSaveCurrentTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return { success: false }
  if (submitLoading.value) return { success: false }

  // Simpan state sebelumnya untuk rollback
  const previousResults = { ...resultsState.value }
  const previousIsSaved = isSaved.value

  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })

  const index = results.findIndex((i) => Number(i.key) === Number(currentTrial.value.key))
  if (index > -1) {
    results[index] = currentTrial.value
  } else {
    results.push(currentTrial.value)
  }

  results = results
    .filter((i) => Number(i.prompt_id) && Number(i.target_id))
    .map((i, idx) => ({ ...i, key: idx + 1 }))

  const finalResults: Record<string, any> = {}
  for (let idx = 0; idx < results.length; idx++) {
    finalResults[idx + 1] = results[idx]
  }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  submitLoading.value = true

  try {
    const { success, message, data } = await sessionStore.updateMeasurementResults(params)

    // ✅ CEK success SEBELUM update state!
    if (!success) {
      resultsState.value = previousResults
      isSaved.value = previousIsSaved
      toast.error(message || 'Failed to save data')
      return { success: false }
    }

    // ✅ Update state HANYA jika success
    isSaved.value = true
    resultsState.value = data.results

    // ✅ Visual feedback berbeda untuk offline/online
    if (data._pendingSync) {
      toast.info('Saved offline, will sync automatically')
    } else {
      // toast.success('Successfully saved') // Optional: bisa di-comment jika terlalu banyak notif
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error in onSaveCurrentTrial:', error)

    resultsState.value = previousResults
    isSaved.value = previousIsSaved

    toast.error('Something went wrong. Please try again.')
    return { success: false }
  } finally {
    submitLoading.value = false
  }
}

// onChoosePrompt dengan guard
const onChoosePrompt = async (prompt: Prompt) => {
  if (sessionStore.session?.status !== 'ongoing') return

  // Prevent multiple submissions
  if (submitLoading.value) {
    toast.warning('Saving data, please wait...')
    return
  }

  const newTrial: Trial = {
    ...currentTrial.value,
    prompt_id: prompt.id,
    prompt_parent_id: prompt.prompt_parent_id
  }

  // Simpan state sebelumnya untuk rollback
  const previousTrial = { ...currentTrial.value }

  isSaved.value = false
  currentTrial.value = newTrial

  // Reset idle timer
  resetIdleTimer()

  // if edit trial - skip assign next task and select-next-task
  if (isOpenEditTrial.value) {
    return
  }

  const { success } = await onSaveCurrentTrial()

  if (!success) {
    // Rollback jika gagal
    currentTrial.value = previousTrial
    return
  }

  const index = ratioScores.value.findIndex((i) => i.target_id === newTrial.target_id)
  if (index > -1 && index + 1 <= ratioScores.value.length - 1) {
    nextTarget.value = ratioScores.value[index + 1]
  } else {
    nextTarget.value = ratioScores.value[0]
  }
  currentDisplay.value = 'select-next-task'
}

const onChooseProblemBehavior = async (problemBehavior: TargetProblemBehavior) => {
  if (sessionStore.session?.status !== 'ongoing') return

  let newId: Trial['target_problem_behavior_id'] = problemBehavior.id
  if (currentTrial.value.target_problem_behavior_id === newId) {
    newId = null
  }

  const newTrial: Trial = {
    ...currentTrial.value,
    target_problem_behavior_id: newId
  }

  isSaved.value = false
  currentTrial.value = newTrial

  // Reset idle timer
  resetIdleTimer()

  if (isOpenEditTrial.value) {
    return
  }

  const { success } = await onSaveCurrentTrial()
  if (!success) return
}

const onUndoTrial = () => {
  if (sessionStore.session?.status !== 'ongoing') return
  const results = Object.keys(resultsState.value).map((key) => ({
    ...resultsState.value[key],
    key
  }))

  let newTrial: Trial = {
    key: 1,
    target_id: 0,
    prompt_id: 0,
    prompt_parent_id: null,
    target_problem_behavior_id: null
  }
  if (results.length) {
    newTrial = {
      ...results[results.length - 1],
      key: results.length
    }
  }
  currentTrial.value = newTrial

  const index = ratioScores.value.findIndex((i) => i.target_id === newTrial.target_id)
  nextTarget.value = ratioScores.value[index]
  currentDisplay.value = 'reselect-task'
}

const onTakeNextTrial = (payload: { isNew: boolean }) => {
  if (sessionStore.session?.status !== 'ongoing') return
  const newKey = payload.isNew ? Number(currentTrial.value.key) + 1 : currentTrial.value.key
  const newTrial: Trial = {
    key: newKey,
    target_id: nextTarget.value?.target_id,
    prompt_id: 0,
    prompt_parent_id: null,
    target_problem_behavior_id: null
  }
  resultsState.value[newTrial.key] = {
    key: newTrial.key,
    target_id: newTrial.target_id,
    prompt_id: newTrial.prompt_id,
    prompt_parent_id: newTrial.prompt_parent_id,
    target_problem_behavior_id: newTrial.target_problem_behavior_id
  }
  currentDisplay.value = 'select-prompt'
  currentTrial.value = newTrial
  nextTarget.value = {}
  generateRatioScores()
}

const onOpenEditTrial = (key: Trial['key']) => {
  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })
  const index = results.findIndex((i) => Number(i.key) === Number(key))
  if (index > -1) {
    isOpenEditTrial.value = true
    currentTrial.value = results[index]
    currentDisplay.value = 'select-prompt'

    isSaved.value = false
  }
}

const onCloseEditTrial = () => {
  isSaved.value = true
  isOpenEditTrial.value = false
}

// onDeleteTrial dengan proper error handling
const onDeleteTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (submitLoading.value) return { success: false }

  // Simpan state sebelumnya untuk rollback
  const previousResults = { ...resultsState.value }

  const key = deleteTrialKey.value
  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })

  results = results
    .filter((i) => Number(i.key) !== Number(key))
    .filter((i) => Number(i.prompt_id) && Number(i.target_id))
    .map((i, idx) => ({ ...i, key: idx + 1 }))

  const finalResults: Record<string, any> = {}

  for (let idx = 0; idx < results.length; idx++) {
    finalResults[idx + 1] = results[idx]
  }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  submitLoading.value = true
  try {
    const { success, message, data } = await sessionStore.updateMeasurementResults(params)

    if (!success) {
      resultsState.value = previousResults
      toast.error(message || 'Failed to delete data')
      return
    }

    isSaved.value = true
    resultsState.value = data.results
    deleteTrialKey.value = null

    if (data._pendingSync) {
      toast.info('Deleted offline, will sync automatically')
    } else {
      toast.success('Data deleted')
    }
  } catch (error) {
    console.error('Unexpected error in onDeleteTrial:', error)
    resultsState.value = previousResults
    toast.error('Something went wrong. Please try again.')
  } finally {
    submitLoading.value = false
  }
}

const onSaveEditTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return

  const { success } = await onSaveCurrentTrial()
  if (!success) return
  isOpenEditTrial.value = false
  generateRatioScores()
}
</script>

<template>
  <div class="flex flex-col flex-grow min-h-full gap-2 pb-16">
    <!-- ratio boxes -->
    <div
      v-if="!is_collapsed"
      :id="`ta-ratio-${measurement.id}-${JSON.stringify(currentTrial)}`"
      class="flex flex-wrap items-center justify-center gap-1 pb-2"
    >
      <div
        v-for="target in ratioScores"
        :key="target.target_id"
        class="relative flex flex-col-reverse items-center w-10 h-10 overflow-hidden transition-all duration-300 border rounded"
        :class="{
          'border-slate-2 bg-slate-2':
            target.count <= 0 && target.target_id !== currentTrial.target_id,
          'border-prim-2 bg-prim-2':
            target.count >= 1 && target.target_id !== currentTrial.target_id,
          'border-light-purple-4 bg-prim-2': target.target_id === currentTrial.target_id
        }"
      >
        <div v-for="(ratio, idx) in target.ratios" :key="idx">
          <div
            v-if="ratio.prompt_id"
            class="relative w-10 bg-prim-4"
            :style="{
              height: 2.5 / target.max_ratio + 'rem'
            }"
          >
            <div
              v-if="ratio.target_problem_behavior_id"
              class="absolute top-0 right-0 z-10 h-full bg-tomato-6"
              :style="{ width: '0.3125rem' }"
            ></div>
          </div>
        </div>
        <div
          class="absolute left-0 top-1/2 w-full -translate-y-1/2 text-center text-[10px] font-bold"
          :class="{
            'text-slate-6': target.count === 0,
            'text-dark-purple-1': target.count > 0 || target.target_id === currentTrial.target_id
          }"
        >
          {{ isOpenTrialHistory ? `${target.average}%` : target.target_code }}
        </div>
      </div>
    </div>

    <!-- select a value for new or edit trial -->
    <div v-if="!isOpenTrialHistory || isOpenEditTrial" class="flex flex-col flex-grow">
      <!-- header information for active trial -->
      <div
        class="flex items-center justify-between shrink-0"
        :class="{
          'h-8': !is_collapsed,
          'h-6': is_collapsed
        }"
      >
        <div class="flex items-center gap-1">
          <div class="text-sm text-slate-7">Current</div>
          <div class="text-sm font-semibold text-light-purple-5">
            {{ currentTrialData.target.target_code }}
          </div>
          <div
            v-if="currentDisplay === 'select-next-task' && !isOpenEditTrial"
            class="text-sm font-semibold text-light-purple-5"
          >
            | {{ currentTrialData.average }}%
          </div>
          <AppButton
            v-if="
              currentDisplay === 'select-prompt' &&
              !currentTrial.prompt_id &&
              !isOpenEditTrial &&
              sessionStore.session?.status === 'ongoing'
            "
            kind="plain"
            size="sm"
            class="ml-2"
            @click="onUndoTrial"
          >
            Change
          </AppButton>
        </div>
        <div class="flex items-center gap-1">
          <div v-if="submitLoading">
            <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
          </div>
          <div class="text-sm text-slate-7">Trial</div>
          <div class="text-sm font-semibold text-light-purple-5">
            <span v-if="sessionStore.session?.status === 'completed'">
              {{ Math.max(0, Object.keys(resultsState).length - 1) }}
            </span>
            <span v-else>
              {{ currentTrial.key }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!isOpenProblemBehavior" class="flex flex-col justify-center flex-grow">
        <!-- select a prompt -->
        <div
          v-if="currentDisplay === 'select-prompt'"
          class="flex flex-col items-center content-center justify-center h-full gap-2"
        >
          <div
            :id="`ta-scroll-${measurement.id}`"
            class="flex w-full gap-4 pb-4 overflow-x-auto scrolling-touch max-w-72 snap-x snap-mandatory scroll-smooth"
            dir="ltr"
            @scroll="onScroll"
          >
            <div
              v-for="(promptBoxes, idx) in promptBoxesPages"
              :key="`${measurement.id}-ta-prompt-boxes-${idx + 1}`"
              :id="`${measurement.id}-ta-prompt-boxes-${idx + 1}`"
              class="flex justify-center w-full shrink-0 snap-center"
            >
              <div
                class="flex flex-wrap items-start content-center justify-center w-full gap-x-2 gap-y-3"
                :class="{ '-translate-y-1 scale-75': is_collapsed }"
              >
                <div v-for="(prompt, promptIdx) in promptBoxes" :key="promptIdx">
                  <div
                    class="relative flex h-[72px] w-[72px] shrink-0 cursor-pointer items-center justify-center rounded-3xl border transition-all duration-300 hover:brightness-95"
                    :class="{
                      'brightness-75 ': prompt.id === currentTrial.prompt_id,
                      'border ': prompt.id !== currentTrial.prompt_id
                    }"
                    :style="{
                      backgroundColor: promptColors[prompt.color || '']?.primaryColor,
                      borderColor: promptColors[prompt.color || '']?.secondaryColor
                    }"
                    @click="onChoosePrompt(prompt)"
                  >
                    <div
                      class="text-[2rem] font-bold"
                      :style="{ color: promptColors[prompt.color || '']?.textColor }"
                    >
                      {{ prompt.abbreviation }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pageCount > 1" class="flex items-center justify-center h-3 gap-2">
            <div
              v-for="(n, idx) in pageCount"
              :key="idx"
              :class="{
                'bg-slate-7': n === page,
                'bg-slate-4': n !== page
              }"
              class="w-3 h-3 transition-all duration-300 rounded-full"
            ></div>
          </div>
        </div>

        <!-- reselect task -->
        <div
          v-if="currentDisplay === 'reselect-task'"
          class="flex flex-col items-center content-center justify-center flex-grow"
          :class="{
            'gap-4': !is_collapsed,
            'gap-2': is_collapsed
          }"
        >
          <div class="flex flex-col items-center gap-1 px-2">
            <div v-if="!is_collapsed" class="text-sm text-center text-slate-8">Select a target</div>
            <div
              :class="{
                'scrollbar-lg max-w-[calc(100vw-6rem)] overflow-x-auto pb-2': is_collapsed
              }"
            >
              <div
                class="flex items-center gap-2"
                :class="{ 'flex-wrap justify-center': !is_collapsed }"
              >
                <AppButton
                  v-for="target in ratioScores"
                  :key="target.target_id"
                  :kind="target.target_id === nextTarget?.target_id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="nextTarget = target"
                >
                  {{ target.target_code }} | {{ target.count + 1 }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>

        <!-- select a next task -->
        <div
          v-if="currentDisplay === 'select-next-task'"
          class="flex flex-col items-center content-center justify-center flex-grow"
          :class="{
            'gap-4': !is_collapsed,
            'gap-2': is_collapsed
          }"
        >
          <div
            v-if="Object.keys(resultsState).length > 1 || currentTrial.prompt_id"
            class="flex items-center text-center"
            :class="{
              'flex-col gap-1': !is_collapsed,
              'flex-row gap-2': is_collapsed
            }"
          >
            <span class="text-sm font-semibold text-slate-7">
              {{ currentTrialData.prompt.name }}
            </span>
            <span
              class="text-light-purple-4"
              :class="{
                'text-5xl font-bold': !is_collapsed,
                'text-sm font-semibold': is_collapsed
              }"
            >
              {{ currentTrialData.prompt.score }}%
            </span>
            <AppButton
              v-if="!is_collapsed"
              kind="plain"
              size="sm"
              @click="currentDisplay = 'select-prompt'"
            >
              Change
            </AppButton>
          </div>
          <div class="flex flex-col items-center gap-1 px-2">
            <div v-if="!is_collapsed" class="text-sm text-center text-slate-8">Next</div>
            <div
              :class="{
                'scrollbar-lg max-w-[calc(100vw-6rem)] overflow-x-auto pb-2': is_collapsed
              }"
            >
              <div
                class="flex items-center gap-2"
                :class="{ 'flex-wrap justify-center': !is_collapsed }"
              >
                <AppButton
                  v-for="target in ratioScores"
                  :key="target.target_id"
                  :kind="target.target_id === nextTarget?.target_id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="nextTarget = target"
                >
                  {{ target.target_code }} | {{ target.count + 1 }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- select a problem behavior -->
      <div
        v-if="isOpenProblemBehavior"
        class="flex flex-col items-center content-center justify-center flex-grow w-full"
        :class="{
          'gap-2': !is_collapsed
        }"
      >
        <div
          class="flex flex-wrap items-start content-center justify-center w-full gap-x-2 gap-y-3"
          :class="{ '-translate-y-1 scale-75': is_collapsed }"
        >
          <div v-for="(problemBehavior, idx) in TAProblemBehaviors" :key="idx">
            <div
              class="relative flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0 rounded-3xl hover:brightness-90"
              :class="{
                'h-[72px] w-[72px]': !is_collapsed,
                'h-[64px] w-[64px]': is_collapsed,
                'bg-tomato-7': problemBehavior.id === currentTrial.target_problem_behavior_id,
                'bg-tomato-1': problemBehavior.id !== currentTrial.target_problem_behavior_id
              }"
              @click="onChooseProblemBehavior(problemBehavior)"
            >
              <span
                class="text-[2rem] font-bold"
                :class="{
                  'text-white': problemBehavior.id === currentTrial.target_problem_behavior_id,
                  'text-tomato-7': problemBehavior.id !== currentTrial.target_problem_behavior_id
                }"
              >
                {{ problemBehavior.code }}
              </span>
            </div>
          </div>
        </div>
        <div class="text-sm text-slate-8">
          {{ currentTrialData.problem_behavior.code_definition }}
        </div>
      </div>
    </div>

    <!-- view trial history -->
    <div v-if="isOpenTrialHistory && !isOpenEditTrial" class="flex flex-col">
      <div v-for="key in Object.keys(resultsState)" :key="key">
        <div
          v-if="resultsState[key].prompt_id"
          class="flex items-center justify-between px-2 py-3 border-b border-slate-3"
        >
          <div class="flex items-center gap-2">
            <div class="w-6 text-sm shrink-0 text-slate-8">{{ key }}.</div>
            <div class="font-semibold tex-sm text-slate-7">
              {{ getCode(resultsState[key].target_id, 'target') }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div
              v-if="resultsState[key].target_problem_behavior_id"
              class="flex items-center justify-center w-6 h-6 rounded bg-tomato-7"
            >
              <span class="text-sm font-semibold text-white">
                {{ getCode(resultsState[key].target_problem_behavior_id, 'problem_behavior') }}
              </span>
            </div>
            <div
              class="flex items-center justify-center w-6 h-6 rounded"
              :style="{
                backgroundColor: promptColors[getColor(resultsState[key].prompt_id)].primaryColor,
                borderColor: promptColors[getColor(resultsState[key].prompt_id)].secondaryColor,
                color: promptColors[getColor(resultsState[key].prompt_id)].textColor
              }"
            >
              <span class="text-sm font-semibold">
                {{ getCode(resultsState[key].prompt_id, 'prompt') }}
              </span>
            </div>

            <div v-if="submitLoading">
              <Icon
                icon="mingcute:loading-fill"
                class="text-2xl animate-spin text-light-purple-5"
              />
            </div>
            <div
              v-else-if="deleteTrialKey === key && sessionStore.session?.status !== 'completed'"
              class="flex items-center gap-2"
            >
              <Icon icon="ph:check-bold" class="text-grass-6" @click="onDeleteTrial" />
              <Icon icon="ph:x-bold" class="text-tomato-7" @click="deleteTrialKey = null" />
            </div>
            <div
              v-else-if="sessionStore.session?.status !== 'completed'"
              class="flex items-center gap-2"
            >
              <Icon icon="ph:pencil-simple" class="text-slate-8" @click="onOpenEditTrial(key)" />
              <Icon
                v-if="Object.values(resultsState).filter((i: any) => i.target_id).length > 1"
                icon="ph:trash"
                class="text-tomato-7"
                @click="deleteTrialKey = key"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="Object.values(resultsState).filter((i: any) => i.prompt_id).length === 0"
        class="py-4 text-sm text-center text-slate-8"
      >
        No result recorded yet.
      </div>
    </div>

    <div
      v-if="
        !is_collapsed || currentDisplay === 'select-next-task' || currentDisplay === 'reselect-task'
      "
      class="absolute bottom-0 flex h-16 w-[calc(100%-2rem)] items-center bg-white"
    >
      <div v-if="isOpenProblemBehavior" class="flex-grow">
        <AppButton
          kind="outline"
          class="w-full"
          :size="is_collapsed ? 'sm' : 'base'"
          :disabled="submitLoading"
          @click="isOpenProblemBehavior = false"
        >
          Back to result
        </AppButton>
      </div>
      <div v-else-if="isOpenTrialHistory && !isOpenEditTrial" class="flex-grow">
        <AppButton
          kind="outline"
          class="w-full"
          :size="is_collapsed ? 'sm' : 'base'"
          :disabled="submitLoading"
          @click="onCloseTrialHistory"
        >
          Back
        </AppButton>
      </div>
      <div
        v-else-if="
          nextTarget?.target_code && currentDisplay === 'reselect-task' && !isOpenEditTrial
        "
        class="flex-grow"
      >
        <AppButton
          class="w-full"
          :loading="submitLoading"
          @click="onTakeNextTrial({ isNew: false })"
        >
          <span v-if="Object.keys(resultsState).length > 1 || currentTrial.prompt_id">
            Next: {{ nextTarget?.target_code }} | {{ nextTarget?.count + 1 }}
          </span>
          <span v-else> Start trial: {{ nextTarget?.target_code }} </span>
        </AppButton>
      </div>
      <div v-else class="flex items-center justify-between w-full gap-3 shrink-0">
        <AppButton
          v-if="!isOpenEditTrial && !is_collapsed"
          kind="outline"
          class="shrink-0"
          :disabled="submitLoading"
          @click="onOpenTrialHistory"
        >
          <Icon icon="material-symbols:menu-rounded" class="text-xl" />
        </AppButton>
        <AppButton
          v-if="isOpenEditTrial && !is_collapsed"
          kind="outline"
          class="shrink-0"
          :disabled="submitLoading"
          @click="onCloseEditTrial"
        >
          <Icon icon="material-symbols:menu-rounded" class="text-xl" />
        </AppButton>

        <div
          v-if="
            nextTarget?.target_code && currentDisplay === 'select-next-task' && !isOpenEditTrial
          "
          class="flex-grow"
        >
          <AppButton
            class="w-full"
            :loading="submitLoading"
            @click="onTakeNextTrial({ isNew: true })"
          >
            Next: {{ nextTarget?.target_code }} | {{ nextTarget?.count + 1 }}
          </AppButton>
        </div>
        <div v-if="isOpenEditTrial" class="flex-grow">
          <AppButton class="w-full" :loading="submitLoading" @click="onSaveEditTrial">
            Update
          </AppButton>
        </div>
        <div
          v-if="
            target.enable_problem_behavior &&
            (Object.keys(resultsState).length > 1 || currentTrial.prompt_id)
          "
          class="flex items-center justify-center w-10 h-10 transition-all duration-300 rounded cursor-pointer hover:brightness-90"
          :class="{
            'bg-tomato-2': !currentTrial.target_problem_behavior_id,
            'bg-tomato-7': currentTrial.target_problem_behavior_id
          }"
          @click="isOpenProblemBehavior = true"
        >
          <span
            class="text-sm font-semibold"
            :class="{
              'text-tomato-7': !currentTrial.target_problem_behavior_id,
              'text-white': currentTrial.target_problem_behavior_id
            }"
          >
            {{ currentTrialData.problem_behavior.code }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
