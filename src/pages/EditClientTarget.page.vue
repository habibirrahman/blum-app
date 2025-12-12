<script lang="ts" setup>
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import AppInputTime from '@/components/AppTimeInput.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppToggle from '@/components/AppToggle.vue'
import { type Curriculum, type TargetStatus } from '@/lib/types'
import CurriculumItemModal from '@/partitions/CurriculumItemModal.vue'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'

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
const successMetric = ref('')
const goal = ref('')
const timeInput = ref(DEFAULT_TIME)
const duration = ref('')
const number_of_trial = ref('')

// Probing
const probingEnabled = ref(false)
const probingTrial = ref('')
const probingGoal = ref('')

// Action recommendations
const totalSuccessChecked = ref(false)
const consecutiveSuccessChecked = ref(false)
const totalSuccessInput = ref(0)
const consecutiveSuccessInput = ref(0)

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

const isPromptingClassic = computed(
  () => isPromptingType.value && clientStore.target?.prompting_format === 'classic'
)

const isPromptingCustom = computed(
  () => isPromptingType.value && clientStore.target?.prompting_format === 'custom'
)

// Feature flags
const useActionRecommendations = computed(() => !isSbtType.value && !isGroup.value)

const useSuccessMetric = computed(() => {
  if (isGroup.value) return false;
  
  return (!isSbtType.value &&
    !isColdProbeType.value &&
    !isPromptingType.value) ||
    isPromptingCustom.value;
})

const useProbing = computed(() => isPercentageType.value || isTrialByTrialType.value)

