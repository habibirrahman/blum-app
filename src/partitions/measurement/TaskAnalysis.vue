<script setup lang="ts">
import {
  useSessionStore,
  type NewTrialTaskAnalysisParams,
  type UpdateTrialTaskAnalysisParams
} from '@/stores/session.store'
import { useAppStore } from '@/stores/app.store'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  Measurement,
  Prompt,
  Target,
  TargetProblemBehavior,
  MeasurementTrialTaskAnalysis
} from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import AppButton from '@/components/AppButton.vue'
import { promptColors } from '@/lib/data'

interface Props {
  measurement: Measurement
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

const sessionStore = useSessionStore()
const appStore = useAppStore()
const toast = useToast()

/** === DATA === */

interface MeasurementTrialModel extends MeasurementTrialTaskAnalysis {
  target?: Target
  prompt?: Prompt
  problemBehavior?: TargetProblemBehavior
  average?: string
}

interface TrialScoreModel extends Target {
  sum: number
  average: string
  count: number
  maxCount?: number
  trials: MeasurementTrialModel[]
}

const page = ref<number>(1)
const trialsState = ref<MeasurementTrialModel[]>([])

const isSaved = ref<boolean>(true)
const submitLoading = ref<boolean>(false)
const isOpenProblemBehavior = ref<boolean>(false)
const isOpenTrialHistory = ref<boolean>(false)
const isOpenEditTrial = ref<boolean>(false)

const activeDisplay = ref<'select-prompt' | 'select-next-trial' | 'reselect-trial'>('select-prompt')
const editDisplay = ref<'select-prompt' | 'select-next-trial' | 'reselect-trial'>('select-prompt')

const trialScoreContainer = ref(null)

const nextTrial = ref<TrialScoreModel | null>(null)

const activeTrial = ref<MeasurementTrialTaskAnalysis | null>(null)
const editTrial = ref<MeasurementTrialTaskAnalysis | null>(null)

const deleteTrialUid = ref<string | null>(null)
const deleteTrialUidLoading = ref<string | null>(null)

/** === COMPUTEDS === */

const targetPrompts = computed(() => {
  const ps = props.target?.prompts || []
  const format = props.target?.prompting_format
  return [...ps]
    .map((i) => {
      if (format === 'classic') {
        const score = i?.name.toLocaleLowerCase() === 'independent' ? 100 : 0
        return { ...i, score }
      }
      return i
    })
    .sort((a, b) => a.position - b.position)
    .sort((a, b) => {
      if (format === 'custom') {
        if (a.is_default && a?.name?.toLocaleLowerCase() === 'independent') return -1
        if (b.is_default && b?.name?.toLocaleLowerCase() === 'independent') return 1
        if (a.is_default && a?.name?.toLocaleLowerCase() === 'incorrect') return 1
        if (b.is_default && b?.name?.toLocaleLowerCase() === 'incorrect') return -1
        return b.score - a.score
      }
      return 0
    })
})

const targetMembers = computed(() => {
  const uts = props.measurement.used_targets || []
  const tms = props.target?.members || []
  return [...tms].filter((tm) => uts.some((ut) => ut.target_id === tm.id))
})

const problemBehaviors = computed(() => {
  const pbs = props.target?.target_problem_behaviors || []
  return [...pbs].sort((a, b) => a.position - b.position)
})

const enableProblemBehavior = computed(() => {
  return props.target?.enable_problem_behavior && problemBehaviors.value.length
})

const currentDisplay = computed({
  get: () => (isOpenEditTrial.value ? editDisplay.value : activeDisplay.value),
  set: (val) => {
    if (isOpenEditTrial.value) editDisplay.value = val
    else activeDisplay.value = val
  }
})

const currentTrial = computed({
  get: () => (isOpenEditTrial.value ? editTrial.value : activeTrial.value),
  set: (val) => {
    if (isOpenEditTrial.value) editTrial.value = val
    else activeTrial.value = val
  }
})

const recordedTrials = computed((): MeasurementTrialModel[] => {
  if (!trialsState.value.length) return []
  return [...trialsState.value].map((trial, idx) => {
    const target = targetMembers.value.find((i) => i.id === trial.target_id)
    const prompt = targetPrompts.value.find((i) => i.id === trial.prompt_id)
    const problemBehavior = problemBehaviors.value.find(
      (i) => i.id === trial.target_problem_behavior_id
    )

    return { ...trial, position: idx + 1, target, prompt, problemBehavior }
  })
})

const currentRecordedTrial = computed((): MeasurementTrialModel | null => {
  if (!currentTrial.value) return null

  const index = trialsState.value.findIndex((i) => i.uid === currentTrial.value?.uid)
  const position = index === -1 ? trialsState.value.length + 1 : index + 1

  const target = targetMembers.value.find((i) => i.id === currentTrial.value?.target_id)
  const prompt = targetPrompts.value.find((i) => i.id === currentTrial.value?.prompt_id)
  const problemBehavior = problemBehaviors.value.find(
    (i) => i.id === currentTrial.value?.target_problem_behavior_id
  )

  const trial = {
    ...currentTrial.value,
    position,
    target,
    prompt,
    problemBehavior
  }

  let average = '0'
  const trialScore = trialScores.value.find((i) => i.id === trial.target_id)
  if (trialScore) average = trialScore.average
  return { ...trial, average }
})

const trialScores = computed((): TrialScoreModel[] => {
  let maxCount = 0

  const scoreMap: TrialScoreModel[] = targetMembers.value.map((i) => {
    const trials = recordedTrials.value.filter((t) => t.target_id === i.id)
    const listOfScore = trials.map((t) => (t.prompt ? t.prompt.score : -1)).filter((r) => r !== -1)

    const sum = listOfScore.reduce((s, val) => s + val, 0)
    const avg = sum / (listOfScore.length || 1)
    // const average = avg % 1 === 0 ? avg + '' : avg.toFixed(1)
    const average = avg + ''

    if (listOfScore.length > maxCount) maxCount = listOfScore.length
    return { ...i, sum, average, count: listOfScore.length, trials }
  })

  return scoreMap.map((i) => ({ ...i, maxCount }))
})

const trialScoresHalf = computed(() => Math.ceil(trialScores.value.length / 2))

const trialScoresRowA = computed(() => trialScores.value.slice(0, trialScoresHalf.value))

const trialScoresRowB = computed(() => trialScores.value.slice(trialScoresHalf.value))

const perPage = computed<number>(() => (props.isCollapsed ? 3 : 9))

const pageCount = computed(() => Math.ceil(targetPrompts.value.length / perPage.value))

const promptBoxesPages = computed<Prompt[][]>(() => {
  const prompts = [...targetPrompts.value]
  const res = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    res.push(prompts.slice(start, end))
  }
  return res
})

