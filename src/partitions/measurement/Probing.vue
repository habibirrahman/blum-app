<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import {
  useSessionStore,
  type UpdateMeasurementMarkProbingParams,
  type UpdateMeasurementResultsParams
} from '@/stores/session.store'
import { computed, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { TransitionRoot } from '@headlessui/vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import { useAppStore } from '@/stores/app.store'
import { useToast } from 'vue-toastification'

const appStore = useAppStore()
const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurement_results: Measurement['results']
  is_collapsed: boolean
}
interface Emits {
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const showPopup = ref<boolean>(false)
const popupTimeout = ref<any>(null)
const onDisplayPopup = () => {
  if (!props.is_collapsed) return
  showPopup.value = true
  clearTimeout(popupTimeout.value)
  popupTimeout.value = setTimeout(() => {
    showPopup.value = false
  }, 3000)
}

const page = ref<number>(1)
watch(
  () => props.is_collapsed,
  () => {
    setTimeout(() => {
      const el = `${props.measurement.id}-probing-circle-${1}`
      const circles = document.getElementById(el)
      circles?.scrollIntoView({ behavior: 'smooth', inline: 'center' })
    }, 300)
  }
)
const onScroll = (e: any) => {
  onDisplayPopup()
  const left = e.currentTarget.scrollLeft
  const w = props.is_collapsed ? 256 : 320 - 32
  const current = Math.floor(left / w) + 1
  if (page.value !== current) page.value = current
}

const perPage = computed<number>(() => 20)
const pageCount = computed<number>(() => {
  const results = Object.keys(props.measurement_results).length || 0
  const trial = props.measurement.target?.probing_number_of_trial || 0
  let circles = results || trial
  // if (!props.measurement.submitted_at && circles >= trial) {
  //   circles++
  // }
  return Math.ceil(circles / perPage.value)
})
interface ProbingCircle {
  key: number | string
  value: boolean | 'empty' | 'removing'
}
const probingCirclesPages = computed<ProbingCircle[][]>(() => {
  const results = props.measurement_results
  const trial = props.measurement.target?.probing_number_of_trial || 0
  const circles: ProbingCircle[] = []
  for (let idx = 0; idx < trial; idx++) {
    circles.push({ key: idx, value: 'empty' })
  }
  for (let key in results) {
    const idx = circles.findIndex((i) => Number(i.key) === Number(key))
    if (idx > -1) circles[idx].value = results[key]
    else circles.push({ key, value: results[key] })
  }
  // if (!props.measurement.submitted_at && Object.keys(results).length >= trial) {
  //   circles.push({ key: 0, value: 'empty' })
  // }
  const res: ProbingCircle[][] = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    const arr = [...circles.slice(start, end)]
    res.push(arr)
  }
  return res
})
const probingScore = computed<number>(() => {
  const results = props.measurement_results
  const trials = Object.values(results).length
  const totalSuccess = Object.values(results).filter((i) => i).length
  return (totalSuccess / trials) * 100 || 0
})

const probingLoading = ref<boolean>(false)
const plusProbingLoading = ref<boolean>(false)
const reduceProbingLoading = ref<boolean>(false)
const removeProbingLoading = ref<boolean>(false)

const onAdd = async (bool: boolean) => {
  onDisplayPopup()

  const finalResults = props.measurement_results
  const length = Object.keys(finalResults).length

  finalResults[length] = bool

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  probingLoading.value = true
  if (bool) plusProbingLoading.value = true
  else reduceProbingLoading.value = true
  const { success, message } = await sessionStore.updateMeasurementResults(params)
  probingLoading.value = false
  plusProbingLoading.value = false
  reduceProbingLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }
  // page.value = pageCount.value
  onDisplayPopup()
}

