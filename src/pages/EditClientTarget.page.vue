<script lang="ts" setup>
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import AppInputTime from '@/components/AppTimeInput.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppToggle from '@/components/AppToggle.vue'
import { type ActionRecommendation, type Curriculum, type TargetStatus } from '@/lib/types'
import CurriculumItemModal from '@/partitions/CurriculumItemModal.vue'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import moment from 'moment'

// ========== CONSTANTS ==========
const STATUS_OPTIONS: { value: TargetStatus; label: string }[] = [
  { value: 'in_progress', label: 'In acquisition' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Pause' },
  { value: 'discontinued', label: 'Discontinued' }
]

const MIN_DURATION = 5
const MIN_TOTAL_SUCCESS = 1
const MIN_CONSECUTIVE_SUCCESS = 2
const MAX_PERCENTAGE = 100
const DEFAULT_TIME = '00:00:00'

// ========== COMPOSABLES ==========
const route = useRoute()
const clientStore = useClientStore()
const appStore = useAppStore()
const toast = useToast()
const router = useRouter()

// ========== UI STATE ==========
const loading = ref(false)
const submitLoading = ref(false)
const isCloseTargetDetails = ref(false)
const isCloseActionRecommendation = ref(true)
const showUnsavedChangesModal = ref(false)
const pendingRoute = ref<any>(null)
const initialDataStr = ref('')

// ========== FORM STATE ==========
// Basic fields
const name = ref('')
const description = ref('')
const status = ref<TargetStatus | ''>('')
const selectStatus = ref<TargetStatus | ''>('')

// Curriculum
const curriculumQuery = ref('')
const showCurriculum = ref(false)
const curriculumOptions = ref<{ value: number; label: string; color: string; name: string }[]>([])
const selectedCurriculum = ref<{
  value: number
  label: string
  color: string
  name: string
} | null>(null)

// Status
const showStatus = ref(false)

// Prompt level (for classic prompting)
const showPromptLevel = ref(false)
const selectedPromptSuccessMetric = ref('')

// Goal and metrics
const goal = ref('')
const goalTime = ref(DEFAULT_TIME)
const duration = ref('')
const numberOfTrial = ref('')
const successMetric = ref('')

// PIR setting
const intervalStartTiming = ref('')
const allowOvertimeRecording = ref(false)

// Probing
const probingEnabled = ref(false)
const probingTrial = ref('')
const probingGoal = ref('')

// Action recommendations

// mastered
const masteredActionId = ref<ActionRecommendation['id']>(0)
const totalSuccessChecked = ref(false)
const consecutiveSuccessChecked = ref(false)
const totalSuccessInput = ref(0)
const consecutiveSuccessInput = ref(0)

// activate_next_target
const nextTargetActionId = ref<ActionRecommendation['id']>(0)
const nextTargetChecked = ref(false)
const nextTargetDetails = computed(() => {
  return clientStore.target?.progression?.next_target
})

// maintenance
const maintenanceActionId = ref<ActionRecommendation['id']>(0)
const maintenanceChecked = ref(false)
const maintenanceApproach = ref('manual')
const manualIntervalAmount = ref<string | number>('')
const manualIntervalUnit = ref('days')
const automationTotalSessions = ref('')
const automationOnFailure = ref('restart_from_first')
const automationSchedules = ref<{ session_order: number; interval_amount: string | number; interval_unit: string }[]>([
  { session_order: 1, interval_amount: 1, interval_unit: 'days' }
])
const maintenanceRecommendationRef = ref<ActionRecommendation | null>(null)
const showManualUnitSheet = ref(false)
const showScheduleUnitSheet = ref(false)
const editingScheduleIndex = ref(0)
const showFailureSheet = ref(false)
const showDisableMaintenanceModal = ref(false)

const UNIT_OPTIONS = [
  { value: 'days', label: 'day' },
  { value: 'weeks', label: 'week' },
  { value: 'months', label: 'month' }
]
const UNIT_OPTIONS_SHORT = [
  { value: 'days', label: 'day' },
  { value: 'weeks', label: 'week' },
  { value: 'months', label: 'month' }
]
const FAILURE_OPTIONS = [
  { value: 'restart_from_first', label: 'Restart from 1st maintenance session' },
  { value: 'repeat_current', label: 'Retry the failed session until the success metric is successfully passed' }
]

// Other
const applyToAllMember = ref(true)

// ========== COMPUTED PROPERTIES ==========
const targetId = computed(() => Number(route.params.target_id))
const clientId = computed(() => Number(route.params.id))

const curriculumParams = computed(() => {
  const params = new URLSearchParams({ sort: 'name_asc' })
  if (curriculumQuery.value) {
    params.append('query', curriculumQuery.value)
  }
  return `?${params.toString()}`
})

const promptSuccessMetricOptions = computed(() => {
  return (
    clientStore.target?.prompts?.map((p) => ({
      value: p.name as string,
      label: p.name as string
    })) || []
  )
})

// Target type checks
const isGroup = computed(() => clientStore.target?.is_group)
const isTargetMember = computed(() => Boolean(clientStore.target?.group_id))

const targetType = computed(() => clientStore.target?.type || '')
const isPercentageType = computed(() => targetType.value.includes('Percentage'))
const isTrialByTrialType = computed(() => targetType.value.includes('TrialByTrial'))
const isDurationType = computed(() => targetType.value.includes('Duration'))
const isLatencyType = computed(() => targetType.value.includes('Latency'))
const isPirType = computed(() => targetType.value.includes('Pir'))
const isFrequencyType = computed(() => targetType.value.includes('Frequency'))
const isPromptingType = computed(() => targetType.value.includes('Prompting'))
const isSbtType = computed(() => targetType.value.includes('Sbt'))
const isColdProbeType = computed(() => targetType.value.includes('ColdProbe'))

// const isFrequencyClassic = computed(
//   () => isFrequencyType.value && clientStore.target?.frequency_format === 'classic'
// )

const isFrequencyCustom = computed(
  () => isFrequencyType.value && clientStore.target?.frequency_format === 'custom'
)

const isPromptingClassic = computed(
  () => isPromptingType.value && clientStore.target?.prompting_format === 'classic'
)

const isPromptingCustom = computed(
  () => isPromptingType.value && clientStore.target?.prompting_format === 'custom'
)

// Feature flags
const useActionRecommendations = computed(() => !isSbtType.value && !isGroup.value)

const useSuccessMetric = computed(() => {
  if (isGroup.value) return false

  return (
    (!isSbtType.value && !isColdProbeType.value && !isPromptingType.value) ||
    isPromptingCustom.value
  )
})

const useProbing = computed(() => isPercentageType.value || isTrialByTrialType.value)

// Validation
const isDisabledSubmit = computed(() => {
  // Basic validation
  if (!name.value || !selectedCurriculum.value) return true

  // Type-specific validation
  if (isPercentageType.value || isTrialByTrialType.value) {
    if (!successMetric.value || !goal.value || !numberOfTrial.value) return true
    if (Number(goal.value) > MAX_PERCENTAGE) return true
    if (probingEnabled.value && (!probingGoal.value || !probingTrial.value)) return true
  }

  if (isDurationType.value || isLatencyType.value) {
    if (goalTime.value === DEFAULT_TIME || !goalTime.value || !successMetric.value || !goal.value) {
      return true
    }
  }

  if (isPirType.value) {
    if (
      Number(duration.value) < MIN_DURATION ||
      !duration.value ||
      !goal.value ||
      !successMetric.value ||
      !intervalStartTiming.value
    ) {
      return true
    }
  }

  if (isFrequencyType.value) {
    if (!goal.value || !successMetric.value) return true
    if (isFrequencyCustom.value) {
      if (!duration.value) return true
    }
  }

  if (isPromptingType.value) {
    if (!goal.value) return true
    if (isPromptingClassic.value && !selectedPromptSuccessMetric.value) return true
    if (!isGroup.value && isPromptingCustom.value && !successMetric.value) return true
  }

  return false
})

// ========== LIFECYCLE ==========
onMounted(async () => {
  await loadInitialData()
})

// ========== METHODS ==========
async function loadInitialData() {
  try {
    loading.value = true
    await clientStore.getTarget({ id: targetId.value })
    const { data } = await appStore.getCurriculums({ params: curriculumParams.value })
    initializeFormData(data)
    initialDataStr.value = JSON.stringify(buildTargetData())
  } catch (error) {
    toast.error('Failed to load target data')
    console.error('Error loading initial data:', error)
  } finally {
    loading.value = false
  }
}

// Navigation Guard
onBeforeRouteLeave((to, from, next) => {
  const currentDataStr = JSON.stringify(buildTargetData())

  if (initialDataStr.value && initialDataStr.value !== currentDataStr) {
    showUnsavedChangesModal.value = true
    pendingRoute.value = to
    next(false)
  } else {
    next()
  }
})

function onStay() {
  showUnsavedChangesModal.value = false
  pendingRoute.value = null
}

function onDiscard() {
  showUnsavedChangesModal.value = false
  // Update initial data to match current so the guard doesn't trigger again
  initialDataStr.value = JSON.stringify(buildTargetData())
  if (pendingRoute.value) {
    router.push(pendingRoute.value)
  }
}

function initializeFormData(curriculums: Curriculum[]) {
  const target = clientStore.target
  if (!target) return

  // Basic fields
  name.value = target.name || ''
  description.value = target.description || ''
  status.value = target.status as TargetStatus
  selectStatus.value = target.status as TargetStatus

  // Curriculum
  curriculumOptions.value = curriculums.map((c) => ({
    value: c.id as number,
    label: c.name as string,
    color: c.color as string,
    name: c.name as string
  }))
  selectedCurriculum.value =
    curriculumOptions.value.find((c) => c.value === target.curriculum_id) || null

  // Action recommendations
  if (useActionRecommendations.value) {
    masteredActionId.value = 0
    nextTargetActionId.value = 0

    const masteredAction = target.action_recommendations?.find(
      (i) => i.recommended_action === 'mastered'
    )
    if (masteredAction) {
      masteredActionId.value = masteredAction.id
      if (masteredAction.total_success !== null) {
        totalSuccessChecked.value = true
        totalSuccessInput.value = masteredAction.total_success as number
      }
      if (masteredAction.consecutive_success !== null) {
        consecutiveSuccessChecked.value = true
        consecutiveSuccessInput.value = masteredAction.consecutive_success as number
      }
    }

    const nextTargetAction = target.action_recommendations?.find(
      (i) => i.recommended_action === 'activate_next_target'
    )
    if (nextTargetAction) {
      nextTargetActionId.value = nextTargetAction.id
      nextTargetChecked.value = nextTargetAction.is_enabled || false
    }

    maintenanceActionId.value = 0
    maintenanceRecommendationRef.value = null
    const maintenanceAction = target.action_recommendations?.find(
      (i) => i.recommended_action === 'maintenance'
    )
    if (maintenanceAction) {
      maintenanceActionId.value = maintenanceAction.id
      maintenanceChecked.value = maintenanceAction.is_enabled || false
      maintenanceRecommendationRef.value = maintenanceAction
      const config = maintenanceAction.maintenance_config
      if (config) {
        maintenanceApproach.value = config.approach || 'manual'
        if (config.approach === 'manual' && config.frequency) {
          manualIntervalAmount.value = config.frequency.interval_amount?.toString() || ''
          manualIntervalUnit.value = config.frequency.interval_unit || 'days'
        } else if (config.approach === 'automation') {
          automationTotalSessions.value = config.total_sessions?.toString() || ''
          automationOnFailure.value = config.on_failure || 'restart_from_first'
          automationSchedules.value = config.schedules || [
            { session_order: 1, interval_amount: 1, interval_unit: 'days' }
          ]
        }
      }
    }
  }

  // Success metric
  if (useSuccessMetric.value) {
    successMetric.value = target.success_metric || ''
  }

  // Type-specific fields
  goal.value = target.goal?.toString() || ''
  goalTime.value = target.goal_time || DEFAULT_TIME
  duration.value = target.duration?.toString() || ''
  numberOfTrial.value = target.number_of_trial?.toString() || ''

  intervalStartTiming.value = target.interval_start_timing || ''
  allowOvertimeRecording.value = target.allow_overtime_recording || false

  // Probing
  if (useProbing.value) {
    probingEnabled.value = target.probing_enable || false
    probingTrial.value = target.probing_number_of_trial?.toString() || ''
    probingGoal.value = target.probing_goal?.toString() || ''
  }

  // Prompting
  if (isPromptingClassic.value) {
    selectedPromptSuccessMetric.value = target.success_metric || ''
  }
}

function buildTargetData() {
  const data: any = {
    id: targetId.value,
    target: {
      name: name.value,
      type: targetType.value,
      curriculum_id: selectedCurriculum.value?.value,
      description: description.value,
      status: status.value,
      date_introduce: clientStore.target?.date_introduce,
      date_mastered: clientStore.target?.date_mastered
    }
  }

  // Apply to all member flag
  if (isTargetMember.value) {
    data.target.apply_to_members = applyToAllMember.value
  }

  // Type-specific data
  if (isPercentageType.value || isTrialByTrialType.value) {
    Object.assign(data.target, {
      success_metric: successMetric.value,
      goal: Number(goal.value),
      number_of_trial: Number(numberOfTrial.value)
    })
  }

  if (isDurationType.value || isLatencyType.value) {
    Object.assign(data.target, {
      success_metric: successMetric.value,
      goal_time: goalTime.value
    })
  }

  if (isPirType.value) {
    Object.assign(data.target, {
      duration: Number(duration.value),
      goal: Number(goal.value),
      success_metric: successMetric.value,
      interval: clientStore.target?.interval,
      interval_start_timing: intervalStartTiming.value,
      allow_overtime_recording: allowOvertimeRecording.value
    })
  }

  if (isFrequencyType.value) {
    Object.assign(data.target, {
      goal: Number(goal.value),
      success_metric: successMetric.value
    })
    if (isFrequencyCustom.value) {
      data.target.duration = Number(duration.value)
    }
  }

  if (isPromptingType.value) {
    Object.assign(data.target, {
      goal: Number(goal.value),
      prompting_format: clientStore.target?.prompting_format
    })

    if (isPromptingClassic.value) {
      data.target.success_metric = selectedPromptSuccessMetric.value
    }

    if (isPromptingCustom.value) {
      data.target.success_metric = successMetric.value
    }

    if (isGroup.value) {
      data.target.success_metric = clientStore.target?.success_metric
    }
  }

  // Probing
  if (useProbing.value) {
    Object.assign(data.target, {
      probing_enable: probingEnabled.value,
      probing_number_of_trial: probingEnabled.value ? Number(probingTrial.value) : null,
      probing_goal: probingEnabled.value ? Number(probingGoal.value) : null
    })
  }

  // Action recommendations for target members
  if (useActionRecommendations.value && isTargetMember.value) {
    data.target.action_recommendations_attributes = [
      {
        total_success: totalSuccessChecked.value ? totalSuccessInput.value : null,
        consecutive_success: consecutiveSuccessChecked.value ? consecutiveSuccessInput.value : null,
        recommended_action: 'mastered'
      }
    ]
  }

  return data
}

async function handleActionRecommendations() {
  if (!useActionRecommendations.value || isTargetMember.value) return

  // prepare data for action recommendations
  const masteredAction = {
    id: masteredActionId.value,
    data: {
      target_id: targetId.value,
      total_success: totalSuccessChecked.value ? totalSuccessInput.value : undefined,
      consecutive_success: consecutiveSuccessChecked.value
        ? consecutiveSuccessInput.value
        : undefined,
      recommended_action: 'mastered'
    } as ActionRecommendation
  }

  const nextTargetAction = {
    id: nextTargetActionId.value,
    data: {
      target_id: targetId.value,
      is_enabled: nextTargetChecked.value,
      recommended_action: 'activate_next_target'
    } as ActionRecommendation
  }

  // hasn't mastered target recommendation -- so create new one
  if (!masteredAction.id) {
    await clientStore.createActionRecommendation({ data: masteredAction.data })
  }

  // hasn't activate next target recommendation -- so create new one
  if (!nextTargetAction.id) {
    await clientStore.createActionRecommendation({ data: nextTargetAction.data })
  }

  // has mastered target recommendation -- so update it
  // mastered recommendation is primary action for target, so it will always have id
  if (masteredAction.id) {
    const payload = {
      data: [{ id: masteredAction.id, ...masteredAction.data }]
    }

    // has activate next target recommendation -- so update it
    if (nextTargetActionId.value) {
      payload.data.push({ id: nextTargetActionId.value, ...nextTargetAction.data })
    }

    const maintenanceAction = {
      id: maintenanceActionId.value,
      data: {
        target_id: targetId.value,
        is_enabled: maintenanceChecked.value,
        recommended_action: 'maintenance',
        maintenance_config: { approach: maintenanceApproach.value } as any
      } as ActionRecommendation
    }
    
    if (maintenanceApproach.value === 'manual') {
      maintenanceAction.data.maintenance_config.frequency = {
        interval_amount: Number(manualIntervalAmount.value) || 1,
        interval_unit: manualIntervalUnit.value || 'days'
      }
      maintenanceAction.data.maintenance_config.frequency_string = `every ${manualIntervalAmount.value || 1} ${manualIntervalUnit.value}`
    } else if (maintenanceApproach.value === 'automation') {
      maintenanceAction.data.maintenance_config.total_sessions = Number(automationTotalSessions.value) || 1
      maintenanceAction.data.maintenance_config.on_failure = automationOnFailure.value
      maintenanceAction.data.maintenance_config.failure_strategy = automationOnFailure.value
      maintenanceAction.data.maintenance_config.schedules = automationSchedules.value.map((s) => ({
        session_order: s.session_order,
        interval_amount: Number(s.interval_amount) || 1,
        interval_unit: s.interval_unit || 'days'
      }))
    }

    if (!maintenanceAction.id) {
      await clientStore.createActionRecommendation({ data: maintenanceAction.data })
    } else {
      payload.data.push({ id: maintenanceAction.id, ...maintenanceAction.data })
    }

    await clientStore.bulkUpdateActionRecommendations(payload)
  }
}

function validateActionRecommendations(): boolean {
  if (totalSuccessChecked.value && totalSuccessInput.value < MIN_TOTAL_SUCCESS) {
    toast.error(
      `Please enter a value greater than or equal to ${MIN_TOTAL_SUCCESS} for total success.`
    )
    return false
  }

  if (consecutiveSuccessChecked.value && consecutiveSuccessInput.value < MIN_CONSECUTIVE_SUCCESS) {
    toast.error(
      `Please enter a value greater than or equal to ${MIN_CONSECUTIVE_SUCCESS} for consecutive.`
    )
    return false
  }

  if (maintenanceChecked.value) {
    if (maintenanceApproach.value === 'manual') {
      if (!manualIntervalAmount.value || Number(manualIntervalAmount.value) < 1) {
        toast.error('Please enter a valid interval amount for manual maintenance approach.')
        return false
      }
    } else {
      if (!automationTotalSessions.value || Number(automationTotalSessions.value) < 1) {
        toast.error('Please enter a valid total sessions for automation maintenance approach.')
        return false
      }
      for (const schedule of automationSchedules.value) {
        if (!schedule.interval_amount || Number(schedule.interval_amount) < 1) {
          toast.error('Please enter valid interval amounts for all automation schedules.')
          return false
        }
      }
    }
  }

  return true
}

function onAutomationSessionsChange() {
  let limit = parseInt(automationTotalSessions.value) || 1
  if (limit < 1) limit = 1
  while (automationSchedules.value.length < limit) {
    automationSchedules.value.push({
      session_order: automationSchedules.value.length + 1,
      interval_amount: 1,
      interval_unit: 'days'
    })
  }
  automationSchedules.value = automationSchedules.value.slice(0, limit)
}

function ordinalSuffix(i: number) {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) return i + 'st'
  if (j === 2 && k !== 12) return i + 'nd'
  if (j === 3 && k !== 13) return i + 'rd'
  return i + 'th'
}