/** === WATCHERS === */

watch(
  () => submitLoading.value,
  (val) => {
    emit('toggle-updated', !val)
  }
)

watch(
  () => isSaved.value,
  (val) => {
    emit('toggle-saved', val)
  }
)

watch(
  () => props.measurement,
  async (val) => {
    await assignTrialsState(val)
  }
)

watch(
  () => [currentTrial.value?.target_id, props.isCollapsed, trialScores.value?.length],
  async ([id, collapsed]) => {
    if (collapsed || !id) return
    await nextTick()
    scrollToActiveTrial()
  },
  { immediate: true }
)

const collapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
watch(
  () => props.isCollapsed,
  () => {
    collapseTimeout.value = setTimeout(() => {
      const el = `${props.measurement.id}-ta-prompt-boxes-${1}`
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

/** === METHODS === */

const assignTrialsState = async (measurement: Measurement) => {
  let trials = (measurement.trials as MeasurementTrialTaskAnalysis[]) || []

  if (!trials?.length) {
    // fetch again from api
    const { success, data } = await sessionStore.getMeasurementTrials({ id: props.measurement.id })
    if (success && data) {
      trials = [...(data.trials as MeasurementTrialTaskAnalysis[])]
    }
  }

  trialsState.value = [...trials]

  return trials
}

function scrollToActiveTrial(smooth = true) {
  const container = trialScoreContainer.value as HTMLDivElement | null
  if (!container) return // ke-collapse, ref-nya null

  const el = document.getElementById(
    `trial-score-${props.measurement.id}-${currentTrial.value?.target_id}`
  )
  if (!el) return

  const cRect = container.getBoundingClientRect()
  const eRect = el.getBoundingClientRect()

  // posisi el relatif ke isi container, lalu digeser biar ke tengah
  const left = eRect.left - cRect.left + container.scrollLeft - (cRect.width - eRect.width) / 2

  container.scrollTo({
    left: Math.max(0, left),
    behavior: smooth ? 'smooth' : 'auto'
  })
}

const onScroll = (e: any) => {
  const offsetWidth = e.currentTarget.offsetWidth
  const scrollLeft = e.currentTarget.scrollLeft
  const current = Math.floor(scrollLeft / offsetWidth) + 1
  page.value = current
}

const onOpenTrialHistory = async () => {
  isOpenTrialHistory.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_open_trials`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onOpenProblemBehavior = async () => {
  isOpenProblemBehavior.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_open_pb`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onCloseTrialHistory = () => {
  isOpenTrialHistory.value = false
  deleteTrialUid.value = null
}

const _onSaveTrial = async (
  uid: string,
  params: Pick<
    MeasurementTrialTaskAnalysis,
    'target_id' | 'prompt_id' | 'prompt_parent_id' | 'target_problem_behavior_id'
  >,
  activity: 'prompt' | 'problem_behavior'
) => {
  if (!params.target_id || !params.prompt_id) {
    return { success: false, data: null }
  }
  if (sessionStore.session?.status !== 'ongoing' || submitLoading.value) {
    return { success: false, data: null }
  }

  const isRecorded = !!recordedTrials.value.find((t) => t.uid === uid)

  const actions = {
    prompt: 'ta_select_prompt',
    problem_behavior: 'ta_select_pb'
  }

  if (isRecorded) {
    // update trial by uid
    const incomingTrial = {
      prompt_id: params?.prompt_id,
      prompt_parent_id: params?.prompt_parent_id,
      target_problem_behavior_id: params?.target_problem_behavior_id
    }

    const latestTrials = [...trialsState.value].map((t) => {
      if (t.uid === uid) return { ...t, ...incomingTrial }
      return t
    })

    const payload = {
      id: props.measurement.id,
      trialId: uid,
      params: { trial: incomingTrial as UpdateTrialTaskAnalysisParams },
      dataResult: { ...props.measurement, trials: latestTrials }
    }

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `${actions[activity]}`,
      recordable: 'Measurement',
      recordable_id: payload.id,
      api: `PATCH /api/v1/measurements/${payload.id}/trials/${uid}`,
      params: payload,
      notes: `Target: ${props.target?.name} [${uid}: ${params?.prompt_id}, ${params?.target_problem_behavior_id}]`,
      timestamp: new Date().toISOString()
    })

    const { success, data } = await sessionStore.updateMeasurementTrial(payload)
    isSaved.value = true
    if (success) {
      const measurement = data as Measurement
      await assignTrialsState(measurement)
    }
    return { success, data }
  } else {
    // create new trial
    const incomingTrial = {
      uid,
      target_id: params?.target_id,
      prompt_id: params?.prompt_id,
      prompt_parent_id: params?.prompt_parent_id,
      target_problem_behavior_id: params?.target_problem_behavior_id,
      recorded_at: new Date().toISOString()
    }

    const latestTrialPosition = Math.max(...trialsState.value.map((t) => t.position), 0) + 1
    const latestTrials = [...trialsState.value, { ...incomingTrial, position: latestTrialPosition }]

    const payload = {
      id: props.measurement.id,
      params: { trial: incomingTrial as NewTrialTaskAnalysisParams },
      dataResult: { ...props.measurement, trials: latestTrials }
    }

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `${actions[activity]}`,
      recordable: 'Measurement',
      recordable_id: payload.id,
      api: `POST /api/v1/measurements/${payload.id}/trials`,
      params: payload,
      notes: `Target: ${props.target?.name} [${uid}: ${params?.prompt_id}, ${params?.target_problem_behavior_id}]`,
      timestamp: new Date().toISOString()
    })

    const { success, data } = await sessionStore.createMeasurementTrial(payload)
    isSaved.value = true
    if (success) {
      const measurement = data as Measurement
      await assignTrialsState(measurement)
    }
    return { success, data }
  }
}

const onChoosePrompt = async (prompt: Prompt) => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (!currentTrial.value) return

  // Prevent multiple submissions
  if (submitLoading.value) {
    toast.warning('Saving data, please wait...')
    return
  }

  currentTrial.value = {
    ...currentTrial.value,
    prompt_id: prompt.id,
    prompt_parent_id: prompt.prompt_parent_id
  }

  isSaved.value = false

  // If already open edit trial, just return
  if (isOpenEditTrial.value) return

  const uid = currentTrial.value.uid
  const payload = {
    target_id: currentTrial.value?.target_id,
    prompt_id: prompt.id,
    prompt_parent_id: prompt.prompt_parent_id,
    target_problem_behavior_id: currentTrial.value?.target_problem_behavior_id
  }

  const { success } = await _onSaveTrial(uid, payload, 'prompt')
  if (!success) return

  const index = trialScores.value.findIndex((i) => i.id === currentTrial.value?.target_id)
  nextTrial.value =
    index > -1 && index + 1 < trialScores.value.length
      ? trialScores.value[index + 1]
      : trialScores.value[0]
  currentDisplay.value = 'select-next-trial'
}

