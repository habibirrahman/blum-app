<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementParams } from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import {
  type MeasurementType,
  type Measurement,
  type Target,
  type TargetType,
  type MeasurementFrequency,
  type MeasurementDurationOrLatency,
  type MeasurementPrompting,
  type MeasurementTaskAnalysis,
  type MeasurementSbt
} from '@/lib/types'
import AppToggle from '@/components/AppToggle.vue'
import { getRandomString, getTargetTasks, getTargetType } from '@/lib/func'
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
import AppCheckInput from '@/components/AppCheckInput.vue'
import dayjs from 'dayjs'

interface Props {
  measurement: Measurement
  isCollapsed?: boolean
  reviewMode?: boolean
  isDisabledAction?: boolean
  useLock?: boolean
  isChecked?: boolean
}
interface Emits {
  (e: 'toggle-updated', payload: { id: Measurement['id']; updated: boolean }): void
  (e: 'toggle-saved', payload: { id: Measurement['id']; saved: boolean }): void
  (e: 'check-completed-cold-probe', payload: { id: Measurement['id']; isCompleted: boolean }): void
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'fetch-session'): void
  (e: 'toggle-lock'): void
  (e: 'toggle-check'): void
  (e: 'after-commit'): void
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false,
  reviewMode: false
})
const emit = defineEmits<Emits>()

const toast = useToast()
const appStore = useAppStore()
const sessionStore = useSessionStore()

/** === DATA === */

const dropLoading = ref<boolean>(false)
const cardLoading = ref<boolean>(true)
const commentLoading = ref<boolean>(false)

const isDropped = ref<boolean>(false)

const commentInput = ref<string>('')

const display = ref<'target' | 'description' | 'comment'>('target')
const cardId = ref<string>('card-random-id')

const measurementResults = ref<Measurement['results']>(props.measurement.results)

/** === COMPUTEDS === */

const measurementType = computed<MeasurementType | TargetType | ''>(() => {
  const targetData: Target = props.measurement?.target || {}
  return props.measurement?.type || targetData?.type || ''
})

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

const isDisabledSaveComment = computed<boolean>(
  () => commentInput.value === (props.measurement.comment || '')
)

// maintenance property
const isMaintenanceDisplayable = computed<boolean>(() => {
  const target = props.measurement.target
  if (!target || !target.in_maintenance) return false
  if (!target.maintenance_next_date) return false

  const nextDate = dayjs(new Date(target.maintenance_next_date))
  const today = dayjs().startOf('day')

  if (
    (nextDate.isSame(today) || nextDate.isBefore(today)) &&
    target.maintenance_status === 'overdue'
  ) {
    return true
  }
  if (nextDate.isSame(today)) {
    return true
  }
  return false
})

const promptingPrompts = computed(() => {
  if (!measurementResults.value) return ''
  const promptKeys = Object.keys(measurementResults.value)
  if (!promptKeys.length) return ''

  const prompts = props.measurement.target?.prompts || []
  if (!prompts.length) return ''

  const usedPrompts = promptKeys?.map((key) => {
    const prompt = prompts?.find((i) => i.id === Number(key))
    const percentage = prompt?.score || 0
    return { ...measurementResults.value[key], percentage }
  })
  const sorted = usedPrompts?.sort((a, b) => (a?.position || 0) - (b?.position || 0))
  const format = props.measurement.target?.prompting_format

  return sorted
    ?.map((prompt) => {
      if (format === 'custom') `${prompt?.name} (${prompt?.percentage}%)`
      return prompt?.name
    })
    ?.join(', ')
})

const sbtPrompts = computed(() => {
  const prompts = props.measurement.target?.prompts || []
  if (!prompts.length) return ''

  const sorted = prompts?.sort((a, b) => (a?.position || 0) - (b?.position || 0))

  return sorted?.map((prompt) => `${prompt.name} (${prompt.score}%)`)?.join(', ')
})

// task analysis property
const taskAnalysisPrompts = computed(() => {
  const prompts = props.measurement.target?.prompts || []
  if (!prompts.length) return ''

  const sorted = prompts?.sort((a, b) => (a?.position || 0) - (b?.position || 0))
  const format = props.measurement.target?.prompting_format

  return sorted
    ?.map((prompt) => {
      if (format === 'custom') `${prompt.name} (${prompt.score}%)`
      const score = prompt.abbreviation === 'Id' && prompt.name === 'Independent' ? 100 : 0
      return `${prompt.name} (${score}%)`
    })
    ?.join(', ')
})