const maintenanceInProgress = computed(() => {
  if (!maintenanceRecommendationRef.value) return false
  const state = maintenanceRecommendationRef.value.maintenance_state
  if (!state) return false
  return clientStore.target?.status === 'mastered' && state.started
})

const baseDateText = computed(() => {
  const prefix = 'after the target is <b>mastered</b>'
  if (!clientStore.target) return prefix
  if (clientStore.target.status === 'mastered' && clientStore.target.date_mastered) {
    const dateStr = moment(clientStore.target.date_mastered).format('DD MMM YYYY')
    return `${prefix} <b>at ${dateStr}</b>`
  }
  return prefix
})

function maintenanceSessionHasBeenRecorded(schedule: { session_order: number }) {
  if (!maintenanceRecommendationRef.value) return false
  const state = maintenanceRecommendationRef.value.maintenance_state
  if (!state) return false
  return state.started && schedule.session_order < state.current_order
}

function onToggleMaintenance() {
  maintenanceChecked.value = !maintenanceChecked.value
}

function shouldConfirmDisableMaintenance(): boolean {
  // Check: user is disabling maintenance, target is mastered, has started records, and NOT completed
  if (maintenanceChecked.value) return false // maintenance is still enabled, no need to confirm
  const state = maintenanceRecommendationRef.value?.maintenance_state
  if (
    clientStore.target?.status === 'mastered' &&
    state?.started &&
    !state?.completed
  ) {
    return true
  }
  return false
}

