<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { useAppStore } from '@/stores/app.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Measurement, Prompt, Target, TargetProblemBehavior, TargetTask } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import AppButton from '@/components/AppButton.vue'
import { getTargetTasks } from '@/lib/func'

const sessionStore = useSessionStore()
const appStore = useAppStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  target: Target
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'toggle-saved', bool: boolean): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

interface Trial {
  key: string | number
  target_task_id?: TargetTask['id']
  prompt_id?: Prompt['id']
  target_problem_behavior_id?: TargetProblemBehavior['id'] | null
}

const isSaved = ref<boolean>(true)
const page = ref<number>(1)
const submitLoading = ref<boolean>(false)

watch(
  () => submitLoading.value,
  (val) => {
    if (!val) {
      emit('toggle-updated', true)
    } else {
      emit('toggle-updated', false)
    }
  }
)

const activeDisplay = ref<'select-prompt' | 'select-next-task' | 'reselect-task'>('select-prompt')
const editDisplay = ref<'select-prompt' | 'select-next-task' | 'reselect-task'>('select-prompt')

const activeTrial = ref<Trial>({
  key: 0,
  target_task_id: 0,
  prompt_id: 0,
  target_problem_behavior_id: null
})
const editTrial = ref<Trial>({
  key: 0,
  target_task_id: 0,
  prompt_id: 0,
  target_problem_behavior_id: null
})

const nextTask = ref<any>()
const deleteTrialKey = ref<null | Trial['key']>(null)

const ratioScores = ref<any[]>([])
const resultsState = ref<Measurement['results']>({})

const isOpenProblemBehavior = ref<boolean>(false)
const isOpenTrialHistory = ref<boolean>(false)
const isOpenEditTrial = ref<boolean>(false)

// state prompts task_codes problem_behaviors from measurement.target
const SBTPrompts = ref<Prompt[]>([])
const SBTTaskCodes = ref<TargetTask[]>([])
const SBTProblemBehaviors = ref<TargetProblemBehavior[]>([])

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