const onChooseProblemBehavior = async (pb: TargetProblemBehavior) => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (!currentTrial.value) return

  // Prevent multiple submissions
  if (submitLoading.value) {
    toast.warning('Saving data, please wait...')
    return
  }

  const newId = currentTrial.value.target_problem_behavior_id === pb.id ? null : pb.id
  currentTrial.value = { ...currentTrial.value, target_problem_behavior_id: newId }

  isSaved.value = false

  // If already open edit trial, just return
  if (isOpenEditTrial.value) return

  const uid = currentTrial.value.uid
  const payload = {
    target_id: currentTrial.value?.target_id,
    prompt_id: currentTrial.value?.prompt_id,
    prompt_parent_id: currentTrial.value?.prompt_parent_id,
    target_problem_behavior_id: newId
  }

  const { success } = await _onSaveTrial(uid, payload, 'problem_behavior')
  if (!success) return
}

const onChooseTarget = async (val: TrialScoreModel) => {
  nextTrial.value = val

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_select_target`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name} [${val.code_definition}]`,
    timestamp: new Date().toISOString()
  })
}

const onTakeNextTrial = async (val: { isNew: boolean }) => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (!currentTrial.value) return

  const uid = val.isNew ? String(crypto.randomUUID()) : currentTrial.value.uid
  const position = (trialsState.value?.length || 0) + 1

  currentTrial.value = {
    uid,
    position,
    target_id: nextTrial.value?.id || targetMembers.value[0].id,
    prompt_id: null,
    prompt_parent_id: null,
    target_problem_behavior_id: null,
    recorded_at: new Date().toISOString()
  }

  currentDisplay.value = 'select-prompt'
  nextTrial.value = null

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_next_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name} [${currentTrial.value?.target_id}]`,
    timestamp: new Date().toISOString()
  })
}

const onUndoTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return

  currentTrial.value = {
    uid: String(crypto.randomUUID()),
    position: 1,
    target_id: targetMembers.value[0].id,
    prompt_id: null,
    prompt_parent_id: null,
    target_problem_behavior_id: null,
    recorded_at: new Date().toISOString()
  }

  const trials = [...recordedTrials.value]
  if (trials.length) {
    const lastTrial = [...trials].pop()
    if (lastTrial) {
      currentTrial.value = {
        uid: lastTrial.uid,
        position: lastTrial.position,
        target_id: lastTrial.target_id,
        prompt_id: lastTrial.prompt_id,
        prompt_parent_id: lastTrial.prompt_parent_id,
        target_problem_behavior_id: lastTrial.target_problem_behavior_id,
        recorded_at: new Date().toISOString()
      }
    }
  }

  const index = trialScores.value.findIndex((i) => i.id === currentTrial.value?.target_id)
  nextTrial.value = trialScores.value[index] || null
  currentDisplay.value = 'reselect-trial'

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_change_target`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onChangeForChoosePrompt = async () => {
  currentDisplay.value = 'select-prompt'

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_change_prompt`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onOpenEditTrial = async (trial: MeasurementTrialModel) => {
  isOpenEditTrial.value = true
  currentTrial.value = trial
  currentDisplay.value = 'select-prompt'

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_open_edit_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onCloseEditTrial = () => {
  isOpenEditTrial.value = false
}

const onOpenDeleteTrial = async (trial: MeasurementTrialModel) => {
  deleteTrialUid.value = trial.uid

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_open_delete_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onCancelDeleteTrial = async () => {
  deleteTrialUid.value = null

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_cancel_delete_trial`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Target: ${props.target?.name}`,
    timestamp: new Date().toISOString()
  })
}

const onDeleteTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (submitLoading.value) return
  if (!deleteTrialUid.value) return

  const latestTrials = [...trialsState.value].filter((t) => t.uid !== deleteTrialUid.value)

  const payload = {
    id: props.measurement.id,
    trialId: deleteTrialUid.value,
    dataResult: { ...props.measurement, trials: latestTrials }
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_delete_trial`,
    recordable: 'Measurement',
    recordable_id: payload.id,
    api: `DELETE /api/v1/measurements/${payload.id}/trials/${payload.trialId}`,
    params: payload,
    notes: `Target: ${props.target?.name} [${payload.trialId}]`,
    timestamp: new Date().toISOString()
  })

  deleteTrialUidLoading.value = deleteTrialUid.value
  const { success, data } = await sessionStore.deleteMeasurementTrial(payload)
  deleteTrialUidLoading.value = null
  isSaved.value = true

  if (success) {
    // Recalculate currentTrial based on remaining results
    const measurement = data as Measurement
    await assignTrialsState(measurement)

    deleteTrialUid.value = null

    activeDisplay.value = 'select-prompt'
  }
}

const onSaveEditTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (!editTrial.value) return
  if (!editTrial.value.prompt_id) return

  // update trial by uid
  const incomingTrial = {
    prompt_id: editTrial.value.prompt_id,
    prompt_parent_id: editTrial.value.prompt_parent_id,
    target_problem_behavior_id: editTrial.value.target_problem_behavior_id
  }

  const latestTrials = [...trialsState.value].map((t) => {
    if (t.uid === editTrial.value?.uid) return { ...t, ...incomingTrial }
    return t
  })

  const payload = {
    id: props.measurement.id,
    trialId: editTrial.value.uid,
    params: { trial: incomingTrial as UpdateTrialTaskAnalysisParams },
    dataResult: { ...props.measurement, trials: latestTrials }
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `ta_update_trial`,
    recordable: 'Measurement',
    recordable_id: payload.id,
    api: `PATCH /api/v1/measurements/${payload.id}/trials/${payload.trialId}`,
    params: payload,
    notes: `Target: ${props.target?.name} [${payload.trialId}: ${editTrial.value.prompt_id}, ${editTrial.value.target_problem_behavior_id}]`,
    timestamp: new Date().toISOString()
  })

  submitLoading.value = true
  const { success, data } = await sessionStore.updateMeasurementTrial(payload)
  submitLoading.value = false
  isSaved.value = true

  if (success) {
    const measurement = data as Measurement
    await assignTrialsState(measurement)
    editTrial.value = null
    isOpenEditTrial.value = false
  }
}

