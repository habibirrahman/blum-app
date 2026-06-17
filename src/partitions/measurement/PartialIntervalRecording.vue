<script setup lang="ts">
import {
  useSessionStore,
  type UpdateMeasurementParams,
  type UpdateMeasurementResultsParams
} from '@/stores/session.store'
import { computed, ref, watch } from 'vue'
import type { DurationArray, Measurement } from '@/lib/types'
import { useToast } from 'vue-toastification'
import { Icon } from '@iconify/vue/dist/iconify.js'
import AppButton from '@/components/AppButton.vue'
import { useClock } from '@/composable/use-clock'

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const sessionStore = useSessionStore()
const toast = useToast()
const { now } = useClock()

/** DATA */

const scoreLoading = ref<boolean>(false)
const stopOvertimeConfirmation = ref<boolean>(false)
const nearEndToastShown = ref<boolean>(false)

/** COMPUTED */

const intervalSeconds = computed<number>(() => {
  const interval = props.measurement.target?.interval
  return (interval || 1) * 60
})

const durationSeconds = computed<number>(() => {
  const measurementDuration = props.measurement.duration
  const targetDuration = props.measurement.target?.duration
  return (measurementDuration || targetDuration || 1) * 60
})

const intervalRound = computed<number>(() => {
  if (!intervalSeconds.value) return 1
  return Math.ceil(durationSeconds.value / intervalSeconds.value)
})

const isOvertimeRunning = computed<boolean>(() => {
  return (
    !!props.measurement?.target?.allow_overtime_recording &&
    !!props.measurement.overtime_started_at &&
    !props.measurement.overtime_ended_at
  )
})

const elapsedTime = computed<number>(() => {
  const isCustomStart = props.measurement?.target?.interval_start_timing === 'custom_start'

  // custom_start: belum pernah start → tidak perlu now, langsung 0
  if (isCustomStart && !props.measurement.recording_started_at) return 0

  // Sudah selesai dengan overtime_ended_at: tidak perlu now, hitung dari fixed data
  if (props.measurement.overtime_ended_at) {
    if (props.measurement.overtime_duration) {
      const overtimeDuration = props.measurement.overtime_duration as DurationArray
      return durationSeconds.value + overtimeDuration[0]
    }
    const start = props.measurement.recording_started_at
      ? new Date(props.measurement.recording_started_at).getTime()
      : 0
    const endTime = new Date(props.measurement.overtime_ended_at).getTime()
    return start ? Math.floor((endTime - start) / 1000) : 0
  }

  // Ab sini kita butuh now.value (recording sedang berjalan / overtime running)
  const datetimeNow = now.value.valueOf()

  // Overtime sedang berjalan
  if (isOvertimeRunning.value && props.measurement.overtime_started_at) {
    const overtimeStart = new Date(props.measurement.overtime_started_at).getTime()
    const diff = Math.floor((datetimeNow - overtimeStart.getTime()) / 1000)
    return durationSeconds.value + diff
  }

  // Recording sedang berjalan (custom_start atau start_with_session)
  if (props.measurement.recording_started_at) {
    const start = new Date(props.measurement.recording_started_at).getTime()
    return Math.floor((datetimeNow - start) / 1000)
  }

  return 0
})

const currentInterval = computed<number>(() => {
  if (!elapsedTime.value) return 1
  const interval = Math.ceil(elapsedTime.value / intervalSeconds.value)
  return Math.max(1, interval)
})

const displayCurrentInterval = computed<number>(() => {
  // Get actual interval count from results
  const resultsCount = props.measurementResults ? Object.keys(props.measurementResults).length : 0
  if (isOvertimeRunning.value) {
    // During overtime, show actual interval count (can exceed intervalRound)
    return Math.max(currentInterval.value, resultsCount)
  }
  if (isOvertimeStopped.value) {
    // After overtime stopped, show final interval count from results
    return Math.max(resultsCount, intervalRound.value)
  }
  // Otherwise cap at intervalRound
  return Math.min(currentInterval.value, intervalRound.value)
})

