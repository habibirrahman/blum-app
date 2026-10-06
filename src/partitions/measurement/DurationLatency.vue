<script setup lang="ts">
import {
  useSessionStore,
  type ResultsDurationOrLatency,
  type UpdateMeasurementResultsV2Params
} from '@/stores/session.store'
import type {
  Measurement,
  MeasurementDurationOrLatency,
  MeasurementResultsDurationOrLatency
} from '@/lib/types'
import AppButton from '@/components/AppButton.vue'
import { Icon } from '@iconify/vue/dist/iconify.js'
import { computed, onMounted, ref, watch } from 'vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppTimeInput from '@/components/AppTimeInput.vue'
import { useClock } from '@/composables/use-clock'
import dayjs from 'dayjs'
import { durationToSeconds, secondsToDuration } from '@/lib/func'
import AppChip from '@/components/AppChip.vue'
import AppTextInput from '@/components/AppTextInput.vue'

interface Props {
  measurement: Measurement
  isCollapsed?: boolean
  //
  isDisabledAction?: boolean
}

interface Lap extends MeasurementResultsDurationOrLatency {
  lapIndex: number
}

// interface FinalResult { // OLD
//   seconds: number
//   string: string
//   started_at?: string | null
//   ended_at?: string | null
// }

interface Emits {
  (e: 'toggle-updated', payload: boolean): void
  (e: 'fetch-session'): void
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false
})
const emit = defineEmits<Emits>()

const sessionStore = useSessionStore()
const { now } = useClock()

/** DATA */

const isOpenEdit = ref(false)
const submitLoading = ref(false)

const isOpenResetConfirmation = ref(false)
const isStarted = ref<boolean | null>(null)

const laps = ref<Lap[]>([])
const editLapInput = ref<Lap | null>(null)

const idleTIme = ref<string>('')
const latestTime = ref<string>('')

/** === COMPUTEDS === */

const lapLength = computed(() => laps.value?.length || 0)

const runningLapIndex = computed(() => lapLength.value - 1)

const displayTimer = computed(() => {
  if (lapLength.value === 0) return '00:00:00'
  if (!isStarted.value) return idleTIme.value
  const diff = now.value.diff(dayjs(latestTime.value), 'second')
  return secondsToDuration(diff)
})

/** === WATCHER === */

watch(
  () => submitLoading.value,
  (val) => {
    emit('toggle-updated', !val)
  }
)

/** === MOTHODS === */

const getLapDisplayTime = (lap: Lap) => {
  if (isStarted.value && lap.lapIndex === runningLapIndex.value) {
    const diff = now.value.diff(lap.started_at, 'seconds')
    return secondsToDuration(diff)
  }
  return lap.string
}

const setupTimer = () => {
  const lastLap = laps.value[runningLapIndex.value] || { started_at: null, seconds: 0 }
  const totalSeconds = laps.value.reduce((acc, lap) => acc + lap.seconds, 0)

  latestTime.value = dayjs(lastLap?.started_at)
    .subtract(totalSeconds - lastLap?.seconds, 'seconds')
    .format()
  idleTIme.value = secondsToDuration(totalSeconds)
}

// ── Toggle timer start / stop ──
const onToggleRunning = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (submitLoading.value) return

  let incomingState = 'idle'

  if (!isStarted.value) {
    const lastLap = laps.value[runningLapIndex.value]

    // ── START ──
    if (lapLength.value === 0 || !lastLap?.started_at) {
      incomingState = 'start'

      laps.value = [
        {
          lapIndex: 0,
          string: '00:00:00',
          seconds: 0,
          started_at: dayjs().format(),
          ended_at: null,
          label: null
        }
      ]

      setupTimer()
    }

    // ── RESUME ──
    if (lapLength.value > 0 && lastLap?.started_at) {
      incomingState = 'resume'

      const seconds = lastLap.seconds || 0
      const start = dayjs().subtract(seconds, 'seconds').format()
      laps.value[runningLapIndex.value].started_at = start
      laps.value[runningLapIndex.value].ended_at = null

      setupTimer()
    }
  } else {
    // ── STOP ──
    if (lapLength.value > 0) {
      incomingState = 'stop'

      const start = laps.value[runningLapIndex.value].started_at
      const end = dayjs().format()
      const diffInSeconds = dayjs(end).diff(dayjs(start), 'second')
      laps.value[runningLapIndex.value].ended_at = end
      laps.value[runningLapIndex.value].string = secondsToDuration(diffInSeconds)
      laps.value[runningLapIndex.value].seconds = diffInSeconds

      setupTimer()
    }
  }

  if (incomingState === 'idle') return

  // call PATCH API only for start, resume, adn stop
  const finalResults: Record<string, ResultsDurationOrLatency> = {}
  laps.value.forEach((lap, index) => {
    finalResults[index] = {
      recording_time: lap.string,
      started_at: lap.started_at,
      ended_at: lap.ended_at,
      label: lap.label
      // seconds: lap.seconds,
      // string: lap.string,
      // started_at: lap.started_at,
      // ended_at: lap.ended_at
    }
  })

  const payload: UpdateMeasurementResultsV2Params = {
    id: props.measurement.id,
    params: { results: finalResults },
    dataResult: { ...props.measurement, results: finalResults },
    lastData: { ...props.measurement }
  }

  submitLoading.value = true
  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `duration_${incomingState}`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
  const { success } = await sessionStore.updateMeasurementResultsV2(payload)
  submitLoading.value = false

  if (!success) return

  if (incomingState === 'stop') {
    isStarted.value = false
  }
  if (incomingState === 'start' || incomingState === 'resume') {
    isStarted.value = true
  }
}