// Validation
const isDisabledSubmit = computed(() => {
  // Basic validation
  if (!name.value || !selectedCurriculum.value) return true

  // Type-specific validation
  if (isPercentageType.value || isTrialByTrialType.value) {
    if (!successMetric.value || !goal.value || !number_of_trial.value) return true
    if (Number(goal.value) > MAX_PERCENTAGE) return true
    if (probingEnabled.value && (!probingGoal.value || !probingTrial.value)) return true
  }

  if (isDurationType.value || isLatencyType.value) {
    if (
      timeInput.value === DEFAULT_TIME ||
      !timeInput.value ||
      !successMetric.value ||
      !goal.value
    ) {
      return true
    }
  }

  if (isPirType.value) {
    if (
      Number(duration.value) < MIN_DURATION ||
      !duration.value ||
      !goal.value ||
      !successMetric.value
    ) {
      return true
    }
  }

  if (isFrequencyType.value) {
    if (!goal.value || !successMetric.value) return true
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
    const actionRec = target.action_recommendations?.[0]
    if (actionRec) {
      if (actionRec.total_success !== null) {
        totalSuccessChecked.value = true
        totalSuccessInput.value = actionRec.total_success as number
      }
      if (actionRec.consecutive_success !== null) {
        consecutiveSuccessChecked.value = true
        consecutiveSuccessInput.value = actionRec.consecutive_success as number
      }
    }
  }

  // Success metric
  if (useSuccessMetric.value) {
    successMetric.value = target.success_metric || ''
  }

  // Type-specific fields
  duration.value = target.duration?.toString() || ''
  goal.value = target.goal?.toString() || ''
  number_of_trial.value = target.number_of_trial?.toString() || ''
  timeInput.value = target.goal_time || DEFAULT_TIME

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
      number_of_trial: Number(number_of_trial.value)
    })
  }

  if (isDurationType.value || isLatencyType.value) {
    Object.assign(data.target, {
      success_metric: successMetric.value,
      goal_time: timeInput.value
    })
  }

  if (isPirType.value) {
    Object.assign(data.target, {
      duration: Number(duration.value),
      goal: Number(goal.value),
      success_metric: successMetric.value,
      interval: clientStore.target?.interval
    })
  }

  if (isFrequencyType.value) {
    Object.assign(data.target, {
      goal: Number(goal.value),
      success_metric: successMetric.value
    })
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

  const actionRecData = {
    target_id: targetId.value,
    id: clientStore.target?.action_recommendations?.[0]?.id,
    total_success: totalSuccessChecked.value ? totalSuccessInput.value : undefined,
    consecutive_success: consecutiveSuccessChecked.value
      ? consecutiveSuccessInput.value
      : undefined,
    recommended_action: 'mastered' as const
  }

  if (!actionRecData.id) {
    await clientStore.createActionRecommendation({ data: actionRecData })
  } else {
    await clientStore.updateActionRecommendation({
      id: actionRecData.id,
      data: actionRecData
    })
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

  return true
}

async function onSubmit() {
  if (!validateActionRecommendations()) return

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

function onChangeToggle(val: { totalSuccessChecked: boolean; consecutiveSuccessChecked: boolean }) {
  totalSuccessChecked.value = val.totalSuccessChecked
  consecutiveSuccessChecked.value = val.consecutiveSuccessChecked
}

function onApplyPromptSuccessMetric(val: string) {
  selectedPromptSuccessMetric.value = val
  showPromptLevel.value = false
}
</script>

<template>
  <!-- Header -->
  <div class="sticky top-0 z-10 flex items-center gap-3 px-4 pt-3 pb-3 bg-white">
    <RouterLink :to="{ name: 'client', params: { id: clientId, tab: 'targets' } }">
      <div class="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer bg-slate-2">
        <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
      </div>
    </RouterLink>
    <div class="text-[22px] font-bold text-slate-10">Edit details</div>
  </div>

  <!-- Main Content -->
  <div class="w-full h-full p-4 space-y-5 min-h-svh bg-prim-3">
    <!-- Target/Group Details Section -->
    <div class="p-4 space-y-4 bg-white rounded">
      <!-- Section Header -->
      <div
        v-if="!isGroup"
        @click="isCloseTargetDetails = !isCloseTargetDetails"
        class="flex items-center justify-between cursor-pointer"
        :class="{ 'border-b border-slate-3 pb-2': !isCloseTargetDetails }"
      >
        <div class="text-sm font-semibold text-slate-10">Target details</div>
        <Icon
          icon="ph:caret-up-bold"
          class="w-5 h-5 transition-transform text-slate-10"
          :class="{ 'rotate-180': isCloseTargetDetails }"
        />
      </div>

      <div v-if="isGroup" class="flex items-center justify-between pb-2 border-b border-slate-3">
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
            class="flex items-center justify-between px-4 py-2 bg-white border rounded cursor-pointer border-slate-4"
          >
            <div class="flex items-center gap-2 truncate">
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
        <div v-if="isTargetMember" class="flex items-center gap-2 p-2 rounded bg-cornflower-2">
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
            class="flex items-center justify-between px-4 py-2 bg-white border rounded cursor-pointer border-slate-4"
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
          v-model="description"
          :custom-heigth="isGroup ? 'h-[10rem]': 'h-full'"
        />

        <!-- Divider for Prompting Types -->
        <div
          v-if="(isPromptingClassic || isPromptingCustom) && !isGroup"
          class="h-0.5 w-full bg-slate-3"
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
              class="flex items-center justify-between px-4 py-2 bg-white border rounded cursor-pointer border-slate-4"
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
            suffix_text="attempt(s)"
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
            suffix_text="percent (%)"
            v-model="goal"
            type="number"
            inputmode="numeric"
          />
        </div>

        <!-- Duration/Latency Time Input -->
        <AppInputTime
          v-if="isDurationType || isLatencyType"
          v-model="timeInput"
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
          suffix_text="Minutes"
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
          suffix_text="percent (%)"
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
          suffix_text="attempt(s) per session"
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
          suffix_text="Percent (%)"
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
          suffix_text="Percent (%)"
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
        <div v-if="useSuccessMetric">
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Success metric</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>

          <div v-if="!isLatencyType" class="flex items-center gap-2 mb-3">
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

          <div class="flex items-center gap-2">
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
          v-model="number_of_trial"
          type="number"
          inputmode="numeric"
        />

        <!-- Apply to All Member Checkbox -->
        <div v-if="isTargetMember" class="flex items-center gap-3">
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
      <div class="flex items-center justify-between pb-2 border-b border-slate-3">
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
        suffix_text="trials"
        :disabled="!probingEnabled"
      />

      <AppTextInput
        name="probing_goal"
        label="Goal"
        required
        v-model="probingGoal"
        type="number"
        inputmode="numeric"
        suffix_text="percent (%)"
        :disabled="!probingEnabled"
      />
    </div>

    <!-- Action Recommendations Section -->
    <div v-if="useActionRecommendations" class="p-4 space-y-3 bg-white rounded">
      <div
        @click="isCloseActionRecommendation = !isCloseActionRecommendation"
        class="flex items-center justify-between cursor-pointer"
        :class="{ 'border-b border-slate-3 pb-2': !isCloseActionRecommendation }"
      >
        <div class="flex items-center gap-2">
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
        <div class="text-sm font-semibold text-slate-10">Passing success metric</div>
        <div class="text-xs text-slate-8">Updating the current target's status from</div>

        <div class="flex items-center gap-2">
          <AppChip chip="in_progress" />
          <div class="text-sm text-slate-8">to</div>
          <AppChip chip="mastered" />
        </div>

        <!-- Total Success -->
        <div class="flex items-center gap-2 pt-2">
          <AppToggle
            name="total_success"
            :checked="totalSuccessChecked"
            @change="
              onChangeToggle({
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

        <div class="flex items-center gap-2 pt-2">
          <input
            type="number"
            pattern="[0-9]*"
            inputmode="numeric"
            min="1"
            v-model="totalSuccessInput"
            :disabled="!totalSuccessChecked"
            :class="{ 'opacity-50': !totalSuccessChecked }"
            class="h-8 w-10 rounded border border-slate-4 px-2 text-center outline-none [-webkit-appearance:none] appearance-none focus:border-light-purple-5 focus:ring-light-purple-2"
          />
          <div class="text-xs text-slate-8">successful session(s).</div>
        </div>

        <!-- Consecutive Success -->
        <div class="flex items-center gap-2 pt-2">
          <AppToggle
            name="consecutive_success"
            :checked="consecutiveSuccessChecked"
            @change="
              onChangeToggle({
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

        <div class="flex items-center gap-2 pt-2">
          <input
            type="number"
            pattern="[0-9]*"
            inputmode="numeric"
            v-model="consecutiveSuccessInput"
            min="2"
            :disabled="!consecutiveSuccessChecked"
            :class="{ 'opacity-50': !consecutiveSuccessChecked }"
            class="h-8 w-10 rounded border border-slate-4 px-2 text-center outline-none [-webkit-appearance:none] appearance-none focus:border-light-purple-5 focus:ring-light-purple-2"
          />
          <div class="text-xs text-slate-8">consecutive session(s).</div>
        </div>
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
    :curriculum-options="curriculumOptions"
    :selected-curriculum="[selectedCurriculum?.value as number]"
    :use-multiple-select="false"
    @close="showCurriculum = false"
    @apply="onApplyCurriculum($event[0])"
  />

  <!-- Status Action Sheet -->
  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div class="space-y-4">
      <div class="flex items-center justify-between w-full">
        <div class="text-xl font-semibold">Status</div>
        <div class="cursor-pointer" @click="showStatus = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in STATUS_OPTIONS"
          :key="opt.value"
          class="flex items-center justify-between w-full border-b h-14 border-slate-3"
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

      <AppButton class="w-full" @click="onApplyStatus(selectStatus as TargetStatus)">
        Apply
      </AppButton>
    </div>
  </AppActionSheet>

  <!-- Prompt Level Action Sheet -->
  <AppActionSheet :show="showPromptLevel" @close="showPromptLevel = false">
    <div class="space-y-4">
      <div class="flex items-center justify-between w-full">
        <div class="text-xl font-semibold">Prompt</div>
        <div class="cursor-pointer" @click="showPromptLevel = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in promptSuccessMetricOptions"
          :key="opt.value"
          class="flex items-center justify-between w-full border-b h-14 border-slate-3"
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

      <AppButton class="w-full" @click="onApplyPromptSuccessMetric(selectedPromptSuccessMetric)">
        Apply
      </AppButton>
    </div>
  </AppActionSheet>

  <!-- Unsaved Changes AYS Modal -->
  <AppActionSheet :show="showUnsavedChangesModal" @close="onStay">
    <div class="space-y-6 pb-4 pt-2">
      <div class="flex flex-col items-center justify-center space-y-2 text-center">
        <div class="text-xl font-bold text-slate-10">Unsaved changes</div>
        <div class="text-base text-slate-8">Are you sure you want to leave this page?</div>
      </div>

      <div class="flex items-center gap-3">
        <AppButton class="w-full" kind="plain" @click="onDiscard">
          <span class="text-base font-semibold text-light-purple-6">Discard change</span>
        </AppButton>
        <AppButton class="w-full" @click="onStay">
          Stay
        </AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