const isOvertimeStopped = computed<boolean>(() => {
  return (
    !!props.measurement?.target?.allow_overtime_recording &&
    !!props.measurement.overtime_started_at &&
    !!props.measurement.overtime_ended_at
  )
})

const isPending = computed<boolean>(() => {
  return (
    props.measurement?.target?.interval_start_timing === 'custom_start' &&
    !props.measurement.recording_started_at
  )
})

const isOvertimePending = computed<boolean>(() => {
  return (
    !!props.measurement?.target?.allow_overtime_recording &&
    elapsedTime.value >= durationSeconds.value &&
    !props.measurement.overtime_started_at &&
    !props.measurement.overtime_ended_at
  )
})

const isFinished = computed<boolean>(() => {
  // Legacy data fallback: if session is already strictly finished,
  // cap the completion so it shows as finished correctly.
  if (
    (sessionStore.session?.status === 'completed' ||
      sessionStore.session?.status === 'cancelled') &&
    props.measurement?.target?.interval_start_timing !== 'custom_start'
  ) {
    return true
  }

  if (props.measurement?.target?.allow_overtime_recording) {
    return !!props.measurement.overtime_ended_at
  }
  return elapsedTime.value >= durationSeconds.value
})

const isNearEnd = computed<boolean>(() => {
  if (isFinished.value || isOvertimeRunning.value || isOvertimePending.value) {
    return false
  }

  const remaining = durationSeconds.value - elapsedTime.value
  return remaining <= 300 && remaining > 0
})

// Recording is considered active when:
// - start_with_session: when session is ongoing
// - custom_start: when recording_started_at is set
const isRecordingActive = computed<boolean>(() => {
  if (isFinished.value) return false
  if (isOvertimePending.value) return false
  if (props.measurement?.target?.interval_start_timing === 'custom_start') {
    return !!props.measurement.recording_started_at
  }
  return (
    sessionStore.session?.status === 'ongoing' ||
    sessionStore.session?.status === 'completed' ||
    sessionStore.session?.status === 'cancelled' ||
    sessionStore.session?.status === 'draft'
  )
})

// Show duration label only when recording is active (for custom_start, after start recording period)
const showDurationLabel = computed<boolean>(() => {
  if (isPending.value) return false
  return isRecordingActive.value
})

// Display total intervals - always show planned count (intervalRound)
// e.g., "Interval 2 of 1" means we're on interval 2 but originally planned 1
const displayTotalIntervals = computed<number>(() => {
  return intervalRound.value
})

// Countdown timer for interval (5 min countdown)
const displayTimerString = computed<string>(() => {
  // If pending or finished, show total duration
  if (isPending.value) {
    return '00:00:00'
  }

  if (isFinished.value) {
    // Show total duration when finished, capping correctly for sessions that end early
    if (
      props.measurement?.target?.allow_overtime_recording &&
      props.measurement.overtime_ended_at
    ) {
      return formatTime(durationSeconds.value + getOvertimeSeconds())
    }
    return formatTime(Math.min(elapsedTime.value, durationSeconds.value))
  }

  // Calculate time remaining in current interval (countdown from 5 min)
  const elapsedInCurrentInterval = elapsedTime.value % intervalSeconds.value
  const remainingInInterval = intervalSeconds.value - elapsedInCurrentInterval

  // During overtime pending, show 00:00:00
  if (isOvertimePending.value) {
    return '00:00:00'
  }

  return formatTime(remainingInInterval)
})

// Remaining duration string (countdown from total duration)
const remainingDurationString = computed<string>(() => {
  if (isPending.value || isFinished.value) return '00:00:00'

  const remaining = Math.max(0, durationSeconds.value - elapsedTime.value)
  return formatTime(remaining)
})

