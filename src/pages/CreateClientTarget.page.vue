<script lang="ts" setup>
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppToggle from '@/components/AppToggle.vue'
import AppInputTime from '@/components/AppTimeInput.vue'
import type { Curriculum, TargetStatus, TargetType } from '@/lib/types'
import CurriculumItemModal from '@/partitions/CurriculumItemModal.vue'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { promptColors } from '@/lib/data'
import { VueDraggable } from 'vue-draggable-plus'

// ========== CONSTANTS ==========
const STATUS_OPTIONS: { value: TargetStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In acquisition' }
]

const METHOD_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'Target::ColdProbe', label: 'Cold probe' },
  { value: 'Target::Duration', label: 'Duration' },
  { value: 'Target::Frequency', label: 'Frequency' },
  { value: 'Target::Latency', label: 'Latency' },
  { value: 'Target::Pir', label: 'Partial Interval Recording' },
  { value: 'Target::Percentage', label: 'Percentage' },
  { value: 'Target::TrialByTrial', label: 'Trial-by-Trial' },
  { value: 'Target::Prompting', label: 'Prompting' }
]

const DEFAULT_TIME = '00:00:00'

// ========== COMPOSABLES ==========
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const clientStore = useClientStore()
const toast = useToast()

// ========== UI STATE ==========
const loading = ref(false)
const submitLoading = ref(false)
const isCloseTargetDetails = ref(false)
const isCloseColdProbeFormat = ref(false)
const isCloseFrequencyFormat = ref(false)
const isClosePirSettings = ref(false)
const isCloseActionRecommendation = ref(false)

// Sheets
const showMethod = ref(false)
const showCurriculum = ref(false)
const showStatus = ref(false)
const showManualUnitSheet = ref(false)
const showScheduleUnitSheet = ref(false)
const showFailureSheet = ref(false)
const editingScheduleIndex = ref(0)

// ========== FORM STATE ==========
const name = ref('')
const description = ref('')
const simplifiedDescription = ref('')
const status = ref<TargetStatus>('pending')
const selectStatus = ref<TargetStatus>('pending')
const selectedMethod = ref<TargetType | ''>('')
const selectMethodTemp = ref<TargetType | ''>('')

// Cold Probe format
const coldProbeFormat = ref<'classic' | 'custom'>('classic')
const targetVariableInputs = ref<{ code: string; title: string }[]>([])

// Frequency format
const frequencyFormat = ref<'classic' | 'custom'>('classic')

// Common Target parameters
const goal = ref('')
const goalTime = ref(DEFAULT_TIME)
const successMetric = ref('')
const duration = ref('')

// PIR parameters
const interval = ref(5)
const intervalStartTiming = ref<'start_with_session' | 'custom_start'>('start_with_session')
const allowOvertimeRecording = ref(true)

// Percentage / Trial-by-Trial parameters
const numberOfTrial = ref('')

// Probing parameters
const probingEnable = ref(false)
const probingNumberOfTrial = ref('')
const probingGoal = ref('')

// Prompting parameters
const promptingFormat = ref<'classic' | 'custom'>('classic')
const promptsAttributes = ref<any[]>([])
const selectedPromptSuccessMetric = ref<string>('')
const showPromptLevel = ref(false)
const isClosePromptingFormat = ref(false)
const showCustomPromptRepoSheet = ref(false)
const selectedRepoPrompts = ref<any[]>([])
const centerPrompts = ref<any[]>([])
const promptOptions = computed(() => {
  return centerPrompts.value.filter((prompt) => {
    return !promptsAttributes.value.some((p) => p.prompt_parent_id === prompt.id)
  })
})

// Prompt form modal states
const showPromptFormSheet = ref(false)
const showSymbolSelectSheet = ref(false)
const showPromptActionSheet = ref(false)

const isEditingPrompt = ref(false)
const activePromptKey = ref<string | null>(null)
const promptFormCode = ref('')
const promptFormName = ref('')
const promptFormColor = ref('cherry')
const promptFormShape = ref('square')

// Action Recommendations
const totalSuccessChecked = ref(false)
const consecutiveSuccessChecked = ref(false)
const totalSuccessInput = ref(2)
const consecutiveSuccessInput = ref(2)

// Maintenance
const maintenanceChecked = ref(false)
const maintenanceApproach = ref<'manual' | 'automation'>('manual')
const manualIntervalAmount = ref<string | number>(1)
const manualIntervalUnit = ref('days')
const automationTotalSessions = ref('1')
const automationOnFailure = ref('restart_from_first')
const automationSchedules = ref<
  { session_order: number; interval_amount: string | number; interval_unit: string }[]
>([{ session_order: 1, interval_amount: 1, interval_unit: 'days' }])

const UNIT_OPTIONS = [
  { value: 'days', label: 'day' },
  { value: 'weeks', label: 'week' },
  { value: 'months', label: 'month' }
]
const FAILURE_OPTIONS = [
  { value: 'restart_from_first', label: 'Restart from 1st maintenance session' },
  {
    value: 'repeat_current',
    label: 'Retry the failed session until the success metric is successfully passed'
  }
]

// Curriculum
const curriculumQuery = ref('')
const curriculumOptions = ref<{ value: number; label: string; color: string }[]>([])
const selectedCurriculum = ref<{ value: number; label: string; color: string } | null>(null)

// ========== COMPUTED ==========
const clientId = computed(() => Number(route.params.id))

const curriculumParams = computed(() => {
  const params = new URLSearchParams({ sort: 'name_asc' })
  if (curriculumQuery.value) {
    params.append('query', curriculumQuery.value)
  }
  return `?${params.toString()}`
})

const selectedMethodLabel = computed(() => {
  return METHOD_OPTIONS.find((m) => m.value === selectedMethod.value)?.label || ''
})

const isColdProbeType = computed(() => selectedMethod.value === 'Target::ColdProbe')
const isDurationType = computed(() => selectedMethod.value === 'Target::Duration')
const isLatencyType = computed(() => selectedMethod.value === 'Target::Latency')
const isFrequencyType = computed(() => selectedMethod.value === 'Target::Frequency')
const isFrequencyCustom = computed(() => isFrequencyType.value && frequencyFormat.value === 'custom')
const isPirType = computed(() => selectedMethod.value === 'Target::Pir')
const isPercentageType = computed(() => selectedMethod.value === 'Target::Percentage')
const isTrialByTrialType = computed(() => selectedMethod.value === 'Target::TrialByTrial')
const useProbing = computed(() => isPercentageType.value || isTrialByTrialType.value)
const isPromptingType = computed(() => selectedMethod.value === 'Target::Prompting')
const isPromptingClassic = computed(() => isPromptingType.value && promptingFormat.value === 'classic')
const isPromptingCustom = computed(() => isPromptingType.value && promptingFormat.value === 'custom')

const useSuccessMetric = computed(() => {
  return (
    isDurationType.value ||
    isLatencyType.value ||
    isFrequencyType.value ||
    isPirType.value ||
    isPercentageType.value ||
    isTrialByTrialType.value
  )
})

const isUseActionRecommendation = computed(() => {
  if (!selectedMethod.value) return false
  // SBT excluded from mobile entirely, but guard anyway
  if ((selectedMethod.value as string).includes('Sbt')) return false
  return true
})

const isDisabledSubmit = computed(() => {
  if (!name.value || !selectedMethod.value || !selectedCurriculum.value) return true

  if (isDurationType.value || isLatencyType.value) {
    if (goalTime.value === DEFAULT_TIME || !goalTime.value || !successMetric.value) return true
  }

  if (isFrequencyType.value) {
    if (!goal.value || !successMetric.value) return true
    if (isFrequencyCustom.value && (!duration.value || Number(duration.value) < 1)) return true
  }

  if (isPirType.value) {
    if (!goal.value || !successMetric.value || !duration.value) return true
    const dur = Number(duration.value)
    if (dur < 5 || dur % 5 !== 0) return true
  }

  if (isPercentageType.value || isTrialByTrialType.value) {
    if (!goal.value || !successMetric.value || !numberOfTrial.value) return true
    if (probingEnable.value) {
      if (!probingNumberOfTrial.value || !probingGoal.value) return true
    }
  }

  if (isPromptingType.value) {
    if (isPromptingClassic.value) {
      if (!goal.value || !selectedPromptSuccessMetric.value || !promptsAttributes.value.length) return true
    } else if (isPromptingCustom.value) {
      if (!goal.value || Number(goal.value) < 1 || Number(goal.value) > 100 || !successMetric.value || !promptsAttributes.value.length) return true
    }
  }

  return false
})

// ========== METHODS ==========
async function fetchCurriculums() {
  loading.value = true
  const { success, data } = await appStore.getCurriculums({ params: curriculumParams.value })
  loading.value = false
  if (!success) return
  curriculumOptions.value = data.map((c: Curriculum) => ({
    value: c.id as number,
    label: c.name as string,
    color: c.color as string
  }))
}

function onApplyMethod() {
  selectedMethod.value = selectMethodTemp.value
  showMethod.value = false
}

function onApplyCurriculum(values: number[]) {
  if (values.length > 0) {
    selectedCurriculum.value =
      curriculumOptions.value.find((c) => c.value === values[0]) || null
  }
  showCurriculum.value = false
}

function onApplyStatus(val: TargetStatus) {
  status.value = val
  showStatus.value = false
}

watch(showStatus, () => {
  selectStatus.value = status.value
})

watch(showMethod, () => {
  selectMethodTemp.value = selectedMethod.value
})