onMounted(async () => {
  const trials = await assignTrialsState(props.measurement)

  let position = 1
  let id = targetMembers.value[0]?.id || 0

  if (trials.length) {
    const lastTrial = [...trials].pop()
    if (lastTrial) {
      position = trials.length + 1
      const index = targetMembers.value.findIndex((i) => i.id === lastTrial.target_id)
      if (index > -1 && index + 1 < targetMembers.value.length) {
        id = targetMembers.value[index + 1].id
      }
    }
  }

  currentTrial.value = {
    uid: String(crypto.randomUUID()),
    position,
    target_id: id,
    prompt_id: null,
    prompt_parent_id: null,
    target_problem_behavior_id: null,
    recorded_at: new Date().toISOString()
  }
})

// Cleanup saat unmount
onUnmounted(() => {
  // Clear timeout to prevent memory leaks
  if (collapseTimeout.value) {
    clearTimeout(collapseTimeout.value)
    collapseTimeout.value = undefined
  }

  // Trigger sync sebelum unmount jika ada perubahan
  if (!isSaved.value && appStore.networkStatus.connected) {
    sessionStore.triggerSync(true)
  }
})
</script>

<template>
  <div class="flex flex-col gap-2 min-h-full grow" :class="[measurement.is_fixed ? '' : 'pb-16']">
    <!-- Ratio Boxes -->
    <div
      v-if="!isCollapsed"
      :id="`trial-score-${measurement.id}`"
      ref="trialScoreContainer"
      class="flex overflow-x-auto gap-1 items-center pb-2 w-full scrollbar-hide shrink-0"
      :class="[trialScores.length > 6 ? 'justify-start' : 'justify-center']"
    >
      <div
        v-for="member in trialScores"
        :key="member.id"
        :id="`trial-score-${measurement.id}-${member.id}`"
        class="flex overflow-hidden relative flex-col-reverse items-center w-10 h-10 rounded border transition-colors duration-300 shrink-0"
        :class="{
          'border-slate-2 bg-slate-2': member.count <= 0 && member.id !== currentTrial?.target_id,
          'border-prim-2 bg-prim-2': member.count >= 1 && member.id !== currentTrial?.target_id,
          'border-light-purple-4 bg-prim-2': member.id === currentTrial?.target_id
        }"
      >
        <div v-for="(ratio, idx) in member.trials" :key="idx">
          <div
            v-if="ratio.prompt_id"
            class="relative w-10 bg-prim-4"
            :style="{
              height: 2.5 / (member.maxCount || 1) + 'rem'
            }"
          >
            <div
              v-if="ratio.target_problem_behavior_id"
              class="absolute top-0 right-0 h-full z-1 bg-tomato-6"
              :style="{ width: '0.375rem' }"
            />
          </div>
        </div>
        <div
          class="absolute left-0 top-1/2 w-full -translate-y-1/2 text-center text-[10px] font-bold"
          :class="{
            'text-slate-6': member.count === 0,
            'text-dark-purple-1': member.count > 0 || member.id === currentTrial?.target_id
          }"
        >
          <template v-if="isOpenTrialHistory">
            {{ member.count > 0 ? `${member.average}%` : '-' }}
          </template>
          <template v-else> {{ member.code_definition }} </template>
        </div>
      </div>
    </div>

    <!-- Active Trial Area -->
    <div v-if="!isOpenTrialHistory || isOpenEditTrial" class="flex flex-col grow">
      <!-- Header Info -->
      <div
        class="flex justify-between items-center pb-2 mb-2 border-b shrink-0 border-slate-4"
        :class="[isCollapsed ? 'h-6' : 'h-8']"
      >
        <div class="flex gap-1 items-center">
          <div class="text-sm text-slate-7">Current</div>
          <div class="text-sm font-semibold text-light-purple-5">
            {{ currentRecordedTrial?.target?.code_definition }}
          </div>
          <div
            v-if="currentDisplay === 'select-next-trial' && !isOpenEditTrial"
            class="text-sm font-semibold text-light-purple-5"
          >
            | {{ currentRecordedTrial?.average }}%
          </div>
          <AppButton
            v-if="
              currentDisplay === 'select-prompt' &&
              !currentTrial?.prompt_id &&
              !isOpenEditTrial &&
              sessionStore.session?.status === 'ongoing'
            "
            kind="outline"
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
          <div class="text-sm font-semibold text-light-purple-5">
            <span v-if="sessionStore.session?.status === 'completed'">
              {{ Math.max(0, trialsState.filter((i) => i.prompt_id).length) }}
            </span>
            <span v-else> {{ currentRecordedTrial?.position }} </span>
          </div>
        </div>
      </div>

      <!-- select a prompt -->
      <div
        v-if="!isOpenProblemBehavior && currentDisplay === 'select-prompt'"
        class="flex flex-col justify-center items-center grow"
      >
        <div
          :id="`ta-scroll-${measurement.id}`"
          class="flex overflow-x-auto gap-4 pb-4 w-full scrolling-touch max-w-72 snap-x snap-mandatory scroll-smooth"
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
              class="flex flex-wrap gap-x-2 gap-y-3 justify-center content-center items-start w-full"
              :class="{ '-translate-y-1 scale-75': isCollapsed }"
            >
              <div v-for="(prompt, promptIdx) in promptBoxes" :key="promptIdx">
                <div
                  class="relative flex h-[72px] w-[72px] shrink-0 cursor-pointer items-center justify-center rounded-3xl border transition-all duration-300"
                  :class="[
                    sessionStore.session?.status === 'ongoing' ? 'active:scale-90' : '',
                    submitLoading ? 'pointer-events-none opacity-50' : '',
                    prompt.id === currentTrial?.prompt_id ? 'brightness-75' : ''
                  ]"
                  :style="{
                    backgroundColor: promptColors[prompt.color || '']?.primaryColor,
                    borderColor: promptColors[prompt.color || '']?.secondaryColor,
                    color: promptColors[prompt.color || '']?.textColor
                  }"
                  @click="onChoosePrompt(prompt)"
                >
                  <div class="text-[2rem] font-bold">
                    {{ prompt.abbreviation }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="pageCount > 1" class="flex gap-2 justify-center items-center pt-2">
          <div
            v-for="(n, idx) in pageCount"
            :key="idx"
            class="w-3 h-3 rounded-full transition-colors duration-300"
            :class="[n === page ? 'bg-slate-7' : 'bg-slate-4']"
          />
        </div>
      </div>

      <!-- select a next task / reselect task -->
      <div
        v-if="
          !isOpenProblemBehavior &&
          (currentDisplay === 'select-next-trial' || currentDisplay === 'reselect-trial')
        "
        class="flex flex-col justify-center content-center items-center grow"
        :class="[isCollapsed ? 'gap-2' : 'gap-4']"
      >
        <div
          v-if="trialsState.length > 1 || currentTrial?.prompt_id"
          class="flex items-center text-center"
          :class="[isCollapsed ? 'flex-row gap-2' : 'flex-col gap-1']"
        >
          <div class="text-sm font-semibold text-slate-7">
            {{ currentRecordedTrial?.prompt?.name }}
          </div>
          <div
            v-if="currentRecordedTrial?.prompt?.score"
            class="text-light-purple-4"
            :class="{
              'text-5xl font-bold': !isCollapsed,
              'text-sm font-semibold': isCollapsed
            }"
          >
            {{ currentRecordedTrial?.prompt?.score }}%
          </div>
          <AppButton v-if="!isCollapsed" kind="plain" size="sm" @click="onChangeForChoosePrompt">
            Change
          </AppButton>
        </div>
        <div class="flex flex-col gap-4 items-center px-2 w-full">
          <div v-if="!isCollapsed" class="text-sm text-center text-slate-8">
            <span v-if="currentDisplay === 'select-next-trial'"> Next </span>
            <span v-if="currentDisplay === 'reselect-trial'"> Select a target </span>
          </div>

          <div
            class="flex overflow-x-auto items-center pb-2 w-full scrollbar-hide shrink-0"
            :class="[trialScores.length > 6 ? 'justify-start' : 'justify-center']"
          >
            <div class="flex flex-col gap-2 items-center w-max">
              <div class="flex gap-2">
                <AppButton
                  v-for="member in trialScoresRowA"
                  :key="member.id"
                  :kind="member.id === nextTrial?.id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="onChooseTarget(member)"
                >
                  {{ member.code_definition }} | {{ member.count + 1 }}
                </AppButton>
              </div>
              <div class="flex gap-2">
                <AppButton
                  v-for="member in trialScoresRowB"
                  :key="member.id"
                  :kind="member.id === nextTrial?.id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="onChooseTarget(member)"
                >
                  {{ member.code_definition }} | {{ member.count + 1 }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Problem Behaviors -->
      <div
        v-if="isOpenProblemBehavior"
        class="flex flex-col justify-center content-center items-center w-full grow"
        :class="{ 'gap-2': !isCollapsed }"
      >
        <div
          class="flex flex-wrap gap-x-2 gap-y-3 justify-center content-center items-start w-full"
          :class="{ '-translate-y-1 scale-75': isCollapsed }"
        >
          <div v-for="(pb, idx) in problemBehaviors" :key="idx">
            <div
              class="flex relative justify-center items-center rounded-3xl transition-colors duration-300 cursor-pointer shrink-0"
              :class="[
                isCollapsed ? 'h-[64px] w-[64px]' : 'h-[72px] w-[72px]',
                sessionStore.session?.status === 'ongoing' ? 'active:scale-90' : '',
                submitLoading ? 'pointer-events-none opacity-50' : '',
                pb.id === currentTrial?.target_problem_behavior_id
                  ? 'bg-tomato-7 text-white'
                  : 'bg-tomato-1 text-tomato-7'
              ]"
              @click="onChooseProblemBehavior(pb)"
            >
              <div class="text-[2rem] font-bold">{{ pb.code }}</div>
            </div>
          </div>
        </div>
        <div class="px-4 text-sm text-center text-slate-8">
          {{ currentRecordedTrial?.problemBehavior?.code_definition }}
        </div>
      </div>
    </div>

    <!-- Trial History -->

    <div v-if="isOpenTrialHistory && !isOpenEditTrial" class="flex flex-col grow">
      <div v-for="(trial, idx) in recordedTrials" :key="trial.uid">
        <div
          v-if="trial.prompt_id"
          class="flex justify-between items-center px-2 py-3 border-b border-slate-3"
        >
          <div class="flex gap-2 items-center">
            <div class="w-6 text-sm shrink-0 text-slate-8">{{ idx + 1 }}.</div>
            <div class="font-semibold tex-sm text-slate-7">
              {{ trial.target?.code_definition }}
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <div
              v-if="trial.target_problem_behavior_id"
              class="flex justify-center items-center w-6 h-6 text-sm font-semibold text-white rounded bg-tomato-7"
            >
              {{ trial.problemBehavior?.code }}
            </div>
            <div
              class="flex justify-center items-center w-6 h-6 text-sm font-semibold rounded"
              :style="{
                backgroundColor: promptColors[trial.prompt?.color || ''].primaryColor,
                borderColor: promptColors[trial.prompt?.color || ''].secondaryColor,
                color: promptColors[trial.prompt?.color || ''].textColor
              }"
            >
              {{ trial.prompt?.abbreviation }}
            </div>

            <div
              v-if="sessionStore.session?.status !== 'completed'"
              class="flex gap-2 items-center ml-2"
            >
              <template v-if="deleteTrialUidLoading === trial.uid">
                <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin" />
              </template>
              <template v-else-if="deleteTrialUid === trial.uid">
                <Icon icon="ph:check-bold" class="text-grass-6" @click="onDeleteTrial" />
                <Icon icon="ph:x-bold" class="text-tomato-7" @click="onCancelDeleteTrial" />
              </template>
              <template v-else>
                <Icon
                  icon="ph:pencil-simple"
                  class="text-slate-8"
                  @click="onOpenEditTrial(trial)"
                />
                <Icon
                  v-if="trialsState.filter((i) => i.target_id).length > 1"
                  icon="ph:trash"
                  class="text-tomato-7"
                  @click="onOpenDeleteTrial(trial)"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="trialsState.filter((i) => i.prompt_id).length === 0"
        class="py-4 text-sm text-center text-slate-8"
      >
        No result recorded yet.
      </div>
    </div>

    <!-- Bottom Actions -->
    <div
      v-if="
        !isCollapsed ||
        currentDisplay === 'select-next-trial' ||
        currentDisplay === 'reselect-trial'
      "
      class="flex bottom-0 items-center h-16 bg-white"
      :class="[measurement.is_fixed ? 'relative w-[calc(100%)]' : 'absolute w-[calc(100%-2rem)]']"
    >
      <div v-if="isOpenProblemBehavior" class="grow">
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
      <div v-else-if="isOpenTrialHistory && !isOpenEditTrial" class="grow">
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
        v-else-if="
          nextTrial?.code_definition && currentDisplay === 'reselect-trial' && !isOpenEditTrial
        "
        class="grow"
      >
        <AppButton
          class="w-full"
          :loading="submitLoading"
          @click="onTakeNextTrial({ isNew: trialsState.length > 1 || !!currentTrial?.prompt_id })"
        >
          <span v-if="trialsState.length > 1 || !!currentTrial?.prompt_id">
            Next: {{ nextTrial?.code_definition }} | {{ nextTrial?.count + 1 }}
          </span>
          <span v-else> Start trial: {{ nextTrial?.code_definition }} </span>
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
          <Icon icon="ph:list" class="text-xl" />
        </AppButton>
        <AppButton
          v-if="isOpenEditTrial && !isCollapsed"
          kind="outline"
          class="shrink-0"
          :disabled="submitLoading"
          @click="onCloseEditTrial"
        >
          <Icon icon="ph:x" class="text-xl" />
        </AppButton>

        <div
          v-if="
            nextTrial?.code_definition && currentDisplay === 'select-next-trial' && !isOpenEditTrial
          "
          class="grow"
        >
          <AppButton
            class="w-full"
            :loading="submitLoading"
            @click="onTakeNextTrial({ isNew: true })"
          >
            Next: {{ nextTrial?.code_definition }} | {{ nextTrial?.count + 1 }}
          </AppButton>
        </div>
        <div v-if="isOpenEditTrial" class="grow">
          <AppButton class="w-full" :loading="submitLoading" @click="onSaveEditTrial">
            Update
          </AppButton>
        </div>
        <div
          v-if="enableProblemBehavior && currentTrial?.prompt_id"
          class="flex justify-center items-center w-10 h-10 rounded transition-colors duration-300 cursor-pointer"
          :class="[
            currentTrial.target_problem_behavior_id
              ? 'bg-tomato-7 text-white'
              : 'bg-tomato-2 text-tomato-7 hover:bg-tomato-3'
          ]"
          @click="onOpenProblemBehavior"
        >
          <div class="text-sm font-semibold">
            {{ currentRecordedTrial?.problemBehavior?.code || 'R' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