// Overtime duration string (counting up from when overtime started)
const overtimeDurationString = computed<string>(() => {
  if (!props.measurement.overtime_started_at) return '00:00:00'

  const datetimeNow = now.value.valueOf()

  const start = new Date(props.measurement.overtime_started_at).getTime()
  const diff = Math.max(0, Math.floor((datetimeNow - start) / 1000))
  return formatTime(diff)
})

const lastIntervalScore = computed<number>(() => {
  // Get the score from the last completed interval (for finished state display)
  if (!props.measurementResults) return 0
  // Get the actual last interval index from results (handles overtime case)
  const keys = Object.keys(props.measurementResults).map(Number)
  if (keys.length === 0) return 0
  const lastIntervalIndex = Math.max(...keys)
  return props.measurementResults[lastIntervalIndex] || 0
})

const scoreInInterval = computed<number>(() => {
  if (!props.measurementResults) return 0
  // Use displayCurrentInterval for score lookup
  const intervalIndex = displayCurrentInterval.value - 1
  return props.measurementResults[intervalIndex] || 0
})

const totalScore = computed<number>(() => {
  if (!props.measurementResults) return 0
  const results: number[] = Object.values(props.measurementResults)
  return results.reduce((a, b) => a + b, 0) || 0
})

const percentageScore = computed<number>(() => {
  if (!props.measurementResults) return 0
  // Percentage is Intervals with Score > 0 / Total Intervals (Round? or Current?)
  // Usually Total Intervals (Planned).
  // If Overtime, does it calculate over current total?
  // Logic says "Percentage" usually based on Planned Interval Round.
  // But if we have 13 intervals...
  const res = Object.values(props.measurementResults).filter((a) => (a as number) > 0)
  const denominator = Math.max(intervalRound.value, currentInterval.value)
  if (denominator === 0) return 0
  return Math.floor((res.length / denominator) * 100)
})

/** WATHCER */

watch(
  () => scoreLoading.value,
  (val) => {
    if (!val) {
      emit('toggle-updated', true)
    } else {
      emit('toggle-updated', false)
    }
  }
)

watch(
  () => sessionStore.session?.status,
  (newStatus, oldStatus) => {
    if (oldStatus === 'ongoing' && newStatus === 'completed') {
      if (isOvertimeRunning.value) {
        onStopOvertime()
      }
    }
  }
)

watch(
  () => isNearEnd.value,
  (val) => {
    if (val && !nearEndToastShown.value) {
      const message = `Last interval! 5 minutes before ${props.measurement?.target?.name} duration end`
      toast.warning(message)
      nearEndToastShown.value = true
    }

    if (!val) {
      nearEndToastShown.value = false
    }
  }
)

// Watch for interval changes to auto-initialize new intervals with 0
watch(
  () => currentInterval.value,
  (newInterval, oldInterval) => {
    // Only initialize if recording is active and it's a new interval
    if (isRecordingActive.value && newInterval !== oldInterval && newInterval > 0) {
      initializeIntervalIfNeeded(newInterval - 1)
    }
  },
  { immediate: false }
)

/** METHODS */

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

const getOvertimeSeconds = (): number => {
  if (!props.measurement.overtime_started_at) return 0

  const datetimeNow = now.value.valueOf()
  let end = datetimeNow

  if (props.measurement.overtime_ended_at) {
    end = new Date(props.measurement.overtime_ended_at).getTime()
  }
  const start = new Date(props.measurement.overtime_started_at).getTime()
  return Math.max(0, Math.floor((end - start) / 1000))
}

const onStartRecording = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (scoreLoading.value) return

  const now = new Date().toISOString()
  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { recording_started_at: now },
    data_result: { ...props.measurement, recording_started_at: now }
  }

  scoreLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `measurement_pir_start_recording`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: params.measurement },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurement(params)
  scoreLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
}

