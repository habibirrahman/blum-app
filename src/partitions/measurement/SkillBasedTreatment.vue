<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import type { Measurement, Prompt, Target, TargetProblemBehavior, TargetTask } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import AppButton from '@/components/AppButton.vue'

const sessionStore = useSessionStore()
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
  target_task_id?: TargetTask['id']
  prompt_id?: Prompt['id']
  target_problem_behavior_id?: TargetProblemBehavior['id'] | null
}

watch(
  () => props.is_collapsed,
  () => {
    setTimeout(() => {
      const el = `${props.measurement.id}-sbt-prompt-boxes-${1}`
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

const isSaved = ref<boolean>(true)
watch(
  () => isSaved.value,
  (val) => {
    emit('toggle-saved', val)
  }
)

const page = ref<number>(1)
const display = ref<'select-prompt' | 'select-next-task'>('select-prompt')
const activeTrial = ref<Trial>({
  key: '0',
  target_task_id: 0,
  prompt_id: 0,
  target_problem_behavior_id: null
})
const editTrial = ref<Trial>({
  key: '0',
  target_task_id: 0,
  prompt_id: 0,
  target_problem_behavior_id: null
})
const nextTask = ref<any>()
const ratioScores = ref<any[]>([])
const resultsState = ref<Measurement['results']>({})
const isOpenProblemBehavior = ref<boolean>(false)
const isOpenTrialHistory = ref<boolean>(false)
const isOpenEditTrial = ref<boolean>(false)
const SBTPrompts = ref<Prompt[]>([])
const SBTTaskCodes = ref<TargetTask[]>([])
const SBTProblemBehaviors = ref<TargetProblemBehavior[]>([])

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

onMounted(() => {
  const prompts = props.target?.prompts || []
  const tasks = props.target?.target_tasks || []
  const problems = props.target?.target_problem_behaviors || []
  SBTPrompts.value = prompts.sort((a, b) => (b?.score || 0) - (a?.score || 0))
  SBTTaskCodes.value = tasks.sort((a, b) => (a?.position || 0) - (b?.position || 0))
  SBTProblemBehaviors.value = problems.sort((a, b) => (a?.position || 0) - (b?.position || 0))
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
      const index = SBTTaskCodes.value.findIndex((i) => i.id === lastTrial.target_task_id)
      let nextTaskId: number | undefined = 0
      if (index > -1 && index + 1 <= SBTTaskCodes.value.length - 1) {
        nextTaskId = SBTTaskCodes.value[index + 1].id
      } else if (SBTTaskCodes.value.length) {
        nextTaskId = SBTTaskCodes.value[0].id
      }
      const newTrial: Trial = {
        key: Number(lastTrial.key) + 1 + '',
        target_task_id: nextTaskId,
        prompt_id: 0,
        target_problem_behavior_id: null // optional
      }
      resultsState.value[newTrial.key] = {
        key: newTrial.key,
        target_task_id: newTrial.target_task_id,
        prompt_id: newTrial.prompt_id,
        target_problem_behavior_id: newTrial.target_problem_behavior_id // optional
      }
      currentTrial.value = newTrial
    }
  } else {
    const newTrial: Trial = {
      key: '1',
      target_task_id: 0,
      prompt_id: 0,
      target_problem_behavior_id: null // optional
    }
    if (SBTTaskCodes.value.length) {
      newTrial.target_task_id = SBTTaskCodes.value[0].id
    }
    resultsState.value[newTrial.key] = {
      key: newTrial.key,
      target_task_id: newTrial.target_task_id,
      prompt_id: newTrial.prompt_id,
      target_problem_behavior_id: newTrial.target_problem_behavior_id // optional
    }
    currentTrial.value = newTrial
  }
})

const onScroll = (e: any) => {
  const offsetWidth = e.currentTarget.offsetWidth
  const scrollLeft = e.currentTarget.scrollLeft
  const current = Math.floor(scrollLeft / offsetWidth) + 1
  page.value = current
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

const perPage = computed<number>(() => (props.is_collapsed ? 3 : 9))
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

const onOpenTrialHistory = () => {
  isOpenTrialHistory.value = true
}
const onCloseTrialHistory = () => {
  isOpenTrialHistory.value = false

  const results = Object.keys(resultsState.value).map((key) => ({
    ...resultsState.value[key],
    key
  }))

  const index = results.findIndex((i) => i.key === currentTrial.value.key)
  if (index > -1) {
    currentTrial.value = results[index]
  }

  if (
    Object.keys(resultsState.value).length > 0 &&
    resultsState.value[currentTrial.value.key] &&
    resultsState.value[currentTrial.value.key].prompt_id
  ) {
    display.value = 'select-next-task'
  } else {
    display.value = 'select-prompt'
  }
}

const submitLoading = ref<boolean>(false)

const onSaveCurrentTrial = async () => {
  if (sessionStore.session?.status !== 'ongoing') return { success: false }
  if (submitLoading.value) return { success: false }

  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })

  const index = results.findIndex((i) => i.key === currentTrial.value.key)
  if (index > -1) {
    results[index] = currentTrial.value
  } else {
    results.push(currentTrial.value)
  }

  results = results
    .filter((i) => i.prompt_id && i.target_task_id)
    .map((i, idx) => ({ ...i, key: idx + 1 }))

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: {},
    data_result: { ...props.measurement, results: {} }
  }
  for (let idx = 0; idx < results.length; idx++) {
    params.results[idx + 1] = results[idx]
    params.data_result.results[idx + 1] = results[idx]
  }

  submitLoading.value = true
  const { success, message, data } = await sessionStore.updateMeasurementResults(params)
  submitLoading.value = false
  if (!success) {
    emit('fetch-session')
    toast.error(message)
    return { success: false }
  }

  // complete saved
  isSaved.value = true
  resultsState.value = data.results
  return { success: true }
}