/** === WATCHERS === */

// Catatan: `results` selalu di-assign sebagai object baru oleh store (lihat
// `setSessionMeasurement` — pakai `arr[idx] = data`, bukan mutasi in-place),
// sehingga shallow watch (tanpa `deep: true`) sudah cukup mendeteksi perubahan
// dan menghindari overhead traverse seluruh object pada setiap update.
watch(
  () => props.measurement.results,
  async (val) => {
    await generateResults(val)
    cardLoading.value = false
  }
)

watch(
  () => props.isCollapsed || props.reviewMode,
  (val) => {
    if (val) display.value = 'target'
  }
)

watch(
  () => props.measurement.is_dropped,
  (val) => {
    isDropped.value = val || false
    cardId.value = getRandomString('card-random-id')
  }
)

watch(
  () => display.value,
  (val) => {
    if (val === 'comment') commentInput.value = props.measurement.comment || ''
  }
)

/** === METHODS === */

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
}

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

const onDrop = async (bool: boolean) => {
  if (sessionStore.session?.status !== 'ongoing') return

  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { is_dropped: !bool },
    data_result: { ...props.measurement, is_dropped: !bool }
  }

  dropLoading.value = true

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
  dropLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
  isDropped.value = data.is_dropped
  // Force the cold probe to be marked as completed if is_dropped is true
  if (data.is_dropped && props.measurement.type?.includes('ColdProbe')) {
    handleCompletedColdProbe(true)
  }
}

const onToggleUpdated = (updated: boolean) => {
  emit('toggle-updated', { id: props.measurement.id, updated })
}

const onToggleSaved = (saved: boolean) => {
  emit('toggle-saved', { id: props.measurement.id, saved })
}

const handleCompletedColdProbe = (isCompleted: boolean) => {
  emit('check-completed-cold-probe', { id: props.measurement.id, isCompleted })
}

const onSaveComment = async () => {
  if (sessionStore.session?.status !== 'ongoing') return

  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { comment: commentInput.value },
    data_result: { ...props.measurement, comment: commentInput.value },
    is_comment: true
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

  isDropped.value = props.measurement.is_dropped || false
  cardLoading.value = false
})

// Cleanup saat unmount
onUnmounted(() => {
  // Clear timeout to prevent memory leaks
})
</script>