const onStartOvertime = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (scoreLoading.value) return

  const now = new Date().toISOString()

  // Initialize first overtime interval with 0
  // The first overtime interval index is intervalRound (e.g., if duration has 2 intervals, overtime starts at index 2)
  const firstOvertimeIntervalIndex = intervalRound.value
  const currentResults = props.measurementResults || {}

  // Fill any missing intervals up to and including the first overtime interval
  const newResults = { ...currentResults }
  for (let i = 0; i <= firstOvertimeIntervalIndex; i++) {
    if (!(i.toString() in newResults)) {
      newResults[i.toString()] = 0
    }
  }

  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: {
      overtime_started_at: now,
      results: newResults
    },
    data_result: {
      ...props.measurement,
      overtime_started_at: now,
      results: newResults
    }
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `measurement_pir_start_overtime`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: params.measurement },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurement(params)
  scoreLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
}

const roundOvertimeDuration = (overtimeStartedAt: string) => {
  const datetimeNow = now.value.valueOf()

  const start = new Date(overtimeStartedAt).getTime()
  const durationSeconds = Math.floor((datetimeNow - start) / 1000)

  // Round duration to nearest minute (>= 30s rounds up, < 30s rounds down)
  const remainderSeconds = durationSeconds % 60
  let roundedDuration
  if (remainderSeconds >= 30) {
    roundedDuration = durationSeconds + (60 - remainderSeconds)
  } else {
    roundedDuration = durationSeconds - remainderSeconds
  }

  // Calculate overtime_ended_at from overtime_started_at + rounded duration
  return new Date(start + roundedDuration * 1000)
}

const onStopOvertime = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (scoreLoading.value) return

  stopOvertimeConfirmation.value = false

  const start = new Date(props.measurement.overtime_started_at || '').getTime()

  // Rounded overtime_ended_at for backend storage
  const overtimeEndedDate = roundOvertimeDuration(props.measurement.overtime_started_at || '')
  const overtimeEndedAt = overtimeEndedDate.toISOString()
  const roundedOvertimeSeconds = Math.floor((overtimeEndedDate.getTime() - start) / 1000)
  const roundedOvertimeString = formatTime(roundedOvertimeSeconds)

  // Initialize current interval if not exists before stopping
  await initializeIntervalIfNeeded(displayCurrentInterval.value - 1)

  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: {
      overtime_ended_at: overtimeEndedAt,
      overtime_duration: [roundedOvertimeSeconds, roundedOvertimeString]
    },
    data_result: {
      ...props.measurement,
      overtime_ended_at: overtimeEndedAt,
      overtime_duration: [roundedOvertimeSeconds, roundedOvertimeString]
    }
  }

  scoreLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `measurement_pir_stop_overtime`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: params.measurement },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurement(params)
  scoreLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
}

// Initialize a specific interval index with 0 if it doesn't exist
const initializeIntervalIfNeeded = async (intervalIndex: number) => {
  const currentResults = props.measurementResults || {}
  const intervalKey = intervalIndex.toString()

  if (!(intervalKey in currentResults)) {
    const newResults = { ...currentResults, [intervalKey]: 0 }

    const params: UpdateMeasurementParams = {
      id: props.measurement.id,
      measurement: { results: newResults },
      data_result: { ...props.measurement, results: newResults }
    }
    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `measurement_pir_initialize_interval`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      api: `PATCH /api/v1/measurements/${props.measurement.id}`,
      params: { measurement: params.measurement },
      notes: `Target: ${props.measurement.target?.name}`,
      timestamp: new Date().toISOString()
    })

    const { success, message } = await sessionStore.updateMeasurement(params)
    if (!success) {
      toast.error(message)
      return
    }
  }
}

