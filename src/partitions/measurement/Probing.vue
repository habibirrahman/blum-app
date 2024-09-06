<script setup lang="ts">
import {
  useSessionStore,
  type MeasurementMarkProbingParams,
  type MeasurementResultsParams
} from '@/stores/session.store'
import { computed, ref } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { TransitionRoot } from '@headlessui/vue'
import Button from '@/components/Button.vue'
import Chip from '@/components/Chip.vue'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
}
const props = withDefaults(defineProps<Props>(), {})

interface ProbingCircle {
  key: number | string
  value: boolean | 'empty' | 'removing'
}
const page = ref<number>(1)
const perPage = computed<number>(() => 20)
const pageCount = computed<number>(() => {
  let circles = Object.keys(props.measurement.results).length
  if (!props.measurement.submitted_at) circles++
  return Math.ceil(circles / perPage.value)
})
const probingCircles = computed(() => {
  const circles: ProbingCircle[] = Object.keys(props.measurement.results).map((key) => ({
    key,
    value: props.measurement.results[key]
  }))
  if (!props.measurement.submitted_at) circles.push({ key: 0, value: 'empty' })
  const start = (page.value - 1) * perPage.value
  const end = page.value * perPage.value
  return circles.slice(start, end)
})
const probingScore = computed(() => {
  const results = props.measurement.results
  const trials = Object.values(results).length
  const totalSuccess = Object.values(results).filter((i) => i).length
  return (totalSuccess / trials) * 100 || 0
})

const probingLoading = ref<boolean>(false)
const onAdd = async (bool: boolean) => {
  const params: MeasurementResultsParams = {
    id: props.measurement.id,
    results: { ...props.measurement.results }
  }
  const length = Object.keys(params.results).length
  params.results[length] = bool
  probingLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  probingLoading.value = false
  if (!success) return
  const newLength = Object.keys(params.results).length
  page.value = Math.floor(newLength / perPage.value) + 1
}
const onRemove = async (circle: ProbingCircle) => {
  const params: MeasurementResultsParams = {
    id: props.measurement.id,
    results: {}
  }
  const res = props.measurement.results
  res[circle.key] = 'removing'
  let idx = 0
  Object.keys(res).forEach((key) => {
    if (key !== circle.key) {
      params.results[idx] = res[key]
      idx++
    }
  })
  probingLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  probingLoading.value = false
}

const showPanel = ref<boolean>(false)
const isProbingPassed = ref<boolean>(false)
const showCelebration = ref<boolean>(false)
const onSubmitProbing = () => {
  probingAction.value = null
  showPanel.value = true
  isProbingPassed.value = probingScore.value >= (props.measurement.target?.probing_goal || 0)
  if (isProbingPassed.value) {
    showCelebration.value = true
    setTimeout(() => {
      showCelebration.value = false
    }, 2000)
  }
}

interface ProbingAction {
  id: string
  visible: boolean
  marked_as: 'mastered' | 'in_progress'
  title: string
  status: 'mastered' | 'in_progress' | null
  message: string | null
}
const probingAction = ref<ProbingAction | null>(null)
const probingActionOptions = computed(() => {
  const passed: ProbingAction[] = [
    {
      id: 'pass_and_mastered',
      visible: true,
      marked_as: 'mastered',
      title: 'Marked as',
      status: 'mastered',
      message: 'No further teaching needed. The target will be added to the cumulative graph.'
    },
    {
      id: 'pass_and_conduct_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: props.measurement.target?.status === 'pending' ? 'Marked as' : 'Keep as',
      status: 'in_progress',
      message: 'Conduct teaching immediately.'
    },
    {
      id: 'pass_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: props.measurement.target?.status === 'pending' ? 'Marked as' : 'Keep as',
      status: 'in_progress',
      message: 'Postpone teaching to the next session.'
    }
  ]
  const failed: ProbingAction[] = [
    {
      id: 'fail_and_start_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: 'Start teaching now',
      status: null,
      message: null
    },
    {
      id: 'fail_and_next',
      visible: true,
      marked_as: 'in_progress',
      title: 'Next session',
      status: null,
      message: null
    }
  ]
  const passedInMastered: ProbingAction[] = [
    {
      id: 'pass_and_keep_mastered',
      visible: true,
      marked_as: 'mastered',
      title: 'Keep as',
      status: 'mastered',
      message: 'No further action is required.'
    },
    {
      id: 'pass_and_conduct_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'in_progress',
      message: 'Conduct teaching immediately.'
    },
    {
      id: 'pass_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'in_progress',
      message: 'Postpone teaching to the next session.'
    }
  ]
  const failedInMastered: ProbingAction[] = [
    {
      id: 'fail_and_restart_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'in_progress',
      message: 'Restart teaching immediately.'
    },
    {
      id: 'fail_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'in_progress',
      message: 'Postpone teaching to the next session.'
    },
    {
      id: 'fail_and_keep_mastered',
      visible: true,
      marked_as: 'mastered',
      title: 'Keep as',
      status: 'mastered',
      message: 'No further action is required.'
    }
  ]
  if (props.measurement.target?.status === 'mastered') {
    return isProbingPassed.value ? passedInMastered : failedInMastered
  } else {
    return isProbingPassed.value ? passed : failed
  }
})

const saveLoading = ref<boolean>(false)
const onSave = async () => {
  const params: MeasurementMarkProbingParams = {
    id: props.measurement.id,
    visible: probingAction.value?.visible,
    marked_as: probingAction.value?.marked_as
  }
  saveLoading.value = true
  const { success } = await sessionStore.updateMeasurementMarkProbing(params)
  saveLoading.value = false
  if (!success) return
  showPanel.value = false
}
</script>