const onChoosePrompt = async (prompt: Prompt) => {
  if (sessionStore.session?.status !== 'ongoing') return
  const newTrial: Trial = {
    ...currentTrial.value,
    prompt_id: prompt.id
  }

  // choose new prompt value
  isSaved.value = false
  currentTrial.value = newTrial

  // if edit trial - skip assign next task and select-nest-task
  if (isOpenEditTrial.value) {
    return
  }

  await onSaveCurrentTrial()

  const index = ratioScores.value.findIndex((i) => i.id === newTrial.target_task_id)
  if (index > -1 && index + 1 <= ratioScores.value.length - 1) {
    nextTask.value = ratioScores.value[index + 1]
  } else {
    nextTask.value = ratioScores.value[0]
  }
  display.value = 'select-next-task'
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

  // choose new problem behavior value
  isSaved.value = false
  currentTrial.value = newTrial

  if (isOpenEditTrial.value) {
    return
  }

  await onSaveCurrentTrial()
}

const onUndoTrial = () => {
  if (sessionStore.session?.status !== 'ongoing') return
  const results = Object.keys(resultsState.value).map((key) => ({
    ...resultsState.value[key],
    key
  }))

  let newTrial: Trial = {
    key: '1',
    target_task_id: 0,
    prompt_id: 0,
    target_problem_behavior_id: null // optional
  }
  if (results.length) {
    // take last trial for current trial
    newTrial = {
      ...results[results.length - 1],
      key: results.length
    }
  }
  // change active trial
  currentTrial.value = newTrial

  // change next task
  const index = ratioScores.value.findIndex((i) => i.id === newTrial.target_task_id)
  if (index > -1 && index + 1 <= ratioScores.value.length - 1) {
    nextTask.value = ratioScores.value[index + 1]
  } else {
    nextTask.value = ratioScores.value[0]
  }

  display.value = 'select-next-task'

  // re-select next task
  isSaved.value = false
}
const onTakeNextTrial = (payload: { isNew: boolean }) => {
  if (sessionStore.session?.status !== 'ongoing') return
  const newKey = payload.isNew ? Number(currentTrial.value.key) + 1 + '' : currentTrial.value.key
  const newTrial: Trial = {
    key: newKey,
    target_task_id: nextTask.value.id,
    prompt_id: 0,
    target_problem_behavior_id: null // optional
  }
  resultsState.value[newTrial.key] = {
    key: newTrial.key,
    target_task_id: newTrial.target_task_id,
    prompt_id: newTrial.prompt_id,
    target_problem_behavior_id: newTrial.target_problem_behavior_id // optional
  }
  display.value = 'select-prompt'
  currentTrial.value = newTrial
  nextTask.value = {}
  generateRatioScores()
}

const onNextTrial = async () => {
  const { success } = await onSaveCurrentTrial()
  if (!success) return
  onTakeNextTrial({ isNew: true })
}