function confirmDisableMaintenance() {
  showDisableMaintenanceModal.value = false
  doSubmit()
}

watch(automationTotalSessions, () => {
  onAutomationSessionsChange()
})

async function onSubmit() {
  if (!validateActionRecommendations()) return

  // Show confirmation if user is disabling active maintenance
  if (shouldConfirmDisableMaintenance()) {
    showDisableMaintenanceModal.value = true
    return
  }

  await doSubmit()
}

async function doSubmit() {
  try {
    submitLoading.value = true

    const data = buildTargetData()
    await handleActionRecommendations()

    const { success } = await clientStore.updateTarget({
      id: targetId.value,
      data
    })

    if (!success) {
      toast.error('Failed to update the target. Please try again.')
      return
    }

    toast.success('The target has been updated.')
    // Update initial data to avoid AYS on successful save
    initialDataStr.value = JSON.stringify(buildTargetData())

    setTimeout(() => {
      router.push({ name: 'client', params: { id: clientId.value, tab: 'targets' } })
    }, 1000)
  } catch (error) {
    toast.error('An error occurred while updating the target.')
    console.error('Error updating target:', error)
  } finally {
    submitLoading.value = false
  }
}

function onApplyCurriculum(val: number) {
  selectedCurriculum.value = curriculumOptions.value.find((c) => c.value === val) || null
  showCurriculum.value = false
}