// ── Record a lap (while timer keeps running) ──
const onAddLap = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if ((!isStarted.value && !laps.value.length) || submitLoading.value) return

  // Complete latest lap
  if (laps.value.length > 0) {
    // when latest lap is running -> complete it
    if (!laps.value[runningLapIndex.value].ended_at) {
      const start = laps.value[runningLapIndex.value].started_at
      const end = dayjs().format()
      const diffInSeconds = dayjs(end).diff(dayjs(start), 'second')
      laps.value[runningLapIndex.value].ended_at = end
      laps.value[runningLapIndex.value].string = secondsToDuration(diffInSeconds)
      laps.value[runningLapIndex.value].seconds = diffInSeconds
    }
  }

  // Add incoming lap
  laps.value.push({
    lapIndex: lapLength.value,
    string: '00:00:00',
    seconds: 0,
    started_at: dayjs().format(),
    ended_at: null,
    label: null
  })

  setupTimer()

  const finalResults: Record<string, ResultsDurationOrLatency> = {}
  laps.value.forEach((lap, index) => {
    finalResults[index] = {
      recording_time: lap.string,
      started_at: lap.started_at,
      ended_at: lap.ended_at,
      label: lap.label
      // seconds: lap.seconds,
      // string: lap.string,
      // started_at: lap.started_at,
      // ended_at: lap.ended_at
    }
  })

  const payload: UpdateMeasurementResultsV2Params = {
    id: props.measurement.id,
    params: { results: finalResults },
    dataResult: { ...props.measurement, results: finalResults },
    lastData: { ...props.measurement }
  }

  submitLoading.value = true
  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `duration_add_lap`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
  const { success } = await sessionStore.updateMeasurementResultsV2(payload)
  submitLoading.value = false

  if (!success) return

  isStarted.value = true
}

// ── Reset laps ──
const onResetLaps = async () => {
  if (sessionStore.session?.status !== 'ongoing') return

  laps.value = []
  const finalResults: Record<string, ResultsDurationOrLatency> = {}

  const payload: UpdateMeasurementResultsV2Params = {
    id: props.measurement.id,
    params: { results: finalResults },
    dataResult: { ...props.measurement, results: finalResults },
    lastData: { ...props.measurement }
  }

  submitLoading.value = true
  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `duration_reset`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
  const { success } = await sessionStore.updateMeasurementResultsV2(payload)
  submitLoading.value = false
  if (!success) return

  setupTimer()
  isOpenResetConfirmation.value = false
}

const onOpenEdit = (lap: Lap) => {
  if (sessionStore.session?.status !== 'ongoing') return

  editLapInput.value = { ...lap }
  isOpenEdit.value = true
}