const onAddScore = async () => {
  if (sessionStore.session?.status !== 'ongoing') return
  if (scoreLoading.value) return

  const interval = displayCurrentInterval.value - 1
  const intervalKey = interval.toString()

  // Check if interval index exists in results
  // If not (overtime scenario), initialize it first
  let finalResults = props.measurementResults || {}
  let actionLabel = `pir_incident`
  if (!(intervalKey in finalResults)) {
    // Initialize new interval index with 0
    finalResults = { ...finalResults, [intervalKey]: 0 }
    actionLabel = `pir_incident_in_overtime`
  } else {
    finalResults[intervalKey] = finalResults[intervalKey] + 1
  }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  scoreLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: actionLabel,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }
}
</script>

<template>
  <div class="flex h-full flex-grow flex-col justify-between gap-2">
    <div
      v-if="scoreLoading"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-28 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="animate-spin text-2xl text-light-purple-5" />
    </div>

    <!-- Stop Recording Confirmation (replaces content) -->
    <template v-if="stopOvertimeConfirmation && !isCollapsed">
      <div class="flex flex-grow flex-col items-center justify-center gap-4 py-6">
        <div class="flex flex-col gap-2 text-center">
          <div class="font-semibold text-slate-10">Stop recording?</div>
          <div class="text-sm text-slate-8">
            Recording can't be resumed after it's stopped for this session.
          </div>
        </div>
        <div class="flex gap-2">
          <AppButton kind="plain" @click="stopOvertimeConfirmation = false">Cancel</AppButton>
          <AppButton color="tomato" @click="onStopOvertime">Stop recording</AppButton>
        </div>
      </div>
    </template>

    <!-- Normal PIR Content -->
    <template v-else>
      <div class="flex items-center justify-evenly gap-3">
        <div v-if="isCollapsed"></div>

        <div class="space-y-2">
          <!-- Header: Timer & Status for Collapsed or nah -->
          <div class="flex flex-col items-center justify-center gap-1">
            <div v-if="!isCollapsed" class="flex items-center gap-1">
              <div
                class="flex h-6 items-center rounded px-1.5"
                :class="[isRecordingActive ? 'bg-prim-1' : 'bg-slate-2']"
              >
                <div
                  class="text-xs"
                  :class="[isRecordingActive ? 'text-light-purple-5' : 'text-slate-7']"
                >
                  Interval <b>{{ displayCurrentInterval }}</b> of <b>{{ displayTotalIntervals }}</b>
                </div>
              </div>
            </div>

            <div v-if="!isCollapsed && isFinished">
              <div class="text-xs text-slate-7">Total duration</div>
            </div>

            <!-- Timer -->
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center gap-1">
                <div
                  class="grid grid-cols-5 items-center font-bold text-slate-8"
                  :class="[isCollapsed ? 'text-xl' : 'text-2xl']"
                >
                  <div class="text-center">
                    {{ displayTimerString.split(':')[0] }}
                  </div>
                  <div class="text-center">:</div>
                  <div class="text-center">
                    {{ displayTimerString.split(':')[1] }}
                  </div>
                  <div class="text-center">:</div>
                  <div class="text-center">
                    {{ displayTimerString.split(':')[2] }}
                  </div>
                </div>
              </div>
              <div
                v-if="isCollapsed"
                class="flex h-6 items-center rounded px-1.5"
                :class="[isRecordingActive ? 'bg-prim-1' : 'bg-slate-2']"
              >
                <div
                  class="text-xs"
                  :class="[isRecordingActive ? 'text-light-purple-5' : 'text-slate-7']"
                >
                  <b>{{ displayCurrentInterval }}</b> / <b>{{ displayTotalIntervals }}</b>
                </div>
              </div>
            </div>

            <!-- Remaining / Overtime / Total Duration label -->
            <div
              v-if="!isCollapsed && showDurationLabel && !isFinished"
              class="text-xs text-slate-8"
            >
              <div v-if="isOvertimeRunning">Overtime + {{ overtimeDurationString }}</div>
              <div v-else>
                Remaining <b>{{ remainingDurationString }}</b>
              </div>
            </div>
          </div>

          <!-- Main Interaction Area - Collapsed -->
          <div v-if="isCollapsed" class="grid justify-center">
            <!-- Center: Stats -->
            <div class="flex flex-col items-center gap-1">
              <div class="text-3xl font-bold text-slate-8">
                {{ totalScore }}
              </div>
              <div class="text-sm text-slate-8">Total frequency</div>
            </div>
          </div>
        </div>

        <!-- Right: Action button - Collapsed -->
        <div v-if="isCollapsed">
          <!-- Pending Start -->
          <AppButton
            v-if="isPending"
            class="h-32 w-32 rounded-full !bg-prim-2"
            kind="plain"
            @click="onStartRecording"
          >
            Start recording
          </AppButton>

          <!-- Overtime Pending -->
          <AppButton
            v-else-if="isOvertimePending"
            class="h-32 w-32 rounded-full !bg-tomato-2"
            color="tomato"
            kind="plain"
            @click="onStartOvertime"
          >
            Start overtime
          </AppButton>

          <!-- Finished -->
          <AppButton v-else-if="isFinished" class="h-32 w-32 rounded-full" disabled>
            Incident
          </AppButton>

          <!-- Running / Incident -->
          <AppButton
            v-else
            class="h-32 w-32 rounded-full"
            :class="{
              'cursor-wait': scoreLoading,
              'pointer-events-none': sessionStore.session?.status !== 'ongoing'
            }"
            @click="onAddScore"
          >
            Incident
          </AppButton>
        </div>
      </div>

      <!-- Main Interaction Area - Desktop (Centered Layout) -->
      <div
        v-if="!isCollapsed"
        class="flex h-full flex-col content-center items-center justify-center gap-y-4 duration-300"
      >
        <!-- Pending Start -->
        <AppButton
          v-if="isPending"
          class="h-48 w-48 rounded-full !bg-prim-2"
          kind="plain"
          @click="onStartRecording"
        >
          <div class="text-sm font-semibold">Start recording period</div>
        </AppButton>

        <!-- Overtime Pending or Finished - Show last interval frequency with different color -->
        <AppButton
          v-else-if="isOvertimePending || isFinished"
          class="h-48 w-48 rounded-full"
          disabled
        >
          <div class="flex flex-col gap-1">
            <div class="text-5xl font-bold">{{ lastIntervalScore }}</div>
            <div class="font-semibold">Incident(s)</div>
          </div>
        </AppButton>

        <!-- Running / Incident -->
        <AppButton
          v-else
          class="h-48 w-48 rounded-full"
          :class="{
            'cursor-wait': scoreLoading,
            'pointer-events-none': sessionStore.session?.status !== 'ongoing'
          }"
          @click="onAddScore"
        >
          <div class="flex flex-col gap-1">
            <div class="text-5xl font-bold">{{ scoreInInterval }}</div>
            <div class="font-semibold">Incident(s)</div>
          </div>
        </AppButton>

        <!-- Start Overtime Button -->
        <div v-if="isOvertimePending" class="flex justify-center pb-2">
          <AppButton
            class="rounded-full !bg-tomato-2"
            kind="plain"
            color="tomato"
            @click="onStartOvertime"
          >
            <span class="px-2">Start overtime</span>
          </AppButton>
        </div>

        <!-- Stop Overtime Button -->
        <div v-if="isOvertimeRunning" class="flex justify-center pb-2">
          <AppButton class="rounded-full" color="tomato" @click="stopOvertimeConfirmation = true">
            <span class="px-2">Stop recording</span>
          </AppButton>
        </div>
      </div>

      <!-- Stats -->
      <div v-if="!isCollapsed" class="shrink-0 space-y-1 pb-3 text-xs font-medium text-slate-7">
        <div class="flex items-center justify-between">
          <div>Total frequency</div>
          <div>{{ totalScore }}</div>
        </div>
        <div class="flex items-center justify-between">
          <div>Percentage</div>
          <div>{{ percentageScore }}%</div>
        </div>
      </div>
    </template>
  </div>
</template>