function onApplyStatus(val: TargetStatus) {
  status.value = val
  showStatus.value = false
}

function onChangeSuccessMetrics(val: {
  totalSuccessChecked: boolean
  consecutiveSuccessChecked: boolean
}) {
  totalSuccessChecked.value = val.totalSuccessChecked
  consecutiveSuccessChecked.value = val.consecutiveSuccessChecked
}

function onChangeNextTarget(val: boolean) {
  nextTargetChecked.value = val
}

function onApplyPromptSuccessMetric(val: string) {
  selectedPromptSuccessMetric.value = val
  showPromptLevel.value = false
}
</script>

<template>
  <!-- Header -->
  <div class="flex sticky top-0 z-10 gap-3 items-center px-4 pt-3 pb-3 bg-white">
    <RouterLink :to="{ name: 'client', params: { id: clientId, tab: 'targets' } }">
      <div class="flex justify-center items-center w-8 h-8 rounded-full cursor-pointer bg-slate-2">
        <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
      </div>
    </RouterLink>
    <div class="text-[22px] font-bold text-slate-10">Edit details</div>
  </div>

  <!-- Main Content -->
  <div class="p-4 space-y-5 w-full h-full min-h-svh bg-prim-3">
    <!-- Target/Group Details Section -->
    <div class="p-4 space-y-4 bg-white rounded">
      <!-- Section Header -->
      <div
        v-if="!isGroup"
        @click="isCloseTargetDetails = !isCloseTargetDetails"
        class="flex justify-between items-center cursor-pointer"
        :class="{ 'border-b border-slate-4 pb-2': !isCloseTargetDetails }"
      >
        <div class="text-sm font-semibold text-slate-10">Target details</div>
        <Icon
          icon="ph:caret-up-bold"
          class="w-5 h-5 transition-transform text-slate-10"
          :class="{ 'rotate-180': isCloseTargetDetails }"
        />
      </div>

      <div v-if="isGroup" class="flex justify-between items-center pb-2 border-b border-slate-4">
        <div class="text-sm font-semibold text-slate-10">Group details</div>
      </div>

      <!-- Form Fields -->
      <div v-if="!isCloseTargetDetails" class="space-y-4">
        <!-- Title -->
        <AppTextInput name="title" label="Title" required v-model="name" />

        <!-- Curriculum (not for groups) -->
        <div v-if="!isGroup">
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Curriculum</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showCurriculum = true"
            class="flex justify-between items-center px-4 py-2 bg-white rounded border cursor-pointer border-slate-4"
          >
            <div class="flex gap-2 items-center truncate">
              <div
                class="flex-shrink-0 w-6 h-6 rounded-full"
                :style="{ backgroundColor: selectedCurriculum?.color }"
              />
              <div class="truncate text-[16px] text-slate-10">
                {{ selectedCurriculum?.name }}
              </div>
            </div>
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Curriculum Change Warning -->
        <div v-if="isTargetMember" class="flex gap-2 items-center p-2 rounded bg-cornflower-2">
          <Icon icon="material-symbols:info" class="text-lg text-cornflower-8" />
          <div class="text-xs text-cornflower-8">
            Changing the curriculum will apply it to all targets in this grouped target.
          </div>
        </div>

        <!-- Status (not for groups) -->
        <div v-if="!isGroup">
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Status</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showStatus = true"
            class="flex justify-between items-center px-4 py-2 bg-white rounded border cursor-pointer border-slate-4"
          >
            <AppChip :chip="status as TargetStatus" />
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Description -->
        <AppTextInput
          name="description"
          label="Description"
          type="textarea"
          :rows="isGroup ? 10 : 4"
          v-model="description"
        />

        <!-- Divider for Prompting Types -->
        <div
          v-if="(isPromptingClassic || isPromptingCustom) && !isGroup"
          class="w-full h-0.5 bg-slate-3"
        />

        <!-- Classic Prompting Goal and Success Metric -->
        <div v-if="isPromptingClassic && !isGroup" class="space-y-2">
          <div class="text-sm font-semibold text-slate-10">Goal and success metric</div>
          <div class="text-xs text-slate-8">
            Mark this target as successful when the client uses a specific prompt at least a certain
            number of times.
          </div>

          <div class="pt-2 pb-2">
            <div class="mb-1 text-sm font-medium text-slate-8">
              <span>Prompt level</span>
              <span class="ml-1 text-tomato-7">*</span>
            </div>
            <div
              @click="showPromptLevel = true"
              class="flex justify-between items-center px-4 py-2 bg-white rounded border cursor-pointer border-slate-4"
            >
              <div class="text-[16px]">{{ selectedPromptSuccessMetric }}</div>
              <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
            </div>
          </div>

          <AppTextInput
            name="goal"
            label="Minimum attempts per session"
            required
            placeholder="Type goal"
            suffix-text="attempt(s)"
            v-model="goal"
            type="number"
            inputmode="numeric"
          />
        </div>

        <!-- Custom Prompting Goal -->
        <div v-if="isPromptingCustom && !isGroup" class="space-y-2">
          <div class="text-sm font-semibold text-slate-10">Goal and success metric</div>
          <div class="text-xs text-slate-8">
            The target passes if the client's score meets the goal you set.
          </div>
          <AppTextInput
            name="goal"
            label="Goal"
            required
            placeholder="1-100"
            suffix-text="percent (%)"
            v-model="goal"
            type="number"
            inputmode="numeric"
          />
        </div>

        <!-- Duration/Latency Time Input -->
        <AppInputTime
          v-if="isDurationType || isLatencyType"
          v-model="goalTime"
          name="duration"
          label="Goal time (hours/minutes/seconds)"
          format="hms"
          :required="true"
        />

        <!-- PIR Interval Display -->
        <div v-if="isPirType">
          <div class="mb-1 text-sm font-medium">Interval</div>
          <div class="text-sm text-slate-10">{{ clientStore.target?.interval }} Minutes</div>
        </div>

        <!-- PIR Duration -->
        <AppTextInput
          v-if="isPirType"
          name="duration"
          label="Duration"
          required
          placeholder="Minimum 5 minutes"
          suffix-text="Minutes"
          v-model="duration"
          :error="
            Number(duration) < MIN_DURATION
              ? `Duration must be at least ${MIN_DURATION} minutes.`
              : ''
          "
          type="number"
          inputmode="numeric"
        />

        <!-- PIR Goal -->
        <AppTextInput
          v-if="isPirType"
          name="goal"
          label="Goal"
          required
          placeholder="1-100"
          suffix-text="percent (%)"
          v-model="goal"
          :error="
            Number(goal) > MAX_PERCENTAGE
              ? `Goal must be less than or equal to ${MAX_PERCENTAGE} percent(%).`
              : ''
          "
          type="number"
          inputmode="numeric"
        />

        <!-- Frequency Goal -->
        <AppTextInput
          v-if="isFrequencyType"
          name="goal"
          label="Goal"
          required
          placeholder="Target goal"
          suffix-text="attempt(s) per session"
          v-model="goal"
          type="number"
          inputmode="numeric"
        />

        <!-- Percentage Goal -->
        <AppTextInput
          v-if="isPercentageType"
          name="goal"
          label="Goal"
          required
          placeholder="1-100"
          suffix-text="Percent (%)"
          v-model="goal"
          :error="
            Number(goal) > MAX_PERCENTAGE
              ? `Goal must be less than or equal to ${MAX_PERCENTAGE} percent(%).`
              : ''
          "
          type="number"
          inputmode="numeric"
        />

        <!-- Trial by Trial Goal -->
        <AppTextInput
          v-if="isTrialByTrialType"
          name="goal"
          label="Goal"
          required
          placeholder="1-100"
          suffix-text="Percent (%)"
          v-model="goal"
          :error="
            Number(goal) > MAX_PERCENTAGE
              ? `Goal must be less than or equal to ${MAX_PERCENTAGE} percent(%).`
              : ''
          "
          type="number"
          inputmode="numeric"
        />

        <!-- Success Metric Radio Buttons -->
        <div v-if="useSuccessMetric" class="space-y-2">
          <div class="text-sm font-medium text-slate-8">
            <span>Success metric</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>

          <div v-if="!isLatencyType" class="flex gap-2 items-center mb-3">
            <input
              type="radio"
              name="success_metric"
              :checked="successMetric === 'equal to or greater than goal'"
              value="equal to or greater than goal"
              class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
              @click="successMetric = 'equal to or greater than goal'"
            />
            <label class="w-full text-sm">Equal to or greater than goal</label>
          </div>

          <div class="flex gap-2 items-center">
            <input
              type="radio"
              name="success_metric"
              :checked="successMetric === 'less than goal'"
              value="less than goal"
              class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
              @click="successMetric = 'less than goal'"
            />
            <label class="w-full text-sm">Less than goal</label>
          </div>
        </div>

        <!-- Minimum Number of Trials -->
        <AppTextInput
          v-if="isPercentageType || isTrialByTrialType"
          name="number_of_trial"
          label="Minimum number of trials"
          required
          v-model="numberOfTrial"
          type="number"
          inputmode="numeric"
        />

        <!-- Frequency (custom) Duration -->
        <AppTextInput
          v-if="isFrequencyCustom"
          name="duration"
          label="Duration"
          required
          placeholder="Minimum 1 minute"
          suffix-text="Minutes"
          v-model="duration"
          :error="Number(duration) < 1 ? `Duration must be at least ${1} minutes.` : ''"
          type="number"
          inputmode="numeric"
        >
          <template #caption>
            This duration will be used as the <b>denominator</b> when calculating the frequency
            rate.
          </template>
        </AppTextInput>

        <!-- PIR Interval start timing -->
        <div v-if="isPirType" class="space-y-2">
          <div class="text-sm font-medium text-slate-8">
            <span>Interval start timing</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div class="text-xs text-slate-7">Choose how intervals begin during the session.</div>

          <div class="flex gap-2 items-center">
            <input
              type="radio"
              name="interval_start_timing"
              :checked="intervalStartTiming === 'start_with_session'"
              value="start_with_session"
              class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
              @click="intervalStartTiming = 'start_with_session'"
            />
            <label class="w-full text-sm">Start with session</label>
          </div>
          <div class="flex gap-2 items-center">
            <input
              type="radio"
              name="interval_start_timing"
              :checked="intervalStartTiming === 'custom_start'"
              value="custom_start"
              class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
              @click="intervalStartTiming = 'custom_start'"
            />
            <label class="w-full text-sm">Custom start</label>
          </div>
        </div>

        <!-- PIR Allow overtime recording -->
        <div v-if="isPirType" class="space-y-2">
          <div class="text-sm font-medium text-slate-8">
            <span>Overtime handling</span>
          </div>
          <div class="text-xs text-slate-7">
            Configure whether recording continues after the planned duration ends.
          </div>

          <div class="flex gap-2 items-center">
            <AppToggle
              name="allow_overtime_recording"
              :checked="allowOvertimeRecording"
              @change="allowOvertimeRecording = !allowOvertimeRecording"
            />
            <div class="text-sm">Allow overtime recording</div>
          </div>
        </div>

        <!-- Apply to All Member Checkbox -->
        <div v-if="isTargetMember" class="flex gap-3 items-center">
          <input
            type="checkbox"
            name="applyToAllMember"
            id="applyToAllMember"
            :checked="applyToAllMember"
            class="rounded shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="applyToAllMember = !applyToAllMember"
          />
          <label for="applyToAllMember" class="w-full text-sm">
            Apply goal and success metric changes to all targets in this group
          </label>
        </div>
      </div>
    </div>

    <!-- Probing Section -->
    <div v-if="useProbing" class="p-4 space-y-4 bg-white rounded">
      <div class="flex justify-between items-center pb-2 border-b border-slate-4">
        <div class="text-sm font-semibold text-slate-10">Probing</div>
        <AppToggle
          name="use_probing"
          :checked="probingEnabled"
          @change="probingEnabled = !probingEnabled"
        />
      </div>

      <div class="text-xs text-slate-8">
        Probing can be employed to assess a skill at various stages of the therapy. Activating
        probing gives you additional option to conduct probes during the session.
      </div>

      <AppTextInput
        name="probing_trial"
        label="Minimum probes (trials) needed"
        required
        v-model="probingTrial"
        type="number"
        inputmode="numeric"
        suffix-text="trials"
        :disabled="!probingEnabled"
      />

      <AppTextInput
        name="probing_goal"
        label="Goal"
        required
        v-model="probingGoal"
        type="number"
        inputmode="numeric"
        suffix-text="percent (%)"
        :disabled="!probingEnabled"
      />
    </div>

    <!-- Action Recommendations Section -->
    <div v-if="useActionRecommendations" class="p-4 space-y-3 bg-white rounded">
      <div
        @click="isCloseActionRecommendation = !isCloseActionRecommendation"
        class="flex justify-between items-center cursor-pointer"
      >
        <div class="flex gap-2 items-center">
          <div class="p-1 rounded bg-orange-3">
            <Icon icon="mynaui:info-waves-solid" class="rotate-180 text-[20px] text-[#FD853A]" />
          </div>
          <div class="text-sm font-semibold text-slate-10">Action recommendations</div>
        </div>
        <Icon
          icon="ph:caret-up-bold"
          class="w-5 h-5 transition-transform text-slate-10"
          :class="{ 'rotate-180': isCloseActionRecommendation }"
        />
      </div>

      <div v-if="!isCloseActionRecommendation" class="space-y-2">
        <!-- mastered action recommendation -->
        <div class="py-2 space-y-2 border-t border-slate-4">
          <div class="text-sm font-semibold text-slate-10">Passing success metric</div>
          <div class="text-xs text-slate-8">Updating the current target's status from</div>

          <div class="flex gap-2 items-center">
            <AppChip chip="in_progress" />
            <div class="text-sm text-slate-8">to</div>
            <AppChip chip="mastered" />
          </div>

          <!-- total success -->
          <div class="flex gap-2 items-center pt-2">
            <AppToggle
              name="total_success"
              :checked="totalSuccessChecked"
              @change="
                onChangeSuccessMetrics({
                  totalSuccessChecked: !totalSuccessChecked,
                  consecutiveSuccessChecked
                })
              "
            />
            <div class="text-xs font-semibold text-slate-9">Total success</div>
          </div>

          <div class="text-xs font-medium text-slate-8">
            Receive a recommendation after completing at least
          </div>

          <div class="flex gap-2 items-center pt-2">
            <input
              type="number"
              pattern="[0-9]*"
              inputmode="numeric"
              min="1"
              v-model="totalSuccessInput"
              :disabled="!totalSuccessChecked"
              :class="{ 'opacity-50': !totalSuccessChecked }"
              class="h-8 w-16 appearance-none rounded border border-slate-4 px-2 text-center outline-none [-webkit-appearance:none] focus:border-light-purple-5 focus:ring-light-purple-2"
            />
            <div class="text-xs text-slate-8">successful session(s).</div>
          </div>
          <!-- end total success -->

          <!-- consecutive success -->
          <div class="flex gap-2 items-center pt-2">
            <AppToggle
              name="consecutive_success"
              :checked="consecutiveSuccessChecked"
              @change="
                onChangeSuccessMetrics({
                  consecutiveSuccessChecked: !consecutiveSuccessChecked,
                  totalSuccessChecked
                })
              "
            />
            <div class="text-xs font-semibold text-slate-9">Consecutive success</div>
          </div>

          <div class="text-xs font-medium text-slate-8">
            Receive a recommendation only if the session is successful for
          </div>

          <div class="flex gap-2 items-center pt-2">
            <input
              type="number"
              pattern="[0-9]*"
              inputmode="numeric"
              v-model="consecutiveSuccessInput"
              min="2"
              :disabled="!consecutiveSuccessChecked"
              :class="{ 'opacity-50': !consecutiveSuccessChecked }"
              class="h-8 w-16 appearance-none rounded border border-slate-4 px-2 text-center outline-none [-webkit-appearance:none] focus:border-light-purple-5 focus:ring-light-purple-2"
            />
            <div class="text-xs text-slate-8">consecutive session(s).</div>
          </div>
          <!-- end consecutive success -->
        </div>
        <!-- end mastered action recommendation -->

        <!-- activate next target recommendation -->
        <div class="py-2 space-y-2 border-t border-slate-4">
          <div class="flex gap-2 items-center">
            <AppToggle
              name="next_target"
              :checked="nextTargetChecked"
              @change="onChangeNextTarget(!nextTargetChecked)"
            />
            <div class="text-sm font-semibold text-slate-10">Next target recommendation</div>
          </div>
          <div class="text-xs text-slate-8">
            <span>When this target is mastered, </span>
            <span v-if="nextTargetDetails">
              updating next target
              <span class="font-semibold">{{ nextTargetDetails.name + ' ' }}</span>
            </span>
            <span v-else>the next target </span>
            <span>will be recommended to change from </span>
          </div>
          <div class="flex gap-2 items-center">
            <AppChip chip="pending" />
            <div class="text-sm text-slate-8">to</div>
            <AppChip chip="in_progress" />
          </div>

          <div v-if="nextTargetDetails?.status === 'create'" class="text-xs italic text-slate-8">
            The next target hasn't been imported yet. You can import it after this target is
            mastered or now.
          </div>

          <div class="flex gap-2 px-3 py-2 rounded bg-cornflower-2">
            <Icon icon="ph:info-fill" class="text-2xl text-cornflower-8" />
            <div class="text-sm text-cornflower-8">
              <span v-if="!clientStore.target?.parent_id">
                This setting is available only when creating a target in the Databank.
              </span>
              <span v-else-if="!nextTargetDetails">
                There is no next target that will be activated once this target has mastered. This
                setting is only available for targets in Databank.
              </span>
              <span v-else>
                Target progression is managed in the Repository. To create or modify the next
                target, update the progression there.
              </span>
            </div>
          </div>
        </div>
        <!-- end activate next target recommendation -->

        <!-- maintenance recommendation -->
        <div class="py-2 space-y-4 border-t border-slate-4">
          <div class="flex gap-2 items-center">
            <AppToggle
              name="maintenance"
              :checked="maintenanceChecked"
              :class="{ 'opacity-75': maintenanceChecked }"
              @change="onToggleMaintenance"
            />
            <div class="text-sm font-semibold text-slate-10">Maintenance</div>
          </div>
          <div class="text-xs text-slate-8">
            Set up a maintenance plan for a mastered target. If failed, target status will be moved
            from
            <div class="flex gap-2 items-center mt-2">
              <AppChip chip="mastered" /> to <AppChip chip="in_progress" />
            </div>
          </div>

          <!-- maintenance in progress notice -->
          <div
            v-if="maintenanceInProgress"
            class="flex gap-2 px-3 py-2 rounded bg-cornflower-2"
          >
            <Icon icon="ph:info-fill" class="text-2xl text-cornflower-8" />
            <div class="text-sm text-cornflower-8">
              Maintenance is already in progress. You are no longer able to change the approach.
            </div>
          </div>

          <div v-if="maintenanceChecked" class="space-y-4">
            <!-- Approach Selection (hidden when in progress) -->
            <div v-if="!maintenanceInProgress" class="flex p-1 rounded-lg border border-slate-4 bg-slate-2">
              <div
                class="flex justify-center items-center py-1 w-full rounded transition-all duration-300 cursor-pointer"
                :class="maintenanceApproach === 'manual' ? 'bg-white font-medium shadow' : 'text-slate-8'"
                @click="maintenanceApproach = 'manual'"
              >
                Manual
              </div>
              <div
                class="flex justify-center items-center py-1 w-full rounded transition-all duration-300 cursor-pointer"
                :class="maintenanceApproach === 'automation' ? 'bg-white font-medium shadow' : 'text-slate-8'"
                @click="maintenanceApproach = 'automation'"
              >
                Automation
              </div>
            </div>

            <!-- Manual Settings -->
            <div v-if="maintenanceApproach === 'manual'" class="space-y-3">
              <div class="text-[13px] font-semibold text-slate-10">Manual approach</div>
              <div class="text-xs text-slate-8">
                Repeat maintenance at a fixed interval with no end date. Sessions continue until the setting is turned off.
              </div>
              
              <div class="pt-2 space-y-1">
                <div class="text-[13px] font-semibold text-slate-10">Recommended maintenance frequency</div>
                <div class="flex gap-2 justify-between items-center pt-1">
                  <span class="text-sm">Every</span>
                  <div class="flex gap-2">
                    <input
                      type="number"
                      v-model="manualIntervalAmount"
                      class="px-2 w-32 h-10 text-sm rounded border appearance-none outline-none border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2"
                    />
                    <div
                      @click="showManualUnitSheet = true"
                      class="flex justify-between items-center px-3 h-10 bg-white rounded border cursor-pointer border-slate-4 min-w-[100px]"
                    >
                      <span class="text-sm">{{ UNIT_OPTIONS.find(o => o.value === manualIntervalUnit)?.label || 'Day(s)' }}</span>
                      <Icon icon="ph:caret-down" class="text-slate-500" />
                    </div>
                  </div>
                </div>
                <div class="text-xs text-slate-8" v-html="baseDateText"></div>
              </div>
            </div>

            <!-- Automation Settings -->
            <div v-if="maintenanceApproach === 'automation'" class="space-y-3">
              <div class="text-[13px] font-semibold text-slate-10">Automation approach</div>
              <div class="text-xs text-slate-8">
                Create a predefined sequence of maintenance sessions with custom intervals between each session.
              </div>

              <div class="space-y-1">
                <AppTextInput
                  name="total_sessions"
                  label="Number of maintenance sessions"
                  required
                  v-model="automationTotalSessions"
                  suffix-text="Session"
                  type="number"
                  inputmode="numeric"
                />
              </div>

              <div class="pt-2 space-y-4">
                <div v-for="(schedule, index) in automationSchedules" :key="index" class="space-y-2">
                  <div class="text-[13px] font-semibold text-slate-10">
                    {{ ordinalSuffix(index + 1) }} maintenance schedule
                  </div>
                  <div class="flex gap-2 items-center">
                    <input
                      type="number"
                      v-model="schedule.interval_amount"
                      :disabled="maintenanceSessionHasBeenRecorded(schedule)"
                      :class="{ 'opacity-50': maintenanceSessionHasBeenRecorded(schedule) }"
                      class="px-2 w-2/4 h-10 text-sm rounded border appearance-none outline-none border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2"
                    />
                    <div
                      @click="() => { if (!maintenanceSessionHasBeenRecorded(schedule)) { editingScheduleIndex = index; showScheduleUnitSheet = true } }"
                      class="flex justify-between w-2/4 items-center px-3 h-10 bg-white rounded border cursor-pointer border-slate-4 min-w-[100px]"
                      :class="{ 'opacity-50 cursor-not-allowed': maintenanceSessionHasBeenRecorded(schedule) }"
                    >
                      <span class="text-sm">{{ UNIT_OPTIONS_SHORT.find(o => o.value === schedule.interval_unit)?.label || 'Day' }}</span>
                      <Icon icon="ph:caret-down" class="text-slate-500" />
                    </div>
                  </div>
                  <div class="text-xs text-slate-8" v-html="index === 0 ? baseDateText : 'after previous maintenance.'"></div>
                </div>
              </div>

              <div class="pt-2 space-y-2">
                <div class="text-[13px] font-medium text-slate-8">When a maintenance session fails</div>
                <div
                  @click="() => { if (automationSchedules.length > 1) showFailureSheet = true }"
                  class="flex justify-between items-center px-3 w-full h-10 bg-white rounded border cursor-pointer border-slate-4"
                  :class="{ 'opacity-50 cursor-not-allowed': automationSchedules.length === 1 }"
                >
                  <span class="pr-2 text-sm truncate">{{ FAILURE_OPTIONS.find(o => o.value === automationOnFailure)?.label }}</span>
                  <Icon icon="ph:caret-down" class="text-slate-500 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- end maintenance recommendation -->
      </div>
    </div>
  </div>

  <!-- Submit Button -->
  <div class="sticky bottom-0 px-4 py-3 bg-white">
    <AppButton
      class="w-full"
      @click="onSubmit"
      :disabled="isDisabledSubmit"
      :loading="submitLoading"
    >
      Update
    </AppButton>
  </div>

  <!-- Curriculum Modal -->
  <CurriculumItemModal
    :show="showCurriculum"
    :reset-able="false"
    :options="curriculumOptions"
    :selected="[selectedCurriculum?.value as number]"
    :use-multiple-select="false"
    @close="showCurriculum = false"
    @apply="onApplyCurriculum($event[0])"
  />

  <!-- Status Action Sheet -->
  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Status</div>
        <div class="cursor-pointer" @click="showStatus = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in STATUS_OPTIONS"
          :key="opt.value"
          class="flex justify-between items-center w-full h-14 border-b border-slate-4"
        >
          <label :for="`status_${opt.value}`" class="w-full text-sm cursor-pointer">
            <div class="w-fit">
              <AppChip :chip="opt.value" />
            </div>
          </label>
          <input
            type="radio"
            name="status_select"
            :id="`status_${opt.value}`"
            :checked="selectStatus === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="selectStatus = opt.value"
          />
        </div>
      </div>

      <div class="grid sticky bottom-0 z-10 grid-cols-1 gap-2 py-3 w-full bg-white">
        <AppButton class="w-full" @click="onApplyStatus(selectStatus as TargetStatus)">
          Apply
        </AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Prompt Level Action Sheet -->
  <AppActionSheet :show="showPromptLevel" @close="showPromptLevel = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Prompt</div>
        <div class="cursor-pointer" @click="showPromptLevel = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in promptSuccessMetricOptions"
          :key="opt.value"
          class="flex justify-between items-center w-full h-14 border-b border-slate-4"
        >
          <label :for="`prompt_${opt.value}`" class="w-full text-sm cursor-pointer">
            {{ opt.label }}
          </label>
          <input
            type="radio"
            name="prompt_success_metric"
            :id="`prompt_${opt.value}`"
            :checked="selectedPromptSuccessMetric === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="selectedPromptSuccessMetric = opt.value"
          />
        </div>
      </div>

      <div class="grid sticky bottom-0 z-10 grid-cols-1 gap-2 py-3 w-full bg-white">
        <AppButton class="w-full" @click="onApplyPromptSuccessMetric(selectedPromptSuccessMetric)">
          Apply
        </AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Unsaved Changes AYS Modal -->
  <AppActionSheet :show="showUnsavedChangesModal" @close="onStay">
    <div class="py-3 space-y-6">
      <div class="flex flex-col justify-center items-center space-y-2 text-center">
        <div class="text-xl font-bold text-slate-10">Unsaved changes</div>
        <div class="text-base text-slate-8">Are you sure you want to leave this page?</div>
      </div>

      <div class="flex gap-3 items-center">
        <AppButton class="w-full" kind="plain" @click="onDiscard">
          <span class="text-base font-semibold text-light-purple-6">Discard change</span>
        </AppButton>
        <AppButton class="w-full" @click="onStay"> Stay </AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Manual Interval Unit Action Sheet -->
  <AppActionSheet :show="showManualUnitSheet" @close="showManualUnitSheet = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Interval unit</div>
        <div class="cursor-pointer" @click="showManualUnitSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in UNIT_OPTIONS"
          :key="opt.value"
          class="flex justify-between items-center w-full h-14 border-b border-slate-4"
        >
          <label :for="`manual_unit_${opt.value}`" class="w-full text-sm cursor-pointer">
            {{ opt.label }}
          </label>
          <input
            type="radio"
            name="manual_unit"
            :id="`manual_unit_${opt.value}`"
            :checked="manualIntervalUnit === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="manualIntervalUnit = opt.value; showManualUnitSheet = false"
          />
        </div>
      </div>
    </div>
  </AppActionSheet>

  <!-- Schedule Interval Unit Action Sheet -->
  <AppActionSheet :show="showScheduleUnitSheet" @close="showScheduleUnitSheet = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Interval unit</div>
        <div class="cursor-pointer" @click="showScheduleUnitSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in UNIT_OPTIONS_SHORT"
          :key="opt.value"
          class="flex justify-between items-center w-full h-14 border-b border-slate-4"
        >
          <label :for="`sched_unit_${opt.value}`" class="w-full text-sm cursor-pointer">
            {{ opt.label }}
          </label>
          <input
            type="radio"
            name="schedule_unit"
            :id="`sched_unit_${opt.value}`"
            :checked="automationSchedules[editingScheduleIndex]?.interval_unit === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="automationSchedules[editingScheduleIndex].interval_unit = opt.value; showScheduleUnitSheet = false"
          />
        </div>
      </div>
    </div>
  </AppActionSheet>

  <!-- Failure Strategy Action Sheet -->
  <AppActionSheet :show="showFailureSheet" @close="showFailureSheet = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">When a maintenance session fails</div>
        <div class="cursor-pointer" @click="showFailureSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in FAILURE_OPTIONS"
          :key="opt.value"
          class="flex justify-between items-center py-4 w-full border-b border-slate-4"
        >
          <label :for="`failure_${opt.value}`" class="pr-4 w-full text-sm cursor-pointer">
            {{ opt.label }}
          </label>
          <input
            type="radio"
            name="failure_strategy"
            :id="`failure_${opt.value}`"
            :checked="automationOnFailure === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="automationOnFailure = opt.value; showFailureSheet = false"
          />
        </div>
      </div>
    </div>
  </AppActionSheet>

  <!-- Disable Maintenance Confirmation Modal -->
  <AppActionSheet :show="showDisableMaintenanceModal" @close="showDisableMaintenanceModal = false">
    <div class="py-3 space-y-4">
      <div class="flex flex-col items-center space-y-2 text-center">
        <div class="text-xl font-bold text-slate-10">Disable maintenance</div>
        <div class="text-sm text-slate-8">
          This will reset the maintenance schedule and stop ongoing progress.
          Are you sure you want to proceed?
        </div>
      </div>

      <div class="flex gap-3 items-center">
        <AppButton class="w-full" kind="plain" @click="showDisableMaintenanceModal = false">
          <span class="text-base font-semibold text-slate-8">Cancel</span>
        </AppButton>
        <AppButton class="w-full" @click="confirmDisableMaintenance">
          Update
        </AppButton>
      </div>
    </div>
  </AppActionSheet>

</template>