<template>
  <div
    class="relative rounded shrink-0"
    :class="{
      'h-[600px] w-[320px]': !isCollapsed,
      'h-[160px] w-full': isCollapsed,
      'border border-light-purple-5 shadow-[4px_4px_4px_4px_#D6C7E066]': isChecked
    }"
  >
    <div
      v-if="reviewMode && measurement.is_fixed"
      class="flex absolute left-0 -top-6 justify-center items-center w-16 h-16 bg-white rounded-full"
    >
      <Icon icon="ph:lock-fill" class="text-[40px] text-prim-5" />
    </div>
    <div
      class="flex flex-col h-full"
      :class="{ 'pointer-events-none': reviewMode && sessionStore.session?.status !== 'draft' }"
    >
      <div
        class="h-[6px] w-full shrink-0 rounded-t"
        :style="{ backgroundColor: measurement.target?.curriculum_color }"
      ></div>
      <div v-if="!isCollapsed" id="measurememt-header">
        <div
          v-if="sessionStore.session?.status === 'draft'"
          class="flex justify-between items-center px-2 w-full h-9 shrink-0 bg-prim-2"
        >
          <div
            v-if="useLock"
            class="flex justify-center items-center w-7 h-7 bg-white rounded"
            @click="emit('toggle-lock')"
          >
            <Icon icon="ph:lock-open-fill" class="text-2xl text-light-purple-5" />
          </div>
          <div v-else></div>

          <div :class="[reviewMode ? 'relative right-4 top-4' : '']">
            <AppCheckInput
              :name="`check-${measurement.id}`"
              :checked="isChecked"
              :class="[reviewMode ? 'scale-150' : '']"
              @change.stop="emit('toggle-check')"
            />
          </div>
        </div>
        <div v-else class="flex justify-between items-center px-4 w-full h-9 shrink-0 bg-prim-2">
          <div
            class="flex justify-center items-center w-6 h-6 rounded transition-colors"
            :class="{ 'bg-white': display === 'description' }"
            @click="onChangeDisplay('description')"
          >
            <Icon icon="ph:article" class="text-2xl text-light-purple-5" />
          </div>
          <div
            class="flex relative justify-center items-center w-6 h-6 rounded transition-colors"
            :class="{ 'bg-white': display === 'comment' }"
            @click="onChangeDisplay('comment')"
          >
            <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
            <div
              class="absolute top-px right-px w-2 h-2 rounded-full transition-colors bg-light-purple-5"
              :class="[measurement.comment ? 'opacity-100' : 'opacity-0']"
            ></div>
          </div>
          <div>
            <AppToggle
              :name="`toggle_measurement_${measurement.id}`"
              :checked="!isDropped"
              :loading="dropLoading"
              :disabled="sessionStore.session?.status !== 'ongoing'"
              @change="onDrop"
            />
          </div>
        </div>
      </div>

      <div v-if="cardLoading" class="flex flex-col justify-center items-center h-full bg-white">
        <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
      </div>
      <div
        v-else
        id="measurememt-body"
        class="flex flex-col gap-2 px-4 pb-3 h-full bg-white rounded-b"
        :class="[isCollapsed ? 'pt-3' : 'no-scrollbar overflow-y-auto']"
      >
        <div v-if="!isCollapsed" id="card-title" class="pt-3">
          <div v-if="measurement.target?.is_group" class="flex gap-2 items-center">
            <Icon icon="ph:copy" class="w-5 h-5 text-slate-6" />
            <div
              class="text-sm font-semibold text-slate-9"
              :class="{ 'line-clamp-2': display === 'target' || display === 'comment' }"
            >
              {{ measurement.target?.name }}
            </div>
          </div>
          <div v-else class="flex flex-col gap-1">
            <div
              class="flex gap-x-2 items-center"
              :class="{ 'flex-wrap': display === 'target' || display === 'comment' }"
            >
              <div class="text-sm font-semibold text-slate-7">
                {{ measurement.target?.curriculum_name }}
              </div>
              <div v-if="isMaintenanceDisplayable" class="shrink-0">
                <div
                  class="flex items-center px-2 h-6 text-xs font-semibold rounded-full bg-orange-2 text-orange-7"
                >
                  {{ measurement.target?.maintenance_badge || 'Maintenance' }}
                </div>
              </div>
              <div v-if="measurementType.includes('Probing')" class="shrink-0">
                <div
                  class="flex items-center px-2 h-6 text-xs font-semibold rounded-full bg-lime-2 text-lime-7"
                >
                  Probing
                </div>
              </div>
              <div v-if="measurement.target?.allow_overtime_recording" class="shrink-0">
                <div
                  class="flex items-center px-2 h-6 text-xs rounded-full bg-slate-3 text-slate-8"
                >
                  Overtime on
                </div>
              </div>
            </div>
            <div
              class="text-sm font-semibold text-slate-9"
              :class="{ 'line-clamp-2': display === 'target' || display === 'comment' }"
            >
              {{ measurement.target?.name }}
            </div>
          </div>
        </div>
        <div v-if="display === 'target'" class="flex gap-3 h-full">
          <div
            v-if="isDropped"
            class="flex flex-col flex-grow gap-4 justify-center items-center min-h-full"
          >
            <Icon icon="solar:clipboard-remove-bold" class="w-20 h-20 text-tulip-6" />
            <div class="space-y-2 w-72">
              <div class="font-semibold text-center">Entry not recorded</div>
              <div v-if="!isCollapsed" class="text-sm text-center text-slate-8">
                This entry will not be saved when the Session ends. Toggle back to save this entry
                recording.
              </div>
            </div>
          </div>

          <div
            v-else
            :key="`measurement-card-${cardId}`"
            class="w-full h-full"
            :class="{ 'pointer-events-none opacity-50': isDisabledAction }"
            :title="isDisabledAction ? 'Refreshing session data, please wait...' : ''"
          >
            <!-- Tambahkan sync status indicator (optional) -->
            <div
              v-if="sessionStore.session?.status === 'ongoing' && hasPendingSync && !isCollapsed"
              class="flex"
            >
              <div class="px-2 py-1 text-xs rounded bg-tulip-1 text-tulip-7">
                {{ syncStatusText }}
              </div>
            </div>

            <ColdProbe
              v-if="measurementType.includes('ColdProbe') && measurement?.target"
              :measurement="measurement"
              :measurement-results="measurementResults"
              :target="measurement?.target"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
              @check-completed-cold-probe="handleCompletedColdProbe"
            />
            <DurationLatency
              v-if="measurementType.includes('Duration') || measurementType.includes('Latency')"
              :measurement="measurement"
              :measurement-results="measurementResults as MeasurementDurationOrLatency['results']"
              :is-collapsed="isCollapsed"
              :is-disabled-action="isDisabledAction"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <Frequency
              v-if="measurementType.includes('Frequency')"
              :measurement="measurement"
              :measurement-results="measurementResults as MeasurementFrequency['results']"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <Percentage
              v-if="measurementType.includes('Percentage')"
              :measurement="measurement"
              :measurement-results="measurementResults"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
              @after-commit="emit('after-commit')"
            />
            <PartialIntervalRecording
              v-if="measurementType.includes('Pir')"
              :measurement="measurement"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
            />
            <Probing
              v-if="measurementType.includes('Probing')"
              :measurement="measurement"
              :measurement-results="measurementResults"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @toggle-collapsed="emit('toggle-collapsed', $event)"
              @fetch-session="emit('fetch-session')"
              @after-commit="emit('after-commit')"
            />
            <Prompting
              v-if="
                measurementType.includes('Prompting') &&
                measurement.target &&
                !measurement.target?.is_group
              "
              :measurement="measurement"
              :measurement-results="measurementResults as MeasurementPrompting['results']"
              :target="measurement?.target"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
            />
            <SkillBasedTreatment
              v-if="measurementType.includes('Sbt') && measurement?.target"
              :measurement="measurement"
              :measurement-results="measurementResults as MeasurementSbt['results']"
              :target="measurement?.target"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @toggle-saved="onToggleSaved($event)"
              @fetch-session="emit('fetch-session')"
            />
            <TaskAnalysis
              v-if="measurementType.includes('Prompting') && measurement.target?.is_group"
              :measurement="measurement"
              :measurement-results="measurementResults as MeasurementTaskAnalysis['results']"
              :target="measurement?.target"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @toggle-saved="onToggleSaved($event)"
              @fetch-session="emit('fetch-session')"
            />
            <TrialByTrial
              v-if="measurementType.includes('TrialByTrial')"
              :measurement="measurement"
              :measurement-results="measurementResults"
              :is-collapsed="isCollapsed"
              @toggle-updated="onToggleUpdated($event)"
              @fetch-session="emit('fetch-session')"
              @after-commit="emit('after-commit')"
            />
          </div>
          <div
            v-if="isCollapsed"
            class="flex justify-center items-center w-8 rounded-full shrink-0 bg-slate-4"
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
              class="space-y-0.5 text-sm text-wrap text-slate-8"
            >
              <div>Grouped targets - {{ getTargetType(measurement.target?.type) }}</div>
            </div>
            <div class="space-y-0.5 text-sm text-wrap text-slate-8">
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
                <div v-if="measurement.target.frequency_format === 'custom'">
                  Duration: {{ measurement.duration }} minute(s)
                </div>
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
                <div v-if="measurement?.target?.is_group">
                  Prompts used in this session:
                  {{ taskAnalysisPrompts }}
                </div>
                <div v-else>
                  Prompts used in this session:
                  {{ promptingPrompts }}
                </div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Sbt'" class="space-y-0.5">
                <div>
                  Prompts used in this session:
                  {{ sbtPrompts }}
                </div>
              </div>
            </div>
            <!-- end target information -->
            <!-- probing -->
            <div
              v-if="measurementType.includes('Probing')"
              class="space-y-0.5 text-sm text-wrap text-slate-8"
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
            <div class="space-y-0.5 text-sm text-wrap text-slate-8">
              <div v-if="!measurement.target?.description" class="italic">No description</div>
              <div v-else class="whitespace-pre-line">{{ measurement.target?.description }}</div>
            </div>
            <!-- end target description -->
            <!-- last past line -->
            <div
              v-if="measurement.target?.last_phase_line"
              class="space-y-0.5 text-sm text-wrap text-slate-8"
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
                <div
                  v-for="taskCode in getTargetTasks(measurement.target)"
                  :key="taskCode.id"
                  class="space-y-1"
                >
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
                  v-for="problemBehavior in measurement.target?.target_problem_behaviors"
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
                  v-for="problemBehavior in measurement.target?.target_problem_behaviors"
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
            :disabled="sessionStore.session?.status !== 'ongoing'"
            class="mt-2 h-full"
          />
          <div class="sticky -bottom-3 py-3 w-full bg-white z-1">
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
