<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  Measurement,
  MeasurementResultsPrompting,
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

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  target: Target
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

/** === DATA === */

interface PromptBox extends MeasurementResultsPrompting {
  key: string
  centerPrompt?: Prompt
}

interface RecordedTrialModel {
  key: number
  promptId: number
  prompt?: Prompt
  problemBehaviorId: number | null
  problemBehaviorIndex: number | null
  problemBehavior?: TargetProblemBehavior
}

const page = ref<number>(1)
const resultsState = ref<Record<string, MeasurementResultsPrompting>>({})
const scoreLoadingBox = ref<PromptBox['key'] | null>(null)
const typeLoadingBox = ref<number | null>(null)

const indexUpdatePbLoading = ref(0)
const indexDeleteTrialLoading = ref(0)

const isOpenProblemBehavior = ref(false)
const isOpenTrialHistory = ref(false)

const lastPbIdInput = ref<number | null>(null)
const editTrial = ref<RecordedTrialModel | null>(null)

const isOpenCustomize = ref<boolean>(false)
const customizeSaveLoading = ref<boolean>(false)

const collapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)

const defaultPrompts = ref<Partial<Prompt>[]>([])

const shapes: Record<string, string> = {
  square: 'ph:square-fill',
  circle: 'ph:circle-fill',
  triangle: 'ph:triangle-fill',
  diamond: 'ph:diamond-fill'
}

/** === COMPUTEDS === */

// === use as props ===
// const measurementResults = computed(
//   () => props.measurement.results as Record<string, MeasurementResultsPrompting>
// )

const problemBehaviors = computed(() => {
  const pbs = props.target?.target_problem_behaviors || []
  return [...pbs].sort((a, b) => (a.position || 0) - (b.position || 0))
})

const enableProblemBehavior = computed(() => {
  return props.target?.enable_problem_behavior && problemBehaviors.value.length
})

const recordedTrials = computed((): RecordedTrialModel[] => {
  if (!resultsState.value) return []
  const trials: RecordedTrialModel[] = []
  let keyCounter = 1

  const sortedKeys = Object.keys(resultsState.value).sort((a, b) => {
    const posA = resultsState.value[a]?.position || 0
    const posB = resultsState.value[b]?.position || 0
    return posA - posB
  })

  sortedKeys.forEach((key) => {
    const item = resultsState.value[key]
    if (item && item.enabled && item.score > 0) {
      // get prompt
      const promptId = Number(key)
      const prompt = props.target?.prompts?.find((p) => p.id === promptId)

      const problemBehaviorIds = item.problem_behaviors || []
      for (let i = 0; i < item.score; i++) {
        // get problem behavior
        const problemBehaviorId = problemBehaviorIds[i]
          ? Number(problemBehaviorIds[i]) || null
          : null
        const problemBehavior = problemBehaviors.value.find((p) => p.id === problemBehaviorId)

        const trial: RecordedTrialModel = {
          key: keyCounter++,
          promptId,
          prompt,
          problemBehaviorId,
          problemBehaviorIndex: i,
          problemBehavior
        }

        trials.push(trial)
      }
    }
  })

  return trials
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
  if (!resultsState.value) return 0
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
  () => props.measurementResults,
  (val) => {
    resultsState.value = val as Record<string, MeasurementResultsPrompting>
  },
  { deep: true }
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

    const res = (props.measurementResults || {}) as Record<string, MeasurementResultsPrompting>
    const keys = Object.keys(res)
    if (keys && keys.length) {
      const n = keys
        .map((i) => ({ ...res[i], key: i }))
        .sort((a, b) => (a?.position || 0) - (b?.position || 0))
      defaultPrompts.value = n as Partial<Prompt>[]
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

const _onSaveScore = async (prompt: any, gapScore: number) => {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    params: {
      results: { [prompt.key]: gapScore }
    },
    dataResult: { ...props.measurement, results: resultsState.value },
    lastData: { ...props.measurement }
  }

  scoreLoadingBox.value = prompt.key
  typeLoadingBox.value = gapScore
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoadingBox.value = null
  typeLoadingBox.value = null

  if (!success) {
    resultsState.value = { ...(props.measurementResults || {}) } as Record<
      string,
      MeasurementResultsPrompting
    >
    toast.error(message)
    return
  }

  if (data?.results) {
    resultsState.value = { ...data.results }
  }
}

//

const getPromptScore = (id: number | string) => {
  const found = props.target?.prompts?.find((i) => i.id === Number(id))
  return found ? Number(found.score || 0) : 0
}

const onSelectProblemBehavior = async (pb: any) => {
  const currentPbId = selectedProblemBehaviorId.value
  const newPbId = currentPbId === pb.id ? null : pb.id
  selectedProblemBehaviorId.value = newPbId

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    params: {
      measurement: {
        results: { target_problem_behavior_id: newPbId }
      }
    },
    dataResult: { ...props.measurement, results: resultsState.value },
    lastData: { ...props.measurement }
  }
  await sessionStore.updateMeasurementResults(params)
}

const onOpenTrialPbSheet = (trial: RecordedTrialModel) => {
  selectedTrialForPb.value = trial
  showTrialPbSheet.value = true
}

const onSelectTrialPb = async (pbId: number | null) => {
  if (!selectedTrialForPb.value) return
  const trialKey = selectedTrialForPb.value.key
  showTrialPbSheet.value = false

  const payload: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    params: {
      results: {
        trial_key: trialKey,
        target_problem_behavior_id: pbId
      }
    },
    dataResult: { ...props.measurement, results: resultsState.value },
    lastData: { ...props.measurement }
  }
  const { success, data } = await sessionStore.updateMeasurementResults(payload)
  if (success && data?.results) {
    resultsState.value = { ...data.results }
  }
}