const perPage = computed<number>(() => (props.isCollapsed ? 3 : 9))
const pageCount = computed<number>(() => {
  const prompts = [...SBTPrompts.value]
  const boxes = prompts.length
  return Math.ceil(boxes / perPage.value)
})
const promptBoxesPages = computed<Prompt[][]>(() => {
  const prompts = [...SBTPrompts.value]
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

const collapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
watch(
  () => props.isCollapsed,
  () => {
    collapseTimeout.value = setTimeout(() => {
      const el = `${props.measurement.id}-sbt-prompt-boxes-${1}`
      const boxes = document.getElementById(el)
      boxes?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 300)

    return () => {
      if (collapseTimeout.value) {
        clearTimeout(collapseTimeout.value)
        collapseTimeout.value = undefined
      }
    }
  }
)

watch(
  () => props.measurementResults,
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
const idleTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const resetIdleTimer = () => {
  if (idleTimeout.value) {
    clearTimeout(idleTimeout.value)
    idleTimeout.value = undefined
  }

  if (sessionStore.session?.status !== 'ongoing') return

  // Auto-save setelah 5 detik idle
  idleTimeout.value = setTimeout(() => {
    if (!isSaved.value && currentTrial.value.prompt_id && !isOpenEditTrial.value) {
      console.log('[Component] Auto-saving due to idle')
      onSaveCurrentTrial()
    }
  }, 5000)

  return () => {
    if (idleTimeout.value) {
      clearTimeout(idleTimeout.value)
      idleTimeout.value = undefined
    }
  }
}

onMounted(async () => {
  const prompts = props.target?.prompts || []
  const tasks = getTargetTasks(props.target)
  const problems = props.target?.target_problem_behaviors || []
  SBTPrompts.value = prompts.sort((a, b) => (b?.score || 0) - (a?.score || 0))
  SBTTaskCodes.value = tasks.sort((a, b) => (a?.position || 0) - (b?.position || 0))
  SBTProblemBehaviors.value = problems.sort((a, b) => (a?.position || 0) - (b?.position || 0))

  const currentResults = props.measurementResults || {}

  generateRatioScores()

  const results = Object.keys(currentResults).map((key) => ({
    ...currentResults[key],
    key
  }))

  if (results.length) {
    const length = results.length
    const lastTrial = results[length - 1]

    if (!lastTrial.prompt_id) {
      currentTrial.value = lastTrial
    } else {
      const index = SBTTaskCodes.value.findIndex((i) => i.id === lastTrial.target_task_id)
      let nextTaskId: number | undefined = 0
      if (index > -1 && index + 1 <= SBTTaskCodes.value.length - 1) {
        nextTaskId = SBTTaskCodes.value[index + 1].id
      } else if (SBTTaskCodes.value.length) {
        nextTaskId = SBTTaskCodes.value[0].id
      }
      const newTrial: Trial = {
        key: Number(lastTrial.key) + 1,
        target_task_id: nextTaskId,
        prompt_id: 0,
        target_problem_behavior_id: null
      }
      currentResults[newTrial.key] = {
        key: newTrial.key,
        target_task_id: newTrial.target_task_id,
        prompt_id: newTrial.prompt_id,
        target_problem_behavior_id: newTrial.target_problem_behavior_id
      }
      currentTrial.value = newTrial
    }
  } else {
    const newTrial: Trial = {
      key: 1,
      target_task_id: 0,
      prompt_id: 0,
      target_problem_behavior_id: null
    }
    if (SBTTaskCodes.value.length) {
      newTrial.target_task_id = SBTTaskCodes.value[0].id
    }
    currentResults[newTrial.key] = {
      key: newTrial.key,
      target_task_id: newTrial.target_task_id,
      prompt_id: newTrial.prompt_id,
      target_problem_behavior_id: newTrial.target_problem_behavior_id
    }
    currentTrial.value = newTrial
  }

  resultsState.value = currentResults
})

// Cleanup saat unmount
onUnmounted(() => {
  // Clear timeout to prevent memory leaks
  if (collapseTimeout.value) {
    clearTimeout(collapseTimeout.value)
    collapseTimeout.value = undefined
  }
  if (idleTimeout.value) {
    clearTimeout(idleTimeout.value)
    idleTimeout.value = undefined
  }

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

const getCode = (id: number, data: 'task_code' | 'prompt' | 'problem_behavior') => {
  if (data === 'task_code') {
    const found = SBTTaskCodes.value.find((i) => i.id === id)
    return found ? found.code : ''
  }
  if (data === 'prompt') {
    const found = SBTPrompts.value.find((i) => i.id === id)
    return found ? found.abbreviation : ''
  }
  if (data === 'problem_behavior') {
    const found = SBTProblemBehaviors.value.find((i) => i.id === id)
    return found ? found.code : ''
  }
  return '-'
}

const getTrial = (trial: Trial) => {
  const defaultTaskCode = SBTTaskCodes.value.length ? SBTTaskCodes.value[0] : { code: '' }
  const taskCode = SBTTaskCodes.value.find((i) => i.id === trial.target_task_id) || defaultTaskCode
  const prompt = SBTPrompts.value.find((i) => i.id === trial.prompt_id) || {
    name: '',
    score: ''
  }
  const problemBehavior = SBTProblemBehaviors.value.find(
    (i) => i.id === trial.target_problem_behavior_id
  ) || { code: 'R', code_definition: '' }

  let average = 0
  const ratioScore = ratioScores.value.find((i) => i.id === trial.target_task_id)
  if (ratioScore) {
    average = ratioScore.average
  }
  return {
    ...trial,
    task_code: taskCode,
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

  const currentResults = resultsState.value || {}

  let maxRatio = 0
  const results = Object.keys(currentResults).map((key) => ({
    ...currentResults[key],
    key
  }))

  const taskCodes = [...SBTTaskCodes.value].map((i) => {
    const ratios = results.filter((r) => r.target_task_id === i.id)
    const listOfScore: number[] = ratios
      .map((r) => {
        const prompt = SBTPrompts.value.find((p) => p.id === r.prompt_id)
        return prompt ? prompt?.score || 0 : -1
      })
      .filter((r) => r !== -1)
    const sum = listOfScore.reduce((sum, i) => (sum += i), 0)
    const average = Math.round(sum / listOfScore.length || 0)

    if (listOfScore.length > maxRatio) maxRatio = listOfScore.length
    return { ...i, sum, average, count: listOfScore.length, ratios }
  })

  const assignedMaxRatio = taskCodes.map((i) => {
    return { ...i, max_ratio: maxRatio }
  })
  ratioScores.value = [...assignedMaxRatio]
}

const onOpenTrialHistory = async () => {
  isOpenTrialHistory.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_open_trials`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onOpenProblemBehavior = async () => {
  isOpenProblemBehavior.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_open_pb`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onCloseTrialHistory = () => {
  isOpenTrialHistory.value = false
  deleteTrialKey.value = null

  setTheLastTrial()
}

const setTheLastTrial = () => {
  const data = resultsState.value
  if (activeDisplay.value === 'select-prompt') {
    const filtered = Object.values(data).filter((i: any) => i.prompt_id && i.target_task_id)
    const newKey = filtered.length + 1
    currentTrial.value = {
      key: newKey,
      target_task_id: currentTrial.value.target_task_id,
      prompt_id: currentTrial.value.prompt_id,
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
    .filter((i) => Number(i.prompt_id) && Number(i.target_task_id))
    .map((i, idx) => ({
      key: idx + 1,
      prompt_id: i.prompt_id,
      target_task_id: i.target_task_id,
      target_problem_behavior_id: i.target_problem_behavior_id
    }))

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
    prompt_id: prompt.id
  }

  // Simpan state sebelumnya untuk rollback
  const previousTrial = { ...currentTrial.value }

  isSaved.value = false
  currentTrial.value = newTrial

  // Reset idle timer
  resetIdleTimer()

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_select_prompt`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: { [newTrial.key]: newTrial } } },
    notes: `Target: ${props.measurement.target?.name} [${newTrial.key}: ${prompt.id} ${prompt.abbreviation}]`,
    timestamp: new Date().toISOString()
  })

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

  const index = ratioScores.value.findIndex((i) => i.id === newTrial.target_task_id)
  if (index > -1 && index + 1 <= ratioScores.value.length - 1) {
    nextTask.value = ratioScores.value[index + 1]
  } else {
    nextTask.value = ratioScores.value[0]
  }
  currentDisplay.value = 'select-next-task'
}

const onChooseProblemBehavior = async (problemBehavior: TargetProblemBehavior) => {
  if (sessionStore.session?.status !== 'ongoing') return

  // Prevent multiple submissions
  if (submitLoading.value) {
    toast.warning('Saving data, please wait...')
    return
  }

  let newId: Trial['target_problem_behavior_id'] = problemBehavior.id
  let newCode: TargetProblemBehavior['code_definition'] = problemBehavior.code_definition
  if (currentTrial.value.target_problem_behavior_id === newId) {
    newId = null
    newCode = ''
  }

  const newTrial: Trial = {
    ...currentTrial.value,
    target_problem_behavior_id: newId
  }

  isSaved.value = false
  currentTrial.value = newTrial

  // Reset idle timer
  resetIdleTimer()

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_select_pb`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: { [newTrial.key]: newTrial } } },
    notes: `Target: ${props.measurement.target?.name} [${newTrial.key}: ${newId} ${newCode}]`,
    timestamp: new Date().toISOString()
  })

  if (isOpenEditTrial.value) {
    return
  }

  const { success } = await onSaveCurrentTrial()
  if (!success) return
}

const onChooseTask = async (taskCode: any) => {
  nextTask.value = taskCode

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_select_task`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name} [${taskCode.code}]`,
    timestamp: new Date().toISOString()
  })
}

const onUndoTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  const results = Object.keys(resultsState.value).map((key) => ({
    ...resultsState.value[key],
    key
  }))

  let newTrial: Trial = {
    key: 1,
    target_task_id: 0,
    prompt_id: 0,
    target_problem_behavior_id: null
  }
  if (results.length) {
    newTrial = {
      ...results[results.length - 1],
      key: results.length
    }
  }
  currentTrial.value = newTrial

  const index = ratioScores.value.findIndex((i) => i.id === newTrial.target_task_id)
  nextTask.value = ratioScores.value[index]
  currentDisplay.value = 'reselect-task'

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_change_task`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onChangeForChoosePrompt = async () => {
  currentDisplay.value = 'select-prompt'

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_change_prompt`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onTakeNextTrial = async (payload: { isNew: boolean }) => {
  if (sessionStore.session?.status !== 'ongoing') return
  const newKey = payload.isNew ? Number(currentTrial.value.key) + 1 : currentTrial.value.key
  const newTrial: Trial = {
    key: newKey,
    target_task_id: nextTask.value?.id,
    prompt_id: 0,
    target_problem_behavior_id: null
  }
  resultsState.value[newTrial.key] = {
    key: newTrial.key,
    target_task_id: newTrial.target_task_id,
    prompt_id: newTrial.prompt_id,
    target_problem_behavior_id: newTrial.target_problem_behavior_id
  }
  currentDisplay.value = 'select-prompt'
  currentTrial.value = newTrial
  nextTask.value = {}
  generateRatioScores()

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_next_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name} [${newTrial.target_task_id}]`,
    timestamp: new Date().toISOString()
  })
}

const onOpenEditTrial = async (key: Trial['key']) => {
  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })
  const index = results.findIndex((i) => Number(i.key) === Number(key))

  if (index > -1) {
    isOpenEditTrial.value = true
    currentTrial.value = results[index]
    currentDisplay.value = 'select-prompt'

    isSaved.value = false

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `sbt_open_edit_trial`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      notes: `Target: ${props.measurement.target?.name}`,
      timestamp: new Date().toISOString()
    })
  }
}

const onCloseEditTrial = () => {
  isSaved.value = true
  isOpenEditTrial.value = false
}

const onOpenDeleteTrial = async (key: Trial['key']) => {
  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })
  const index = results.findIndex((i) => Number(i.key) === Number(key))

  if (index > -1) {
    deleteTrialKey.value = key

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `sbt_open_delete_trial`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      notes: `Target: ${props.measurement.target?.name}`,
      timestamp: new Date().toISOString()
    })
  }
}

const onCancelDeleteTrial = async () => {
  deleteTrialKey.value = null

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_cancel_delete_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
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
    .filter((i) => Number(i.prompt_id) && Number(i.target_task_id))
    .map((i, idx) => ({
      key: idx + 1,
      prompt_id: i.prompt_id,
      target_task_id: i.target_task_id,
      target_problem_behavior_id: i.target_problem_behavior_id
    }))

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

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_delete_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name} [${key}]`,
    timestamp: new Date().toISOString()
  })

  try {
    const { success, message, data } = await sessionStore.updateMeasurementResults(params)

    if (!success) {
      resultsState.value = previousResults
      toast.error(message || 'Failed to delete trial')
      return
    }

    isSaved.value = true
    resultsState.value = data.results
    deleteTrialKey.value = null

    if (data._pendingSync) {
      toast.info('Deleted offline, will sync automatically')
    } else {
      toast.success('Trial deleted')
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

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `sbt_update_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: { [currentTrial.value.key]: currentTrial.value } } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success } = await onSaveCurrentTrial()
  if (!success) return
  isOpenEditTrial.value = false
  generateRatioScores()
}
</script>

<template>
  <div class="flex flex-col flex-grow gap-2 pb-16 min-h-full">
    <!-- ratio boxes -->
    <div
      v-if="!isCollapsed"
      :id="`sbt-ratio-${measurement.id}-${JSON.stringify(currentTrial)}`"
      class="flex flex-wrap gap-1 justify-center items-center pb-2"
    >
      <div
        v-for="taskCode in ratioScores"
        :key="taskCode.id"
        class="flex overflow-hidden relative flex-col-reverse items-center w-10 h-10 rounded border transition-colors duration-300"
        :class="{
          'border-slate-2 bg-slate-2':
            taskCode.count <= 0 && taskCode.id !== currentTrial.target_task_id,
          'border-teal-1 bg-teal-1':
            taskCode.count >= 1 && taskCode.id !== currentTrial.target_task_id,
          'border-teal-7 bg-teal-1': taskCode.id === currentTrial.target_task_id
        }"
      >
        <div v-for="(ratio, idx) in taskCode.ratios" :key="idx">
          <div
            v-if="ratio.prompt_id"
            class="relative w-10 bg-teal-3"
            :style="{
              height: 2.5 / taskCode.max_ratio + 'rem'
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
            'text-slate-6': taskCode.count === 0,
            'text-teal-7': taskCode.count > 0 || taskCode.id === currentTrial.target_task_id
          }"
        >
          {{ isOpenTrialHistory ? `${taskCode.average}%` : taskCode.code }}
        </div>
      </div>
    </div>

    <!-- select a value for new or edit trial -->
    <div v-if="!isOpenTrialHistory || isOpenEditTrial" class="flex flex-col flex-grow">
      <!-- header information for active trial -->
      <div
        class="flex justify-between items-center shrink-0"
        :class="{
          'h-8': !isCollapsed,
          'h-6': isCollapsed
        }"
      >
        <div class="flex gap-1 items-center">
          <div class="text-sm text-slate-7">Current</div>
          <div class="text-sm font-semibold text-teal-8">
            {{ currentTrialData.task_code.code }}
          </div>
          <div
            v-if="currentDisplay === 'select-next-task' && !isOpenEditTrial"
            class="text-sm font-semibold text-teal-8"
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
            color="teal"
            size="sm"
            class="ml-2"
            @click="onUndoTrial"
          >
            Change
          </AppButton>
        </div>
        <div class="flex gap-1 items-center">
          <div v-if="submitLoading">
            <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
          </div>
          <div class="text-sm text-slate-7">Trial</div>
          <div class="text-sm font-semibold text-teal-8">
            <span v-if="sessionStore.session?.status === 'completed'">
              {{ Math.max(0, Object.keys(resultsState).length - 1) }}
            </span>
            <span v-else>
              {{ currentTrial.key }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!isOpenProblemBehavior" class="flex flex-col flex-grow justify-center">
        <!-- select a prompt -->
        <div
          v-if="currentDisplay === 'select-prompt'"
          class="flex flex-col gap-2 justify-center content-center items-center h-full"
        >
          <div
            :id="`sbt-scroll-${measurement.id}`"
            class="flex overflow-x-auto gap-4 pb-4 w-full scrolling-touch max-w-72 snap-x snap-mandatory scroll-smooth"
            dir="ltr"
            @scroll="onScroll"
          >
            <div
              v-for="(promptBoxes, idx) in promptBoxesPages"
              :key="`${measurement.id}-sbt-prompt-boxes-${idx + 1}`"
              :id="`${measurement.id}-sbt-prompt-boxes-${idx + 1}`"
              class="flex justify-center w-full shrink-0 snap-center"
            >
              <div
                class="flex flex-wrap gap-x-2 gap-y-3 justify-center content-center items-start w-full"
                :class="{ '-translate-y-1 scale-75': isCollapsed }"
              >
                <div v-for="(prompt, promptIdx) in promptBoxes" :key="promptIdx">
                  <div
                    class="relative flex h-[72px] w-[72px] shrink-0 cursor-pointer items-center justify-center rounded-3xl transition-colors duration-300 hover:brightness-95"
                    :class="{
                      'bg-teal-7': prompt.id === currentTrial.prompt_id,
                      'bg-teal-1': prompt.id !== currentTrial.prompt_id
                    }"
                    @click="onChoosePrompt(prompt)"
                  >
                    <div
                      class="text-[2rem] font-bold"
                      :class="{
                        'text-white': prompt.id === currentTrial.prompt_id,
                        'text-teal-7': prompt.id !== currentTrial.prompt_id
                      }"
                    >
                      {{ prompt.abbreviation }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pageCount > 1" class="flex gap-2 justify-center items-center h-3">
            <div
              v-for="(n, idx) in pageCount"
              :key="idx"
              :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
              class="w-3 h-3 rounded-full transition-colors"
            ></div>
          </div>
        </div>

        <!-- reselect task -->
        <div
          v-if="currentDisplay === 'reselect-task'"
          class="flex flex-col flex-grow justify-center content-center items-center"
          :class="{
            'gap-4': !isCollapsed,
            'gap-2': isCollapsed
          }"
        >
          <div class="flex flex-col gap-1 items-center px-2">
            <div v-if="!isCollapsed" class="text-sm text-center text-slate-8">Select a task</div>
            <div
              :class="{
                'scrollbar-lg max-w-[calc(100vw-6rem)] overflow-x-auto pb-2': isCollapsed
              }"
            >
              <div
                class="flex gap-2 items-center"
                :class="{ 'flex-wrap justify-center': !isCollapsed }"
              >
                <AppButton
                  v-for="taskCode in ratioScores"
                  :key="taskCode.id"
                  color="teal"
                  :kind="taskCode.id === nextTask?.id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="onChooseTask(taskCode)"
                >
                  {{ taskCode.code }} | {{ taskCode.count + 1 }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>

        <!-- select a next task -->
        <div
          v-if="currentDisplay === 'select-next-task'"
          class="flex flex-col flex-grow justify-center content-center items-center"
          :class="{
            'gap-4': !isCollapsed,
            'gap-2': isCollapsed
          }"
        >
          <div
            v-if="Object.keys(resultsState).length > 1 || currentTrial.prompt_id"
            class="flex items-center text-center"
            :class="{
              'flex-col gap-1': !isCollapsed,
              'flex-row gap-2': isCollapsed
            }"
          >
            <span class="text-sm font-semibold text-slate-7">
              {{ currentTrialData.prompt.name }}
            </span>
            <span
              class="text-teal-7"
              :class="{
                'text-5xl font-bold': !isCollapsed,
                'text-sm font-semibold': isCollapsed
              }"
            >
              {{ currentTrialData.prompt.score }}%
            </span>
            <AppButton v-if="!isCollapsed" kind="plain" size="sm" @click="onChangeForChoosePrompt">
              Change
            </AppButton>
          </div>
          <div class="flex flex-col gap-1 items-center px-2">
            <div v-if="!isCollapsed" class="text-sm text-center text-slate-8">Next</div>
            <div
              :class="{
                'scrollbar-lg max-w-[calc(100vw-6rem)] overflow-x-auto pb-2': isCollapsed
              }"
            >
              <div
                class="flex gap-2 items-center"
                :class="{ 'flex-wrap justify-center': !isCollapsed }"
              >
                <AppButton
                  v-for="taskCode in ratioScores"
                  :key="taskCode.id"
                  color="teal"
                  :kind="taskCode.id === nextTask?.id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="onChooseTask(taskCode)"
                >
                  {{ taskCode.code }} | {{ taskCode.count + 1 }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- select a problem behavior -->
      <div
        v-if="isOpenProblemBehavior"
        class="flex flex-col flex-grow justify-center content-center items-center w-full"
        :class="{
          'gap-2': !isCollapsed
        }"
      >
        <div
          class="flex flex-wrap gap-x-2 gap-y-3 justify-center content-center items-start w-full"
          :class="{ '-translate-y-1 scale-75': isCollapsed }"
        >
          <div v-for="(problemBehavior, idx) in SBTProblemBehaviors" :key="idx">
            <div
              class="flex relative justify-center items-center rounded-3xl transition-colors duration-300 cursor-pointer shrink-0 hover:brightness-90"
              :class="{
                'h-[72px] w-[72px]': !isCollapsed,
                'h-[64px] w-[64px]': isCollapsed,
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
          class="flex justify-between items-center px-2 py-3 border-b border-slate-3"
        >
          <div class="flex gap-2 items-center">
            <div class="w-6 text-sm shrink-0 text-slate-8">{{ key }}.</div>
            <div class="font-semibold tex-sm text-slate-7">
              {{ getCode(resultsState[key].target_task_id, 'task_code') }}
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <div
              v-if="resultsState[key].target_problem_behavior_id"
              class="flex justify-center items-center w-6 h-6 rounded bg-tomato-7"
            >
              <span class="text-sm font-semibold text-white">
                {{ getCode(resultsState[key].target_problem_behavior_id, 'problem_behavior') }}
              </span>
            </div>
            <div class="flex justify-center items-center w-6 h-6 rounded bg-teal-7">
              <span class="text-sm font-semibold text-white">
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
              class="flex gap-2 items-center"
            >
              <Icon icon="ph:check-bold" class="text-grass-6" @click="onDeleteTrial" />
              <Icon icon="ph:x-bold" class="text-tomato-7" @click="onCancelDeleteTrial" />
            </div>
            <div
              v-else-if="sessionStore.session?.status !== 'completed'"
              class="flex gap-2 items-center"
            >
              <Icon icon="ph:pencil-simple" class="text-slate-8" @click="onOpenEditTrial(key)" />
              <Icon
                v-if="Object.values(resultsState).filter((i: any) => i.target_task_id).length > 1"
                icon="ph:trash"
                class="text-tomato-7"
                @click="onOpenDeleteTrial(key)"
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
        !isCollapsed || currentDisplay === 'select-next-task' || currentDisplay === 'reselect-task'
      "
      class="absolute bottom-0 flex h-16 w-[calc(100%-2rem)] items-center bg-white"
    >
      <div v-if="isOpenProblemBehavior" class="flex-grow">
        <AppButton
          kind="outline"
          class="w-full"
          :size="isCollapsed ? 'sm' : 'base'"
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
          :size="isCollapsed ? 'sm' : 'base'"
          :disabled="submitLoading"
          @click="onCloseTrialHistory"
        >
          Back
        </AppButton>
      </div>
      <div
        v-else-if="nextTask?.code && currentDisplay === 'reselect-task' && !isOpenEditTrial"
        class="flex-grow"
      >
        <AppButton
          color="teal"
          class="w-full"
          :loading="submitLoading"
          @click="onTakeNextTrial({ isNew: false })"
        >
          <span v-if="Object.keys(resultsState).length > 1 || currentTrial.prompt_id">
            Next: {{ nextTask?.code }} | {{ nextTask?.count + 1 }}
          </span>
          <span v-else> Start trial: {{ nextTask?.code }} </span>
        </AppButton>
      </div>
      <div v-else class="flex gap-3 justify-between items-center w-full shrink-0">
        <AppButton
          v-if="!isOpenEditTrial && !isCollapsed"
          kind="outline"
          class="shrink-0"
          :disabled="submitLoading"
          @click="onOpenTrialHistory"
        >
          <Icon icon="material-symbols:menu-rounded" class="text-xl" />
        </AppButton>
        <AppButton
          v-if="isOpenEditTrial && !isCollapsed"
          kind="outline"
          class="shrink-0"
          :disabled="submitLoading"
          @click="onCloseEditTrial"
        >
          <Icon icon="material-symbols:menu-rounded" class="text-xl" />
        </AppButton>

        <div
          v-if="nextTask?.code && currentDisplay === 'select-next-task' && !isOpenEditTrial"
          class="flex-grow"
        >
          <AppButton
            color="teal"
            class="w-full"
            :loading="submitLoading"
            @click="onTakeNextTrial({ isNew: true })"
          >
            Next: {{ nextTask?.code }} | {{ nextTask?.count + 1 }}
          </AppButton>
        </div>
        <div v-if="isOpenEditTrial" class="flex-grow">
          <AppButton color="teal" class="w-full" :loading="submitLoading" @click="onSaveEditTrial">
            Update
          </AppButton>
        </div>
        <div
          v-if="
            target.enable_problem_behavior &&
            (Object.keys(resultsState).length > 1 || currentTrial.prompt_id)
          "
          class="flex justify-center items-center w-10 h-10 rounded transition-colors duration-300 cursor-pointer hover:brightness-90"
          :class="{
            'bg-tomato-2': !currentTrial.target_problem_behavior_id,
            'bg-tomato-7': currentTrial.target_problem_behavior_id
          }"
          @click="onOpenProblemBehavior"
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
