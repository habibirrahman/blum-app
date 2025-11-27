<script setup lang="ts">
import {
  useSessionStore,
  type UpdateMeasurementParams,
  type UpdateMeasurementResultsParams
} from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { type MeasurementType, type Measurement, type Target, type TargetType } from '@/lib/types'
import AppToggle from '@/components/AppToggle.vue'
import { getRandomString, getTargetType } from '@/lib/func'
import Prompting from './measurement/Prompting.vue'
import Frequency from './measurement/Frequency.vue'
import PartialIntervalRecording from './measurement/PartialIntervalRecording.vue'
import DurationLatency from './measurement/DurationLatency.vue'
import Percentage from './measurement/Percentage.vue'
import Probing from './measurement/Probing.vue'
import SkillBasedTreatment from './measurement/SkillBasedTreatment.vue'
import { useToast } from 'vue-toastification'
import TrialByTrial from './measurement/TrialByTrial.vue'
import ColdProbe from './measurement/ColdProbe.vue'
import TaskAnalysis from './measurement/TaskAnalysis.vue'
import { useAppStore } from '@/stores/app.store'

const toast = useToast()
const appStore = useAppStore()
const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  counter: number
  is_collapsed?: boolean
  review_mode?: boolean
  is_running?: boolean
  is_disabled_action?: boolean
}
interface Emits {
  (e: 'toggle-updated', payload: { id: Measurement['id']; updated: boolean }): void
  (e: 'toggle-running'): void
  (e: 'toggle-saved', payload: { id: Measurement['id']; saved: boolean }): void
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'fetch-session'): void
  (e: 'check-completed-cold-probe', payload: { id: Measurement['id']; isCompleted: boolean }): void
}
const props = withDefaults(defineProps<Props>(), {
  is_collapsed: false,
  review_mode: false
})
const emit = defineEmits<Emits>()

// Periodic check untuk stuck items
let periodicCheckInterval: any = null

onMounted(async () => {
  if (sessionStore.session?.status === 'ongoing') {
    // Setup auto-sync (hanya sekali)
    if (!sessionStore._autoSyncInitialized) {
      sessionStore.setupAutoSync()
    }

    // Process pending items jika online
    if (appStore.network_status.connected && sessionStore.pending_progress.length > 0) {
      console.log('[Component] Processing pending items on mount')
      await sessionStore.resolvePendingProgress()
    }
  }

  cardLoading.value = true
  await generateResults(props.measurement.results)

  target.value = props.measurement.target

  isDropped.value = props.measurement.is_dropped || false
  cardLoading.value = false
})

// Cleanup saat unmount
onUnmounted(() => {
  clearInterval(periodicCheckInterval)
})

const measurementResults = ref<Measurement['results']>()

watch(
  () => props.measurement.results,
  async (val) => {
    await generateResults(val)
    cardLoading.value = false
  },
  { deep: true }
)

const generateResults = async (res: Measurement['results']) => {
  measurementResults.value = res

  // Restore dari backup jika ada
  const measurementId = Number(props.measurement.id)
  const backup = await sessionStore.restoreFromBackup(measurementId)
  if (backup) {
    if (backup.status === 'pending') {
      measurementResults.value = backup.data.results
      toast.info('Data restored from backup`')
    }
  }

  if (
    props.measurement.type === 'Measurement::Duration' ||
    props.measurement.type === 'Measurement::Latency'
  ) {
    generateLaps(measurementResults.value)
  }
}

const cardLoading = ref<boolean>(true)
const measurementType = computed<MeasurementType | TargetType | ''>(() => {
  const targetData: Target = props.measurement?.target || target.value || {}
  return props.measurement?.type || targetData?.type || ''
})

const display = ref<'target' | 'description' | 'comment'>('target')
watch(
  () => props.is_collapsed || props.review_mode,
  (val) => {
    if (val) display.value = 'target'
  }
)
const onChangeDisplay = async (val: 'target' | 'description' | 'comment') => {
  if (display.value === val) {
    display.value = 'target'
    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `${val}_close`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      notes: `Closed ${val}, and open target measurement`,
      timestamp: new Date().toISOString()
    })
    return
  }

  display.value = val
  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `${val}_open`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    timestamp: new Date().toISOString()
  })
}