const onUpdateLap = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (submitLoading.value) return
  if (!editLapInput.value) return

  const end = dayjs().format()
  const totalSeconds = durationToSeconds(editLapInput.value.string)
  const start = dayjs(end).subtract(totalSeconds, 'seconds').format()

  const updatedLap: Lap = {
    lapIndex: editLapInput.value.lapIndex,
    string: editLapInput.value.string,
    seconds: totalSeconds,
    started_at: start,
    ended_at: end,
    label: editLapInput.value.label
  }

  laps.value[editLapInput.value.lapIndex] = { ...updatedLap }

  setupTimer()

  const finalResults: Record<string, ResultsDurationOrLatency> = {}
  laps.value.forEach((lap, index) => {
    finalResults[index] = {
      recording_time: lap.string,
      started_at: lap.started_at,
      ended_at: lap.ended_at,
      label: lap.label
      // seconds: lap.seconds,
      // string: lap.string,
      // started_at: lap.started_at,
      // ended_at: lap.ended_at
    }
  })

  const payload: UpdateMeasurementResultsV2Params = {
    id: props.measurement.id,
    params: { results: finalResults },
    dataResult: { ...props.measurement, results: finalResults },
    lastData: { ...props.measurement }
  }

  submitLoading.value = true
  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `duration_update_lap_${editLapInput.value.lapIndex + 1}`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })
  try {
    await sessionStore.updateMeasurementResultsV2(payload)
  } catch (e) {
    console.error(e)
  }
  submitLoading.value = false

  isOpenEdit.value = false
}

const isTimeSuccessful = (timeString: string, compareMode: 'less' | 'greater') => {
  if (!timeString || !props.measurement?.target?.goal_time) return false
  try {
    const timeValue = durationToSeconds(timeString)
    const goalValue = durationToSeconds(props.measurement.target.goal_time)

    return compareMode === 'less' ? timeValue < goalValue : timeValue >= goalValue
  } catch (e) {
    console.error(e)
    return false
  }
}

const getTextColorClass = (lap: Lap) => {
  const metric = props.measurement?.target?.success_metric
  const time = getLapDisplayTime(lap)
  // const durationSeconds = durationToSeconds(time)
  const compareMode = metric === 'less than goal' ? 'less' : 'greater'
  return isTimeSuccessful(time, compareMode) ? 'text-grass-7' : 'text-tomato-7'
}

onMounted(() => {
  const results = props.measurement.results as MeasurementDurationOrLatency['results']

  const res: MeasurementResultsDurationOrLatency[] = Object.values(results)

  if (!res.length) {
    laps.value = []
  } else {
    laps.value = Object.keys(results).map((key) => {
      return {
        lapIndex: Number(key),
        ...results[key]
      }
    })
  }

  idleTIme.value = '00:00:00'
  latestTime.value = ''
  isStarted.value = false

  setupTimer()

  // RESUME
  const lastLap = laps.value[runningLapIndex.value]
  if (lastLap?.started_at && !lastLap?.ended_at) {
    isStarted.value = true
  }
})
</script>