// Watch method selection to set defaults
watch(selectedMethod, (val) => {
  // Reset cold probe state
  coldProbeFormat.value = 'classic'
  targetVariableInputs.value = []

  // Reset frequency format and custom duration
  frequencyFormat.value = 'classic'
  duration.value = ''

  // Reset PIR parameters
  interval.value = 5
  intervalStartTiming.value = 'start_with_session'
  allowOvertimeRecording.value = true

  // Reset Percentage/TBT parameters
  numberOfTrial.value = ''

  // Reset Probing parameters
  probingEnable.value = false
  probingNumberOfTrial.value = ''
  probingGoal.value = ''

  // Reset target parameters
  goal.value = ''
  goalTime.value = DEFAULT_TIME
  successMetric.value = ''

  // Reset action recommendation defaults
  totalSuccessChecked.value = true
  consecutiveSuccessChecked.value = true
  totalSuccessInput.value = 2
  consecutiveSuccessInput.value = 2

  if (val === 'Target::ColdProbe') {
    totalSuccessInput.value = 3
    consecutiveSuccessInput.value = 3
    targetVariableInputs.value = [
      { code: 'PR', title: 'Probe' },
      { code: 'MO', title: 'Motivation' }
    ]
  } else if (val === 'Target::Duration') {
    successMetric.value = 'equal to or greater than goal'
  } else if (val === 'Target::Latency') {
    successMetric.value = 'less than goal'
  } else if (val === 'Target::Frequency') {
    successMetric.value = 'equal to or greater than goal'
    goal.value = '5'
  } else if (val === 'Target::Pir') {
    successMetric.value = 'equal to or greater than goal'
    goal.value = '80'
    duration.value = '60'
  } else if (val === 'Target::Percentage' || val === 'Target::TrialByTrial') {
    successMetric.value = 'equal to or greater than goal'
    goal.value = '80'
    numberOfTrial.value = '10'
    probingNumberOfTrial.value = '5'
    probingGoal.value = '80'
  } else if (val === 'Target::Prompting') {
    promptingFormat.value = 'classic'
    goal.value = '5'
    selectedPromptSuccessMetric.value = ''
    fetchCenterPrompts()
  }
})

watch(promptingFormat, () => {
  promptsAttributes.value = []
  selectedPromptSuccessMetric.value = ''
  successMetric.value = ''
  fetchCenterPrompts()
})

watch(automationTotalSessions, () => {
  onAutomationSessionsChange()
})

// ========== HELPERS ==========
function ordinalSuffix(i: number) {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) return i + 'st'
  if (j === 2 && k !== 12) return i + 'nd'
  if (j === 3 && k !== 13) return i + 'rd'
  return i + 'th'
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

function validateActionRecommendations(): boolean {
  if (totalSuccessChecked.value && totalSuccessInput.value < 1) {
    toast.error('Please enter a value greater than or equal to 1 for total success.')
    return false
  }
  if (consecutiveSuccessChecked.value && consecutiveSuccessInput.value < 2) {
    toast.error('Please enter a value greater than or equal to 2 for consecutive.')
    return false
  }
  if (
    totalSuccessChecked.value &&
    consecutiveSuccessChecked.value &&
    Number(totalSuccessInput.value) > Number(consecutiveSuccessInput.value)
  ) {
    toast.error(
      `Please enter a value greater than or equal to ${totalSuccessInput.value} for consecutive.`
    )
    return false
  }
  if (maintenanceChecked.value && maintenanceApproach.value === 'manual') {
    if (!manualIntervalAmount.value || Number(manualIntervalAmount.value) < 1) {
      toast.error('Please enter a valid interval amount for manual maintenance approach.')
      return false
    }
  }
  if (maintenanceChecked.value && maintenanceApproach.value === 'automation') {
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
  return true
}

const submitTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
async function onSubmit() {
  // Validate action recommendations
  if (isUseActionRecommendation.value && !validateActionRecommendations()) return

  submitLoading.value = true

  const data: any = {
    client_id: clientId.value,
    kind: 'client',
    target: {
      name: name.value,
      type: selectedMethod.value,
      curriculum_id: selectedCurriculum.value?.value,
      description: description.value,
      simplified_description: simplifiedDescription.value,
      status: status.value,
      client_id: clientId.value
    }
  }

  // Cold Probe specific payload
  if (selectedMethod.value === 'Target::ColdProbe') {
    data.target.goal = 100
    data.target.success_metric = 'equal to or greater than goal'
    data.target.cold_probe_format = coldProbeFormat.value
    if (coldProbeFormat.value === 'custom') {
      data.target.target_variables_attributes = targetVariableInputs.value.map((v) => ({
        code: v.code,
        title: v.title,
        cold_probe_format: coldProbeFormat.value
      }))
    } else {
      data.target.target_variables_attributes = [
        { code: 'PR', title: 'Probe', cold_probe_format: coldProbeFormat.value }
      ]
    }
  }

  // Duration/Latency specific payload
  if (selectedMethod.value === 'Target::Duration' || selectedMethod.value === 'Target::Latency') {
    data.target.success_metric = successMetric.value
    data.target.goal_time = goalTime.value
  }

  // Frequency specific payload
  if (selectedMethod.value === 'Target::Frequency') {
    data.target.goal = Number(goal.value)
    data.target.success_metric = successMetric.value
    data.target.frequency_format = frequencyFormat.value
    if (frequencyFormat.value === 'custom') {
      data.target.duration = Number(duration.value)
    }
  }

  // PIR specific payload & validation
  if (selectedMethod.value === 'Target::Pir') {
    const dur = Number(duration.value)
    if (dur < 5) {
      toast.error('Duration must be more than or equal to 5 minutes.')
      submitLoading.value = false
      return
    }
    if (dur % 5 !== 0) {
      toast.error('Duration must be a multiple of 5 minutes.')
      submitLoading.value = false
      return
    }
    if (Number(goal.value) > 100) {
      toast.error('Goal must be less than or equal to 100 percent(%).')
      submitLoading.value = false
      return
    }
    data.target.success_metric = successMetric.value
    data.target.goal = Number(goal.value)
    data.target.interval = interval.value
    data.target.duration = dur
    data.target.interval_start_timing = intervalStartTiming.value
    data.target.allow_overtime_recording = allowOvertimeRecording.value
  }

  // Percentage/Trial-by-Trial specific payload & validation
  if (selectedMethod.value === 'Target::Percentage' || selectedMethod.value === 'Target::TrialByTrial') {
    if (Number(goal.value) > 100) {
      toast.error('Goal must be less than or equal to 100 percent(%).')
      submitLoading.value = false
      return
    }
    data.target.success_metric = successMetric.value
    data.target.goal = Number(goal.value)
    data.target.number_of_trial = Number(numberOfTrial.value)
    data.target.probing_enable = probingEnable.value
    if (probingEnable.value) {
      if (Number(probingGoal.value) > 100) {
        toast.error('Probing goal must be less than or equal to 100 percent(%).')
        submitLoading.value = false
        return
      }
      data.target.probing_number_of_trial = Number(probingNumberOfTrial.value)
      data.target.probing_goal = Number(probingGoal.value)
    }
  }

  // Prompting specific payload
  if (selectedMethod.value === 'Target::Prompting') {
    if (promptingFormat.value === 'custom') {
      if (Number(goal.value) > 100 || Number(goal.value) < 1) {
        toast.error('Goal must be between 1 and 100 percent(%).')
        submitLoading.value = false
        return
      }
    }
    data.target.prompting_format = promptingFormat.value
    data.target.goal = Number(goal.value)
    data.target.success_metric = promptingFormat.value === 'custom' ? successMetric.value : selectedPromptSuccessMetric.value
    data.target.prompts_attributes = promptsAttributes.value.map((i, n) => {
      const p: any = {
        name: i.name,
        abbreviation: i.abbreviation,
        color: i.color,
        shape: i.shape,
        position: n + 1,
        is_default: i.is_default,
        prompting_format: promptingFormat.value
      }
      if (promptingFormat.value === 'custom') {
        p.prompt_parent_id = i.prompt_parent_id
        p.score = i.score
      }
      return p
    })
  }

  // Action recommendations payload (all types)
  if (isUseActionRecommendation.value) {
    const recommendations: any[] = [
      {
        total_success: totalSuccessChecked.value ? totalSuccessInput.value || null : null,
        consecutive_success: consecutiveSuccessChecked.value
          ? consecutiveSuccessInput.value || null
          : null,
        recommended_action: 'mastered'
      }
    ]

    if (maintenanceChecked.value) {
      const maintenanceConfig: any = {
        approach: maintenanceApproach.value
      }

      if (maintenanceApproach.value === 'manual') {
        maintenanceConfig.frequency = {
          interval_amount: Number(manualIntervalAmount.value) || 1,
          interval_unit: manualIntervalUnit.value || 'days'
        }
        maintenanceConfig.frequency_string = `every ${manualIntervalAmount.value || 1} ${manualIntervalUnit.value}`
      } else if (maintenanceApproach.value === 'automation') {
        maintenanceConfig.total_sessions = Number(automationTotalSessions.value) || 1
        maintenanceConfig.on_failure = automationOnFailure.value
        maintenanceConfig.failure_strategy = automationOnFailure.value
        maintenanceConfig.schedules = automationSchedules.value.map((s) => ({
          session_order: s.session_order,
          interval_amount: Number(s.interval_amount) || 1,
          interval_unit: s.interval_unit || 'days'
        }))
      }

      recommendations.push({
        recommended_action: 'maintenance',
        is_enabled: maintenanceChecked.value,
        maintenance_config: maintenanceConfig
      })
    }

    data.target.action_recommendations_attributes = recommendations
  }

  const { success, message } = await clientStore.createTarget({ data })
  submitLoading.value = false

  if (!success) {
    toast.error(message || 'Failed to create the target. Please try again.')
    return
  }

  toast.success('Success! New target has been created successfully.')

  submitTimeout.value = setTimeout(() => {
    router.push({ name: 'client', params: { id: clientId.value, tab: 'targets' } })
  }, 1000)
}

// ========== PROMPTING METHODS ==========
const promptPageIndex = ref(0)
const promptPageLimit = 9
const promptPageCount = computed(() => {
  return Math.ceil(promptsAttributes.value.length / promptPageLimit)
})
const visiblePrompts = computed(() => {
  const start = promptPageIndex.value * promptPageLimit
  const end = start + promptPageLimit
  return promptsAttributes.value.slice(start, end)
})

watch(promptsAttributes, () => {
  if (promptPageIndex.value >= promptPageCount.value) {
    promptPageIndex.value = Math.max(0, promptPageCount.value - 1)
  }
}, { deep: true })

const groupedPromptInputs = computed(() => {
  const grouped: Record<number, any[]> = {}
  promptsAttributes.value.forEach((p) => {
    const score = p.score ?? 0
    if (!grouped[score]) {
      grouped[score] = []
    }
    grouped[score].push(p)
  })
  
  return Object.keys(grouped).map((scoreStr) => {
    const score = Number(scoreStr)
    return {
      score,
      prompts: grouped[score]
    }
  }).sort((a, b) => b.score - a.score)
})

async function fetchCenterPrompts() {
  const { success, data } = await appStore.actionGet({
    url: `/api/v1/center_prompts?type=Prompt::Prompting&prompting_format=${promptingFormat.value}`
  })
  if (success && data) {
    centerPrompts.value = data
    promptsAttributes.value = data.map((i: any, n: number) => ({
      ...i,
      key: `prompt-${Date.now()}-${n}-${Math.floor(Math.random() * 1000)}`,
      position: n + 1,
      is_default: i.is_default ?? true,
      prompting_format: promptingFormat.value,
      prompt_parent_id: i.id || 0,
      score: i.score || 0
    })).sort((a: any, b: any) => {
      if (promptingFormat.value === 'custom') {
        if (a.is_default && a.abbreviation === 'Id') return -1
        if (b.is_default && b.abbreviation === 'Id') return 1
        if (a.is_default && a.abbreviation === 'Ic') return 1
        if (b.is_default && b.abbreviation === 'Ic') return -1
        return (b.score ?? 0) - (a.score ?? 0)
      }
      return 0
    })
    
    if (promptingFormat.value === 'classic') {
      if (promptsAttributes.value.length && !selectedPromptSuccessMetric.value) {
        selectedPromptSuccessMetric.value = promptsAttributes.value[0].name
      }
    } else if (promptingFormat.value === 'custom') {
      successMetric.value = 'equal to or greater than goal'
    }
  }
}


function onAddPrompt() {
  isEditingPrompt.value = false
  activePromptKey.value = null
  promptFormCode.value = ''
  promptFormName.value = ''
  promptFormColor.value = 'cherry'
  promptFormShape.value = 'square'
  showPromptFormSheet.value = true
}

function onEditPrompt() {
  const prompt = promptsAttributes.value.find((p) => p.key === activePromptKey.value)
  if (!prompt) return
  isEditingPrompt.value = true
  promptFormCode.value = prompt.abbreviation || ''
  promptFormName.value = prompt.name || ''
  promptFormColor.value = prompt.color || 'cherry'
  promptFormShape.value = prompt.shape || 'square'
  showPromptActionSheet.value = false
  showPromptFormSheet.value = true
}

function onDeletePrompt() {
  if (!activePromptKey.value) return
  const index = promptsAttributes.value.findIndex((p) => p.key === activePromptKey.value)
  if (index > -1) {
    const prompt = promptsAttributes.value[index]
    if (promptingFormat.value === 'classic' && promptsAttributes.value.length <= 1) {
      toast.error('At least 1 prompt is required.')
      showPromptActionSheet.value = false
      activePromptKey.value = null
      return
    }
    if (promptingFormat.value === 'custom' && prompt.is_default) {
      toast.error('Default prompts cannot be deleted.')
      showPromptActionSheet.value = false
      activePromptKey.value = null
      return
    }

    const deletedPromptName = prompt.name
    promptsAttributes.value.splice(index, 1)
    promptsAttributes.value.forEach((p, idx) => {
      p.position = idx + 1
    })
    if (selectedPromptSuccessMetric.value === deletedPromptName) {
      selectedPromptSuccessMetric.value = promptsAttributes.value.length ? promptsAttributes.value[0].name : ''
    }
  }
  showPromptActionSheet.value = false
  activePromptKey.value = null
}

function onSavePromptForm() {
  if (!promptFormCode.value.trim()) {
    toast.error('Code is required.')
    return
  }
  if (promptFormCode.value.trim().length > 3) {
    toast.error('Code cannot exceed 3 characters.')
    return
  }
  if (!promptFormName.value.trim()) {
    toast.error('Prompt name is required.')
    return
  }

  if (isEditingPrompt.value) {
    const prompt = promptsAttributes.value.find((p) => p.key === activePromptKey.value)
    if (prompt) {
      const oldName = prompt.name
      prompt.abbreviation = promptFormCode.value.trim()
      prompt.name = promptFormName.value.trim()
      prompt.color = promptFormColor.value
      prompt.shape = promptFormShape.value
      
      if (selectedPromptSuccessMetric.value === oldName) {
        selectedPromptSuccessMetric.value = prompt.name
      }
    }
  } else {
    const newPrompt = {
      key: `prompt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: promptFormName.value.trim(),
      abbreviation: promptFormCode.value.trim(),
      color: promptFormColor.value,
      shape: promptFormShape.value,
      position: promptsAttributes.value.length + 1,
      is_default: false,
      prompt_parent_id: 0
    }
    promptsAttributes.value.push(newPrompt)
    if (promptsAttributes.value.length === 1) {
      selectedPromptSuccessMetric.value = newPrompt.name
    }
  }

  showPromptFormSheet.value = false
  activePromptKey.value = null
}

function onOpenCustomPromptRepo() {
  selectedRepoPrompts.value = []
  showCustomPromptRepoSheet.value = true
}

function onChangeNewCustomPrompt(opt: any) {
  const isSelected = selectedRepoPrompts.value.some((i) => i.id === opt.id)
  if (isSelected) {
    selectedRepoPrompts.value = selectedRepoPrompts.value.filter((i) => i.id !== opt.id)
  } else {
    selectedRepoPrompts.value.push(opt)
  }
}

function onAddCustomPrompts() {
  selectedRepoPrompts.value.forEach((i) => {
    const newPrompt = {
      key: `prompt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: i.name,
      abbreviation: i.abbreviation,
      color: i.color,
      shape: i.shape,
      position: promptsAttributes.value.length + 1,
      score: i.score ?? 0,
      is_default: i.is_default,
      prompting_format: 'custom',
      prompt_parent_id: i.id
    }
    promptsAttributes.value.push(newPrompt)
  })
  
  promptsAttributes.value.sort((a: any, b: any) => {
    if (a.is_default && a.abbreviation === 'Id') return -1
    if (b.is_default && b.abbreviation === 'Id') return 1
    if (a.is_default && a.abbreviation === 'Ic') return 1
    if (b.is_default && b.abbreviation === 'Ic') return -1
    return (b.score ?? 0) - (a.score ?? 0)
  })
  
  showCustomPromptRepoSheet.value = false
  selectedRepoPrompts.value = []
}