const cardId = ref<string>('card-random-id')

// 🔧 Tambahkan computed untuk monitoring
const hasPendingSync = computed(() => {
  return sessionStore.pending_progress.some(
    (item) => item.key === `update_measurement_${props.measurement.id}`
  )
})

const syncStatusText = computed(() => {
  if (!hasPendingSync.value) return ''

  const item = sessionStore.pending_progress.find(
    (i) => i.key === `update_measurement_${props.measurement.id}`
  )

  if (!item) return ''

  if (item.retryCount && item.retryCount > 3) {
    return `Sync failed: ${item.retryCount} attempt(s)`
  }

  return 'Syncing...'
})

// drop measurement property
const isDropped = ref<boolean>(false)
watch(
  () => props.measurement.is_dropped,
  (val) => {
    isDropped.value = val || false
    cardId.value = getRandomString('card-random-id')
  }
)
const isDropLoading = ref<boolean>(false)
const onDrop = async (bool: boolean) => {
  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { is_dropped: !bool },
    data_result: { ...props.measurement, is_dropped: !bool }
  }

  isDropLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `measurement_dropped`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: params.measurement },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message, data } = await sessionStore.updateMeasurement(params)
  isDropLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
  isDropped.value = data.is_dropped
  if (data.is_dropped && props.is_running) {
    emit('toggle-running')
  }
  // Force the cold probe to be marked as completed if is_dropped is true
  if (data.is_dropped && props.measurement.type?.includes('ColdProbe')) {
    handleCompletedColdProbe(true)
  }
}
const handleCompletedColdProbe = (isCompleted: boolean) => {
  emit('check-completed-cold-probe', { id: props.measurement.id, isCompleted })
}

const onToggleUpdated = (updated: boolean) => {
  emit('toggle-updated', { id: props.measurement.id, updated })
}

// comment property
const commentInput = ref<string>('')
const commentLoading = ref<boolean>(false)
watch(display, (val) => {
  if (val === 'comment') commentInput.value = props.measurement.comment || ''
})
const isDisabledSaveComment = computed<boolean>(
  () => commentInput.value === (props.measurement.comment || '')
)
const onSaveComment = async () => {
  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { comment: commentInput.value },
    data_result: { ...props.measurement, comment: commentInput.value }
  }

  commentLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `comment_save`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: params.measurement },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurement(params)
  commentLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
  display.value = 'target'
}

// duration property
const durationCounter = ref<number>(0)
const isStarted = ref<boolean>(false)
const durationInterval = ref<any>(null)
const updateLoading = ref<boolean>(false)
const lapLoading = ref<boolean>(false)
const laps = ref<any[]>([])
const lastLapTime = ref<any>(null)
const lastTimer = ref<any>(null)
const resetConfirmation = ref<boolean>(false)
const lapTimer = ref<number>(0)

const timerRunning = computed<string>(() => {
  let baseSeconds = 0
  if (lastTimer.value) {
    const [h, m, s] = lastTimer.value.split(':').map(Number)
    baseSeconds = h * 3600 + m * 60 + s
  }

  const totalSeconds = baseSeconds + (durationCounter.value || 0)

  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
})

const currentLapTime = computed<string>(() => {
  let baseSeconds = 0
  if (lastLapTime.value) {
    const [h, m, s] = lastLapTime.value.split(':').map(Number)
    baseSeconds = h * 3600 + m * 60 + s
  }

  const totalSeconds = baseSeconds + (lapTimer.value || 0)

  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
})