<template>
  <!-- Duration latency -->
  <div v-if="!isOpenResetConfirmation" class="flex flex-col flex-grow gap-2 justify-between h-full">
    <div
      v-if="submitLoading"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-16 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div
      class="flex flex-col flex-grow gap-x-3 justify-center content-center items-center h-full"
      :class="{ 'gap-y-4': !isCollapsed, 'gap-y-2 px-3': isCollapsed }"
    >
      <!-- Lap info -->
      <div v-if="isCollapsed" class="font-semibold text-slate-7">Lap {{ lapLength }}</div>

      <!-- Timer -->
      <div
        class="grid grid-cols-5 items-center text-3xl text-[32px] font-bold transition-colors"
        :class="{ 'text-slate-6': !isStarted, 'text-slate-8': isStarted }"
      >
        <div class="flex justify-center">{{ displayTimer.split(':')[0] }}</div>
        <div class="flex justify-center pb-2">:</div>
        <div class="flex justify-center">{{ displayTimer.split(':')[1] }}</div>
        <div class="flex justify-center pb-2">:</div>
        <div class="flex justify-center">{{ displayTimer.split(':')[2] }}</div>
      </div>

      <!-- Controls -->
      <div class="flex gap-3 items-center w-full">
        <AppButton
          kind="plain"
          class="grow rounded-full !bg-prim-2"
          :loading="submitLoading"
          :disabled="
            (!isStarted && !lapLength) ||
            isDisabledAction ||
            sessionStore.session?.status !== 'ongoing'
          "
          @click="onAddLap"
        >
          <Icon icon="ph:plus-bold" class="text-lg" />
          <span>Lap</span>
        </AppButton>

        <AppButton
          kind="plain"
          :color="isStarted ? 'tomato' : 'grass'"
          class="rounded-full grow"
          :class="[isStarted ? '!bg-tomato-2' : '!bg-grass-2']"
          :loading="submitLoading"
          :disabled="isDisabledAction || sessionStore.session?.status !== 'ongoing'"
          @click="onToggleRunning"
        >
          {{ isStarted ? 'Stop' : lapLength > 0 ? 'Resume' : 'Start' }}
        </AppButton>

        <AppButton
          v-if="!isStarted && lapLength > 0"
          class="rounded-full !bg-prim-2"
          kind="plain"
          :disabled="isDisabledAction || sessionStore.session?.status !== 'ongoing'"
          @click="isOpenResetConfirmation = true"
        >
          <Icon icon="ph:arrow-counter-clockwise-bold" class="text-lg" />
        </AppButton>
      </div>

      <!-- Laps List -->
      <div
        v-if="lapLength > 0 && !isCollapsed"
        class="overflow-scroll mt-2 w-full"
        :style="{
          maxHeight: 'calc(100vh - 10rem)',
          scrollbarWidth: 'none'
        }"
      >
        <div
          v-for="lap in [...laps].reverse()"
          :key="lap.lapIndex"
          class="flex gap-2 justify-between items-center w-full h-8 border-b border-slate-4"
        >
          <div class="flex gap-2 items-center">
            <div class="text-sm shrink-0" :class="getTextColorClass(lap)">
              Lap {{ lap.lapIndex + 1 }}
            </div>
            <AppChip
              v-if="lap.label"
              :label="lap.label"
              class="truncate max-w-24 bg-light-purple-1 text-dark-purple-1"
            />
          </div>

          <div class="flex gap-2 items-center shrink-0">
            <div class="font-semibold" :class="getTextColorClass(lap)">
              {{ getLapDisplayTime(lap) }}
            </div>
            <AppButton
              v-if="!isStarted && sessionStore.session?.status === 'ongoing'"
              kind="plain"
              size="sm"
              class="h-6! w-6!"
              title="Edit lap"
              @click="onOpenEdit(lap)"
            >
              <Icon icon="ph:pencil-simple-bold" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!isCollapsed && !isOpenResetConfirmation"
      class="pb-3 text-sm text-center shrink-0 text-slate-8"
    >
      <span> Goal: </span>
      <span>
        {{ measurement.target?.success_metric === 'equal to or greater than goal' ? '≥' : '' }}
        {{ measurement.target?.success_metric === 'less than goal' ? '<' : '' }}
        {{ measurement.target?.goal_time }}
      </span>
    </div>
  </div>
  <!-- End duration latency -->

  <!-- Confirm reset laps -->
  <div
    v-if="isOpenResetConfirmation"
    class="flex flex-col flex-grow gap-2 justify-center items-center h-full"
  >
    <div class="text-lg font-semibold text-center text-slate-8">Reset all recorded laps?</div>
    <div class="px-4 text-sm text-center text-slate-6">
      This will clear all existing lap records and begin again from Lap 1.
      <br />
      You won't be able to recover previous data.
    </div>
    <div class="grid grid-cols-2 gap-4 px-4">
      <AppButton kind="plain" @click="isOpenResetConfirmation = false">Cancel</AppButton>
      <AppButton color="tomato" :loading="submitLoading" @click="onResetLaps">Reset</AppButton>
    </div>
  </div>
  <!-- End confirm reset laps -->

  <!-- Edit lap modal -->
  <AppActionSheet :show="isOpenEdit" @close="isOpenEdit = false">
    <div v-if="editLapInput" class="flex flex-col gap-4 py-3 w-full">
      <div class="text-xl font-semibold text-left">Edit lap {{ measurement.target?.name }}</div>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <div class="text-sm font-medium text-slate-7">
            {{ measurement.target?.curriculum_name }}
          </div>
          <div class="text-base font-semibold text-slate-8">{{ measurement.target?.name }}</div>
          <div class="text-sm text-slate-6">
            {{ measurement.target?.type === 'Target::Duration' ? 'Duration' : '' }}
            {{ measurement.target?.type === 'Target::Latency' ? 'Latency' : '' }}
          </div>
        </div>

        <AppTextInput
          :name="`lap-${editLapInput.lapIndex}-label`"
          label="Label"
          optional
          v-model="editLapInput.label"
          placeholder="e.g. Puzzle"
          :max-length="32"
          :disabled="submitLoading"
          caption="This label applies to the current session only and resets next session."
        />

        <AppTimeInput
          :label="`Lap ${editLapInput.lapIndex + 1}`"
          :name="`lap-${editLapInput.lapIndex + 1}`"
          v-model="editLapInput.string"
          :disabled="submitLoading"
        />
      </div>
      <div class="grid grid-cols-2 gap-4 items-center">
        <AppButton kind="plain" @click="isOpenEdit = false">Cancel</AppButton>
        <AppButton :loading="submitLoading" @click="onUpdateLap">Save</AppButton>
      </div>
    </div>
  </AppActionSheet>
  <!-- end edit lap modal -->
</template>
