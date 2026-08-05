<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
// import { useAppStore } from '@/stores/app.store'
import { useToast } from 'vue-toastification'
import axios from 'axios'
import type { Measurement } from '@/lib/types'
import AppChip from '@/components/AppChip.vue'

defineOptions({ name: 'GroupMeasurement' })

interface Props {
  measurement: Measurement
  measurementResults?: Record<string, any>
  isCollapsed?: boolean
  type?: 'tbt' | 'percentage'
}

interface Emits {
  (e: 'toggle-updated', val: boolean): void
  (e: 'toggle-saved', val: boolean): void
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'fetch-measurements'): void
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false,
  type: undefined
})

const emit = defineEmits<Emits>()

const sessionStore = useSessionStore()
// const appStore = useAppStore()
const toast = useToast()

interface MemberResult {
  probing: Record<string, boolean | null> | null
  teaching: Record<string, boolean | null> | null
  decision: string | null
  submitted: boolean
}

interface GateOption {
  id: string
  visible: boolean
  marked_as: string
  title: string
  status: string | null
  message: string | null
}

const groupType = computed(() => {
  if (props.type) return props.type
  const targetType = props.measurement.target?.type || ''
  const mType = props.measurement.type || ''
  if (targetType.includes('percentage') || mType.includes('percentage')) return 'percentage'
  return 'tbt'
})

const titleLabel = computed(() => (groupType.value === 'percentage' ? 'Group Percentage' : 'Group TBT'))
const subtitleLabel = computed(() => (groupType.value === 'percentage' ? 'Grouped targets · Percentage' : 'Grouped targets · Trial-by-Trial'))
const actionNotesPrefix = computed(() => (groupType.value === 'percentage' ? 'Group Percentage' : 'Group TBT'))

/** === STATE === */
const resultsState = ref<Record<string, MemberResult>>({})
const activeMemberId = ref<number>(0)
const view = ref<'entry' | 'move' | 'desc' | 'list' | 'decision-gate'>('entry')
const moveSel = ref<number | undefined | null>(null)
const gateSel = ref<GateOption | null>(null)
const saveLoading = ref(false)
const saving = ref(false)
const showMemberSelector = ref(false)

const showPopup = ref(false)
let popupTimeout: any = null

function onDisplayPopup() {
  if (!props.isCollapsed) return
  showPopup.value = true
  if (popupTimeout) clearTimeout(popupTimeout)
  popupTimeout = setTimeout(() => {
    showPopup.value = false
  }, 3000)
}

const isBusy = computed(() => saving.value || saveLoading.value)

// function isMemberProbing(memberId: number) {
//   const res = resultsState.value[String(memberId)]
//   return res && res.probing !== null
// }

const targetGoal = computed(() => Number(props.measurement.target?.goal || 0))
const usedTargets = computed(() => props.measurement.used_targets || [])

const activeMember = computed(() =>
  usedTargets.value.find((t) => t.target_id === activeMemberId.value)
)

const activeMemberResults = computed<MemberResult>(() => {
  const memberIdStr = String(activeMemberId.value)
  return (
    resultsState.value[memberIdStr] || {
      probing: null,
      teaching: {},
      decision: null,
      submitted: false
    }
  )
})

// Phase: probe or teach
const isProbingPhase = computed(() => {
  const res = activeMemberResults.value
  if (res.decision === 'acq-teach' || res.decision === 'fail-teach') {
    return false
  }
  return res.probing !== null
})

// const phaseOfActive = computed(() => (isProbingPhase.value ? 'probe' : 'teach'))

// Current trials for rendering (includes 3 placeholders in probing phase when empty/partial)
const currentTrials = computed(() => {
  const res = activeMemberResults.value
  const map = isProbingPhase.value ? res.probing : res.teaching
  if (!map) return []
  const list = Object.keys(map)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({
      key,
      value: map[key]
    }))

  if (isProbingPhase.value) {
    const minTrials = activeMember.value?.probing_number_of_trial || 3
    while (list.length < minTrials) {
      list.push({
        key: `placeholder-${list.length}`,
        value: null
      })
    }
  }

  return list
})

// Pagination
const currentPage = ref(0)
const pageSize = computed(() => (isProbingPhase.value ? 5 : 25))
const totalPages = computed(() => {
  const len = currentTrials.value.length
  return Math.max(1, Math.ceil(len / pageSize.value))
})

const probingPages = computed(() => {
  const trials = [...currentTrials.value]
  const size = 5
  const pages = []
  for (let i = 0; i < trials.length; i += size) {
    pages.push(trials.slice(i, i + size))
  }
  return pages.length ? pages : [[]]
})

const teachingPages = computed(() => {
  const trials = [...currentTrials.value]
  const size = 25
  const pages = []
  for (let i = 0; i < trials.length; i += size) {
    pages.push(trials.slice(i, i + size))
  }
  return pages.length ? pages : [[]]
})

const onScroll = (e: Event) => {
  const target = e.currentTarget as HTMLElement
  const current = Math.round(target.scrollLeft / target.offsetWidth)
  currentPage.value = current
}

