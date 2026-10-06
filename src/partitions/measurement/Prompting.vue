<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsV2Params } from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  Measurement,
  MeasurementResultsPrompting,
  MeasurementTrial,
  Prompt,
  Target,
  TargetProblemBehavior
} from '@/lib/types'
import { promptColors } from '@/lib/data'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import AppButton from '@/components/AppButton.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppToggle from '@/components/AppToggle.vue'
import { useAppStore } from '@/stores/app.store'

const appStore = useAppStore()
const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  target: Target
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false
})
const emit = defineEmits<Emits>()

/** === DATA === */

interface PromptBox extends MeasurementResultsPrompting {
  key: string
  centerPrompt?: Prompt
}

interface MeasurementTrialModel extends MeasurementTrial {
  prompt?: Prompt
  problemBehavior?: TargetProblemBehavior
}

const page = ref<number>(1)
const resultsState = ref<Record<string, MeasurementResultsPrompting>>({})
const trialsState = ref<MeasurementTrial[]>([])

const scoreLoadingBox = ref<PromptBox['key'] | null>(null)
const typeLoadingBox = ref<number | null>(null)
const updateLastTrialLoading = ref(false)
const indexUpdateTrialLoading = ref(0)
const indexDeleteTrialLoading = ref(0)

const isOpenProblemBehavior = ref(false)
const isOpenTrialHistory = ref(false)
const isShowIndexEditTrial = ref(0)

const lastPbIdInput = ref<number | null>(null)
const editTrial = ref<MeasurementTrialModel | null>(null)

const isOpenCustomize = ref<boolean>(false)
const customizeSaveLoading = ref<boolean>(false)

const collapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)

interface DefaultPrompt extends MeasurementResultsPrompting {
  key: number
}

const defaultPrompts = ref<DefaultPrompt[]>([])

const shapes: Record<string, string> = {
  square: 'ph:square-fill',
  circle: 'ph:circle-fill',
  triangle: 'ph:triangle-fill',
  diamond: 'ph:diamond-fill'
}

/** === COMPUTEDS === */

const measurementResults = computed(
  () => props.measurement.results as Record<string, MeasurementResultsPrompting>
)

const problemBehaviors = computed(() => {
  const pbs = props.target?.target_problem_behaviors || []
  return [...pbs].sort((a, b) => (a.position || 0) - (b.position || 0))
})

const enableProblemBehavior = computed(() => {
  return props.target?.enable_problem_behavior && problemBehaviors.value.length
})

const recordedTrials = computed((): MeasurementTrialModel[] => {
  if (!trialsState.value.length) return []
  return [...trialsState.value].map((trial) => {
    const prompt = props.target?.prompts?.find((i) => i.id === trial.prompt_id)
    const problemBehavior =
      props.target?.target_problem_behaviors?.find(
        (i) => i.id === trial.target_problem_behavior_id
      ) || null

    return { ...trial, prompt, problemBehavior } as MeasurementTrialModel
  })
})

const lastTrial = computed(() => {
  const trials = recordedTrials.value
  return trials.length ? trials[trials.length - 1] : null
})

const lastPromptName = computed(() => {
  if (!lastTrial.value) return ''
  return lastTrial.value.prompt?.name || ''
})

const lastPb = computed(() => {
  if (!lastTrial.value) return null
  return lastTrial.value.problemBehavior
})

const selectedPbDefinition = computed(() => {
  if (!lastPb.value) return ''
  return `${lastPb.value.code} - ${lastPb.value.code_definition}`
})

const selectedPbCode = computed(() => {
  if (!lastPb.value) return 'R'
  return lastPb.value.code
})

const perPage = computed<number>(() => (props.isCollapsed ? 3 : 9))

const pageCount = computed<number>(() => {
  const res = Object.keys(resultsState.value) || []
  const boxes = res.filter((i) => resultsState.value[i].enabled).length
  return Math.ceil(boxes / perPage.value)
})