const onRemove = async (circle: ProbingCircle) => {
  onDisplayPopup()

  const lastResults = props.measurement_results
  lastResults[circle.key] = 'removing'

  const finalResults: Record<string, boolean> = {}
  let idx = 0
  for (let key in lastResults) {
    if (lastResults[key] === true || lastResults[key] === false) {
      finalResults[idx] = lastResults[key]
      idx++
    }
  }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  probingLoading.value = true
  removeProbingLoading.value = true
  const { success, message } = await sessionStore.updateMeasurementResults(params)
  probingLoading.value = false
  removeProbingLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }
  // page.value = pageCount.value
  onDisplayPopup()
}

const showPanel = ref<boolean>(false)
watch(showPanel, (val) => {
  if (val) emit('toggle-collapsed', !val)
})
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
const probingActionOptions = computed<ProbingAction[]>(() => {
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
  const params: UpdateMeasurementMarkProbingParams = {
    id: props.measurement.id,
    visible: probingAction.value?.visible,
    marked_as: probingAction.value?.marked_as
  }
  saveLoading.value = true
  const { success, message } = await sessionStore.updateMeasurementMarkProbing(params)
  saveLoading.value = false
  if (!success) {
    emit('fetch-session')
    toast.error(message)
    return
  }
  showPanel.value = false
}
</script>

<template>
  <div class="flex flex-col justify-between flex-grow h-full gap-2">
    <div
      class="flex flex-col items-center content-center justify-center flex-grow gap-2 transition-all"
      :class="{
        'h-full w-full': !is_collapsed,
        'absolute left-1/2 mb-2 w-64 -translate-x-1/2 rounded border border-prim-3 bg-white py-3':
          is_collapsed,
        'bottom-full opacity-100': is_collapsed && (showPopup || probingLoading),
        '-z[1] bottom-0 opacity-0': is_collapsed && !showPopup
      }"
    >
      <div
        class="flex gap-4 pb-4 overflow-x-auto snap-x snap-mandatory scroll-smooth"
        :class="{ 'w-[calc(320px-32px)] ': !is_collapsed, 'w-64': is_collapsed }"
        @scroll="onScroll"
      >
        <div
          v-for="(probingCircles, idx) in probingCirclesPages"
          :key="`${measurement.id}-probing-circle-${idx + 1}`"
          :id="`${measurement.id}-probing-circle-${idx + 1}`"
          class="flex justify-center shrink-0 snap-start"
          :class="{ 'w-[calc(320px-32px)] ': !is_collapsed, 'w-64': is_collapsed }"
        >
          <div
            class="flex flex-wrap items-start content-center justify-center max-w-64 gap-x-2 gap-y-2"
          >
            <div
              v-for="box in probingCircles"
              :key="`${box.key}_${box.value}`"
              class="flex items-center justify-center w-10 h-10 transition-all rounded-full shrink-0"
              :class="{
                'pointer-events-none':
                  measurement.submitted_at ||
                  removeProbingLoading ||
                  box.value === 'empty' ||
                  box.value === 'removing',
                'border-2 border-dashed border-slate-5 bg-slate-2': box.value === 'empty',
                'bg-white': box.value === 'removing',
                'bg-lime-5': box.value === true,
                'bg-tomato-7': box.value === false
              }"
              @click="onRemove(box)"
            >
              <Icon
                v-if="box.value === 'removing'"
                icon="mingcute:loading-fill"
                class="text-2xl animate-spin text-light-purple-5"
              />
              <Icon v-else icon="ph:trash" class="text-xl text-white opacity-50" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="is_collapsed" class="flex items-center justify-center h-2 gap-2">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="w-2 h-2 transition-all rounded-full"
        ></div>
      </div>
      <div v-if="measurement.submitted_at && !is_collapsed" class="flex justify-center w-60">
        <AppChip :chip="measurement.marked_as" />
      </div>
    </div>

    <div class="pb-3 space-y-2 shrink-0" :class="{ 'relative z-[1] h-full': is_collapsed }">
      <div
        v-if="measurement.submitted_at && is_collapsed"
        class="absolute flex justify-center -translate-x-1/2 -top-1 left-1/2"
      >
        <AppChip :chip="measurement.marked_as" />
      </div>
      <div v-if="!is_collapsed" class="flex items-center justify-center h-2 gap-2 mb-4">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="w-2 h-2 transition-all rounded-full"
        ></div>
      </div>
      <div class="flex flex-col" :class="{ 'gap-4': !is_collapsed, 'gap-0 pt-2': is_collapsed }">
        <div
          class="flex items-center justify-center"
          :class="{ 'scale-90 gap-3': is_collapsed, 'gap-4': !is_collapsed }"
        >
          <div
            class="flex items-center justify-center w-20 h-20 transition-all rounded-full shrink-0"
            :class="{
              'pointer-events-none': measurement.submitted_at || probingLoading,
              'bg-tomato-9': reduceProbingLoading,
              'bg-slate-5': measurement.submitted_at,
              'bg-tomato-7': !measurement.submitted_at && !reduceProbingLoading
            }"
            @click="onAdd(false)"
          >
            <Icon icon="ph:x" class="w-10 h-10 text-white" />
          </div>
          <div
            class="flex items-center justify-center w-20 h-20 transition-all rounded-full shrink-0"
            :class="{
              'pointer-events-none': measurement.submitted_at || probingLoading,
              'bg-lime-7': plusProbingLoading,
              'bg-slate-5': measurement.submitted_at,
              'bg-lime-5': !measurement.submitted_at && !plusProbingLoading
            }"
            @click.prevent="onAdd(true)"
          >
            <Icon icon="ph:check" class="w-10 h-10 text-white" />
          </div>
          <div
            v-if="
              !measurement.submitted_at &&
              Object.keys(measurement_results).length >=
                (measurement.target?.probing_number_of_trial || 0)
            "
            class="flex items-center justify-center w-20 h-20 rounded-full shrink-0 bg-light-purple-5"
            @click="onSubmitProbing"
          >
            <div class="text-sm font-semibold text-white">Submit</div>
          </div>
        </div>
      </div>
      <div v-if="!is_collapsed" class="flex items-center gap-2 text-xs font-medium text-slate-7">
        <div class="w-9 shrink-0">Score</div>
        <div class="h-4 px-2 rounded-full bg-lime-2 text-lime-7">
          {{ probingScore.toFixed(0) }}%
        </div>
      </div>
      <div v-if="!is_collapsed" class="flex items-center gap-2 text-xs font-medium text-slate-7">
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
      <div v-if="showCelebration" class="grid w-full h-full place-content-center">
        <img alt="celebration" class="rounded-full h-72 w-72" src="@/assets/celebration.gif" />
      </div>
      <div
        v-if="!showCelebration"
        class="flex flex-col items-center justify-center w-full h-full gap-2"
      >
        <img
          v-if="isProbingPassed"
          alt="probing_confetti"
          class="absolute bottom-0 -z-[1] w-full"
          src="@/assets/probing_confetti.svg"
        />
        <img
          v-if="!isProbingPassed"
          alt="probing_failed"
          class="w-20"
          :class="{
            'absolute right-2 top-2 -z-[1] opacity-50': measurement.target?.status === 'mastered'
          }"
          src="@/assets/probing_failed.svg"
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
              <AppChip v-if="opt.status" :chip="opt.status" />
            </div>
            <div v-if="opt.message" class="text-sm text-slate-8">{{ opt.message }}</div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <AppButton class="!px-0" kind="plain" color="lime" @click="showPanel = false">
              Back to Session
            </AppButton>
            <AppButton
              color="lime"
              :loading="saveLoading"
              :disabled="!probingAction || !appStore.network_status.connected"
              @click="onSave"
            >
              {{ appStore.network_status.connected ? 'Save' : 'Offline' }}
            </AppButton>
          </div>
        </div>
      </div>
    </TransitionRoot>

    <div
      v-if="showPanel && measurement.is_fixed"
      class="absolute left-0 w-full h-20 -bottom-20 bg-prim-3"
    ></div>
  </div>
</template>