const onChangePage = (num: number) => {
  currentPage.value = num
  const prefix = isProbingPhase.value ? 'tbt-group-probing-' : 'tbt-group-teaching-'
  const elId = `${prefix}${props.measurement.id}-page-${num}`
  const el = document.getElementById(elId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
}

function autoAlignPage() {
  const index = currentTrials.value.findIndex((t) => t.value === null)
  let targetPage = 0
  if (index !== -1) {
    targetPage = Math.floor(index / pageSize.value)
  } else {
    targetPage = Math.max(0, totalPages.value - 1)
  }
  if (currentPage.value !== targetPage) {
    currentPage.value = targetPage
    nextTick(() => {
      const prefix = isProbingPhase.value ? 'tbt-group-probing-' : 'tbt-group-teaching-'
      const elId = `${prefix}${props.measurement.id}-page-${targetPage}`
      const el = document.getElementById(elId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    })
  }
}

watch(
  [activeMemberId, isProbingPhase],
  () => {
    autoAlignPage()
  },
  { immediate: true }
)

watch(totalPages, (newVal) => {
  if (currentPage.value >= newVal) {
    currentPage.value = Math.max(0, newVal - 1)
  }
})

watch(
  usedTargets,
  (newVal) => {
    if (
      newVal.length > 0 &&
      (!activeMemberId.value || !newVal.some((t) => t.target_id === activeMemberId.value))
    ) {
      if (newVal[0]?.target_id) {
        activeMemberId.value = newVal[0].target_id
      }
    }
  },
  { immediate: true }
)

// Minimum required trials
const minTrialsOfActive = computed(() => {
  if (isProbingPhase.value) {
    return activeMember.value?.probing_number_of_trial || 3
  }
  return activeMember.value?.number_of_trial || 2
})

// Count of answered trials
const answeredCountOfActive = computed(() => {
  return currentTrials.value.filter((t) => t.value !== null).length
})

// Active member score
const scoreOfActive = computed(() => {
  const answered = currentTrials.value.filter((t) => t.value !== null)
  if (answered.length === 0) return 0
  const correct = answered.filter((t) => t.value === true).length
  return Math.round((correct / answered.length) * 100)
})

const gateOptions = computed<GateOption[]>(() => {
  if (!activeMember.value) return []
  const isPending = activeMember.value.status === 'pending'
  const isMastered = activeMember.value.status === 'mastered'
  const passed = scoreOfActive.value >= targetGoal.value

  const passedOptions: GateOption[] = [
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
      title: isPending ? 'Marked as' : 'Keep as',
      status: 'in_progress',
      message: 'Conduct teaching immediately.'
    },
    {
      id: 'pass_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: isPending ? 'Marked as' : 'Keep as',
      status: 'in_progress',
      message: 'Postpone teaching to the next session.'
    }
  ]

  const failedOptions: GateOption[] = [
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

  const passedInMastered: GateOption[] = [
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

  const failedInMastered: GateOption[] = [
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

  if (isMastered) {
    return passed ? passedInMastered : failedInMastered
  } else {
    return passed ? passedOptions : failedOptions
  }
})

// Scaffold initial state
function ensureScaffoldedResults() {
  const scaffolded: Record<string, MemberResult> = {}
  usedTargets.value.forEach((target) => {
    if (target.target_id === undefined) return
    const memberIdStr = String(target.target_id)
    const existing = resultsState.value[memberIdStr]

    if (existing) {
      scaffolded[memberIdStr] = { ...existing }
    } else {
      const isProbingActive = Boolean(target.probing_number_of_trial)
      let initialProbing: Record<string, boolean | null> | null = null

      if (isProbingActive) {
        initialProbing = {}
        const minProbe = target.probing_number_of_trial || 3
        for (let i = 0; i < minProbe; i++) {
          initialProbing[String(i)] = null
        }
      }

      const initialTeaching: Record<string, boolean | null> = {}
      const minTeach = target.number_of_trial || 2
      for (let i = 0; i < minTeach; i++) {
        initialTeaching[String(i)] = null
      }

      scaffolded[memberIdStr] = {
        probing: initialProbing,
        teaching: initialTeaching,
        decision: null,
        submitted: false
      }
    }
  })

  resultsState.value = scaffolded
}

watch(
  () => props.measurementResults,
  (val) => {
    if (val && Object.keys(val).length > 0) {
      resultsState.value = JSON.parse(JSON.stringify(val))
    } else {
      ensureScaffoldedResults()
    }
  },
  { immediate: true, deep: true }
)

function getMemberAnsweredCount(memberId?: number) {
  if (memberId === undefined) return 0
  const res = resultsState.value[String(memberId)]
  if (!res) return 0
  const isProbe = res.decision !== 'acq-teach' && res.decision !== 'fail-teach' && res.probing !== null
  const map = isProbe ? res.probing : res.teaching
  if (!map) return 0
  return Object.values(map).filter((v) => v !== null).length
}

function getMemberPhase(memberId?: number) {
  if (memberId === undefined) return 'probe'
  const res = resultsState.value[String(memberId)]
  if (!res) return 'probe'
  if (res.decision === 'acq-teach' || res.decision === 'fail-teach') return 'teach'
  return res.probing !== null ? 'probe' : 'teach'
}

function getMemberFillPct(memberId?: number) {
  if (memberId === undefined) return 0
  const target = usedTargets.value.find((t) => t.target_id === memberId)
  if (!target) return 0
  const isProbe = getMemberPhase(memberId) === 'probe'
  const min = isProbe ? target.probing_number_of_trial || 3 : target.number_of_trial || 2
  const answered = getMemberAnsweredCount(memberId)
  return Math.min(100, Math.round((answered / min) * 100))
}

const listEntries = computed(() => {
  const entries: Array<{
    id: number | undefined
    target_code: string | undefined
    target_name: string | undefined
    score: number
    probing: boolean
    locked: boolean
  }> = []

  usedTargets.value.forEach((m) => {
    const res = resultsState.value[String(m.target_id)]
    const currentPhase = getMemberPhase(m.target_id)
    const probingMap = res?.probing
    const hasProbingData =
      probingMap !== null &&
      probingMap !== undefined &&
      (Object.values(probingMap).some((v) => v !== null) || res?.submitted || res?.decision !== null)

    if (currentPhase === 'teach' && hasProbingData) {
      // Add Probing entry (completed / locked probing history)
      const probingAnswered = Object.values(probingMap || {}).filter((v) => v !== null)
      const probingCorrect = probingAnswered.filter((v) => v === true).length
      const probingScore = probingAnswered.length
        ? Math.round((probingCorrect / probingAnswered.length) * 100)
        : 0

      entries.push({
        id: m.target_id,
        target_code: m.target_code,
        target_name: m.target_name,
        score: probingScore,
        probing: true,
        locked: true
      })
    }

    if (currentPhase === 'teach') {
      // Add Teaching entry
      const teachingMap = res?.teaching || {}
      const teachingAnswered = Object.values(teachingMap).filter((v) => v !== null)
      const teachingCorrect = teachingAnswered.filter((v) => v === true).length
      const teachingScore = teachingAnswered.length
        ? Math.round((teachingCorrect / teachingAnswered.length) * 100)
        : 0

      entries.push({
        id: m.target_id,
        target_code: m.target_code,
        target_name: m.target_name,
        score: teachingScore,
        probing: false,
        locked: res?.submitted || false
      })
    } else {
      // Active Probing entry
      const probingAnswered = Object.values(probingMap || {}).filter((v) => v !== null)
      const probingCorrect = probingAnswered.filter((v) => v === true).length
      const probingScore = probingAnswered.length
        ? Math.round((probingCorrect / probingAnswered.length) * 100)
        : 0

      entries.push({
        id: m.target_id,
        target_code: m.target_code,
        target_name: m.target_name,
        score: probingScore,
        probing: true,
        locked: res?.submitted || false
      })
    }
  })

  return entries
})

async function saveResultsToServer() {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: resultsState.value },
    data_result: { ...props.measurement, results: resultsState.value },
    last_data: { ...props.measurement }
  }

  saving.value = true
  emit('toggle-updated', false)
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  emit('toggle-updated', true)
  saving.value = false

  if (success && data?.results) {
    resultsState.value = JSON.parse(JSON.stringify(data.results))
  } else if (!success) {
    toast.error(message)
  }
}

function switchToMember(memberId?: number | null) {
  if (memberId === undefined || memberId === null) return
  activeMemberId.value = memberId
  view.value = 'entry'
  moveSel.value = null
  gateSel.value = null
}

function onRecordProbe(val: boolean) {
  if (sessionStore.session?.status !== 'ongoing') return
  onDisplayPopup()
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes || memberRes.submitted || !memberRes.probing) return

  const probing = memberRes.probing
  const sortedKeys = Object.keys(probing).sort((a, b) => Number(a) - Number(b))
  const firstNullKey = sortedKeys.find((k) => probing[k] === null)

  if (firstNullKey !== undefined) {
    memberRes.probing[firstNullKey] = val
  } else {
    const nextKey = sortedKeys.length > 0 ? String(Math.max(...sortedKeys.map(Number)) + 1) : '0'
    memberRes.probing[nextKey] = val
  }

  sessionStore.addSessionActivity({
    action_label: `tbt_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `${actionNotesPrefix.value} Target Member ${activeMember.value?.target_code} Probing: ${val}`,
    timestamp: new Date().toISOString()
  })

  saveResultsToServer()
  autoAlignPage()
}

// function onRecordTeaching(val: boolean) {
//   if (sessionStore.session?.status !== 'ongoing') return
//   const memberIdStr = String(activeMemberId.value)
//   const memberRes = resultsState.value[memberIdStr]
//   if (!memberRes || !memberRes.teaching) return

//   const teaching = memberRes.teaching
//   const sortedKeys = Object.keys(teaching).sort((a, b) => Number(a) - Number(b))
//   const firstNullKey = sortedKeys.find((k) => teaching[k] === null)

//   if (firstNullKey !== undefined) {
//     memberRes.teaching[firstNullKey] = val
//   } else {
//     const nextKey = sortedKeys.length > 0 ? String(Math.max(...sortedKeys.map(Number)) + 1) : '0'
//     memberRes.teaching[nextKey] = val
//   }

//   sessionStore.addSessionActivity({
//     action_label: `tbt_score`,
//     recordable: 'Measurement',
//     recordable_id: props.measurement.id,
//     api: `PATCH /api/v1/measurements/${props.measurement.id}`,
//     params: { measurement: { results: resultsState.value } },
//     notes: `${actionNotesPrefix.value} Target Member ${activeMember.value?.target_code} Teaching: ${val}`,
//     timestamp: new Date().toISOString()
//   })

//   saveResultsToServer()
//   autoAlignPage()
// }

function onRemoveProbe(idx: number) {
  if (sessionStore.session?.status !== 'ongoing') return
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes || memberRes.submitted || !memberRes.probing) return

  const probing = memberRes.probing
  const keys = Object.keys(probing).sort((a, b) => Number(a) - Number(b))
  const values = keys.map((k) => probing[k])
  values.splice(idx, 1)

  const newProbing: Record<string, boolean | null> = {}
  values.forEach((v, i) => {
    newProbing[String(i)] = v
  })

  memberRes.probing = newProbing

  sessionStore.addSessionActivity({
    action_label: `tbt_delete`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `${actionNotesPrefix.value} Target Member ${activeMember.value?.target_code} Probing trial deleted`,
    timestamp: new Date().toISOString()
  })

  saveResultsToServer()
  autoAlignPage()
}

function onCycleTeaching(key: string) {
  if (sessionStore.session?.status !== 'ongoing') return
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes || !memberRes.teaching) return

  const val = memberRes.teaching[key]
  let nextVal = null
  if (val === null) nextVal = true
  else if (val === true) nextVal = false
  else if (val === false) nextVal = null

  memberRes.teaching[key] = nextVal

  sessionStore.addSessionActivity({
    action_label: `tbt_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `${actionNotesPrefix.value} Target Member ${activeMember.value?.target_code} Teaching cycle: ${nextVal}`,
    timestamp: new Date().toISOString()
  })

  saveResultsToServer()
}

function onAddTeachingTrial() {
  if (sessionStore.session?.status !== 'ongoing') return
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes || !memberRes.teaching) return

  const teaching = memberRes.teaching
  const keys = Object.keys(teaching).map(Number)
  const nextKey = keys.length > 0 ? String(Math.max(...keys) + 1) : '0'

  memberRes.teaching = {
    ...teaching,
    [nextKey]: null
  }

  sessionStore.addSessionActivity({
    action_label: `tbt_add`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `${actionNotesPrefix.value} Target Member ${activeMember.value?.target_code} Teaching trial added`,
    timestamp: new Date().toISOString()
  })

  saveResultsToServer()
  nextTick(() => {
    autoAlignPage()
  })
}