const generateLaps = (results: Measurement['results']) => {
  laps.value = []
  lastLapTime.value = null
  lastTimer.value = null
  lapTimer.value = 0
  durationCounter.value = 0

  Object.keys(results).forEach((lapIndex) => {
    const lap = results[lapIndex]
    if (parseInt(lapIndex) !== 0 || (lap.string !== '00:00:00' && lap.seconds !== 0)) {
      laps.value.push({
        lapNumber: parseInt(lapIndex),
        time: lap.string,
        seconds: lap.seconds
      })
    }
  })

  let totalSeconds = 0
  if (laps.value.length > 0) {
    laps.value.forEach((lap) => {
      const [h, m, s] = lap.time.split(':').map(Number)
      totalSeconds += h * 3600 + m * 60 + s
    })
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    const minutes = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')

    lastTimer.value = `${hours}:${minutes}:${seconds}`
    lastLapTime.value = laps.value[laps.value.length - 1].time
  }
}
const onStartDurationTimer = () => {
  durationInterval.value = setInterval(() => {
    durationCounter.value++
    lapTimer.value++
  }, 1000)
}
const onToggleTimer = async () => {
  if (!isStarted.value) {
    isStarted.value = true
    onStartDurationTimer()
    if (laps.value.length === 0) {
      const lapTime = currentLapTime.value
      laps.value.push({
        lapNumber: 0,
        time: lapTime,
        seconds: lapTimer.value
      })
    }
    emit('toggle-running')

    const finalResults = Object.fromEntries(
      laps.value.map((i: any, idx: number) => [idx, { string: i.time, seconds: i.seconds }])
    )

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `duration_start`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      params: { measurement: { results: finalResults } },
      notes: `Target: ${props.measurement.target?.name}`,
      timestamp: new Date().toISOString()
    })
  } else {
    // const capturedDurationTime = timerRunning.value
    const capturedLapTime = currentLapTime.value
    const capturedLapSeconds = lapTimer.value

    clearInterval(durationInterval.value)

    if (laps.value.length > 0) {
      laps.value[laps.value.length - 1].time = capturedLapTime
      laps.value[laps.value.length - 1].seconds = capturedLapSeconds
    }

    const finalResults = Object.fromEntries(
      laps.value.map((i: any, idx: number) => [idx, { string: i.time, seconds: i.seconds }])
    )

    const params: UpdateMeasurementResultsParams = {
      id: props.measurement.id,
      measurement: { results: finalResults },
      data_result: { ...props.measurement, results: finalResults },
      last_data: { ...props.measurement }
    }

    updateLoading.value = true

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `duration_stop`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      params: { measurement: { results: finalResults } },
      notes: `Target: ${props.measurement.target?.name}`,
      timestamp: new Date().toISOString()
    })

    const { data } = await sessionStore.updateMeasurementResults(params)
    updateLoading.value = false

    // if (!success) {
    //   resumeTimerFromString(capturedDurationTime, capturedLapTime)
    //   toast.error(message)
    //   return
    // }

    generateLaps(data.results)
    isStarted.value = false
    emit('toggle-running')
  }
}
const onRecordLap = async () => {
  if (!isStarted.value || lapLoading.value) return

  // const capturedDurationTime = timerRunning.value
  const capturedLapTime = currentLapTime.value
  const capturedLapSeconds = lapTimer.value

  clearInterval(durationInterval.value)
  lapLoading.value = true

  if (laps.value.length > 0) {
    laps.value[laps.value.length - 1].time = capturedLapTime
    laps.value[laps.value.length - 1].seconds = capturedLapSeconds
  }

  const lapNumber = laps.value.length
  laps.value.push({
    lapNumber,
    time: '00:00:00',
    seconds: 0
  })

  const finalResults = Object.fromEntries(
    laps.value.map((i: any, idx: number) => [idx, { string: i.time, seconds: i.seconds }])
  )

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `duration_lap`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { data } = await sessionStore.updateMeasurementResults(params)

  // if (!success) {
  //   laps.value.pop()
  //   resumeTimerFromString(capturedDurationTime, capturedLapTime)
  //   return
  // }

  lapTimer.value = 0
  lastLapTime.value = null

  // Mulai timer lagi
  generateLaps(data.results)
  startTimerAfterLap()
  lapLoading.value = false
}

const startTimerAfterLap = () => {
  durationInterval.value = setInterval(() => {
    durationCounter.value++
    lapTimer.value++
  }, 1000)
}

// const resumeTimerFromString = (durationString: string, lapString: string) => {
//   const [dHours, dMinutes, dSeconds] = durationString.split(':').map(Number)
//   durationCounter.value = dHours * 3600 + dMinutes * 60 + dSeconds

//   if (lapString) {
//     const [lHours, lMinutes, lSeconds] = lapString.split(':').map(Number)
//     lapTimer.value = lHours * 3600 + lMinutes * 60 + lSeconds
//     lastLapTime.value = lapString
//   }
// }