function openSymbolSelect() {
  showSymbolSelectSheet.value = true
}

function applySymbolSelect(color: string, shape: string) {
  promptFormColor.value = color
  promptFormShape.value = shape
  showSymbolSelectSheet.value = false
}

function onDragEnd() {
  promptsAttributes.value.forEach((p, index) => {
    p.position = index + 1
  })
}

const promptSuccessMetricOptions = computed(() => {
  return promptsAttributes.value.map((p) => ({
    value: p.name,
    label: p.name
  }))
})

const activePromptName = computed(() => {
  if (!activePromptKey.value) return ''
  const prompt = promptsAttributes.value.find((p) => p.key === activePromptKey.value)
  return prompt ? prompt.name : ''
})

function openPromptAction(prompt: any) {
  activePromptKey.value = prompt.key
  showPromptActionSheet.value = true
}

// ========== LIFECYCLE ==========
onMounted(() => {
  fetchCurriculums()
})
</script>

<template>
  <!-- Header -->
  <div class="flex sticky top-0 z-10 gap-3 items-center px-4 pt-3 pb-3 bg-white">
    <RouterLink :to="{ name: 'client', params: { id: clientId, tab: 'targets' } }">
      <div class="flex justify-center items-center w-8 h-8 rounded-full cursor-pointer bg-slate-2">
        <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
      </div>
    </RouterLink>
    <div class="text-[22px] font-bold text-slate-10">New target</div>
  </div>

  <!-- Main Content -->
  <div class="p-4 pb-20 space-y-5 w-full h-full min-h-svh bg-prim-3">
    <!-- Target Details Section -->
    <div class="p-4 space-y-4 bg-white rounded">
      <!-- Section Header -->
      <div
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

      <!-- Form Fields -->
      <div v-if="!isCloseTargetDetails" class="space-y-4">
        <!-- Title -->
        <AppTextInput name="title" label="Title" required placeholder="Type title" v-model="name" />

        <!-- Data collection method -->
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Data collection method</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showMethod = true"
            class="flex justify-between items-center px-4 py-2 bg-white rounded border cursor-pointer border-slate-4"
          >
            <div class="truncate text-[16px]" :class="selectedMethodLabel ? 'text-slate-10' : 'text-slate-6'">
              {{ selectedMethodLabel || 'Select type' }}
            </div>
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Curriculum -->
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Curriculum</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showCurriculum = true"
            class="flex justify-between items-center px-4 py-2 bg-white rounded border cursor-pointer border-slate-4"
          >
            <div v-if="selectedCurriculum" class="flex gap-2 items-center truncate">
              <div
                class="flex-shrink-0 w-6 h-6 rounded-full"
                :style="{ backgroundColor: selectedCurriculum.color }"
              />
              <div class="truncate text-[16px] text-slate-10">
                {{ selectedCurriculum.label }}
              </div>
            </div>
            <div v-else class="text-[16px] text-slate-6">Select curriculum</div>
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Status -->
        <div>
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

        <!-- Clinical description -->
        <AppTextInput
          name="clinical_description"
          label="Clinical description"
          type="textarea"
          :rows="4"
          placeholder="Provide a detailed explanation of the target for therapists and supervisors, such as its procedures and modifications."
          v-model="description"
        />

        <!-- Simplified description -->
        <AppTextInput
          name="simplified_description"
          label="Simplified description"
          type="textarea"
          :rows="4"
          placeholder="Describe the target in simplified language that's easy for non-clinical readers to understand (e.g., parents). This description can also be included in reports."
          v-model="simplifiedDescription"
        />

        <!-- Duration/Latency Time Input -->
        <AppInputTime
          v-if="isDurationType || isLatencyType"
          v-model="goalTime"
          name="duration"
          label="Goal time (hours/minutes/seconds)"
          format="hms"
          :required="true"
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

        <!-- Goal for PIR, Percentage, TBT -->
        <AppTextInput
          v-if="isPirType || isPercentageType || isTrialByTrialType"
          name="goal"
          label="Goal"
          required
          placeholder="1-100"
          suffix-text="percent (%)"
          v-model="goal"
          type="number"
          inputmode="numeric"
          :error="
            goal && (Number(goal) < 1 || Number(goal) > 100)
              ? 'Goal must be between 1 and 100 percent.'
              : ''
          "
        />

        <!-- Number of trials (Percentage) -->
        <AppTextInput
          v-if="isPercentageType"
          name="number_of_trials"
          label="Number of trials"
          required
          placeholder="Type number"
          v-model="numberOfTrial"
          type="number"
          inputmode="numeric"
        />

        <!-- Minimum number of trials (TBT) -->
        <AppTextInput
          v-if="isTrialByTrialType"
          name="number_of_trials"
          label="Minimum number of trials"
          required
          placeholder="Type number"
          v-model="numberOfTrial"
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
      </div>
    </div>

    <!-- Cold Probe Format Section -->
    <div v-if="isColdProbeType" class="p-4 space-y-4 bg-white rounded">
      <!-- Section Header -->
      <div
        @click="isCloseColdProbeFormat = !isCloseColdProbeFormat"
        class="flex justify-between items-center cursor-pointer"
      >
        <div class="flex gap-2 items-center">
          <div class="text-sm font-semibold text-slate-10">Cold probe format</div>
          <div
            v-if="isCloseColdProbeFormat"
            class="px-2 py-0.5 text-xs font-medium rounded bg-slate-2 text-slate-7"
          >
            {{ coldProbeFormat === 'classic' ? 'Classic' : 'Custom' }}
          </div>
        </div>
        <Icon
          icon="ph:caret-up-bold"
          class="w-5 h-5 transition-transform text-slate-10"
          :class="{ 'rotate-180': isCloseColdProbeFormat }"
        />
      </div>

      <div v-if="!isCloseColdProbeFormat" class="space-y-4">
        <!-- Classic / Custom Toggle -->
        <div class="flex p-1 rounded-lg border border-slate-4 bg-slate-2">
          <div
            class="flex justify-center items-center py-1.5 w-full text-xs font-semibold rounded transition-colors duration-300 cursor-pointer"
            :class="coldProbeFormat === 'classic' ? 'bg-white text-slate-10' : 'text-slate-7'"
            @click="coldProbeFormat = 'classic'"
          >
            Classic
          </div>
          <div
            class="flex justify-center items-center py-1.5 w-full text-xs font-semibold rounded transition-colors duration-300 cursor-pointer"
            :class="coldProbeFormat === 'custom' ? 'bg-white text-slate-10' : 'text-slate-7'"
            @click="coldProbeFormat = 'custom'"
          >
            Custom
          </div>
        </div>

        <!-- Description -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-9">
            {{ coldProbeFormat === 'classic' ? 'Single-variable' : 'Multi-variable' }}
          </div>
          <div v-if="coldProbeFormat === 'classic'" class="text-xs text-slate-8">
            Record only whether the cold probe result was "Yes" or "No" during the session,
            without capturing any additional details.
          </div>
          <div v-if="coldProbeFormat === 'custom'" class="text-xs text-slate-8">
            Record both the cold probe result and the client's motivation. A session will be
            considered successful if the client provides a correct probe response and demonstrates
            motivation.
          </div>
        </div>

        <!-- Preview -->
        <div class="flex justify-center items-center py-6 rounded border border-slate-4 bg-slate-1">
          <div class="flex gap-4">
            <template v-if="coldProbeFormat === 'classic'">
              <div class="flex flex-col gap-2 items-center">
                <div class="text-xs text-slate-7">Probe</div>
                <div
                  class="flex justify-center items-center w-12 h-12 rounded-full border border-dotted border-slate-4"
                >
                  <Icon icon="ph:check-bold" class="text-xl text-slate-6" />
                </div>
                <div
                  class="flex justify-center items-center w-12 h-12 rounded-full border border-dotted border-slate-4"
                >
                  <Icon icon="ph:x-bold" class="text-xl text-slate-6" />
                </div>
              </div>
            </template>
            <template v-if="coldProbeFormat === 'custom'">
              <div
                v-for="(variable, index) in targetVariableInputs"
                :key="index"
                class="flex flex-col gap-2 items-center"
                :class="{
                  'border-r-2 border-slate-3 pr-4': index !== targetVariableInputs.length - 1
                }"
              >
                <div class="text-xs text-slate-7">
                  {{ variable.code?.slice(0, 5) }}{{ (variable.code?.length || 0) > 5 ? '...' : '' }}
                </div>
                <div
                  class="flex justify-center items-center w-12 h-12 rounded-full border-2 border-dotted border-slate-4"
                >
                  <Icon icon="ph:check-bold" class="text-xl text-slate-6" />
                </div>
                <div
                  class="flex justify-center items-center w-12 h-12 rounded-full border-2 border-dotted border-slate-4"
                >
                  <Icon icon="ph:x-bold" class="text-xl text-slate-6" />
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Custom Variable Inputs -->
        <div v-if="coldProbeFormat === 'custom'" class="space-y-4">
          <div
            v-for="(variable, index) in targetVariableInputs"
            :key="index"
            class="grid grid-cols-2 gap-3"
          >
            <AppTextInput
              :name="`var_code_${index}`"
              label="Code"
              required
              v-model="variable.code"
              placeholder="Code"
            />
            <AppTextInput
              :name="`var_title_${index}`"
              label="Motivation"
              required
              v-model="variable.title"
              placeholder="Name"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Frequency Format Section -->
    <div v-if="isFrequencyType" class="p-4 space-y-4 bg-white rounded">
      <!-- Section Header -->
      <div
        @click="isCloseFrequencyFormat = !isCloseFrequencyFormat"
        class="flex justify-between items-center cursor-pointer"
      >
        <div class="flex gap-2 items-center">
          <div class="text-sm font-semibold text-slate-10">Frequency format</div>
          <div
            v-if="isCloseFrequencyFormat"
            class="px-2 py-0.5 text-xs font-medium rounded bg-slate-2 text-slate-7"
          >
            {{ frequencyFormat === 'classic' ? 'Classic' : 'Custom' }}
          </div>
        </div>
        <Icon
          icon="ph:caret-up-bold"
          class="w-5 h-5 transition-transform text-slate-10"
          :class="{ 'rotate-180': isCloseFrequencyFormat }"
        />
      </div>

      <div v-if="!isCloseFrequencyFormat" class="space-y-4">
        <!-- Classic / Custom Toggle -->
        <div class="flex p-1 rounded-lg border border-slate-4 bg-slate-2">
          <div
            class="flex justify-center items-center py-1.5 w-full text-xs font-semibold rounded transition-colors duration-300 cursor-pointer"
            :class="frequencyFormat === 'classic' ? 'bg-white text-slate-10' : 'text-slate-7'"
            @click="frequencyFormat = 'classic'"
          >
            Classic
          </div>
          <div
            class="flex justify-center items-center py-1.5 w-full text-xs font-semibold rounded transition-colors duration-300 cursor-pointer"
            :class="frequencyFormat === 'custom' ? 'bg-white text-slate-10' : 'text-slate-7'"
            @click="frequencyFormat = 'custom'"
          >
            Custom
          </div>
        </div>

        <!-- Description -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-9">
            {{ frequencyFormat === 'classic' ? 'Single-variable' : 'Multi-variable' }}
          </div>
          <div v-if="frequencyFormat === 'classic'" class="text-xs text-slate-8">
            Record the frequency of a behavior during the session, without capturing any
            additional details.
          </div>
          <div v-if="frequencyFormat === 'custom'" class="text-xs text-slate-8">
            Record frequency data over a specified duration to calculate the rate of a
            behavior during the session.
          </div>
        </div>

        <!-- Preview -->
        <div class="flex justify-center items-center py-6 rounded border border-slate-4 bg-slate-1">
          <div
            class="relative p-4 w-80 bg-white rounded-lg border-t-4 shadow-sm border-light-purple-5"
          >
            <div class="space-y-2">
              <div class="w-16 h-4 rounded-full bg-slate-2" />
              <div class="w-64 h-4 rounded-full bg-slate-2" />
              <div class="w-48 h-4 rounded-full bg-slate-2" />
            </div>
            <div class="flex justify-center items-center py-8">
              <div class="flex flex-col items-center space-y-2">
                <div
                  class="flex justify-center items-center font-bold text-white rounded-3xl shadow cursor-pointer bg-light-purple-5 h-18 w-18"
                >
                  <Icon icon="ph:plus-bold" class="text-4xl" />
                </div>
                <div
                  class="flex justify-center items-center h-6 bg-white rounded border shadow-sm cursor-pointer border-slate-5 w-18"
                >
                  <Icon icon="ph:minus-bold" class="text-xs text-slate-6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Duration Input -->
        <div v-if="frequencyFormat === 'custom'" class="space-y-4">
          <AppTextInput
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
        </div>
      </div>
    </div>

    <!-- PIR Settings Section -->
    <div v-if="isPirType" class="p-4 space-y-4 bg-white rounded">
      <!-- Section Header -->
      <div
        @click="isClosePirSettings = !isClosePirSettings"
        class="flex justify-between items-center cursor-pointer"
        :class="{ 'border-b border-slate-4 pb-2': !isClosePirSettings }"
      >
        <div class="text-sm font-semibold text-slate-10">Partial interval recording settings</div>
        <Icon
          icon="ph:caret-up-bold"
          class="w-5 h-5 transition-transform text-slate-10"
          :class="{ 'rotate-180': isClosePirSettings }"
        />
      </div>

      <!-- Settings Content -->
      <div v-if="!isClosePirSettings" class="space-y-4">
        <div class="text-xs text-slate-8">
          Set how interval-based recording works during an active session.
        </div>

        <!-- Interval (Readonly) -->
        <AppTextInput
          name="interval"
          label="Interval"
          disabled
          modelValue="5"
          suffix-text="minutes"
        />

        <!-- Duration -->
        <AppTextInput
          name="duration"
          label="Duration"
          required
          placeholder="Type duration"
          v-model="duration"
          type="number"
          inputmode="numeric"
          suffix-text="minutes"
          :error="
            duration && (Number(duration) < 5 || Number(duration) % 5 !== 0)
              ? 'Duration must be at least 5 minutes and a multiple of 5.'
              : ''
          "
        />

        <!-- Interval start timing -->
        <div class="space-y-2">
          <div class="text-sm font-medium text-slate-8">Interval start timing</div>
          <div class="text-xs text-slate-6">Choose how intervals begin during the sessions.</div>
          <div class="pt-1 space-y-2">
            <div class="flex gap-2 items-center">
              <input
                type="radio"
                name="interval_start_timing"
                :checked="intervalStartTiming === 'start_with_session'"
                value="start_with_session"
                class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
                @click="intervalStartTiming = 'start_with_session'"
              />
              <label class="text-sm">Start with session</label>
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
              <label class="text-sm">Custom start</label>
            </div>
          </div>
        </div>

        <!-- Allow overtime recording -->
        <div class="pt-4 space-y-2 border-t border-slate-4">
          <div class="flex justify-between items-center">
            <div class="text-sm font-medium text-slate-9">Allow overtime recording</div>
            <AppToggle
              name="allow_overtime_recording"
              :checked="allowOvertimeRecording"
              @change="allowOvertimeRecording = !allowOvertimeRecording"
            />
          </div>
          <div class="text-xs text-slate-6">
            Control whether recording can continue after the planned duration ends.
          </div>
        </div>
      </div>
    </div>

    <!-- Probing Section -->
    <div v-if="useProbing" class="p-4 space-y-4 bg-white rounded">
      <div class="flex justify-between items-center">
        <div class="text-sm font-semibold text-slate-10">Probing</div>
        <AppToggle
          name="probing_enable"
          :checked="probingEnable"
          @change="probingEnable = !probingEnable"
        />
      </div>

      <div v-if="probingEnable" class="pt-4 space-y-4 border-t border-slate-4">
        <p class="text-xs leading-relaxed text-slate-8">
          Probing can be employed to assess a skill at various stages of the therapy. Activating probing gives you additional option to conduct probes during the session.
        </p>

        <!-- Minimum probes (trials) needed -->
        <AppTextInput
          name="probing_number_of_trial"
          label="Minimum probes (trials) needed"
          required
          placeholder="Type number"
          suffix-text="trials"
          v-model="probingNumberOfTrial"
          type="number"
          inputmode="numeric"
        />

        <!-- Goal -->
        <AppTextInput
          name="probing_goal"
          label="Goal"
          required
          placeholder="1-100"
          suffix-text="percent (%)"
          v-model="probingGoal"
          type="number"
          inputmode="numeric"
          :error="
            probingGoal && (Number(probingGoal) < 1 || Number(probingGoal) > 100)
              ? 'Probing goal must be between 1 and 100 percent.'
              : ''
          "
        />
      </div>
    </div>

    <!-- Prompting Format Section -->
    <div v-if="isPromptingType" class="p-4 space-y-4 bg-white rounded">
      <div
        @click="isClosePromptingFormat = !isClosePromptingFormat"
        class="flex justify-between items-center cursor-pointer"
      >
        <div class="flex gap-2 items-center">
          <div class="p-1 rounded bg-light-purple-1">
            <Icon icon="ph:gear-six-fill" class="text-[20px] text-light-purple-6" />
          </div>
          <div class="text-sm font-semibold text-slate-10">Prompting format</div>
        </div>
        <div class="flex gap-1.5 items-center">
          <span v-if="isClosePromptingFormat" class="text-xs font-medium capitalize text-slate-6">
            {{ promptingFormat }}
          </span>
          <Icon
            icon="ph:caret-up-bold"
            class="w-5 h-5 transition-transform text-slate-10"
            :class="{ 'rotate-180': isClosePromptingFormat }"
          />
        </div>
      </div>

      <div v-if="!isClosePromptingFormat" class="pt-4 space-y-4 border-t border-slate-4">
        <!-- Toggle classic vs custom -->
        <div class="flex p-1 rounded bg-slate-1">
          <button
            type="button"
            class="flex-1 py-1.5 text-xs font-semibold text-center rounded transition-colors"
            :class="promptingFormat === 'classic' ? 'bg-white text-slate-10 shadow-sm font-bold' : 'text-slate-6 font-medium'"
            @click="promptingFormat = 'classic'"
          >
            Classic
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 text-xs font-semibold text-center rounded transition-colors"
            :class="promptingFormat === 'custom' ? 'bg-white text-slate-10 shadow-sm font-bold' : 'text-slate-6 font-medium'"
            @click="promptingFormat = 'custom'"
          >
            Custom
          </button>
        </div>

        <!-- Details block based on selection -->
        <div>
          <div class="text-sm font-bold text-slate-9">
            {{ promptingFormat === 'classic' ? 'Frequency-based prompting' : 'Score-based prompting' }}
          </div>
          <div class="mt-1 text-xs leading-normal text-slate-6">
            {{
              promptingFormat === 'classic'
                ? 'Tracks how many times each type of prompt is used during the session.'
                : 'Calculates a percentage score based on the prompts used and the values you assign to each one.'
            }}
          </div>
        </div>

        <!-- Alert warning/info -->
        <div v-if="promptingFormat === 'classic'" class="flex gap-3 rounded-lg bg-[#E0EFFF] p-3 text-[#1D4ED8]">
          <Icon icon="ph:info-bold" class="w-5 h-5 shrink-0" />
          <div class="text-xs leading-normal">
            Customize default prompts for the entire center by creating them in the Repository.
            <span class="block mt-1 font-semibold text-blue-900">only available on desktop app</span>
          </div>
        </div>

        <div v-if="promptingFormat === 'custom'" class="flex gap-3 rounded-lg bg-[#E0EFFF] p-3 text-[#1D4ED8]">
          <Icon icon="ph:megaphone-fill" class="w-5 h-5 shrink-0" />
          <div class="space-y-1 text-xs leading-normal">
            <div class="font-semibold text-blue-900">Prompts now centralized in Repository</div>
            <div class="text-blue-800">
              With the latest update, prompts for Custom format targets can only be created or edited in the Repository.
            </div>
            <div class="font-semibold text-blue-900">only available on desktop app</div>
          </div>
        </div>

        <!-- Dynamic Preview container (Real implementation of PromptPreview) -->
        <div class="flex justify-center items-center p-4 h-72 rounded-xl border border-slate-2 bg-slate-50">
          <div class="flex relative flex-col gap-2 p-3 w-64 bg-white rounded-lg border-t-4 shadow-sm border-light-purple-6">
            <!-- Mock app header -->
            <div class="space-y-1">
              <div class="w-8 h-1.5 rounded-full bg-slate-2"></div>
              <div class="w-16 h-1.5 rounded-full bg-slate-2"></div>
              <div class="w-12 h-1.5 rounded-full bg-slate-2"></div>
            </div>
            <!-- Mock grids of buttons -->
            <div class="flex flex-wrap content-center items-center justify-center gap-x-2 gap-y-3 py-4 min-h-[140px]">
              <div v-for="prompt in visiblePrompts" :key="prompt.key" class="flex flex-col items-center space-y-1 shrink-0">
                <div
                  class="flex relative justify-center items-center w-10 h-10 rounded-xl border shrink-0"
                  :style="{
                    backgroundColor: promptColors[prompt.color || 'grey']?.primaryColor,
                    borderColor: promptColors[prompt.color || 'grey']?.secondaryColor,
                    color: promptColors[prompt.color || 'grey']?.textColor,
                  }"
                >
                  <div class="notranslate absolute top-0.5 text-[6px] font-bold" translate="no">
                    {{ prompt.abbreviation }}
                  </div>
                  <div class="text-[14px] font-bold mt-1.5">+</div>
                </div>
                <div class="flex justify-center items-center w-10 h-2 rounded border border-slate-2">
                  <div class="w-4 h-0.5 rounded bg-slate-2 shrink-0" />
                </div>
              </div>
              <div v-if="!promptsAttributes.length" class="py-4 text-xs text-center text-slate-6">
                No active prompts to preview
              </div>
            </div>
            <!-- Pagination dots -->
            <div v-if="promptPageCount > 1" class="flex gap-1.5 justify-center items-center pb-1">
              <button
                v-for="n in promptPageCount"
                :key="n"
                :class="n - 1 === promptPageIndex ? 'bg-light-purple-6' : 'bg-slate-3'"
                class="w-1.5 h-1.5 rounded-full border-none outline-none"
                @click.prevent="promptPageIndex = n - 1"
              />
            </div>
          </div>
        </div>

        <!-- Prompts list title -->
        <div class="text-xs font-bold tracking-wider uppercase text-slate-6">Prompts list</div>

        <!-- Table headers -->
        <div v-if="promptingFormat === 'classic'" class="grid grid-cols-[auto_40px_60px_1fr_auto] items-center gap-3 border-b border-slate-3 pb-2 text-[10px] font-semibold text-slate-6 uppercase tracking-wider px-2">
          <div class="w-6"></div> <!-- drag handle column space -->
          <div>Code</div>
          <div>Symbol</div>
          <div>Prompt</div>
          <div></div> <!-- actions column space -->
        </div>

        <div v-if="promptingFormat === 'custom'" class="grid grid-cols-[56px_40px_60px_1fr_auto] items-center gap-3 border-b border-slate-3 pb-2 text-[10px] font-semibold text-slate-6 uppercase tracking-wider px-2">
          <div>Score (%)</div>
          <div>Code</div>
          <div>Symbol</div>
          <div>Prompt</div>
          <div></div> <!-- actions column space -->
        </div>

        <!-- Prompts List Representation -->
        <!-- Classic (Draggable) -->
        <VueDraggable
          v-if="promptingFormat === 'classic'"
          v-model="promptsAttributes"
          :animation="150"
          handle=".drag-handle"
          @end="onDragEnd"
          class="space-y-1"
        >
          <div
            v-for="prompt in promptsAttributes"
            :key="prompt.key"
            class="grid grid-cols-[auto_40px_60px_1fr_auto] items-center gap-3 bg-white hover:bg-slate-50 border border-slate-2 rounded-lg py-2 px-2 transition-colors"
          >
            <!-- Drag handle -->
            <div class="flex justify-center items-center w-6 drag-handle text-slate-6 cursor-grab active:cursor-grabbing">
              <Icon icon="ph:dots-six-vertical-bold" class="text-lg" />
            </div>

            <!-- Abbreviation badge -->
            <div class="flex">
              <span
                class="rounded px-1.5 py-0.5 text-xs font-bold truncate max-w-[36px]"
                :style="{
                  backgroundColor: promptColors[prompt.color || 'grey']?.primaryColor,
                  color: promptColors[prompt.color || 'grey']?.textColor
                }"
              >
                {{ prompt.abbreviation }}
              </span>
            </div>

            <!-- Shape/Symbol symbol -->
            <div class="flex items-center">
              <Icon
                v-if="prompt.shape"
                :icon="prompt.shape === 'square' ? 'ph:square-fill' : prompt.shape === 'circle' ? 'ph:circle-fill' : prompt.shape === 'triangle' ? 'ph:triangle-fill' : 'ph:diamond-fill'"
                class="text-xl"
                :style="{ color: promptColors[prompt.color || 'grey']?.primaryColor }"
              />
            </div>

            <!-- Prompt Name -->
            <div class="text-sm font-medium truncate text-slate-8">
              {{ prompt.name }}
            </div>

            <!-- Action Menu trigger (3 vertical dots) -->
            <button
              type="button"
              @click.stop="openPromptAction(prompt)"
              class="flex justify-center items-center w-8 h-8 rounded-full transition-colors text-slate-6 hover:bg-slate-2"
            >
              <Icon icon="ph:dots-three-outline-vertical-fill" class="text-base" />
            </button>
          </div>
        </VueDraggable>

        <!-- Custom (Grouped by Score) -->
        <div v-if="promptingFormat === 'custom'" class="space-y-2">
          <div
            v-for="group in groupedPromptInputs"
            :key="group.score ?? 0"
            class="flex overflow-hidden bg-white rounded-lg border border-slate-2 shadow-xs"
          >
            <!-- Score badge column on the left -->
            <div class="flex justify-center items-center py-3 w-14 border-r shrink-0 bg-slate-50 border-slate-2">
              <span class="px-1.5 py-0.5 text-xs font-bold rounded border bg-light-purple-1 border-light-purple-2 text-light-purple-6">
                {{ group.score }}
              </span>
            </div>
            
            <!-- Prompts inside this group -->
            <div class="flex flex-col divide-y grow divide-slate-100">
              <div
                v-for="prompt in group.prompts"
                :key="prompt.key"
                class="grid grid-cols-[40px_60px_1fr_auto] items-center gap-3 py-2.5 px-2 hover:bg-slate-50 transition-colors"
              >
                <!-- Abbreviation badge -->
                <div class="flex">
                  <span
                    class="rounded px-1.5 py-0.5 text-xs font-bold truncate max-w-[36px]"
                    :style="{
                      backgroundColor: promptColors[prompt.color || 'grey']?.primaryColor,
                      color: promptColors[prompt.color || 'grey']?.textColor
                    }"
                  >
                    {{ prompt.abbreviation }}
                  </span>
                </div>

                <!-- Shape/Symbol symbol -->
                <div class="flex items-center">
                  <Icon
                    v-if="prompt.shape"
                    :icon="prompt.shape === 'square' ? 'ph:square-fill' : prompt.shape === 'circle' ? 'ph:circle-fill' : prompt.shape === 'triangle' ? 'ph:triangle-fill' : 'ph:diamond-fill'"
                    class="text-xl"
                    :style="{ color: promptColors[prompt.color || 'grey']?.primaryColor }"
                  />
                </div>

                <!-- Prompt Name -->
                <div class="text-sm font-medium truncate text-slate-8">
                  {{ prompt.name }}
                </div>

                <!-- Action Menu trigger -->
                <button
                  v-if="!prompt.is_default"
                  type="button"
                  @click.stop="openPromptAction(prompt)"
                  class="flex justify-center items-center w-8 h-8 rounded-full transition-colors text-slate-6 hover:bg-slate-2"
                >
                  <Icon icon="ph:dots-three-outline-vertical-fill" class="text-base" />
                </button>
                <div v-else class="w-8 h-8 shrink-0" />
              </div>
            </div>
          </div>
          <div v-if="!promptsAttributes.length" class="py-4 text-xs text-center rounded-lg border text-slate-6 bg-slate-50 border-slate-2">
            No active prompts. Add prompts from repository.
          </div>
        </div>

        <!-- Add Prompt Button -->
        <button
          v-if="promptingFormat === 'classic'"
          type="button"
          @click="onAddPrompt"
          class="flex gap-2 items-center py-2 text-sm font-semibold transition-colors text-light-purple-6 hover:text-light-purple-7"
        >
          <Icon icon="ph:plus-circle-bold" class="text-xl text-light-purple-6" />
          Add prompt
        </button>

        <button
          v-if="promptingFormat === 'custom'"
          type="button"
          @click="onOpenCustomPromptRepo"
          class="flex gap-2 items-center py-2 text-sm font-semibold transition-colors text-light-purple-6 hover:text-light-purple-7"
        >
          <Icon icon="ph:plus-circle-bold" class="text-xl text-light-purple-6" />
          Add prompt
        </button>

        <!-- Goal and success metric sub-section -->
        <!-- Classic Goal & Success Metric -->
        <div v-if="promptingFormat === 'classic'" class="pt-4 space-y-4 border-t border-slate-4">
          <div class="text-sm font-semibold text-slate-10">Goal and success metric</div>
          <div class="text-xs leading-relaxed text-slate-8">
            Mark this target as successful when the client uses a specific prompt at least a certain number of times.
          </div>

          <!-- Prompt level select -->
          <div class="space-y-1">
            <span class="text-xs font-semibold text-slate-7">Prompt level *</span>
            <div
              class="flex justify-between items-center px-3 w-full h-10 bg-white rounded border cursor-pointer border-slate-3"
              @click="showPromptLevel = true"
            >
              <div class="text-[16px] text-slate-9">
                {{ selectedPromptSuccessMetric || 'Select prompt' }}
              </div>
              <Icon icon="tabler:chevron-down" class="text-[20px] text-slate-6" />
            </div>
          </div>

          <!-- Minimum attempts per session -->
          <AppTextInput
            name="classic_prompting_attempts"
            label="Minimum attempts per session *"
            placeholder="Type goal"
            v-model="goal"
            type="number"
            inputmode="numeric"
          />
        </div>

        <!-- Custom Goal & Success Metric -->
        <div v-if="promptingFormat === 'custom'" class="pt-4 space-y-4 border-t border-slate-4">
          <div class="text-sm font-semibold text-slate-10">Goal and success metric</div>
          <div class="text-xs leading-relaxed text-slate-8">
            The target passes if the client's score meets the goal you set.
          </div>

          <!-- Goal percentage field -->
          <AppTextInput
            name="custom_prompting_goal"
            label="Goal *"
            placeholder="1-100"
            suffix-text="percent (%)"
            v-model="goal"
            type="number"
            inputmode="numeric"
            :error="
              goal && (Number(goal) < 1 || Number(goal) > 100)
                ? 'Goal must be between 1 and 100 percent.'
                : ''
            "
          />

          <!-- Success metric radio buttons -->
          <div class="space-y-2">
            <div class="text-xs font-semibold text-slate-7">
              <span>Success metric</span>
              <span class="ml-1 text-tomato-7">*</span>
            </div>

            <div class="flex gap-2 items-center mb-3">
              <input
                type="radio"
                name="custom_prompting_success_metric"
                id="custom_prompting_success_metric_greater"
                :checked="successMetric === 'equal to or greater than goal'"
                value="equal to or greater than goal"
                class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
                @click="successMetric = 'equal to or greater than goal'"
              />
              <label for="custom_prompting_success_metric_greater" class="w-full text-sm text-slate-8">Equal to or greater than goal</label>
            </div>

            <div class="flex gap-2 items-center">
              <input
                type="radio"
                name="custom_prompting_success_metric"
                id="custom_prompting_success_metric_less"
                :checked="successMetric === 'less than goal'"
                value="less than goal"
                class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
                @click="successMetric = 'less than goal'"
              />
              <label for="custom_prompting_success_metric_less" class="w-full text-sm text-slate-8">Less than goal</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Recommendations Section -->
    <div v-if="isUseActionRecommendation" class="p-4 space-y-3 bg-white rounded">
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
        <!-- Passing success metric -->
        <div class="py-2 space-y-2 border-t border-slate-4">
          <div class="text-sm font-semibold text-slate-10">Passing success metric</div>
          <div class="text-xs text-slate-8">Updating the current target's status from</div>
          <div class="flex gap-2 items-center">
            <AppChip chip="in_progress" />
            <div class="text-sm text-slate-8">to</div>
            <AppChip chip="mastered" />
          </div>

          <!-- Total success -->
          <div class="flex gap-2 items-center pt-2">
            <AppToggle
              name="total_success"
              :checked="totalSuccessChecked"
              @change="totalSuccessChecked = !totalSuccessChecked"
            />
            <div class="text-xs font-semibold text-slate-9">Total success</div>
          </div>
          <div class="text-xs font-medium text-slate-8">
            Receive a recommendation after completing at least
          </div>
          <div class="flex gap-2 items-center pt-1">
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

          <!-- Consecutive success -->
          <div class="flex gap-2 items-center pt-2">
            <AppToggle
              name="consecutive_success"
              :checked="consecutiveSuccessChecked"
              @change="consecutiveSuccessChecked = !consecutiveSuccessChecked"
            />
            <div class="text-xs font-semibold text-slate-9">Consecutive success</div>
          </div>
          <div class="text-xs font-medium text-slate-8">
            Receive a recommendation only if the session is successful for
          </div>
          <div class="flex gap-2 items-center pt-1">
            <input
              type="number"
              pattern="[0-9]*"
              inputmode="numeric"
              min="2"
              v-model="consecutiveSuccessInput"
              :disabled="!consecutiveSuccessChecked"
              :class="{ 'opacity-50': !consecutiveSuccessChecked }"
              class="h-8 w-16 appearance-none rounded border border-slate-4 px-2 text-center outline-none [-webkit-appearance:none] focus:border-light-purple-5 focus:ring-light-purple-2"
            />
            <div class="text-xs text-slate-8">consecutive session(s).</div>
          </div>
        </div>

        <!-- Next target recommendation -->
        <div class="py-2 space-y-2 border-t border-slate-4">
          <div class="flex gap-2 items-center">
            <AppToggle name="next_target" :checked="false" :disabled="true" />
            <div class="text-sm font-semibold text-slate-10">Next target recommendation</div>
          </div>
          <div class="text-xs text-slate-8">
            When this target is mastered, the next target will be recommended to change from
          </div>
          <div class="flex gap-2 items-center">
            <AppChip chip="pending" />
            <div class="text-sm text-slate-8">to</div>
            <AppChip chip="in_progress" />
          </div>
          <div class="flex gap-2 px-3 py-2 rounded bg-cornflower-2">
            <Icon icon="ph:info-fill" class="text-2xl shrink-0 text-cornflower-8" />
            <div class="text-xs text-cornflower-8">
              This setting is available only when creating a target in the Databank.
            </div>
          </div>
        </div>

        <!-- Maintenance -->
        <div class="py-2 space-y-4 border-t border-slate-4">
          <div class="flex gap-2 items-center">
            <AppToggle
              name="maintenance"
              :checked="maintenanceChecked"
              @change="maintenanceChecked = !maintenanceChecked"
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

          <div v-if="maintenanceChecked" class="space-y-4">
            <!-- Approach Selection -->
            <div class="flex p-1 rounded-lg border border-slate-4 bg-slate-2">
              <div
                class="flex justify-center items-center py-1 w-full text-xs font-semibold rounded transition-colors duration-300 cursor-pointer text-slate-7"
                :class="maintenanceApproach === 'manual' ? 'bg-white' : 'text-slate-7'"
                @click="maintenanceApproach = 'manual'"
              >
                Manual
              </div>
              <div
                class="flex justify-center items-center py-1 w-full text-xs font-semibold rounded transition-colors duration-300 cursor-pointer text-slate-7"
                :class="maintenanceApproach === 'automation' ? 'bg-white' : 'text-slate-7'"
                @click="maintenanceApproach = 'automation'"
              >
                Automation
              </div>
            </div>

            <!-- Manual Settings -->
            <div v-if="maintenanceApproach === 'manual'" class="space-y-3">
              <div class="text-[13px] font-semibold text-slate-10">Manual approach</div>
              <div class="text-xs text-slate-8">
                Repeat maintenance at a fixed interval with no end date. Sessions continue until the
                setting is turned off.
              </div>

              <div class="pt-2 space-y-1">
                <div class="text-[13px] font-semibold text-slate-10">
                  Recommended maintenance frequency
                </div>
                <div class="flex gap-2 justify-between items-center pt-1">
                  <span class="text-xs">Every</span>
                  <div class="flex gap-2">
                    <input
                      type="number"
                      v-model="manualIntervalAmount"
                      class="px-2 w-20 h-10 text-sm rounded border appearance-none outline-none border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2"
                    />
                    <div
                      @click="showManualUnitSheet = true"
                      class="flex h-10 min-w-[90px] cursor-pointer items-center justify-between rounded border border-slate-4 bg-white px-3"
                    >
                      <span class="text-sm">{{ UNIT_OPTIONS.find((o) => o.value === manualIntervalUnit)?.label || 'day' }}</span>
                      <Icon icon="ph:caret-down" class="text-slate-600" />
                    </div>
                  </div>
                </div>
                <div class="text-xs text-slate-8">after the target is <b>mastered</b></div>
              </div>
            </div>

            <!-- Automation Settings -->
            <div v-if="maintenanceApproach === 'automation'" class="space-y-3">
              <div class="text-[13px] font-semibold text-slate-10">Automation approach</div>
              <div class="text-xs text-slate-8">
                Create a predefined sequence of maintenance sessions with custom intervals between
                each session.
              </div>

              <div class="space-y-1">
                <AppTextInput
                  name="total_sessions"
                  label="Number of maintenance sessions"
                  required
                  v-model="automationTotalSessions"
                  suffix-text="Session(s)"
                  type="number"
                />
              </div>

              <div class="pt-2 space-y-4">
                <div
                  v-for="(schedule, index) in automationSchedules"
                  :key="index"
                  class="space-y-2"
                >
                  <div class="text-[13px] font-semibold text-slate-10">
                    {{ ordinalSuffix(index + 1) }} maintenance schedule
                  </div>
                  <div class="flex gap-2 items-center">
                    <input
                      type="number"
                      v-model="schedule.interval_amount"
                      class="px-2 w-2/4 h-10 text-sm rounded border appearance-none outline-none border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2"
                    />
                    <div
                      @click="
                        () => {
                          editingScheduleIndex = index
                          showScheduleUnitSheet = true
                        }
                      "
                      class="flex h-10 w-2/4 min-w-[100px] cursor-pointer items-center justify-between rounded border border-slate-4 bg-white px-3"
                    >
                      <span class="text-sm">{{
                        UNIT_OPTIONS.find((o) => o.value === schedule.interval_unit)?.label || 'day'
                      }}</span>
                      <Icon icon="ph:caret-down" class="text-slate-600" />
                    </div>
                  </div>
                  <div
                    class="text-xs text-slate-8"
                    v-html="
                      index === 0
                        ? 'after the target is <b>mastered</b>'
                        : 'after previous maintenance'
                    "
                  ></div>
                </div>
              </div>

              <div class="pt-2 space-y-2">
                <div class="text-[13px] font-medium text-slate-8">
                  When a maintenance session fails
                </div>
                <div
                  @click="showFailureSheet = true"
                  class="flex justify-between items-center px-3 w-full h-10 bg-white rounded border cursor-pointer border-slate-4"
                  :class="{ 'cursor-not-allowed opacity-50': automationSchedules.length <= 1 }"
                >
                  <span class="pr-2 text-sm truncate">{{
                    FAILURE_OPTIONS.find((o) => o.value === automationOnFailure)?.label
                  }}</span>
                  <Icon icon="ph:caret-down" class="shrink-0 text-slate-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom Submit Button -->
  <div class="fixed bottom-0 z-20 px-4 w-full bg-pure-white pb-safe">
    <div class="flex items-center w-full h-16">
      <AppButton
        class="grow"
        kind="outline"
        :loading="submitLoading"
        :disabled="isDisabledSubmit"
        @click="onSubmit"
      >
        Create Target
      </AppButton>
    </div>
  </div>

  <!-- Data Collection Method Sheet -->
  <AppActionSheet :show="showMethod" @close="showMethod = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Data collection method</div>
        <div class="cursor-pointer" @click="showMethod = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in METHOD_OPTIONS"
          :key="opt.value"
          class="flex justify-between items-center w-full h-14 border-b border-slate-3"
        >
          <label :for="`method_${opt.value}`" class="w-full text-sm">{{ opt.label }}</label>
          <input
            type="radio"
            name="data_collection_method"
            :id="`method_${opt.value}`"
            :checked="selectMethodTemp === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="selectMethodTemp = opt.value"
          />
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 justify-center items-center py-3 w-full bg-white">
        <AppButton class="w-full" @click="onApplyMethod">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Curriculum Sheet -->
  <CurriculumItemModal
    :show="showCurriculum"
    :options="curriculumOptions"
    :selected="selectedCurriculum ? [selectedCurriculum.value] : []"
    :use-multiple-select="false"
    :reset-able="false"
    @set-query="curriculumQuery = $event"
    @close="showCurriculum = false"
    @apply="onApplyCurriculum($event)"
  />

  <!-- Status Sheet -->
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
          class="flex justify-between items-center w-full h-14 border-b border-slate-3"
        >
          <label :for="`status_${opt.value}`" class="text-sm w-fit">
            <AppChip :chip="opt.value" />
          </label>
          <input
            type="radio"
            name="target_status"
            :id="`status_${opt.value}`"
            :checked="selectStatus === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="selectStatus = opt.value"
          />
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 justify-center items-center py-3 w-full bg-white">
        <AppButton class="w-full" @click="onApplyStatus(selectStatus)">Apply</AppButton>
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
            @click="
              () => {
                manualIntervalUnit = opt.value
                showManualUnitSheet = false
              }
            "
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
          v-for="opt in UNIT_OPTIONS"
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
            @click="
              () => {
                automationSchedules[editingScheduleIndex].interval_unit = opt.value
                showScheduleUnitSheet = false
              }
            "
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
            @click="
              () => {
                automationOnFailure = opt.value
                showFailureSheet = false
              }
            "
          />
        </div>
      </div>
    </div>
  </AppActionSheet>

  <!-- Prompt Level Select Sheet -->
  <AppActionSheet :show="showPromptLevel" @close="showPromptLevel = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Prompt level</div>
        <div class="cursor-pointer" @click="showPromptLevel = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in promptSuccessMetricOptions"
          :key="opt.value"
          class="flex justify-between items-center w-full h-14 border-b border-slate-3"
        >
          <label :for="`prompt_metric_${opt.value}`" class="w-full text-sm cursor-pointer">
            {{ opt.label }}
          </label>
          <input
            type="radio"
            name="prompt_success_metric"
            :id="`prompt_metric_${opt.value}`"
            :checked="selectedPromptSuccessMetric === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="
              () => {
                selectedPromptSuccessMetric = opt.value
                showPromptLevel = false
              }
            "
          />
        </div>
      </div>
    </div>
  </AppActionSheet>

  <!-- Prompt Action Sheet -->
  <AppActionSheet :show="showPromptActionSheet" @close="showPromptActionSheet = false">
    <div class="py-2">
      <div class="flex justify-between items-center pb-3 mb-2 border-b border-slate-3">
        <div class="text-lg font-bold text-slate-9">{{ activePromptName }}</div>
        <div class="cursor-pointer" @click="showPromptActionSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div class="space-y-1">
        <!-- Edit prompt button (Classic only) -->
        <button
          v-if="promptingFormat === 'classic'"
          type="button"
          @click="onEditPrompt"
          class="flex gap-3 items-center px-2 py-3 w-full text-left rounded-lg transition-colors text-slate-8 hover:bg-slate-50"
        >
          <Icon icon="ph:pencil-simple-line-bold" class="text-xl text-slate-6" />
          <span class="text-sm font-medium">Edit prompt</span>
        </button>
        <!-- Delete prompt button -->
        <button
          v-if="promptingFormat !== 'classic' || promptsAttributes.length > 1"
          type="button"
          @click="onDeletePrompt"
          class="flex gap-3 items-center px-2 py-3 w-full text-left text-red-600 rounded-lg transition-colors hover:bg-red-50"
        >
          <Icon icon="ph:trash-bold" class="text-red-5" />
          <span class="text-sm font-medium">Delete prompt</span>
        </button>
      </div>
    </div>
  </AppActionSheet>

  <!-- Add/Edit Prompt Form Sheet -->
  <AppActionSheet :show="showPromptFormSheet" @close="showPromptFormSheet = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">{{ isEditingPrompt ? 'Edit prompt' : 'Add new prompt' }}</div>
        <div class="cursor-pointer" @click="showPromptFormSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div class="py-2 space-y-4">
        <!-- Code field with max 3 char helper inside label row -->
        <div class="space-y-1">
          <div class="flex justify-between items-center text-xs font-semibold text-slate-7">
            <span>Code *</span>
            <span class="font-normal text-slate-6">Max. 3 char</span>
          </div>
          <input
            type="text"
            maxlength="3"
            placeholder="Type code"
            v-model="promptFormCode"
            class="px-3 w-full h-10 text-sm rounded border outline-none border-slate-3 focus:border-light-purple-5 focus:ring-light-purple-2"
          />
        </div>

        <!-- Symbol button selector -->
        <div class="space-y-1">
          <span class="text-xs font-semibold text-slate-7">Symbol</span>
          <div
            @click="openSymbolSelect"
            class="flex justify-between items-center px-3 w-full h-10 bg-white rounded border cursor-pointer border-slate-3"
          >
            <div class="flex gap-2 items-center">
              <!-- Shape icon representing selected shape -->
              <Icon
                :icon="promptFormShape === 'square' ? 'ph:square-fill' : promptFormShape === 'circle' ? 'ph:circle-fill' : promptFormShape === 'triangle' ? 'ph:triangle-fill' : 'ph:diamond-fill'"
                class="text-lg"
                :style="{ color: promptColors[promptFormColor]?.primaryColor }"
              />
            </div>
            <Icon icon="ph:caret-down" class="text-slate-6" />
          </div>
        </div>

        <!-- Prompt name field -->
        <div class="space-y-1">
          <span class="text-xs font-semibold text-slate-7">Prompt name *</span>
          <input
            type="text"
            placeholder="Type name"
            v-model="promptFormName"
            class="px-3 w-full h-10 text-sm rounded border outline-none border-slate-3 focus:border-light-purple-5 focus:ring-light-purple-2"
          />
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 gap-3 justify-center items-center py-4 w-full bg-white">
        <AppButton class="flex-1" kind="plain" @click="showPromptFormSheet = false">Cancel</AppButton>
        <AppButton class="flex-1" @click="onSavePromptForm">
          {{ isEditingPrompt ? 'Update' : 'Add' }}
        </AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Symbol Selection Sheet -->
  <AppActionSheet :show="showSymbolSelectSheet" @close="showSymbolSelectSheet = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white border-b border-slate-2">
        <div class="text-xl font-semibold">Symbol</div>
        <div class="cursor-pointer" @click="showSymbolSelectSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <!-- Temporary local selections inside sheet -->
      <div class="py-2 space-y-4">
        <div>
          <div class="mb-2 text-xs font-bold tracking-wider uppercase text-slate-6">Colors</div>
          <div class="divide-y divide-slate-1 max-h-[220px] overflow-y-auto pr-1">
            <div
              v-for="colorOpt in [
                { value: 'cherry', label: 'Cherry' },
                { value: 'blush', label: 'Blush' },
                { value: 'gold', label: 'Gold' },
                { value: 'daffodil', label: 'Daffodil' },
                { value: 'lake', label: 'Lake' },
                { value: 'mint', label: 'Mint' },
                { value: 'sky', label: 'Sky' },
                { value: 'hydrangeas', label: 'Hydrangeas' },
                { value: 'grey', label: 'Grey' },
                { value: 'primary', label: 'Primary' }
              ]"
              :key="colorOpt.value"
              @click="promptFormColor = colorOpt.value"
              class="flex justify-between items-center py-2.5 transition-colors cursor-pointer hover:bg-slate-50"
            >
              <div class="flex gap-3 items-center">
                <div
                  class="w-5 h-5 rounded-full border border-slate-3 shrink-0"
                  :style="{ backgroundColor: promptColors[colorOpt.value]?.primaryColor }"
                ></div>
                <span class="text-sm text-slate-8">{{ colorOpt.label }}</span>
              </div>
              <div class="flex justify-center items-center">
                <input
                  type="radio"
                  name="symbol_color"
                  :checked="promptFormColor === colorOpt.value"
                  class="rounded-full shrink-0 border-slate-3 text-light-purple-5 focus:ring-light-purple-3"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="pt-3 mb-2 text-xs font-bold tracking-wider uppercase border-t text-slate-6 border-slate-2">Shapes</div>
          <div class="divide-y divide-slate-1">
            <div
              v-for="shapeOpt in [
                { value: 'square', label: 'Square' },
                { value: 'circle', label: 'Circle' },
                { value: 'triangle', label: 'Triangle' },
                { value: 'diamond', label: 'Diamond' }
              ]"
              :key="shapeOpt.value"
              @click="promptFormShape = shapeOpt.value"
              class="flex justify-between items-center py-2.5 transition-colors cursor-pointer hover:bg-slate-50"
            >
              <div class="flex gap-3 items-center">
                <Icon
                  :icon="shapeOpt.value === 'square' ? 'ph:square-fill' : shapeOpt.value === 'circle' ? 'ph:circle-fill' : shapeOpt.value === 'triangle' ? 'ph:triangle-fill' : 'ph:diamond-fill'"
                  class="text-xl"
                  :style="{ color: promptColors[promptFormColor]?.primaryColor }"
                />
                <span class="text-sm text-slate-8">{{ shapeOpt.label }}</span>
              </div>
              <div class="flex justify-center items-center">
                <input
                  type="radio"
                  name="symbol_shape"
                  :checked="promptFormShape === shapeOpt.value"
                  class="rounded-full shrink-0 border-slate-3 text-light-purple-5 focus:ring-light-purple-3"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 justify-center items-center py-3 w-full bg-white border-t border-slate-2">
        <AppButton class="w-full font-semibold" @click="showSymbolSelectSheet = false">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Add Prompts from Repository Action Sheet -->
  <AppActionSheet :show="showCustomPromptRepoSheet" @close="showCustomPromptRepoSheet = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-lg font-bold">Add prompts from repository</div>
        <div class="cursor-pointer" @click="showCustomPromptRepoSheet = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      
      <div class="mb-4 text-xs leading-normal text-slate-6">
        This prompt is from the Repository and is shared across all targets in your center. To add a new prompt, please visit the Repository.
      </div>

      <div class="overflow-y-auto pr-1 max-h-80 divide-y divide-slate-100">
        <div
          v-for="opt in promptOptions"
          :key="opt.id"
          class="flex justify-between items-center py-3"
        >
          <div class="flex gap-3 items-center">
            <!-- Score badge -->
            <span class="px-1.5 py-0.5 w-10 text-xs font-bold text-center rounded border bg-light-purple-1 border-light-purple-2 text-light-purple-6 shrink-0">
              {{ opt.score ?? 0 }}
            </span>
            <!-- Code badge -->
            <span
              class="rounded px-1.5 py-0.5 text-xs font-bold truncate max-w-[36px]"
              :style="{
                backgroundColor: promptColors[opt.color || 'grey']?.primaryColor,
                color: promptColors[opt.color || 'grey']?.textColor
              }"
            >
              {{ opt.abbreviation }}
            </span>
            <!-- Symbol -->
            <Icon
              v-if="opt.shape"
              :icon="opt.shape === 'square' ? 'ph:square-fill' : opt.shape === 'circle' ? 'ph:circle-fill' : opt.shape === 'triangle' ? 'ph:triangle-fill' : 'ph:diamond-fill'"
              class="text-xl shrink-0"
              :style="{ color: promptColors[opt.color || 'grey']?.primaryColor }"
            />
            <!-- Name -->
            <span class="text-sm font-medium text-slate-8 truncate max-w-[120px]">{{ opt.name }}</span>
          </div>
          <!-- Checkbox -->
          <input
            type="checkbox"
            class="w-5 h-5 rounded cursor-pointer border-slate-6 text-light-purple-5 focus:ring-light-purple-2 shrink-0"
            :checked="selectedRepoPrompts.some((i) => i.id === opt.id)"
            @change="onChangeNewCustomPrompt(opt)"
          />
        </div>
        <div v-if="!promptOptions.length" class="py-8 text-xs text-center text-slate-6">
          No more prompts available in repository.
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 gap-3 justify-center items-center py-3 mt-4 w-full bg-white border-t border-slate-2">
        <AppButton class="flex-1" kind="plain" @click="showCustomPromptRepoSheet = false">Cancel</AppButton>
        <AppButton
          class="flex-1 font-semibold"
          :disabled="!selectedRepoPrompts.length"
          @click="onAddCustomPrompts"
        >
          Add {{ selectedRepoPrompts.length }} prompt(s)
        </AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