function onRemoveTeachingTrial(key: string) {
  if (sessionStore.session?.status !== 'ongoing') return
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes || !memberRes.teaching) return

  const teaching = memberRes.teaching || {}
  const newTeaching = { ...teaching }
  delete newTeaching[key]

  const remainingValues = Object.keys(newTeaching)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => newTeaching[k])

  const indexedTeaching: Record<string, boolean | null> = {}
  remainingValues.forEach((v, idx) => {
    indexedTeaching[String(idx)] = v
  })

  memberRes.teaching = indexedTeaching

  sessionStore.addSessionActivity({
    action_label: `tbt_delete`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `${actionNotesPrefix.value} Target Member ${activeMember.value?.target_code} Teaching trial deleted`,
    timestamp: new Date().toISOString()
  })

  saveResultsToServer()
}

function onSubmitProbing() {
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes) return

  memberRes.submitted = true
  view.value = 'decision-gate'
  gateSel.value = null
  emit('toggle-collapsed', false)
  saveResultsToServer()
}

function onCancelDecision() {
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (memberRes && !memberRes.decision) {
    memberRes.submitted = false
  }
  view.value = 'entry'
  gateSel.value = null
  saveResultsToServer()
}

async function saveDecision() {
  const opt = gateSel.value
  if (!opt) return

  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes) return

  const currentStatus = activeMember.value?.status
  const targetStatusMap: Record<string, string> = {
    mastered: 'mastered',
    in_progress: 'in_progress'
  }
  const nextStatus = targetStatusMap[opt.marked_as]

  if (nextStatus && nextStatus !== currentStatus) {
    saveLoading.value = true
    emit('toggle-updated', false)
    try {
      const res = await axios.patch(`/api/v1/targets/${activeMemberId.value}/update_status`, {
        status: nextStatus
      })
      if (res.status === 200 || res.status === 204) {
        toast.success(
          `Target status updated to ${nextStatus === 'mastered' ? 'Mastered' : 'In acquisition'}`
        )
        if (activeMember.value) {
          activeMember.value.status = nextStatus
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to update target status')
    }
    emit('toggle-updated', true)
    saveLoading.value = false
  }

  // Set memberRes.decision string for backend & desktop compatibility
  let choiceKey = 'acq-postpone'
  if (
    opt.id === 'pass_and_mastered' ||
    opt.id === 'pass_and_keep_mastered' ||
    opt.id === 'fail_and_keep_mastered'
  ) {
    choiceKey = 'mastered'
  } else if (opt.id === 'pass_and_conduct_teaching') {
    choiceKey = 'acq-teach'
  } else if (opt.id === 'pass_and_postpone_teaching') {
    choiceKey = 'acq-postpone'
  } else if (
    opt.id === 'fail_and_start_teaching' ||
    opt.id === 'fail_and_restart_teaching' ||
    opt.id === 'fail_and_conduct_teaching'
  ) {
    choiceKey = 'fail-teach'
  } else if (opt.id === 'fail_and_next' || opt.id === 'fail_and_postpone_teaching') {
    choiceKey = 'fail-next'
  }

  memberRes.decision = choiceKey

  if (choiceKey === 'acq-teach' || choiceKey === 'fail-teach') {
    // If they chose to teach now, initialize the teaching trials map
    const minTeaching = activeMember.value?.number_of_trial || 2
    const freshTeaching: Record<string, boolean | null> = {}
    for (let i = 0; i < minTeaching; i++) {
      freshTeaching[String(i)] = null
    }
    memberRes.teaching = freshTeaching
  } else {
    // Otherwise clear teaching
    memberRes.teaching = null
  }

  gateSel.value = null
  view.value = 'entry'
  await saveResultsToServer()
}

function onConfirmMove() {
  if (moveSel.value) {
    switchToMember(moveSel.value)
  }
}

onMounted(() => {
  ensureScaffoldedResults()
  if (usedTargets.value.length > 0 && usedTargets.value[0]?.target_id) {
    activeMemberId.value = usedTargets.value[0].target_id
  }
})
</script>

<template>
  <div class="flex overflow-hidden flex-col justify-between h-full grow">
    <div v-if="saving || saveLoading" class="absolute top-4 right-16">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <!-- 1. Tabs Row (Ratios) - shown only when expanded -->
    <div
      v-if="!isCollapsed"
      class="flex overflow-x-auto gap-1.5 items-center px-2 py-2 w-full scrollbar-hide shrink-0"
      :class="[usedTargets.length > 6 ? 'justify-start' : 'justify-center']"
    >
      <button
        v-for="member in usedTargets"
        :key="member.target_id"
        class="flex overflow-hidden relative justify-center items-center w-10 h-10 text-xs font-semibold rounded-lg border transition-all duration-200 shrink-0"
        :class="[
          activeMemberId === member.target_id
            ? getMemberPhase(member.target_id) === 'probe'
              ? 'border-lime-7 bg-lime-100 text-lime-700 shadow-sm'
              : 'border-light-purple-5 text-light-purple-5 bg-purple-50 shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        ]"
        @click="switchToMember(member.target_id)"
      >
        <!-- fill overlay percentage -->
        <div
          class="absolute right-0 bottom-0 left-0 transition-all duration-300 pointer-events-none"
          :style="{
            height: getMemberFillPct(member.target_id) + '%',
            backgroundColor: getMemberPhase(member.target_id) === 'probe' ? 'rgba(101, 163, 13, 0.1)' : 'rgba(139, 92, 246, 0.1)'
          }"
        />
        <span class="relative pointer-events-none">{{ member.target_code }}</span>
      </button>
    </div>

    <!-- Floating Probing Circles Popup when Collapsed -->
    <div
      v-if="isCollapsed && isProbingPhase && (showPopup || saveLoading)"
      class="flex absolute bottom-full left-1/2 z-50 flex-col gap-1.5 justify-center items-center p-3 mb-2 w-64 bg-white rounded-xl border shadow-lg transition-all -translate-x-1/2 border-slate-200"
    >
      <div class="flex overflow-x-auto gap-2 items-center max-w-full">
        <div v-for="(t, idx) in currentTrials" :key="t.key" class="relative group shrink-0">
          <div
            class="flex justify-center items-center w-9 h-9 text-xs font-bold rounded-full transition-all duration-200"
            :class="[
              t.value === true
                ? 'bg-lime-5 text-white cursor-pointer'
                : t.value === false
                  ? 'bg-tomato-7 text-white cursor-pointer'
                  : 'border-2 border-dashed border-slate-300 bg-slate-50 text-transparent pointer-events-none',
              sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted ? 'pointer-events-none' : ''
            ]"
            @click="t.value !== null && onRemoveProbe(idx)"
          >
            <Icon v-if="t.value !== null" icon="ph:trash" class="text-lg text-white opacity-90" />
          </div>
        </div>
      </div>
      <div class="text-[10px] font-medium text-slate-400">Tap a circle to remove</div>
    </div>

    <!-- MAIN DISPLAY CONTAINER -->
    <div class="flex overflow-hidden relative flex-col justify-between bg-white grow" :class="{ 'p-3': !isCollapsed, 'px-2 py-1': isCollapsed }">
      <!-- Descriptions view overlay -->
      <div v-if="view === 'desc' && !isCollapsed" class="flex overflow-y-auto flex-col justify-between p-1 h-full bg-white grow">
        <div class="space-y-3">
          <div class="pb-2 border-b border-slate-100">
            <div class="flex gap-1.5 items-center text-sm font-bold text-slate-800">
              <Icon icon="ph:copy" class="text-lg text-slate-400" />
              {{ titleLabel }}
            </div>
            <div class="mt-0.5 text-xs text-slate-500">{{ subtitleLabel }}</div>
          </div>

          <div class="pt-1 space-y-4">
            <div v-for="member in usedTargets" :key="member.target_id" class="space-y-1">
              <div class="text-xs font-bold text-slate-800">
                {{ member.target_code }} - {{ member.target_name }}
              </div>
              <div class="text-xs text-slate-600">
                Goal: {{ member.goal ?? measurement.target?.goal ?? 0 }}%
              </div>
              <div class="text-xs text-slate-600">
                <template v-if="groupType === 'tbt'">
                  Minimum number of trials: {{ member.number_of_trial || member.probing_number_of_trial || 2 }} trial(s)
                </template>
                <template v-else>
                  Number of trials: {{ member.number_of_trial || 5 }} trial(s)
                </template>
              </div>
              <div class="text-xs text-slate-600">
                Success metric: {{ member.success_metric || 'equal to or greater than goal' }}
              </div>
              <div v-if="!member.description" class="text-xs italic text-slate-400">
                No description
              </div>
              <div v-else class="text-xs whitespace-pre-line text-slate-500">
                {{ member.description }}
              </div>
            </div>
          </div>
        </div>

        <div class="pt-3 mt-4 border-t border-slate-100">
          <button
            class="w-full h-9 text-xs font-semibold bg-white rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95"
            @click="view = 'entry'"
          >
            Close
          </button>
        </div>
      </div>

      <!-- 1. MEMBER LIST VIEW (hidden when collapsed) -->
      <div
        v-else-if="view === 'list' && !isCollapsed"
        class="flex overflow-y-auto flex-col pb-4 grow"
      >
        <div class="mb-2 text-xs font-bold text-slate-800">Target Members List</div>
        <div class="border-t divide-y divide-slate-100 border-slate-100">
          <div
            v-for="e in listEntries"
            :key="e.id + '-' + e.probing"
            class="flex justify-between items-center py-2.5 transition-colors cursor-pointer hover:bg-slate-50"
            @click="switchToMember(e.id)"
          >
            <div class="flex gap-2 items-center">
              <span class="text-sm font-bold text-slate-800">{{ e.target_code }}</span>
              <span class="text-xs truncate max-w-40 text-slate-500">{{ e.target_name }}</span>
            </div>

            <div class="flex gap-2 items-center">
              <span
                class="px-2 py-0.5 text-xs font-bold rounded-full"
                :class="[e.probing ? 'bg-lime-100 text-lime-700' : 'bg-slate-100 text-slate-700']"
              >
                {{ e.score }}%
              </span>
              <span
                v-if="e.probing"
                class="bg-lime-2 text-lime-7 rounded px-1.5 py-0.5 text-[10px] font-medium"
              >
                Probing
              </span>
              <Icon v-if="!e.locked" icon="ph:pencil-simple" class="text-sm text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- 2. SWITCH MEMBER OVERLAY (hidden when collapsed) -->
      <div v-else-if="view === 'move' && !isCollapsed" class="flex overflow-hidden flex-col justify-between grow">
        <div class="flex flex-col gap-4 justify-center items-center py-6 grow">
          <div class="flex flex-col items-center">
            <div class="text-3xl font-extrabold text-slate-800">{{ scoreOfActive }}%</div>
            <div class="mt-1 text-xs font-medium text-slate-400">Score</div>
            <button
              v-if="activeMemberResults.submitted && !activeMemberResults.decision"
              class="mt-1.5 text-xs font-semibold text-light-purple-5 hover:underline"
              @click="view = 'decision-gate'"
            >
              Change
            </button>
          </div>
          <div class="my-2 w-full max-w-[200px] border-t border-slate-100" />
          <div class="flex flex-col gap-2 items-center w-full">
            <div class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Next
            </div>
            <div
              class="flex overflow-x-auto gap-2 px-4 py-1 mt-1 w-full scrollbar-hide"
              :class="[usedTargets.length > 5 ? 'justify-start flex-nowrap' : 'justify-center flex-wrap']"
            >
              <button
                v-for="member in usedTargets"
                :key="'move-' + member.target_id"
                class="flex justify-center items-center w-10 h-10 text-xs font-bold rounded-lg border transition-all duration-200 shrink-0"
                :class="[
                  moveSel === member.target_id
                    ? 'border-light-purple-5 text-light-purple-5 scale-105 bg-purple-50 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ]"
                @click="moveSel = member.target_id ?? null"
              >
                {{ member.target_code }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. MEMBER ENTRY VIEW -->
      <div v-else class="flex overflow-hidden flex-col justify-between grow">
        <div
          class="flex px-1 shrink-0"
          :class="{ 'mb-2 flex-col pb-2 gap-2': !isCollapsed, 'mb-1 flex-row items-center justify-between pb-1': isCollapsed }"
        >
          <div class="flex justify-between items-center w-full">
            <div class="flex gap-1.5 items-center text-xs">
              <span class="text-slate-500">Current</span>
              <span class="font-bold text-light-purple-5">{{ activeMember?.target_code }}</span>
              <button
                v-if="isCollapsed"
                class="ml-1 font-semibold underline text-light-purple-5 hover:text-light-purple-6"
                @click="showMemberSelector = !showMemberSelector"
              >
                Move to
              </button>
            </div>

            <div
              class="flex gap-3 items-center text-xs"
              :class="{ 'cursor-pointer': isCollapsed }"
              @click="onDisplayPopup"
            >
              <div>
                <span class="mr-1 text-slate-500">Score</span>
                <span
                  class="font-bold"
                  :class="[isProbingPhase ? 'text-lime-700' : 'text-slate-800']"
                >
                  {{ scoreOfActive }}%
                </span>
              </div>
              <div>
                <span class="mr-1 text-slate-500">Trial</span>
                <span class="font-bold text-slate-800">{{ answeredCountOfActive }}</span>
              </div>
            </div>
          </div>

          <!-- Sub-header badge row (shown when expanded) -->
          <div v-if="!isCollapsed" class="flex justify-between items-center pt-1 shrink-0">
            <span
              v-if="isProbingPhase"
              class="px-2 py-0.5 text-xs font-bold text-lime-700 bg-lime-100 rounded-full"
            >
              Probing
            </span>
            <span
              v-if="activeMemberResults.decision"
              class="px-2 py-0.5 text-xs font-bold rounded-full"
              :class="[
                activeMemberResults.decision === 'mastered'
                  ? 'bg-lime-100 text-lime-700'
                  : 'bg-amber-100 text-amber-800',
              ]"
            >
              {{ activeMemberResults.decision === 'mastered' ? 'Mastered' : 'In acquisition' }}
            </span>
          </div>
        </div>

        <!-- Member Selector Overlay when Move to is clicked -->
        <div v-if="showMemberSelector" class="flex flex-col gap-2 justify-center items-center py-2 w-full grow">
          <div
            class="flex overflow-x-auto gap-2 px-4 py-1 mt-1 w-full scrollbar-hide"
            :class="[usedTargets.length > 5 ? 'justify-start flex-nowrap' : 'justify-center flex-wrap']"
          >
            <button
              v-for="member in usedTargets"
              :key="'move-' + member.target_id"
              class="flex justify-center items-center w-10 h-10 text-xs font-bold rounded-lg border transition-all duration-200 shrink-0"
              :class="[
                moveSel === member.target_id
                  ? 'border-light-purple-5 text-light-purple-5 scale-105 bg-purple-50 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ]"
              @click="moveSel = member.target_id"
            >
              {{ member.target_code }}
            </button>
          </div>
          <button
            class="bg-light-purple-5 hover:bg-light-purple-6 flex h-9 w-full items-center justify-center rounded-lg text-xs font-semibold text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            :disabled="!moveSel"
            @click="() => { if (moveSel) { switchToMember(moveSel); showMemberSelector = false; } }"
          >
            Move to
          </button>
        </div>

        <!-- Scrollable Trials Area (shown when member selector is closed) -->
        <div
          v-else
          class="flex flex-col justify-center items-center w-full grow"
          :class="{ 'overflow-y-auto py-2': !isCollapsed, 'py-0': isCollapsed }"
        >
          <!-- Probing view -->
          <div v-if="isProbingPhase" class="w-full">
            <!-- Collapsed Probing Row (when isCollapsed = true) -->
            <div v-if="isCollapsed" class="w-full">
              <!-- AppChip when submitted with decision -->
              <div v-if="activeMemberResults.submitted && activeMemberResults.decision" class="flex justify-center my-1">
                <AppChip :chip="activeMemberResults.decision" />
              </div>
              <div class="flex gap-3 justify-center items-center py-1">
                <button
                  class="flex justify-center items-center w-[4.5rem] h-[4.5rem] text-xl font-bold text-white rounded-full transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted || sessionStore.session?.status !== 'ongoing' || isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-tomato-7 hover:bg-tomato-8 shadow-md'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted || isBusy
                  "
                  @click="onRecordProbe(false)"
                >
                  <Icon icon="ph:x-bold" class="w-10 h-10 text-white" />
                </button>
                <button
                  class="flex justify-center items-center w-[4.5rem] h-[4.5rem] text-xl font-bold text-white rounded-full transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted || sessionStore.session?.status !== 'ongoing' || isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-lime-5 hover:bg-lime-6 shadow-md'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted || isBusy
                  "
                  @click="onRecordProbe(true)"
                >
                  <Icon icon="ph:check-bold" class="w-10 h-10 text-white" />
                </button>
                <button
                  v-if="!activeMemberResults.submitted && answeredCountOfActive >= minTrialsOfActive"
                  class="flex justify-center items-center px-4 w-[4.5rem] h-[4.5rem] text-xs font-bold text-white rounded-full shadow-md transition-all bg-light-purple-5 hover:bg-light-purple-6 active:scale-95 disabled:opacity-40"
                  :disabled="sessionStore.session?.status !== 'ongoing' || isBusy"
                  @click="onSubmitProbing"
                >
                  Submit
                </button>
              </div>
            </div>

            <!-- Full Probing View (when isCollapsed = false) -->
            <div v-else class="flex flex-col gap-4 items-center w-full">
              <div
                :id="`probing-scroll-${measurement.id}`"
                class="flex overflow-x-auto gap-4 pb-3 max-w-[280px] w-full scrollbar-hide snap-x snap-mandatory scroll-smooth"
                @scroll="onScroll"
              >
                <div
                  v-for="(pageTrials, pageIdx) in probingPages"
                  :key="'probing-page-' + pageIdx"
                  :id="`tbt-group-probing-${measurement.id}-page-${pageIdx + 1}`"
                  class="flex justify-center w-full shrink-0 snap-center"
                >
                  <div class="flex flex-wrap gap-3 justify-center items-center max-w-[280px]">
                    <div v-for="(t, idx) in pageTrials" :key="t.key" class="relative group">
                      <div
                        class="flex justify-center items-center w-9 h-9 text-sm font-bold rounded-full transition-all duration-200"
                        :class="[
                          t.value === true
                            ? 'bg-lime-5 text-white'
                            : t.value === false
                              ? 'bg-tomato-7 text-white'
                              : 'border-2 border-dashed border-slate-300 bg-slate-50 text-transparent',
                          sessionStore.session?.status === 'ongoing' && !activeMemberResults.submitted && t.value !== null
                            ? 'cursor-pointer'
                            : 'pointer-events-none'
                        ]"
                        @click="onRemoveProbe(pageIdx * 5 + idx)"
                      >
                        <Icon
                          v-if="t.value !== null && !activeMemberResults.submitted"
                          icon="ph:trash-bold"
                          class="w-4 h-4 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Page indicators -->
              <div v-if="totalPages > 1" class="flex gap-1.5 justify-center items-center -mt-2">
                <button
                  v-for="pageIdx in totalPages"
                  :key="pageIdx"
                  class="w-1.5 h-1.5 rounded-full transition-all duration-200"
                  :class="[
                    currentPage === pageIdx - 1
                      ? 'scale-110 bg-slate-800'
                      : 'bg-slate-300 hover:bg-slate-400',
                  ]"
                  @click="onChangePage(pageIdx - 1)"
                />
              </div>

              <!-- Buttons -->
              <div class="flex gap-4 items-center mt-2">
                <button
                  class="flex justify-center items-center w-[4.5rem] h-[4.5rem] text-2xl font-bold text-white rounded-full transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted || sessionStore.session?.status !== 'ongoing' || isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-tomato-7 hover:bg-tomato-8 shadow-md'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted || isBusy
                  "
                  @click="onRecordProbe(false)"
                >
                  <Icon icon="ph:x-bold" class="w-10 h-10 text-white" />
                </button>
                <button
                  class="flex justify-center items-center w-[4.5rem] h-[4.5rem] text-2xl font-bold text-white rounded-full transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted || sessionStore.session?.status !== 'ongoing' || isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-lime-5 hover:bg-lime-6 shadow-md'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted || isBusy
                  "
                  @click="onRecordProbe(true)"
                >
                  <Icon icon="ph:check-bold" class="w-10 h-10 text-white" />
                </button>

                <!-- Submit probing -->
                <button
                  v-if="!activeMemberResults.submitted && answeredCountOfActive >= minTrialsOfActive"
                  class="flex flex-col justify-center items-center w-[4.5rem] h-[4.5rem] text-xs font-bold text-white rounded-full shadow-md transition-all bg-light-purple-5 hover:bg-light-purple-6 active:scale-95"
                  :disabled="sessionStore.session?.status !== 'ongoing' || isBusy"
                  @click="onSubmitProbing"
                >
                  <span>Submit</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Teaching view (Square cells click cycle) -->
          <div v-else class="flex flex-col items-center w-full" :class="{ 'gap-4': !isCollapsed, 'gap-1': isCollapsed }">
            <div
              :id="`teaching-scroll-${measurement.id}`"
              class="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
              :class="{ 'w-full max-w-[280px] gap-4 pt-2 pb-3': !isCollapsed, 'max-w-[calc(100vw-6rem)] gap-2 pt-2 pb-1': isCollapsed }"
              @scroll="onScroll"
            >
              <div
                v-for="(pageTrials, pageIdx) in teachingPages"
                :key="'teaching-page-' + pageIdx"
                :id="`tbt-group-teaching-${measurement.id}-page-${pageIdx}`"
                class="flex justify-center w-full shrink-0 snap-center"
              >
                <div
                  class="flex justify-center items-center"
                  :class="{ 'max-w-[280px] flex-wrap gap-2.5': !isCollapsed, 'gap-2': isCollapsed }"
                >
                  <div v-for="t in pageTrials" :key="t.key" class="relative group">
                    <button
                      class="flex justify-center items-center rounded-lg border-2 transition-all duration-150"
                      :class="[
                        isCollapsed ? 'h-7 w-7' : 'h-9 w-9',
                        t.value === true
                          ? 'border-grass-7 bg-grass-1 text-grass-7 font-bold'
                          : t.value === false
                            ? 'border-tomato-7 bg-tomato-1 text-tomato-7 font-bold'
                            : 'border-slate-300 bg-white hover:border-slate-400',
                        sessionStore.session?.status !== 'ongoing' || isBusy ? 'pointer-events-none' : '',
                        isBusy ? 'opacity-50' : '',
                      ]"
                      @click="onCycleTeaching(t.key)"
                    >
                      <Icon v-if="t.value === true" icon="ph:check" class="text-lg" />
                      <Icon v-else-if="t.value === false" icon="ph:x" class="text-sm" />
                    </button>

                    <button
                      v-if="
                        sessionStore.session?.status === 'ongoing' &&
                        Number(t.key) >= minTrialsOfActive &&
                        !isBusy
                      "
                      class="flex absolute -top-1.5 -right-1.5 z-10 justify-center items-center w-4 h-4 text-white rounded-full shadow bg-tomato-7"
                      @click="onRemoveTeachingTrial(t.key)"
                    >
                      <Icon icon="ph:x-bold" class="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>

                  <!-- Add trial box -->
                  <button
                    v-if="
                      sessionStore.session?.status === 'ongoing' &&
                      !isBusy &&
                      pageIdx === teachingPages.length - 1 &&
                      currentTrials.slice(0, minTrialsOfActive).every((t) => t.value !== null)
                    "
                    class="flex justify-center items-center rounded-lg border-2 border-dashed transition-colors border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400 hover:bg-slate-100"
                    :class="{ 'h-9 w-9 text-lg': !isCollapsed, 'h-7 w-7 text-sm': isCollapsed }"
                    @click="onAddTeachingTrial"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Page indicators -->
            <div v-if="totalPages > 1" class="flex gap-1.5 justify-center items-center -mt-2">
              <button
                v-for="pageIdx in totalPages"
                :key="pageIdx"
                class="w-1.5 h-1.5 rounded-full transition-all duration-200"
                :class="[
                  currentPage === pageIdx - 1
                    ? 'bg-slate-800 scale-110'
                    : 'bg-slate-300 hover:bg-slate-400',
                ]"
                @click="onChangePage(pageIdx - 1)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. CARD FOOTER BUTTONS (shown only when expanded and not in decision gate) -->
    <div
      v-if="!isCollapsed && view !== 'decision-gate'"
      class="flex gap-2 p-2 shrink-0"
    >
      <!-- Move view footer -->
      <template v-if="view === 'move'">
        <button
          class="flex justify-center items-center w-9 h-9 bg-white rounded-lg border shrink-0 border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          <Icon icon="ph:caret-left-bold" />
        </button>
        <button
          class="flex justify-center items-center h-9 text-xs font-semibold text-white rounded-lg transition-all bg-light-purple-5 hover:bg-light-purple-6 grow active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          :disabled="!moveSel || isBusy"
          @click="onConfirmMove"
        >
          Move to: {{ usedTargets.find((t) => t.target_id === moveSel)?.target_code || '...' }}
        </button>
      </template>

      <!-- Description view footer -->
      <template v-else-if="view === 'desc'">
        <button
          class="flex justify-center items-center h-9 text-xs font-semibold bg-white rounded-lg border transition-all grow border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          Back to result
        </button>
      </template>

      <!-- List view footer -->
      <template v-else-if="view === 'list'">
        <button
          class="flex justify-center items-center h-9 text-xs font-semibold bg-white rounded-lg border transition-all grow border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          Back to result
        </button>
      </template>

      <!-- Regular active entry view footer -->
      <template v-else>
        <!-- Menu list button -->
        <button
          class="flex justify-center items-center w-9 h-9 bg-white rounded-lg border shrink-0 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 active:scale-95"
          title="Targets list"
          @click="view = 'list'"
        >
          <Icon icon="ph:list" class="text-lg" />
        </button>

        <!-- Move to button -->
        <button
          class="flex justify-center items-center h-9 text-xs font-semibold bg-white rounded-lg border grow border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95"
          @click="view = 'move'"
        >
          Move to
        </button>
      </template>
    </div>

    <!-- 6. DECISION GATE OVERLAY (desktop blubridge-vue design) -->
    <div
      v-if="view === 'decision-gate' && !isCollapsed"
      class="flex overflow-y-auto absolute inset-0 flex-col p-3.5 bg-black"
      :style="{ background: 'linear-gradient(180deg, #F2F8CF 0%, #FFFFFF 100%)' }"
    >
      <div class="flex relative flex-col gap-3 px-4 py-4 w-full grow">
        <img
          v-if="scoreOfActive >= targetGoal"
          src="@/assets/probing_confetti.svg"
          class="object-cover absolute bottom-0 left-0 z-0 w-full pointer-events-none"
        />
        <img
          v-if="scoreOfActive < targetGoal"
          src="@/assets/probing_failed.svg"
          class="mx-auto w-20 pointer-events-none"
          :class="{
            'absolute top-2 right-2 z-0 opacity-50': activeMember?.status === 'mastered',
          }"
        />

        <div v-if="scoreOfActive >= targetGoal" class="relative space-y-1 text-center">
          <h3 class="text-sm font-bold text-lime-800">This target has probed out.</h3>
          <p class="text-xs font-medium text-lime-700">What action would you like to take?</p>
        </div>
        <div v-else class="relative space-y-1 text-center">
          <h3 class="text-sm font-bold text-lime-800">This target doesn't meet the goal.</h3>
          <div>
            <p v-if="activeMember?.status === 'mastered'" class="text-xs font-medium text-lime-700">
              What action would you like to take?
            </p>
            <p v-else class="text-xs font-medium text-lime-700">
              Do you want to begin teaching now or postpone it to the next session?
            </p>
          </div>
        </div>

        <div class="flex relative flex-col gap-2">
          <div
            v-for="opt in gateOptions"
            :key="opt.id"
            class="flex flex-col gap-2 justify-center items-center p-3 text-center bg-white rounded-lg border shadow-sm transition-all duration-300 cursor-pointer"
            :class="[gateSel?.id === opt.id ? 'border-lime-600 bg-lime-50/50' : 'border-slate-200 bg-white']"
            @click="gateSel = opt"
          >
            <div class="flex gap-2 items-center">
              <span class="text-xs font-medium text-slate-800">{{ opt.title }}</span>
              <AppChip v-if="opt.status" :chip="opt.status" />
            </div>
            <span v-if="opt.message" class="text-xs text-slate-500">{{ opt.message }}</span>
          </div>
        </div>
      </div>

      <!-- Gate Footer -->
      <div class="grid grid-cols-2 gap-2">
        <AppButton class="!px-0" kind="plain" color="lime" @click="onCancelDecision">
          Back to Session
        </AppButton>
        <AppButton
          color="lime"
          :loading="saveLoading"
          :disabled="!gateSel || saveLoading"
          @click="saveDecision"
        >
          {{ saveLoading ? 'Saving...' : 'Save' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>