<template>
  <div class="flex h-full flex-col content-center items-center justify-center gap-2">
    <div class="flex w-60 flex-wrap items-center justify-center gap-x-2 gap-y-2">
      <div
        v-for="box in probingCircles"
        :key="`${box.key}_${box.value}`"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
        :class="{
          'pointer-events-none':
            measurement.submitted_at ||
            probingLoading ||
            box.value === 'empty' ||
            box.value === 'removing',
          'bg-white': box.value === 'empty',
          'bg-lime-4': box.value === true,
          'bg-red-cherry': box.value === false,
          'opacity-100': box.value !== 'removing',
          'opacity-0': box.value === 'removing'
        }"
        @click="onRemove(box)"
      ></div>
    </div>
    <div v-if="measurement.submitted_at" class="flex w-60 justify-center">
      <Chip :chip="measurement.marked_as" />
    </div>
  </div>
  <div class="shrink-0 space-y-2">
    <div class="space-y-4">
      <div class="flex items-center justify-center gap-4">
        <div
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          :class="{
            'pointer-events-none': measurement.submitted_at || probingLoading,
            'bg-slate-5': measurement.submitted_at,
            'bg-red-cherry': !measurement.submitted_at
          }"
          @click="onAdd(false)"
        >
          <Icon icon="ph:x" class="h-10 w-10 text-white" />
        </div>
        <div
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          :class="{
            'pointer-events-none': measurement.submitted_at || probingLoading,
            'bg-slate-5': measurement.submitted_at,
            'bg-lime-4': !measurement.submitted_at
          }"
          @click.prevent="onAdd(true)"
        >
          <Icon icon="ph:check" class="h-10 w-10 text-white" />
        </div>
        <div
          v-if="
            !measurement.submitted_at &&
            Object.keys(measurement.results).length >=
              (measurement.target?.probing_number_of_trial || 0)
          "
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-light-purple-5"
          @click="onSubmitProbing"
        >
          <div class="text-sm font-semibold text-white">Submit</div>
        </div>
      </div>
      <div class="flex h-2 items-center justify-center gap-2">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="h-2 w-2 rounded-full transition-all"
          @click="page = n"
        ></div>
      </div>
    </div>
    <div class="flex items-center gap-2 text-xs font-medium text-slate-7">
      <div class="w-9 shrink-0">Score</div>
      <div class="h-4 rounded-full bg-lime-2 px-2 text-lime-7">{{ probingScore.toFixed(0) }}%</div>
    </div>
    <div class="flex items-center gap-2 text-xs font-medium text-slate-7">
      <div class="w-9 shrink-0">Goal</div>
      <div>
        score ≥ {{ measurement.target?.probing_goal }}% in minimum
        {{ measurement.target?.probing_number_of_trial }} trial(s)
      </div>
    </div>
  </div>

  <TransitionRoot
    :show="showPanel"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-75"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-75"
    class="absolute left-0 top-0 z-[1] h-full w-full rounded border-2 border-white"
    :style="{ background: 'linear-gradient(180deg, #F2F8CF 0%, #FFFFFF 100%)' }"
  >
    <div v-if="showCelebration" class="grid h-full w-full place-content-center">
      <img alt="celebration" class="h-72 w-72 rounded-full" src="@/assets/celebration.gif" />
    </div>
    <div
      v-if="!showCelebration"
      class="flex h-full w-full flex-col items-center justify-center gap-2"
    >
      <img
        v-if="isProbingPassed"
        alt="probing-confetti"
        class="absolute bottom-0 -z-[1] w-full"
        src="@/assets/probing-confetti.svg"
      />
      <img
        v-if="!isProbingPassed"
        alt="probing-failed"
        class="w-20"
        :class="{
          'absolute right-2 top-2 -z-[1] opacity-50': measurement.target?.status === 'mastered'
        }"
        src="@/assets/probing-failed.svg"
      />
      <div class="w-[270px] space-y-3">
        <div v-if="isProbingPassed" class="space-y-1 text-center">
          <div class="font-semibold text-lime-8">This target has probed out.</div>
          <div class="text-sm text-lime-7">What action would you like to take?</div>
        </div>
        <div v-if="!isProbingPassed" class="space-y-1 text-center">
          <div class="font-semibold text-lime-8">This target doesn't meet the goal.</div>
          <div class="text-sm text-lime-7">
            <span v-if="measurement.target?.status === 'mastered'">
              What action would you like to take?
            </span>
            <span v-else>
              Do you want to begin teaching now or postpone it to the next session?
            </span>
          </div>
        </div>
        <div
          v-for="opt in probingActionOptions"
          :key="opt.id"
          class="flex flex-col items-center justify-center gap-2 rounded-[10px] border bg-white p-3 text-center transition-all"
          :class="{
            'border-lime-6': probingAction?.id === opt.id,
            'border-white': probingAction?.id !== opt.id
          }"
          :style="{ boxShadow: '0px 4px 8px -2px #B9D84333' }"
          @click="probingAction = opt"
        >
          <div class="flex items-center gap-2">
            <div class="text-sm font-semibold text-slate-8">{{ opt.title }}</div>
            <Chip v-if="opt.status" :chip="opt.status" />
          </div>
          <div v-if="opt.message" class="text-sm text-slate-8">{{ opt.message }}</div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <Button kind="plain" color="lime" @click="showPanel = false">Back to Session</Button>
          <Button color="lime" :loading="saveLoading" :disabled="!probingAction" @click="onSave">
            Save
          </Button>
        </div>
      </div>
    </div>
  </TransitionRoot>
</template>