const promptBoxesPages = computed<PromptBox[][]>(() => {
  if (!resultsState.value) return []
  const keys = Object.keys(resultsState.value)
  if (!keys || !keys.length) return []

  const prompts: PromptBox[] = keys
    .map((key) => ({ ...resultsState.value[key], key }) as PromptBox)
    .filter((i) => i.enabled)
    .sort((a, b) => a.position - b.position)

  const res: PromptBox[][] = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    const arr = [...prompts.slice(start, end)]
    res.push(arr)
  }
  return res
})

const currentScore = computed<number>(() => {
  if (sessionStore.session?.status === 'draft' || !resultsState.value) return 0
  const keys = Object.keys(resultsState.value)
  if (!keys || !keys.length) return 0

  let count = 0
  let total = 0

  for (let idx = 0; idx < keys.length; idx++) {
    const key = keys[idx]
    if (resultsState.value[key].enabled) {
      const promptScore = getPromptScore(key)
      const attempt = Number(resultsState.value[key].score || 0)

      count += attempt
      total += attempt * promptScore
    }
  }
  const final = total / (count || 0)
  return Math.round(final || 0)
})

/** === WATCHERS === */

watch(
  () => scoreLoadingBox.value,
  (val) => {
    emit('toggle-updated', val === null)
  }
)

watch(
  () => props.measurement,
  (val) => {
    const measurement = val as Measurement
    assignState(measurement)
  }
)

watch(
  () => lastPb.value,
  (val) => {
    lastPbIdInput.value = val?.id || null
  }
)