const onOpenEditTrial = (key: Trial['key']) => {
  let results = Object.keys(resultsState.value).map((key) => {
    return { ...resultsState.value[key], key }
  })
  const index = results.findIndex((i) => i.key === key)
  if (index > -1) {
    isOpenEditTrial.value = true
    currentTrial.value = results[index]
    display.value = 'select-prompt'

    // open edit trial
    isSaved.value = false
  }
}
const onCloseEditTrial = () => {
  // cancel edit trial
  isSaved.value = true
  isOpenEditTrial.value = false
}
const onSaveEditTrial = async () => {
  const { success } = await onSaveCurrentTrial()
  if (!success) return
  isOpenEditTrial.value = false
  generateRatioScores()
}
</script>

<template>
  <div class="relative flex h-full flex-grow flex-col">
    <!-- ratio boxes -->
    <div
      v-if="!is_collapsed"
      :id="`sbt-ratio-${measurement.id}-${JSON.stringify(currentTrial)}`"
      class="flex flex-wrap items-center justify-center gap-1 pb-2"
    >
      <div
        v-for="taskCode in ratioScores"
        :key="taskCode.id"
        class="relative flex h-10 w-10 flex-col-reverse items-center overflow-hidden rounded border transition-all duration-300"
        :class="{
          'border-slate-2 bg-slate-2': taskCode.count <= 0,
          'border-teal-1 bg-teal-1': taskCode.count >= 1,
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
              class="absolute right-0 top-0 z-10 h-full bg-tomato-6"
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
    <div v-if="!isOpenTrialHistory || isOpenEditTrial" class="flex h-full flex-col">
      <!-- header information for active trial -->
      <div
        class="flex shrink-0 items-center justify-between"
        :class="{
          'h-8': !is_collapsed,
          'h-6': is_collapsed
        }"
      >
        <div class="flex items-center gap-1">
          <div class="text-sm text-slate-7">Current</div>
          <div class="text-sm font-semibold text-teal-8">
            {{ currentTrialData.task_code.code }}
          </div>
          <div
            v-if="display === 'select-next-task' && !isOpenEditTrial"
            class="text-sm font-semibold text-teal-8"
          >
            | {{ currentTrialData.average }}%
          </div>
          <Icon
            v-if="display === 'select-prompt' && !isOpenEditTrial"
            icon="ph:pencil-simple"
            class="text-teal-7"
            @click="onUndoTrial"
          />
        </div>
        <div class="flex items-center gap-1">
          <div class="text-sm text-slate-7">Trial</div>
          <div class="text-sm font-semibold text-teal-8">
            {{ currentTrial.key }}
          </div>
        </div>
      </div>

      <div v-if="!isOpenProblemBehavior" class="h-full">
        <!-- select a prompt -->
        <div
          v-if="display === 'select-prompt'"
          class="flex h-full flex-col content-center items-center justify-center gap-2"
        >
          <div
            :id="`sbt-scroll-${measurement.id}`"
            class="scrolling-touch flex w-full max-w-72 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4"
            dir="ltr"
            @scroll="onScroll"
          >
            <div
              v-for="(promptBoxes, idx) in promptBoxesPages"
              :key="`${measurement.id}-sbt-prompt-boxes-${idx + 1}`"
              :id="`${measurement.id}-sbt-prompt-boxes-${idx + 1}`"
              class="flex w-full shrink-0 snap-center justify-center"
            >
              <div
                class="flex w-full flex-wrap content-center items-start justify-center gap-x-2 gap-y-3"
                :class="{ '-translate-y-1 scale-75': is_collapsed }"
              >
                <div v-for="(prompt, promptIdx) in promptBoxes" :key="promptIdx">
                  <div
                    class="relative flex h-[72px] w-[72px] shrink-0 cursor-pointer items-center justify-center rounded-3xl transition-all duration-300 hover:brightness-95"
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
          <div v-if="pageCount > 1" class="flex h-3 items-center justify-center gap-2">
            <div
              v-for="(n, idx) in pageCount"
              :key="idx"
              :class="{
                'bg-slate-7': n === page,
                'bg-slate-4': n !== page
              }"
              class="h-3 w-3 rounded-full transition-all duration-300"
            ></div>
          </div>
        </div>

        <!-- select a next task -->
        <div
          v-if="display === 'select-next-task'"
          class="flex h-full flex-col content-center items-center justify-center"
          :class="{
            'gap-4': !is_collapsed,
            'gap-2': is_collapsed
          }"
        >
          <div
            v-if="currentTrial.prompt_id"
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
              class="text-teal-7"
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
              @click="display = 'select-prompt'"
            >
              Change
            </AppButton>
          </div>
          <div class="flex flex-col items-center gap-1">
            <div v-if="!is_collapsed" class="text-center text-sm text-slate-8">
              {{ currentTrial.prompt_id ? 'Next' : 'Select a task to start' }}
            </div>
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
                  v-for="taskCode in ratioScores"
                  :key="taskCode.id"
                  color="teal"
                  :kind="taskCode.id === nextTask.id ? 'primary' : 'outline'"
                  size="sm"
                  class="shrink-0"
                  @click="nextTask = taskCode"
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
        class="flex h-full w-full flex-col content-center items-center justify-center"
        :class="{
          'gap-2': !is_collapsed
        }"
      >
        <div
          class="flex w-full flex-wrap content-center items-start justify-center gap-x-2 gap-y-3"
          :class="{ '-translate-y-1 scale-75': is_collapsed }"
        >
          <div v-for="(problemBehavior, idx) in SBTProblemBehaviors" :key="idx">
            <div
              class="relative flex shrink-0 cursor-pointer items-center justify-center rounded-3xl transition-all duration-300 hover:brightness-90"
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
          class="flex items-center justify-between border-b border-slate-3 px-2 py-3"
        >
          <div class="flex items-center gap-2">
            <div class="w-6 shrink-0 text-sm text-slate-8">{{ key }}.</div>
            <div class="tex-sm font-semibold text-slate-7">
              {{ getCode(resultsState[key].target_task_id, 'task_code') }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div
              v-if="resultsState[key].target_problem_behavior_id"
              class="flex h-6 w-6 items-center justify-center rounded bg-tomato-7"
            >
              <span class="text-sm font-semibold text-white">
                {{ getCode(resultsState[key].target_problem_behavior_id, 'problem_behavior') }}
              </span>
            </div>
            <div class="flex h-6 w-6 items-center justify-center rounded bg-teal-7">
              <span class="text-sm font-semibold text-white">
                {{ getCode(resultsState[key].prompt_id, 'prompt') }}
              </span>
            </div>
            <Icon icon="ph:pencil-simple" class="text-slate-8" @click="onOpenEditTrial(key)" />
          </div>
        </div>
        <div
          v-else-if="Object.keys(resultsState).length === 1"
          class="py-4 text-center text-sm text-slate-8"
        >
          Trial history not found.
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="!is_collapsed || display === 'select-next-task'"
    class="sticky -bottom-3 z-10 w-full bg-white py-3"
  >
    <div v-if="isOpenProblemBehavior" class="flex-grow">
      <AppButton
        kind="outline"
        class="w-full"
        :size="is_collapsed ? 'sm' : 'base'"
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
        @click="onCloseTrialHistory"
      >
        Back
      </AppButton>
    </div>
    <div v-else class="flex shrink-0 items-center justify-between gap-3">
      <AppButton
        v-if="!isOpenEditTrial && !is_collapsed"
        kind="outline"
        class="shrink-0"
        @click="onOpenTrialHistory"
      >
        <Icon icon="material-symbols:menu-rounded" class="text-xl" />
      </AppButton>
      <AppButton
        v-if="isOpenEditTrial && !is_collapsed"
        kind="outline"
        class="shrink-0"
        @click="onCloseEditTrial"
      >
        <Icon icon="material-symbols:menu-rounded" class="text-xl" />
      </AppButton>

      <div
        v-if="nextTask?.code && display === 'select-next-task' && !isOpenEditTrial"
        class="flex-grow"
      >
        <AppButton
          v-if="currentTrial.prompt_id"
          color="teal"
          class="w-full"
          :loading="submitLoading"
          @click="onNextTrial"
        >
          Next: {{ nextTask.code }} | {{ nextTask.count + 1 }}
        </AppButton>
        <AppButton
          v-else
          color="teal"
          class="w-full"
          :loading="submitLoading"
          @click="onTakeNextTrial({ isNew: true })"
        >
          Start trial: {{ nextTask.code }}
        </AppButton>
      </div>
      <div v-if="isOpenEditTrial" class="flex-grow">
        <AppButton color="teal" class="w-full" :loading="submitLoading" @click="onSaveEditTrial">
          Update
        </AppButton>
      </div>
      <div
        v-if="Object.keys(resultsState).length > 1 || currentTrial.prompt_id"
        class="flex h-10 w-10 cursor-pointer items-center justify-center rounded transition-all duration-300 hover:brightness-90"
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
</template>