const onResetLaps = async () => {
  if (resetConfirmation.value) {
    laps.value = []
    lastLapTime.value = null
    lastTimer.value = null
    lapTimer.value = 0
    durationCounter.value = 0

    const finalResults = {
      0: { string: '00:00:00', seconds: 0 }
    }

    const params: UpdateMeasurementResultsParams = {
      id: props.measurement.id,
      measurement: { results: finalResults },
      data_result: { ...props.measurement, results: finalResults },
      last_data: { ...props.measurement }
    }

    // record session activities
    await sessionStore.addSessionActivity({
      action_label: `duration_reset`,
      recordable: 'Measurement',
      recordable_id: props.measurement.id,
      params: { measurement: { results: finalResults } },
      notes: `Target: ${props.measurement.target?.name}`,
      timestamp: new Date().toISOString()
    })

    const { success, data } = await sessionStore.updateMeasurementResults(params)

    if (!success) {
      return
    }
    generateLaps(data.results)
  }
  resetConfirmation.value = false
}

// prompting & sbt property
const target = ref<Target>()
const onToggleSaved = (saved: boolean) => {
  emit('toggle-saved', { id: props.measurement.id, saved })
}
</script>

<template>
  <div
    class="relative transition-all rounded shrink-0"
    :class="{
      'h-[600px] w-[320px]': !is_collapsed,
      'h-[180px] w-full': is_collapsed
    }"
  >
    <div
      v-if="review_mode && measurement.is_fixed"
      class="absolute left-0 flex items-center justify-center w-16 h-16 bg-white rounded-full -top-6"
    >
      <Icon icon="ph:lock-fill" class="text-[40px] text-prim-5" />
    </div>
    <div class="flex flex-col h-full" :class="{ 'pointer-events-none': review_mode }">
      <div
        class="h-[6px] w-full shrink-0 rounded-t"
        :style="{ backgroundColor: measurement.target?.curriculum_color }"
      ></div>
      <div
        v-if="!is_collapsed"
        id="measurememt-header"
        class="flex items-center justify-between w-full px-4 h-9 shrink-0 bg-prim-2"
      >
        <div
          class="flex items-center justify-center w-6 h-6 transition-all rounded"
          :class="{ 'bg-white': display === 'description' }"
          @click="onChangeDisplay('description')"
        >
          <Icon icon="ph:article" class="text-2xl text-light-purple-5" />
        </div>
        <div
          class="relative flex items-center justify-center w-6 h-6 transition-all rounded"
          :class="{ 'bg-white': display === 'comment' }"
          @click="onChangeDisplay('comment')"
        >
          <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
          <div
            class="absolute w-2 h-2 transition-all rounded-full right-px top-px bg-light-purple-5"
            :class="[measurement.comment ? 'opacity-100' : 'opacity-0']"
          ></div>
        </div>
        <div>
          <AppToggle
            :name="`toggle_measurement_${measurement.id}`"
            :checked="!isDropped"
            :loading="isDropLoading"
            :disabled="sessionStore.session?.status !== 'ongoing'"
            @change="onDrop"
          />
        </div>
      </div>

      <div v-if="cardLoading" class="flex flex-col items-center justify-center h-full bg-white">
        <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
      </div>
      <div
        v-else
        id="measurememt-body"
        class="flex flex-col h-full gap-2 px-4 pb-3 bg-white rounded-b"
        :class="[is_collapsed ? 'pt-3' : 'no-scrollbar overflow-y-auto']"
      >
        <div v-if="!is_collapsed" id="card-title" class="pt-3">
          <div v-if="measurement.target?.is_group" class="flex items-center gap-2">
            <Icon icon="ph:copy" class="w-5 h-5 text-slate-6" />
            <div
              class="text-sm font-semibold text-slate-9"
              :class="{ 'truncate ': display === 'target' || display === 'comment' }"
            >
              {{ measurement.target?.name }}
            </div>
          </div>
          <div v-else class="flex flex-col gap-1">
            <div
              class="flex items-center gap-x-2"
              :class="{ 'flex-wrap': display === 'target' || display === 'comment' }"
            >
              <div class="text-sm font-semibold text-slate-7">
                {{ measurement.target?.curriculum_name }}
              </div>
              <div v-if="measurementType.includes('Probing')" class="shrink-0">
                <div class="px-2 text-sm font-semibold rounded-full bg-lime-2 text-lime-7">
                  Probing
                </div>
              </div>
            </div>
            <div
              class="text-sm font-semibold text-slate-9"
              :class="{ 'truncate ': display === 'target' || display === 'comment' }"
            >
              {{ measurement.target?.name }}
            </div>
          </div>
        </div>
        <div v-if="display === 'target'" class="flex h-full gap-3">
          <div
            v-if="isDropped"
            class="flex flex-col items-center justify-center flex-grow min-h-full gap-4"
          >
            <Icon icon="solar:clipboard-remove-bold" class="w-20 h-20 text-tulip-6" />
            <div v-if="!is_collapsed" class="space-y-2 w-72">
              <div class="font-semibold text-center">Entry not recorded</div>
              <div class="text-sm text-center text-slate-8">
                This entry will not be saved when the Session ends. Toggle back to save this entry
                recording.
              </div>
            </div>
          </div>
          <div v-else :key="`measurement-card-${cardId}`" class="w-full h-full">
            <!-- Tambahkan sync status indicator (optional) -->
            <div
              v-if="sessionStore.session?.status === 'ongoing' && hasPendingSync && !is_collapsed"
              class="flex"
            >
              <div class="px-2 py-1 text-xs rounded bg-tulip-1 text-tulip-7">
                {{ syncStatusText }}
              </div>
            </div>

            <DurationLatency
              v-if="measurementType.includes('Duration') || measurementType.includes('Latency')"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :is_started="isStarted"
              :timer="timerRunning"
              :update_loading="updateLoading"
              :lap_loading="lapLoading"
              :laps="laps"
              :current_lap_time="currentLapTime"
              :is_collapsed="is_collapsed"
              :reset_confirmation="resetConfirmation"
              :is_disabled_action="is_disabled_action"
              @toggle-timer="onToggleTimer"
              @record-lap="onRecordLap"
              @reset-laps-confirm="resetConfirmation = true"
              @reset-laps-cancel="resetConfirmation = false"
              @fetch-session="emit('fetch-session')"
              @reset-laps="onResetLaps"
            />
            <Frequency
              v-if="measurementType.includes('Frequency')"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :is_collapsed="is_collapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <PartialIntervalRecording
              v-if="measurementType.includes('Pir')"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :counter="counter"
              :is_collapsed="is_collapsed"
              @fetch-session="emit('fetch-session')"
            />
            <Percentage
              v-if="measurementType.includes('Percentage')"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :is_collapsed="is_collapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <TrialByTrial
              v-if="measurementType.includes('TrialByTrial')"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :is_collapsed="is_collapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <Probing
              v-if="measurementType.includes('Probing')"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :is_collapsed="is_collapsed"
              @toggle-collapsed="emit('toggle-collapsed', $event)"
              @fetch-session="emit('fetch-session')"
            />
            <Prompting
              v-if="measurementType.includes('Prompting') && target && !target.is_group"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :target="target"
              :is_collapsed="is_collapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <TaskAnalysis
              v-if="measurementType.includes('Prompting') && target && target.is_group"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :target="target"
              :is_collapsed="is_collapsed"
              @toggle-saved="onToggleSaved($event)"
              @fetch-session="emit('fetch-session')"
            />
            <SkillBasedTreatment
              v-if="measurementType.includes('Sbt') && target"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :target="target"
              :is_collapsed="is_collapsed"
              @toggle-saved="onToggleSaved($event)"
              @fetch-session="emit('fetch-session')"
            />
            <ColdProbe
              v-if="measurementType.includes('ColdProbe') && target"
              :measurement="measurement"
              :measurement_results="measurementResults"
              :target="target"
              :is_collapsed="is_collapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
              @check-completed-cold-probe="handleCompletedColdProbe"
            />
          </div>
          <div
            v-if="is_collapsed"
            class="flex items-center justify-center w-8 rounded-full shrink-0 bg-slate-4"
            @click="emit('toggle-collapsed', false)"
          >
            <Icon icon="ph:caret-double-up" class="text-xl text-slate-7" />
          </div>
        </div>
        <div v-if="display === 'description'" class="pb-16">
          <div class="flex flex-col gap-3">
            <!-- target information -->
            <div
              v-if="measurement.target?.is_group"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              <div>Grouped targets - {{ getTargetType(measurement.target?.type) }}</div>
            </div>
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              <div v-if="!measurement.target?.is_group">
                {{ getTargetType(measurement.target?.type) }}
              </div>
              <div
                v-if="
                  measurement.target?.type === 'Target::Duration' ||
                  measurement.target?.type === 'Target::Latency'
                "
                class="space-y-0.5"
              >
                <div>Goal time: {{ measurement.target.goal_time }}</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div
                v-if="
                  measurement.target?.type === 'Target::Percentage' ||
                  measurement.target?.type === 'Target::TrialByTrial'
                "
                class="space-y-0.5"
              >
                <div>Goal: {{ measurement.target.goal }}%</div>
                <div v-if="measurement.target?.type === 'Target::Percentage'">
                  Number of trials: {{ measurement.target.number_of_trial }} trial(s)
                </div>
                <div v-if="measurement.target?.type === 'Target::TrialByTrial'">
                  Minimum number of trials: {{ measurement.target.number_of_trial }} trial(s)
                </div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Pir'" class="space-y-0.5">
                <div>Goal: {{ measurement.target.goal }}%</div>
                <div>Interval: {{ measurement.target.interval }} minute(s)</div>
                <div>Duration: {{ measurement.target.duration }} minute(s)</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Frequency'" class="space-y-0.5">
                <div>Goal: {{ measurement.target.goal }} attempt(s) per session</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Prompting'" class="space-y-0.5">
                <div class="capitalize">Format: {{ measurement.target?.prompting_format }}</div>
                <div v-if="measurement.target?.prompting_format === 'classic'">
                  Goal and success metric: Achieve target with
                  {{ measurement.target?.success_metric }} prompt, minimum
                  {{ measurement.target?.goal }} attempt(s) per session
                </div>
                <div v-if="measurement.target?.prompting_format === 'custom'">
                  Goal: {{ measurement.target?.goal }}%
                </div>
                <div v-if="measurement.target?.prompting_format === 'custom'">
                  Success metric: {{ measurement.target?.success_metric }}
                </div>
                <div v-if="target?.is_group">
                  Prompts used in this session:
                  {{
                    target?.prompts
                      ?.sort((a, b) => (a?.position || 0) - (b?.position || 0))
                      ?.map((prompt) => {
                        if (target?.prompting_format === 'custom') {
                          return `${prompt.name} (${prompt.score}%)`
                        }
                        const score =
                          prompt.abbreviation === 'Id' && prompt.name === 'Independent' ? 100 : 0
                        return `${prompt.name} (${score}%)`
                      })
                      ?.join(', ')
                  }}
                </div>
                <div v-else>
                  Prompts used in this session:
                  {{
                    Object.keys(measurementResults)
                      ?.map((key) => {
                        const found = target?.prompts?.find((i) => i.id === Number(key))
                        const percentage = found?.score || 0
                        return { ...measurementResults[key], percentage }
                      })
                      ?.sort((a, b) => a.position - b.position)
                      ?.map((prompt) => {
                        if (target?.prompting_format === 'custom') {
                          return `${prompt?.name} (${prompt?.percentage}%)`
                        }
                        return prompt?.name
                      })
                      ?.join(', ')
                  }}
                </div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Sbt'" class="space-y-0.5">
                <div>
                  Prompts used in this session:
                  {{
                    target?.prompts
                      ?.sort((a, b) => (a?.position || 0) - (b?.position || 0))
                      ?.map((prompt) => `${prompt.name} (${prompt.score}%)`)
                      ?.join(', ')
                  }}
                </div>
              </div>
            </div>
            <!-- end target information -->
            <!-- probing -->
            <div
              v-if="measurementType.includes('Probing')"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              <div>Probing activated</div>
              <div>
                Goal: score
                {{
                  measurement.target?.success_metric === 'equal to or greater than goal' ? '≥' : '<'
                }}
                {{ measurement.target?.probing_goal }}% in minimum
                {{ measurement.target?.probing_number_of_trial }} trial(s)
              </div>
            </div>
            <!-- end probing -->
            <!-- target description -->
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              <div v-if="!measurement.target?.description" class="italic">No description</div>
              <div v-else class="whitespace-pre-line">{{ measurement.target?.description }}</div>
            </div>
            <!-- end target description -->
            <!-- last past line -->
            <div
              v-if="measurement.target?.last_phase_line"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              Data from this session will be added to the
              <span class="font-semibold">{{ measurement.target.last_phase_line?.label }}</span>
              phase.
            </div>
            <!-- end last past line -->
            <!-- sbt -->
            <div v-if="measurement.target?.type === 'Target::Sbt'">
              <!-- sbt taks -->
              <div class="py-3 space-y-3 border-t-2 border-slate-4">
                <div v-for="taskCode in target?.target_tasks" :key="taskCode.id" class="space-y-1">
                  <div class="text-sm font-semibold text-slate-8">
                    {{ taskCode.code }} - {{ taskCode.title }}
                  </div>
                  <div class="text-sm whitespace-pre-line text-slate-8">
                    {{ taskCode.description }}
                  </div>
                </div>
              </div>
              <!-- sbt problem behavior -->
              <div class="py-3 space-y-3 border-t-2 border-slate-4">
                <div
                  v-for="problemBehavior in target?.target_problem_behaviors"
                  :key="problemBehavior.id"
                  class="space-y-1"
                >
                  <div class="text-sm font-semibold text-slate-8">
                    {{ problemBehavior.code }} - {{ problemBehavior.code_definition }}
                  </div>
                  <div class="text-sm whitespace-pre-line text-slate-8">
                    {{ problemBehavior.description }}
                  </div>
                </div>
              </div>
            </div>
            <!-- end sbt -->
            <!-- group targets -->
            <div v-if="measurement.target?.is_group">
              <!-- group targets members -->
              <div class="py-3 space-y-3 border-t-2 border-slate-4">
                <div
                  v-for="member in measurement.used_targets"
                  :key="member.target_id"
                  class="space-y-1"
                >
                  <div class="text-sm font-semibold text-slate-8">
                    {{ member.target_code }} - {{ member.target_name }}
                  </div>
                  <div class="text-sm whitespace-pre-line text-slate-8">
                    {{ member.description }}
                  </div>
                </div>
              </div>
              <!-- group targets problem behavior -->
              <div class="py-3 space-y-3 border-t-2 border-slate-4">
                <div
                  v-for="problemBehavior in target?.target_problem_behaviors"
                  :key="problemBehavior.id"
                  class="space-y-1"
                >
                  <div class="text-sm font-semibold text-slate-8">
                    {{ problemBehavior.code }} - {{ problemBehavior.code_definition }}
                  </div>
                  <div class="text-sm whitespace-pre-line text-slate-8">
                    {{ problemBehavior.description }}
                  </div>
                </div>
              </div>
            </div>
            <!-- end group targets -->
          </div>
          <div class="absolute bottom-0 flex h-16 w-[calc(100%-2rem)] items-center bg-pure-white">
            <AppButton kind="outline" class="w-full" @click="onChangeDisplay('description')">
              Close
            </AppButton>
          </div>
        </div>
        <div
          v-if="display === 'comment'"
          class="flex h-[calc(100%-44px)] flex-col justify-between gap-3"
        >
          <div
            v-if="sessionStore.session?.status !== 'ongoing'"
            class="pt-3 text-sm text-wrap text-slate-8"
          >
            {{ measurement.comment || '-' }}
          </div>
          <AppTextInput
            v-else
            :name="`measurement-comment-${measurement.id}`"
            type="textarea"
            placeholder="Type your comment here..."
            v-model="commentInput"
            class="h-full mt-2"
          />
          <div class="sticky z-10 w-full py-3 bg-white -bottom-3">
            <AppButton
              v-if="sessionStore.session?.status !== 'ongoing'"
              kind="outline"
              class="w-full"
              @click="onChangeDisplay('comment')"
            >
              Close
            </AppButton>
            <div v-else class="grid grid-cols-2">
              <AppButton kind="plain" class="w-full" @click="onChangeDisplay('comment')">
                Cancel
              </AppButton>
              <AppButton
                class="w-full"
                :disabled="isDisabledSaveComment"
                :loading="commentLoading"
                @click="onSaveComment"
              >
                Save
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