watch(
  () => props.isCollapsed,
  () => {
    collapseTimeout.value = setTimeout(() => {
      const el = `${props.measurement.id}-prompt-boxes-${1}`
      const boxes = document.getElementById(el)
      if (!boxes) return
      boxes.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
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
  () => isOpenCustomize.value,
  (val) => {
    if (!val) return

    const res = measurementResults.value
    const keys = Object.keys(res)
    if (keys && keys.length) {
      const n = keys
        .map((i) => ({ ...res[i], key: Number(i) }))
        .sort((a, b) => (a?.position || 0) - (b?.position || 0))
      defaultPrompts.value = n as DefaultPrompt[]
    }
  }
)

/** === METHODS === */

const onScroll = (e: Event) => {
  const target = e.currentTarget as HTMLElement
  const current = Math.floor(target.scrollLeft / target.offsetWidth) + 1
  page.value = current
}

// no need 'onChangePage'

const assignState = (measurement: Measurement) => {
  if (measurement?.results) {
    resultsState.value = { ...measurement.results }
  }
  if (measurement?.trials) {
    trialsState.value = [...measurement.trials]
  }
}

const _onSaveScore = async (prompt: any, gapScore: number) => {
  const params: UpdateMeasurementResultsV2Params = {
    id: props.measurement.id,
    params: {
      results: {
        [prompt.key]: gapScore
      }
    },
    dataResult: { ...props.measurement, results: resultsState.value },
    lastData: { ...props.measurement }
  }

  const { success, data, message } = await sessionStore.updateMeasurementResultsV2(params)

  scoreLoadingBox.value = null
  typeLoadingBox.value = null

  if (!success) {
    resultsState.value = { ...measurementResults.value }
    trialsState.value = [...(props.measurement.trials || [])]
    toast.error(message)
    return
  }

  const measurement = data as Measurement
  assignState(measurement)
}

const onChangeScore = async (prompt: any, score: number) => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (scoreLoadingBox.value !== null) return
  if (!resultsState.value[prompt.key]) return

  const currentPromptScore = resultsState.value[prompt.key].score || 0
  const newScore = Math.max(0, currentPromptScore + score)
  if (newScore === currentPromptScore) return

  resultsState.value[prompt.key] = {
    ...resultsState.value[prompt.key],
    score: newScore
  }

  const gapScore = newScore - (measurementResults.value[prompt.key]?.score || 0)

  // record session activities
  sessionStore.addSessionActivity({
    action_label: score === 1 ? `prompting_add` : `prompting_subtract`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { results: { [prompt.key]: gapScore } },
    notes: `Target: ${props.measurement.target?.name} [${prompt.key} ${prompt.name}: ${newScore}]`,
    timestamp: new Date().toISOString()
  })

  scoreLoadingBox.value = prompt.key
  typeLoadingBox.value = score
  _onSaveScore(prompt, gapScore)
}

const getPromptScore = (id: number | string) => {
  const found = props.target?.prompts?.find((i) => i.id === Number(id))
  return found ? Number(found.score || 0) : 0
}

const onSelectLastTrialPb = async (pbId: number) => {
  if (!props.measurement.id) return
  if (sessionStore.session?.status !== 'ongoing') return
  if (!lastTrial.value) return

  const newPbId = lastTrial.value.target_problem_behavior_id === pbId ? null : pbId
  lastPbIdInput.value = newPbId

  const payload = {
    id: props.measurement.id,
    trial_id: lastTrial.value.id,
    params: { target_problem_behavior_id: newPbId }
  }

  updateLastTrialLoading.value = true
  const { success, message, data } = await sessionStore.updateMeasurementTrial(payload)
  updateLastTrialLoading.value = false

  if (!success) {
    lastPbIdInput.value = lastPb.value?.id || null
    toast.error(message)
    return
  }

  const measurement = data as Measurement
  assignState(measurement)
}

const openPbDropdown = (trial: MeasurementTrialModel) => {
  if (sessionStore.session?.status !== 'ongoing') return
  editTrial.value = { ...trial }
  isShowIndexEditTrial.value = trial.id
}

const onSavePbDropdown = async (pbId: number) => {
  if (!props.measurement.id) return
  if (sessionStore.session?.status !== 'ongoing') return
  if (indexUpdateTrialLoading.value !== 0) return
  if (!editTrial.value) return

  const currentPbId = editTrial.value.target_problem_behavior_id || null
  const newPbId = currentPbId === pbId ? null : pbId
  editTrial.value.target_problem_behavior_id = newPbId

  const payload = {
    id: props.measurement.id,
    trial_id: editTrial.value.id,
    params: { target_problem_behavior_id: newPbId }
  }

  indexUpdateTrialLoading.value = editTrial.value.id
  const { success, message, data } = await sessionStore.updateMeasurementTrial(payload)
  indexUpdateTrialLoading.value = 0

  if (!success) {
    editTrial.value.target_problem_behavior_id = currentPbId
    toast.error(message)
    return
  }

  const measurement = data as Measurement
  assignState(measurement)

  isShowIndexEditTrial.value = 0
}

const onDeleteTrial = async (trial: MeasurementTrialModel) => {
  if (!props.measurement.id) return
  if (sessionStore.session?.status !== 'ongoing') return
  if (indexDeleteTrialLoading.value !== 0) return

  const payload = {
    id: props.measurement.id,
    trial_id: trial.id
  }

  indexDeleteTrialLoading.value = trial.id
  const { success, message, data } = await sessionStore.deleteMeasurementTrial(payload)
  indexDeleteTrialLoading.value = 0

  if (!success) {
    toast.error(message)
    return
  }

  const measurement = data as Measurement
  assignState(measurement)
}

const onToggleEnabledPrompt = (prompt: DefaultPrompt) => {
  const index = defaultPrompts.value.findIndex((i) => Number(i.key) === Number(prompt.key))
  if (index > -1) {
    defaultPrompts.value[index].enabled = !prompt.enabled
  }
}

const onSavePrompts = async () => {
  const payload = {
    id: props.measurement.id,
    params: { measurement: { results: {} as Record<string, MeasurementResultsPrompting> } },
    dataResult: props.measurement
  }

  defaultPrompts.value.forEach((i) => {
    payload.params.measurement.results[i.key] = i
  })

  customizeSaveLoading.value = true
  await sessionStore.updateMeasurement(payload)
  customizeSaveLoading.value = false

  isOpenCustomize.value = false
}

onMounted(() => {
  const measurement = props.measurement as Measurement
  assignState(measurement)
})

onUnmounted(() => {
  // Clear timeout to prevent memory leaks
  if (collapseTimeout.value) {
    clearTimeout(collapseTimeout.value)
    collapseTimeout.value = undefined
  }
})
</script>

<template>
  <div class="flex flex-col gap-2 justify-between h-full grow">
    <!-- Loading state -->
    <div
      v-if="scoreLoadingBox !== null"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-16 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <!-- Problem Behaviors View -->
    <div
      v-if="isOpenProblemBehavior"
      class="flex flex-col gap-2 justify-between items-center pt-2 pb-2 h-full"
    >
      <div class="text-xs font-medium text-slate-7">
        Problem behavior
        <span v-if="lastPromptName">
          · for <span class="font-semibold text-slate-8">{{ lastPromptName }}</span>
        </span>
      </div>

      <div
        class="flex gap-3 pt-2"
        :class="
          isCollapsed
            ? 'w-full flex-nowrap justify-center overflow-x-auto px-2 py-1'
            : 'flex-wrap justify-center'
        "
      >
        <div
          v-for="pb in problemBehaviors"
          :key="pb.id"
          class="flex flex-col justify-center items-center w-16 h-16 rounded-2xl border transition-all cursor-pointer shrink-0 hover:brightness-95"
          :class="[
            lastPbIdInput === pb.id
              ? 'border-tomato-7 bg-tomato-7 font-bold text-white'
              : 'border-tomato-3 bg-tomato-2 font-bold text-tomato-8',
            sessionStore.session?.status !== 'ongoing' ? 'pointer-events-none' : ''
          ]"
          @click="onSelectLastTrialPb(pb.id)"
        >
          <span class="text-2xl font-bold">{{ pb.code }}</span>
        </div>
      </div>

      <div v-if="!isCollapsed" class="px-4 text-xs font-medium text-center text-slate-8">
        {{ selectedPbDefinition || 'Select a problem behavior to record' }}
      </div>

      <div class="mt-2 w-full">
        <AppButton kind="outline" class="w-full" @click="isOpenProblemBehavior = false">
          {{ isCollapsed ? 'Back to result' : 'Back to prompts' }}
        </AppButton>
      </div>
    </div>

    <!-- Trial History View -->
    <div
      v-else-if="isOpenTrialHistory"
      class="flex overflow-y-auto flex-col justify-between h-full grow"
    >
      <div
        v-if="!appStore.network_status?.connected"
        class="flex gap-1 justify-center items-center px-2 py-1.5 text-xs text-center text-white rounded bg-tomato-7"
      >
        <span>Please reconnect to view trial history</span>
      </div>

      <div
        class="flex flex-col py-2"
        :class="[appStore.network_status?.connected ? '' : ' blur-sm']"
      >
        <!-- offline indicator -->

        <div v-if="!recordedTrials.length" class="py-16 text-xs text-center text-slate-5">
          No recorded trials yet
        </div>

        <div
          v-for="(trial, index) in recordedTrials"
          :key="trial.id"
          class="flex justify-between items-center px-2 py-3 border-b border-slate-4"
        >
          <div class="flex gap-3 items-center">
            <span class="w-4 text-xs font-medium text-slate-6">{{ index + 1 }}.</span>

            <!-- Prompt Label -->
            <div
              class="flex justify-center items-center px-1.5 h-6 text-xs font-bold rounded min-w-7"
              :style="{
                backgroundColor: promptColors[trial.prompt?.color || 'cherry']?.primaryColor,
                borderColor: promptColors[trial.prompt?.color || 'cherry']?.secondaryColor,
                color: promptColors[trial.prompt?.color || 'cherry']?.textColor
              }"
            >
              {{ trial.prompt?.abbreviation || 'P' }}
            </div>

            <!-- Problem Behavior -->
            <div
              v-if="enableProblemBehavior"
              class="flex gap-2 justify-between items-center px-1.5 h-6 rounded border transition-colors cursor-pointer min-w-12"
              :class="[
                trial?.target_problem_behavior_id
                  ? 'border-tomato-9 bg-tomato-7 text-white'
                  : 'border-tomato-3 bg-tomato-1 text-tomato-7',
                sessionStore.session?.status !== 'ongoing' ? 'pointer-events-none' : ''
              ]"
              @click="openPbDropdown(trial)"
            >
              <div class="text-xs font-bold">
                <span v-if="!trial?.target_problem_behavior_id">-</span>
                <span v-else>{{ trial.problemBehavior?.code }}</span>
              </div>
              <Icon
                icon="ph:caret-down-bold"
                class="text-sm transition-all transform"
                :class="[
                  trial?.target_problem_behavior_id ? 'text-white' : 'text-tomato-7',
                  isShowIndexEditTrial === trial.id ? 'rotate-180' : ''
                ]"
              />
            </div>
          </div>

          <!-- Actions: Trash -->
          <div class="flex gap-1.5 items-center">
            <button
              type="button"
              title="Delete"
              class="p-1 rounded cursor-pointer text-tomato-5 hover:text-tomato-7"
              :class="[sessionStore.session?.status !== 'ongoing' ? 'pointer-events-none' : '']"
              :disabled="sessionStore.session?.status !== 'ongoing'"
              @click="onDeleteTrial(trial)"
            >
              <Icon
                v-if="indexDeleteTrialLoading === trial.id"
                icon="mingcute:loading-fill"
                class="w-4 h-4 animate-spin shrink-0"
              />
              <Icon v-else icon="ph:trash" class="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      <div class="sticky bottom-0 px-2 py-2 w-full bg-white z-1">
        <AppButton kind="outline" class="w-full" @click="isOpenTrialHistory = false">
          Back
        </AppButton>
      </div>
    </div>

    <!-- Prompts View (Default) -->
    <div v-else class="flex flex-col gap-2 justify-between h-full grow">
      <div class="flex justify-center content-center items-center h-full grow">
        <!-- Scrollable Prompts Container -->
        <div
          :id="`prompting-scroll-${measurement.id}`"
          class="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scroll-smooth"
          :class="[
            isCollapsed && enableProblemBehavior
              ? 'w-[calc(320px-32px-60px)]'
              : 'w-[calc(320px-32px)]'
          ]"
          dir="ltr"
          @scroll="onScroll"
        >
          <div
            v-for="(promptBoxes, idx) in promptBoxesPages"
            :key="`${measurement.id}-prompt-boxes-${idx + 1}`"
            :id="`${measurement.id}-prompt-boxes-${idx + 1}`"
            class="flex justify-center shrink-0 snap-center"
            :class="[
              isCollapsed && enableProblemBehavior
                ? 'w-[calc(320px-32px-60px)]'
                : 'w-[calc(320px-32px)]'
            ]"
          >
            <div
              class="flex w-[calc(240px+24px)] content-center justify-center gap-3"
              :class="[isCollapsed ? '-translate-y-1 scale-75 items-start' : 'flex-wrap']"
            >
              <div v-for="prompt in promptBoxes" :key="prompt.key" class="space-y-1">
                <div
                  class="flex relative justify-center items-center w-20 h-20 rounded-2xl border transition-colors shrink-0"
                  :class="{
                    'cursor-wait':
                      (scoreLoadingBox !== null && scoreLoadingBox !== prompt.key) ||
                      (typeLoadingBox !== null && typeLoadingBox !== 1),
                    'pointer-events-none': sessionStore.session?.status !== 'ongoing'
                  }"
                  :style="{
                    backgroundColor: promptColors[prompt.color].primaryColor,
                    borderColor: promptColors[prompt.color].secondaryColor,
                    color: promptColors[prompt.color].textColor
                  }"
                  @click="onChangeScore(prompt, 1)"
                >
                  <div class="absolute top-1 text-xs font-semibold">
                    {{ prompt.abbreviation }}
                  </div>

                  <div v-if="prompt.score" class="mt-2 text-4xl font-bold">
                    {{ prompt.score }}
                  </div>
                  <Icon v-else icon="stash:plus-solid" class="text-5xl" />
                </div>

                <div
                  class="flex justify-center items-center px-5 h-5 rounded border border-slate-5 bg-pure-white"
                  :class="{
                    'cursor-wait':
                      (scoreLoadingBox !== null && scoreLoadingBox !== prompt.key) ||
                      (typeLoadingBox !== null && typeLoadingBox !== -1),
                    'pointer-events-none':
                      !prompt.score || sessionStore.session?.status !== 'ongoing'
                  }"
                  @click="onChangeScore(prompt, -1)"
                >
                  <div
                    class="w-6 h-1 rounded transition-colors shrink-0"
                    :class="[!prompt.score ? 'bg-slate-4' : 'bg-slate-6']"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed PB toggle button OUTSIDE scrollable container when collapsed -->
        <div
          v-if="isCollapsed && enableProblemBehavior"
          class="flex justify-center items-center pb-4 transition-transform scale-75 -translate-y-2 shrink-0"
        >
          <AppButton
            :kind="lastPb ? 'primary' : 'outline'"
            color="tomato"
            title="Record problem behavior"
            class="flex relative justify-center items-center w-20 h-20 font-bold rounded-2xl border transition-all cursor-pointer shrink-0"
            :class="[lastPb ? '' : '!bg-tomato-2 hover:!bg-tomato-3']"
            :disabled="!lastPromptName"
            @click="isOpenProblemBehavior = true"
          >
            <span class="text-3xl font-bold">{{ selectedPbCode }}</span>
          </AppButton>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="pb-3 mt-auto space-y-2 shrink-0" :class="{ '-translate-y-2': isCollapsed }">
        <div class="flex gap-2 justify-center items-center h-3">
          <div
            v-for="n in pageCount"
            :key="n"
            class="w-2 h-2 rounded-full transition-colors"
            :class="[n === page ? 'bg-slate-10' : 'bg-slate-6']"
          ></div>
        </div>

        <AppButton
          v-if="sessionStore.session?.status === 'draft'"
          kind="outline"
          size="sm"
          class="px-0 mt-2 w-full"
          @click="isOpenCustomize = !isOpenCustomize"
        >
          Customize prompt visibility
        </AppButton>

        <div v-if="!isCollapsed" class="flex gap-2 justify-between items-center mt-1 w-full">
          <!-- ≡ Trial History List Button (Left) -->
          <AppButton
            :kind="isOpenTrialHistory ? 'primary' : 'outline'"
            size="sm"
            title="Trial history"
            class="w-8 h-8"
            @click="isOpenTrialHistory = true"
          >
            <Icon icon="ph:list" class="w-5 h-5" />
          </AppButton>

          <!-- Goal / Score Text (Center) -->
          <div class="flex justify-center items-center px-1 text-center grow">
            <div
              v-if="measurement?.target?.prompting_format === 'classic'"
              class="flex flex-wrap gap-y-0.5 gap-x-1 justify-center items-center text-xs text-center text-slate-7"
            >
              <span> Goal: </span>
              <span class="font-semibold text-slate-8"> {{ measurement.target?.goal }} </span>
              <span> attempt(s) </span>
              <span class="font-semibold text-slate-8">
                {{ measurement.target?.success_metric }}
              </span>
            </div>

            <div
              v-if="measurement?.target?.prompting_format === 'custom'"
              class="flex items-center text-xs"
            >
              <span class="text-slate-7">
                <span
                  v-if="measurement?.target?.success_metric === 'equal to or greater than goal'"
                >
                  Goal: ≥ {{ `${measurement?.target?.goal}%` }}
                </span>
                <span v-if="measurement?.target?.success_metric === 'less than goal'">
                  Goal: {{ '<' }} {{ `${measurement?.target?.goal}%` }}
                </span>
              </span>

              <span class="w-2 shrink-0"></span>

              <span>
                <span class="text-slate-7"> Score: </span>
                <span class="font-semibold text-slate-8"> {{ currentScore }}% </span>
              </span>
            </div>
          </div>

          <!-- R / R1 PB Toggle Button (Right) -->
          <AppButton
            v-if="enableProblemBehavior"
            :kind="lastPb ? 'primary' : 'outline'"
            color="tomato"
            size="sm"
            title="Record problem behavior"
            :disabled="!lastPromptName"
            class="w-8 h-8"
            :class="[lastPb ? '' : '!hover:bg-tomato-3 !bg-tomato-2']"
            @click="isOpenProblemBehavior = true"
          >
            <div class="text-xs font-bold">{{ selectedPbCode }}</div>
          </AppButton>
          <div v-else class="w-8 shrink-0" />
        </div>
      </div>
    </div>
  </div>

  <AppActionSheet
    :show="isOpenCustomize"
    @close="isOpenCustomize = false"
    class="pointer-events-auto"
  >
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 bg-white">
        <div class="text-xl font-semibold">Customize prompt visibility</div>
        <div class="cursor-pointer" @click="isOpenCustomize = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="prompt in defaultPrompts"
          :key="prompt.key"
          class="flex justify-between items-center w-full h-14 border-b border-slate-3"
          :class="[
            prompt.name === measurement.target?.success_metric
              ? 'cursor-not-allowed'
              : 'cursor-pointer'
          ]"
        >
          <div
            class="flex gap-3 items-center h-10 truncate"
            :class="{ 'pointer-events-none': prompt.name === measurement.target?.success_metric }"
            @click="onToggleEnabledPrompt(prompt)"
          >
            <Icon
              :icon="shapes[prompt.shape]"
              class="text-2xl"
              :style="{ color: promptColors[prompt.color].primaryColor }"
            />
            <div class="text-sm truncate text-slate-8">
              {{ prompt.name }}
            </div>
            <div
              v-if="prompt.name === measurement.target?.success_metric"
              class="text-xs italic truncate text-slate-6"
            >
              as success metric
            </div>
          </div>

          <AppToggle
            :name="`toggle-prompt-${prompt.key}`"
            :checked="prompt.enabled"
            :disabled="prompt.name === measurement.target?.success_metric"
            @change="onToggleEnabledPrompt(prompt)"
          />
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 justify-between items-center py-3 bg-white">
        <AppButton class="w-full" :loading="customizeSaveLoading" @click="onSavePrompts">
          Apply
        </AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Trial Item Problem Behavior Action Sheet -->
  <AppActionSheet
    :show="!!isShowIndexEditTrial"
    @close="isShowIndexEditTrial = 0"
    class="pointer-events-auto"
  >
    <div>
      <div
        class="flex sticky top-0 z-10 justify-between items-center px-1 py-3 bg-white border-b border-slate-3"
      >
        <div class="text-lg font-semibold text-slate-9">Select Problem Behavior</div>
        <div class="cursor-pointer" @click="isShowIndexEditTrial = 0">
          <Icon icon="ph:x" class="text-2xl text-slate-7" />
        </div>
      </div>

      <div class="max-h-[60vh] overflow-y-auto py-2">
        <div
          v-for="pb in problemBehaviors"
          :key="pb.id"
          class="flex justify-between items-center px-3 w-full h-14 border-b transition-colors cursor-pointer border-slate-3 hover:bg-slate-1"
          :class="{
            'bg-slate-2 font-semibold': editTrial?.target_problem_behavior_id === pb.id
          }"
          @click="onSavePbDropdown(pb.id)"
        >
          <div class="flex gap-3 items-center">
            <div class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: pb.color }"></div>
            <div class="text-sm text-slate-8">{{ pb.code }} - {{ pb.code_definition }}</div>
          </div>
          <Icon
            v-if="editTrial?.target_problem_behavior_id === pb.id"
            icon="ph:check-bold"
            class="text-xl text-tulip-7"
          />
        </div>
      </div>
    </div>
  </AppActionSheet>
</template>