const onDeleteTrialEntry = (trialKey: number) => {
  const trial = recordedTrials.value.find((t) => t.key === trialKey)
  if (!trial) return
  const prompt = promptBoxesPages.value
    .flat()
    .find((p) => Number(p.key) === Number(trial.prompt_id))
  if (prompt && prompt.score > 0) {
    onChangeScore(prompt, -1)
  }
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

  const res = (props.measurementResults || {}) as Record<string, MeasurementResultsPrompting>
  const gapScore = newScore - (res[prompt.key]?.score || 0)

  if (gapScore > 0) {
    selectedProblemBehaviorId.value = null
  }

  // record session activities
  sessionStore.addSessionActivity({
    action_label: score === 1 ? `prompting_add` : `prompting_subtract`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}/update_results`,
    params: { results: { [prompt.key]: gapScore } },
    notes: `Target: ${props.measurement.target?.name} [${prompt.key} ${prompt.name}: ${newScore}]`,
    timestamp: new Date().toISOString()
  })

  _onSaveScore(prompt, gapScore)
}

const onToggleEnabledPrompt = (prompt: Prompt) => {
  const index = defaultPrompts.value.findIndex((i) => Number(i.key) === Number(prompt.key))
  if (index > -1) {
    defaultPrompts.value[index].enabled = !prompt.enabled
  }
}

const onSavePrompts = async () => {
  const payload = {
    id: props.measurement.id,
    params: { measurement: { results: {} as Record<string, Prompt> } },
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
  resultsState.value = {
    ...((props.measurementResults || {}) as Record<string, MeasurementResultsPrompting>)
  }
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
  <div class="flex flex-col flex-grow gap-2 justify-between h-full">
    <div
      v-if="scoreLoadingBox !== null"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-16 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <!-- 1. Inline Problem Behaviors View -->
    <div
      v-if="isOpenProblemBehavior"
      class="flex flex-col justify-between items-center pt-2 pb-2 h-full"
    >
      <div class="text-xs font-medium text-slate-6">
        Problem behavior
        <span v-if="lastPromptName">
          · for <span class="font-semibold text-slate-8">{{ lastPromptName }}</span>
        </span>
      </div>

      <div
        class="flex gap-3 pt-2"
        :class="
          isCollapsed
            ? 'w-full flex-nowrap justify-start overflow-x-auto px-2 py-1'
            : 'flex-wrap justify-center'
        "
      >
        <button
          v-for="pb in problemBehaviors"
          :key="pb.id"
          type="button"
          class="flex flex-col justify-center items-center w-16 h-16 rounded-2xl border transition-all cursor-pointer shrink-0 hover:brightness-95"
          :class="[
            lastTrial?.target_problem_behavior_id === pb.id || selectedProblemBehaviorId === pb.id
              ? 'border-[#FF4447] bg-[#FF4447] font-bold text-white'
              : 'border-[#FFC1C2] bg-[#FFF0F0] font-bold text-[#FF4447]'
          ]"
          @click="onSelectProblemBehavior(pb)"
        >
          <span class="text-2xl font-bold">{{ pb.code }}</span>
        </button>
      </div>

      <div v-if="!isCollapsed" class="px-4 text-xs font-medium text-center text-slate-8">
        {{ selectedPbDefinition || 'Select a problem behavior to record' }}
      </div>

      <AppButton kind="outline" class="mt-2 w-full" @click="isOpenProblemBehavior = false">
        {{ isCollapsed ? 'Back to result' : 'Back to prompts' }}
      </AppButton>
    </div>

    <!-- 2. Inline Trial History View -->
    <div v-else-if="isOpenTrialHistory" class="flex flex-col justify-between pt-1 pb-2 h-full">
      <div class="px-2 pb-1 text-sm font-semibold border-b border-slate-3 text-slate-8">
        {{ target?.name }}
      </div>

      <div class="flex overflow-y-auto flex-col flex-grow">
        <div
          v-for="trial in recordedTrials"
          :key="trial.key"
          class="flex justify-between items-center px-2 py-2 border-b border-slate-2"
        >
          <div class="flex gap-2 items-center">
            <span class="w-4 text-xs font-medium text-slate-6">{{ trial.key }}.</span>
            <div
              class="flex h-6 min-w-[28px] items-center justify-center rounded px-1.5 text-xs font-bold"
              :style="{
                backgroundColor: promptColors[trial.prompt?.color || 'cherry']?.primaryColor,
                borderColor: promptColors[trial.prompt?.color || 'cherry']?.secondaryColor,
                color: promptColors[trial.prompt?.color || 'cherry']?.textColor
              }"
            >
              {{ trial.prompt?.abbreviation || 'P' }}
            </div>

            <!-- Problem Behavior Button (AppActionSheet Picker on Mobile) -->
            <div v-if="problemBehaviors.length" class="relative">
              <button
                type="button"
                class="flex gap-1 justify-center items-center px-2 h-6 text-xs font-bold rounded border transition-colors cursor-pointer"
                :class="[
                  trial.target_problem_behavior_id
                    ? 'border-[#FF4447] bg-[#FF4447] text-white'
                    : 'border-[#FFC1C2] bg-[#FFF0F0] text-[#FF4447]'
                ]"
                @click="onOpenTrialPbSheet(trial)"
              >
                <span>{{ trial.problem_behavior?.code || '-' }}</span>
                <Icon icon="ph:caret-down-bold" class="text-[10px]" />
              </button>
            </div>
          </div>

          <div class="flex gap-1.5 items-center">
            <button
              type="button"
              class="p-1 rounded text-slate-5 hover:text-slate-8"
              title="Edit"
              @click="
                () => {
                  isOpenTrialHistory = false
                  isOpenProblemBehavior = true
                }
              "
            >
              <Icon icon="ph:pencil-simple" class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1 rounded text-tulip-6 hover:text-tulip-8"
              title="Delete"
              @click="onDeleteTrialEntry(trial.key)"
            >
              <Icon icon="ph:trash" class="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        <div v-if="!recordedTrials.length" class="py-6 text-xs text-center text-slate-5">
          No recorded trials yet
        </div>
      </div>

      <AppButton kind="outline" class="mt-2 w-full" @click="isOpenTrialHistory = false">
        Back
      </AppButton>
    </div>

    <!-- 3. Default Prompts Grid View -->
    <div v-else class="flex flex-col flex-grow gap-2 justify-between h-full">
      <div class="flex flex-grow justify-center content-center items-center h-full">
        <div
          class="flex w-[calc(320px-32px)] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4"
          @scroll="onScroll"
        >
          <div
            v-for="(promptBoxes, idx) in promptBoxesPages"
            :key="`${measurement.id}-prompt-boxes-${idx + 1}`"
            :id="`${measurement.id}-prompt-boxes-${idx + 1}`"
            class="flex w-[calc(320px-32px)] shrink-0 snap-start justify-center"
          >
            <div
              class="flex w-[calc(240px+24px)] flex-wrap content-center items-start justify-center gap-x-3 gap-y-4"
              :class="{ '-translate-y-1 scale-75': isCollapsed }"
            >
              <div v-for="prompt in promptBoxes" :key="prompt.id" class="space-y-1">
                <div
                  class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] border text-4xl font-bold transition-colors"
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
                  <div class="absolute top-px text-xs font-semibold">{{ prompt.abbreviation }}</div>
                  <div v-if="prompt.score">{{ prompt.score }}</div>
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
                    :class="{ 'bg-slate-5': !prompt.score, 'bg-slate-6': prompt.score }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed PB toggle button OUTSIDE scrollable container when collapsed (Right side, matching desktop) -->
        <div
          v-if="isCollapsed && problemBehaviors.length > 0"
          class="flex justify-center items-center pb-4 ml-2 transition-transform scale-75 -translate-y-1 shrink-0"
        >
          <button
            type="button"
            class="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-[20px] border font-bold transition-all"
            :class="[
              selectedProblemBehaviorId
                ? 'border-[#FF4447] bg-[#FF4447] font-bold text-white'
                : 'border-[#FFC1C2] bg-[#FFF0F0] font-bold text-[#FF4447] hover:bg-[#FFE5E5]'
            ]"
            title="Record problem behavior"
            @click="isOpenProblemBehavior = true"
          >
            <span class="text-3xl font-bold">{{ selectedPbCode }}</span>
          </button>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="pb-3 space-y-2 shrink-0" :class="{ '-translate-y-4': isCollapsed }">
        <div class="flex gap-2 justify-center items-center h-2">
          <div
            v-for="n in pageCount"
            :key="n"
            :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
            class="w-2 h-2 rounded-full transition-colors"
          ></div>
        </div>

        <div v-if="!isCollapsed" class="flex gap-2 justify-between items-center px-2 mt-1 w-full">
          <!-- ≡ Trial History List Button (Left) -->
          <button
            type="button"
            class="flex justify-center items-center w-8 h-8 bg-white rounded border transition-colors cursor-pointer shrink-0 border-slate-4 text-slate-7 hover:bg-slate-2"
            title="Trial history"
            @click="isOpenTrialHistory = true"
          >
            <Icon icon="ph:list" class="w-5 h-5" />
          </button>

          <!-- Goal / Score Text (Center) -->
          <div class="flex justify-center items-center text-center grow">
            <div
              v-if="measurement?.target?.prompting_format === 'classic'"
              class="text-xs font-medium text-center text-slate-7"
            >
              Goal: {{ measurement.target?.goal }} attempt(s)
              {{ measurement.target?.success_metric }} prompt
            </div>
            <div
              v-if="measurement?.target?.prompting_format === 'custom'"
              class="text-xs font-medium text-center text-slate-7"
            >
              <span v-if="measurement?.target?.success_metric === 'equal to or greater than goal'">
                Goal: ≥ {{ `${measurement?.target?.goal}%` }}
              </span>
              <span v-if="measurement?.target?.success_metric === 'less than goal'">
                Goal: {{ '<' }} {{ `${measurement?.target?.goal}%` }}
              </span>
              <span class="w-2 shrink-0"></span>
              Score {{ `${currentScore}%` }}
            </div>
          </div>

          <!-- R / R1 PB Toggle Button (Right) -->
          <button
            v-if="problemBehaviors.length > 0"
            type="button"
            class="flex justify-center items-center w-8 h-8 rounded border transition-colors cursor-pointer shrink-0"
            :class="[
              selectedProblemBehaviorId
                ? 'border-[#FF4447] bg-[#FF4447] font-bold text-white'
                : 'border-[#FFC1C2] bg-[#FFF0F0] font-bold text-[#FF4447] hover:bg-[#FFE5E5]'
            ]"
            title="Record problem behavior"
            @click="isOpenProblemBehavior = true"
          >
            <span class="text-xs font-bold">{{ selectedPbCode }}</span>
          </button>
        </div>
      </div>

      <AppButton
        v-if="sessionStore.session?.status === 'draft'"
        kind="outline"
        class="pointer-events-auto"
        @click="isOpenCustomize = !isOpenCustomize"
      >
        Customize prompt visibility
      </AppButton>
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
    :show="showTrialPbSheet"
    @close="showTrialPbSheet = false"
    class="pointer-events-auto"
  >
    <div>
      <div
        class="flex sticky top-0 z-10 justify-between items-center px-1 py-3 bg-white border-b border-slate-3"
      >
        <div class="text-lg font-semibold text-slate-9">Select Problem Behavior</div>
        <div class="cursor-pointer" @click="showTrialPbSheet = false">
          <Icon icon="ph:x" class="text-2xl text-slate-7" />
        </div>
      </div>

      <div class="max-h-[60vh] overflow-y-auto py-2">
        <div
          class="flex justify-between items-center px-3 w-full h-14 border-b transition-colors cursor-pointer border-slate-3 hover:bg-slate-1"
          :class="{ 'bg-slate-2 font-semibold': !selectedTrialForPb?.target_problem_behavior_id }"
          @click="onSelectTrialPb(null)"
        >
          <div class="text-sm text-slate-8">- None</div>
          <Icon
            v-if="!selectedTrialForPb?.target_problem_behavior_id"
            icon="ph:check-bold"
            class="text-xl text-tulip-7"
          />
        </div>

        <div
          v-for="pb in problemBehaviors"
          :key="pb.id"
          class="flex justify-between items-center px-3 w-full h-14 border-b transition-colors cursor-pointer border-slate-3 hover:bg-slate-1"
          :class="{
            'bg-slate-2 font-semibold': selectedTrialForPb?.target_problem_behavior_id === pb.id
          }"
          @click="onSelectTrialPb(pb.id || null)"
        >
          <div class="flex gap-3 items-center">
            <div class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: pb.color }"></div>
            <div class="text-sm text-slate-8">{{ pb.code }} - {{ pb.code_definition }}</div>
          </div>
          <Icon
            v-if="selectedTrialForPb?.target_problem_behavior_id === pb.id"
            icon="ph:check-bold"
            class="text-xl text-tulip-7"
          />
        </div>
      </div>
    </div>
  </AppActionSheet>
</template>
