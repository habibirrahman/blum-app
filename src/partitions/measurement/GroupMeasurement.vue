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

const titleLabel = computed(() =>
  groupType.value === 'percentage' ? 'Group Percentage' : 'Group TBT'
)
const subtitleLabel = computed(() =>
  groupType.value === 'percentage'
    ? 'Grouped targets · Percentage'
    : 'Grouped targets · Trial-by-Trial'
)
const actionNotesPrefix = computed(() =>
  groupType.value === 'percentage' ? 'Group Percentage' : 'Group TBT'
)

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
  const isProbe =
    res.decision !== 'acq-teach' && res.decision !== 'fail-teach' && res.probing !== null
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
      (Object.values(probingMap).some((v) => v !== null) ||
        res?.submitted ||
        res?.decision !== null)

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
  const payload: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    params: { measurement: { results: resultsState.value } },
    dataResult: { ...props.measurement, results: resultsState.value },
    lastData: { ...props.measurement }
  }

  saving.value = true
  emit('toggle-updated', false)
  const { success, data, message } = await sessionStore.updateMeasurementResults(payload)
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
  <div class="flex h-full grow flex-col justify-between overflow-hidden">
    <div v-if="saving || saveLoading" class="absolute right-16 top-4">
      <Icon icon="mingcute:loading-fill" class="animate-spin text-2xl text-light-purple-5" />
    </div>

    <!-- 1. Tabs Row (Ratios) - shown only when expanded -->
    <div
      v-if="!isCollapsed"
      class="scrollbar-hide flex w-full shrink-0 items-center gap-1.5 overflow-x-auto px-2 py-2"
      :class="[usedTargets.length > 6 ? 'justify-start' : 'justify-center']"
    >
      <button
        v-for="member in usedTargets"
        :key="member.target_id"
        class="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-xs font-semibold transition-all duration-200"
        :class="[
          activeMemberId === member.target_id
            ? getMemberPhase(member.target_id) === 'probe'
              ? 'border-lime-7 bg-lime-100 text-lime-700 shadow-sm'
              : 'border-light-purple-5 bg-purple-50 text-light-purple-5 shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        ]"
        @click="switchToMember(member.target_id)"
      >
        <!-- fill overlay percentage -->
        <div
          class="pointer-events-none absolute bottom-0 left-0 right-0 transition-all duration-300"
          :style="{
            height: getMemberFillPct(member.target_id) + '%',
            backgroundColor:
              getMemberPhase(member.target_id) === 'probe'
                ? 'rgba(101, 163, 13, 0.1)'
                : 'rgba(139, 92, 246, 0.1)'
          }"
        />
        <span class="pointer-events-none relative">{{ member.target_code }}</span>
      </button>
    </div>

    <!-- Floating Probing Circles Popup when Collapsed -->
    <div
      v-if="isCollapsed && isProbingPhase && (showPopup || saveLoading)"
      class="absolute bottom-full left-1/2 z-50 mb-2 flex w-64 -translate-x-1/2 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-lg transition-all"
    >
      <div class="flex max-w-full items-center gap-2 overflow-x-auto">
        <div v-for="(t, idx) in currentTrials" :key="t.key" class="group relative shrink-0">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-200"
            :class="[
              t.value === true
                ? 'cursor-pointer bg-lime-5 text-white'
                : t.value === false
                  ? 'cursor-pointer bg-tomato-7 text-white'
                  : 'pointer-events-none border-2 border-dashed border-slate-300 bg-slate-50 text-transparent',
              sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted
                ? 'pointer-events-none'
                : ''
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
    <div
      class="relative flex grow flex-col justify-between overflow-hidden bg-white"
      :class="{ 'p-3': !isCollapsed, 'px-2 py-1': isCollapsed }"
    >
      <!-- Descriptions view overlay -->
      <div
        v-if="view === 'desc' && !isCollapsed"
        class="flex h-full grow flex-col justify-between overflow-y-auto bg-white p-1"
      >
        <div class="space-y-3">
          <div class="border-b border-slate-100 pb-2">
            <div class="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Icon icon="ph:copy" class="text-lg text-slate-400" />
              {{ titleLabel }}
            </div>
            <div class="mt-0.5 text-xs text-slate-500">{{ subtitleLabel }}</div>
          </div>

          <div class="space-y-4 pt-1">
            <div v-for="member in usedTargets" :key="member.target_id" class="space-y-1">
              <div class="text-xs font-bold text-slate-800">
                {{ member.target_code }} - {{ member.target_name }}
              </div>
              <div class="text-xs text-slate-600">
                Goal: {{ member.goal ?? measurement.target?.goal ?? 0 }}%
              </div>
              <div class="text-xs text-slate-600">
                <template v-if="groupType === 'tbt'">
                  Minimum number of trials:
                  {{ member.number_of_trial || member.probing_number_of_trial || 2 }} trial(s)
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
              <div v-else class="whitespace-pre-line text-xs text-slate-500">
                {{ member.description }}
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 border-t border-slate-100 pt-3">
          <button
            class="h-9 w-full rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
            @click="view = 'entry'"
          >
            Close
          </button>
        </div>
      </div>

      <!-- 1. MEMBER LIST VIEW (hidden when collapsed) -->
      <div
        v-else-if="view === 'list' && !isCollapsed"
        class="flex grow flex-col overflow-y-auto pb-4"
      >
        <div class="mb-2 text-xs font-bold text-slate-800">Target Members List</div>
        <div class="divide-y divide-slate-100 border-t border-slate-100">
          <div
            v-for="e in listEntries"
            :key="e.id + '-' + e.probing"
            class="flex cursor-pointer items-center justify-between py-2.5 transition-colors hover:bg-slate-50"
            @click="switchToMember(e.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-slate-800">{{ e.target_code }}</span>
              <span class="max-w-40 truncate text-xs text-slate-500">{{ e.target_name }}</span>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-bold"
                :class="[e.probing ? 'bg-lime-100 text-lime-700' : 'bg-slate-100 text-slate-700']"
              >
                {{ e.score }}%
              </span>
              <span
                v-if="e.probing"
                class="rounded bg-lime-2 px-1.5 py-0.5 text-[10px] font-medium text-lime-7"
              >
                Probing
              </span>
              <Icon v-if="!e.locked" icon="ph:pencil-simple" class="text-sm text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- 2. SWITCH MEMBER OVERLAY (hidden when collapsed) -->
      <div
        v-else-if="view === 'move' && !isCollapsed"
        class="flex grow flex-col justify-between overflow-hidden"
      >
        <div class="flex grow flex-col items-center justify-center gap-4 py-6">
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
          <div class="flex w-full flex-col items-center gap-2">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Next</div>
            <div
              class="scrollbar-hide mt-1 flex w-full gap-2 overflow-x-auto px-4 py-1"
              :class="[
                usedTargets.length > 5 ? 'flex-nowrap justify-start' : 'flex-wrap justify-center'
              ]"
            >
              <button
                v-for="member in usedTargets"
                :key="'move-' + member.target_id"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-all duration-200"
                :class="[
                  moveSel === member.target_id
                    ? 'scale-105 border-light-purple-5 bg-purple-50 text-light-purple-5 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
      <div v-else class="flex grow flex-col justify-between overflow-hidden">
        <div
          class="flex shrink-0 px-1"
          :class="{
            'mb-2 flex-col gap-2 pb-2': !isCollapsed,
            'mb-1 flex-row items-center justify-between pb-1': isCollapsed
          }"
        >
          <div class="flex w-full items-center justify-between">
            <div class="flex items-center gap-1.5 text-xs">
              <span class="text-slate-500">Current</span>
              <span class="font-bold text-light-purple-5">{{ activeMember?.target_code }}</span>
              <button
                v-if="isCollapsed"
                class="hover:text-light-purple-6 ml-1 font-semibold text-light-purple-5 underline"
                @click="showMemberSelector = !showMemberSelector"
              >
                Change
              </button>
            </div>

            <div
              class="flex items-center gap-3 text-xs"
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
          <div v-if="!isCollapsed" class="flex shrink-0 items-center justify-between pt-1">
            <span
              v-if="isProbingPhase"
              class="rounded-full bg-lime-100 px-2 py-0.5 text-xs font-bold text-lime-700"
            >
              Probing
            </span>
            <span
              v-if="activeMemberResults.decision"
              class="rounded-full px-2 py-0.5 text-xs font-bold"
              :class="[
                activeMemberResults.decision === 'mastered'
                  ? 'bg-lime-100 text-lime-700'
                  : 'bg-amber-100 text-amber-800'
              ]"
            >
              {{ activeMemberResults.decision === 'mastered' ? 'Mastered' : 'In acquisition' }}
            </span>
          </div>
        </div>

        <!-- Member Selector Overlay when Change is clicked -->
        <div
          v-if="showMemberSelector"
          class="flex w-full grow flex-col items-center justify-center gap-2 py-2"
        >
          <div class="text-xs font-medium text-slate-500">Select a target:</div>
          <div
            class="scrollbar-hide mt-1 flex w-full gap-2 overflow-x-auto px-4 py-1"
            :class="[
              usedTargets.length > 5 ? 'flex-nowrap justify-start' : 'flex-wrap justify-center'
            ]"
          >
            <button
              v-for="member in usedTargets"
              :key="'move-' + member.target_id"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-all duration-200"
              :class="[
                moveSel === member.target_id
                  ? 'scale-105 border-light-purple-5 bg-purple-50 text-light-purple-5 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              ]"
              @click="
                () => {
                  switchToMember(member.target_id)
                  showMemberSelector = false
                }
              "
            >
              {{ member.target_code }}
            </button>
          </div>
        </div>

        <!-- Scrollable Trials Area (shown when member selector is closed) -->
        <div
          v-else
          class="flex w-full grow flex-col items-center justify-center"
          :class="{ 'overflow-y-auto py-2': !isCollapsed, 'py-0': isCollapsed }"
        >
          <!-- Probing view -->
          <div v-if="isProbingPhase" class="w-full">
            <!-- Collapsed Probing Row (when isCollapsed = true) -->
            <div v-if="isCollapsed" class="w-full">
              <!-- AppChip when submitted with decision -->
              <div
                v-if="activeMemberResults.submitted && activeMemberResults.decision"
                class="my-1 flex justify-center"
              >
                <AppChip :chip="activeMemberResults.decision" />
              </div>
              <div class="flex items-center justify-center gap-3 py-1">
                <button
                  class="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-xl font-bold text-white transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted ||
                    sessionStore.session?.status !== 'ongoing' ||
                    isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-tomato-7 shadow-md hover:bg-tomato-8'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' ||
                    activeMemberResults.submitted ||
                    isBusy
                  "
                  @click="onRecordProbe(false)"
                >
                  <Icon icon="ph:x-bold" class="h-10 w-10 text-white" />
                </button>
                <button
                  class="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-xl font-bold text-white transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted ||
                    sessionStore.session?.status !== 'ongoing' ||
                    isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-lime-5 shadow-md hover:bg-lime-6'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' ||
                    activeMemberResults.submitted ||
                    isBusy
                  "
                  @click="onRecordProbe(true)"
                >
                  <Icon icon="ph:check-bold" class="h-10 w-10 text-white" />
                </button>
                <button
                  v-if="
                    !activeMemberResults.submitted && answeredCountOfActive >= minTrialsOfActive
                  "
                  class="hover:bg-light-purple-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-light-purple-5 px-4 text-xs font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-40"
                  :disabled="sessionStore.session?.status !== 'ongoing' || isBusy"
                  @click="onSubmitProbing"
                >
                  Submit
                </button>
              </div>
            </div>

            <!-- Full Probing View (when isCollapsed = false) -->
            <div v-else class="flex w-full flex-col items-center gap-4">
              <div
                :id="`probing-scroll-${measurement.id}`"
                class="scrollbar-hide flex w-full max-w-[280px] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3"
                @scroll="onScroll"
              >
                <div
                  v-for="(pageTrials, pageIdx) in probingPages"
                  :key="'probing-page-' + pageIdx"
                  :id="`tbt-group-probing-${measurement.id}-page-${pageIdx + 1}`"
                  class="flex w-full shrink-0 snap-center justify-center"
                >
                  <div class="flex max-w-[280px] flex-wrap items-center justify-center gap-3">
                    <div v-for="(t, idx) in pageTrials" :key="t.key" class="group relative">
                      <div
                        class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-200"
                        :class="[
                          t.value === true
                            ? 'bg-lime-5 text-white'
                            : t.value === false
                              ? 'bg-tomato-7 text-white'
                              : 'border-2 border-dashed border-slate-300 bg-slate-50 text-transparent',
                          sessionStore.session?.status === 'ongoing' &&
                          !activeMemberResults.submitted &&
                          t.value !== null
                            ? 'cursor-pointer'
                            : 'pointer-events-none'
                        ]"
                        @click="onRemoveProbe(pageIdx * 5 + idx)"
                      >
                        <Icon
                          v-if="t.value !== null && !activeMemberResults.submitted"
                          icon="ph:trash-bold"
                          class="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Page indicators -->
              <div v-if="totalPages > 1" class="-mt-2 flex items-center justify-center gap-1.5">
                <button
                  v-for="pageIdx in totalPages"
                  :key="pageIdx"
                  class="h-1.5 w-1.5 rounded-full transition-all duration-200"
                  :class="[
                    currentPage === pageIdx - 1
                      ? 'scale-110 bg-slate-800'
                      : 'bg-slate-300 hover:bg-slate-400'
                  ]"
                  @click="onChangePage(pageIdx - 1)"
                />
              </div>

              <!-- Buttons -->
              <div class="mt-2 flex items-center gap-4">
                <button
                  class="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-2xl font-bold text-white transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted ||
                    sessionStore.session?.status !== 'ongoing' ||
                    isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-tomato-7 shadow-md hover:bg-tomato-8'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' ||
                    activeMemberResults.submitted ||
                    isBusy
                  "
                  @click="onRecordProbe(false)"
                >
                  <Icon icon="ph:x-bold" class="h-10 w-10 text-white" />
                </button>
                <button
                  class="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-2xl font-bold text-white transition-all active:scale-95"
                  :class="[
                    activeMemberResults.submitted ||
                    sessionStore.session?.status !== 'ongoing' ||
                    isBusy
                      ? 'pointer-events-none bg-slate-5 opacity-50 shadow-none'
                      : 'bg-lime-5 shadow-md hover:bg-lime-6'
                  ]"
                  :disabled="
                    sessionStore.session?.status !== 'ongoing' ||
                    activeMemberResults.submitted ||
                    isBusy
                  "
                  @click="onRecordProbe(true)"
                >
                  <Icon icon="ph:check-bold" class="h-10 w-10 text-white" />
                </button>

                <!-- Submit probing -->
                <button
                  v-if="
                    !activeMemberResults.submitted && answeredCountOfActive >= minTrialsOfActive
                  "
                  class="hover:bg-light-purple-6 flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full bg-light-purple-5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
                  :disabled="sessionStore.session?.status !== 'ongoing' || isBusy"
                  @click="onSubmitProbing"
                >
                  <span>Submit</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Teaching view (Square cells click cycle) -->
          <div
            v-else
            class="flex w-full flex-col items-center"
            :class="{ 'gap-4': !isCollapsed, 'gap-1': isCollapsed }"
          >
            <div
              :id="`teaching-scroll-${measurement.id}`"
              class="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
              :class="{
                'w-full max-w-[280px] gap-4 pb-3 pt-2': !isCollapsed,
                'max-w-[calc(100vw-6rem)] gap-2 pb-1 pt-2': isCollapsed
              }"
              @scroll="onScroll"
            >
              <div
                v-for="(pageTrials, pageIdx) in teachingPages"
                :key="'teaching-page-' + pageIdx"
                :id="`tbt-group-teaching-${measurement.id}-page-${pageIdx}`"
                class="flex w-full shrink-0 snap-center justify-center"
              >
                <div
                  class="flex items-center justify-center"
                  :class="{ 'max-w-[280px] flex-wrap gap-2.5': !isCollapsed, 'gap-2': isCollapsed }"
                >
                  <div v-for="t in pageTrials" :key="t.key" class="group relative">
                    <button
                      class="flex items-center justify-center rounded-lg border-2 transition-all duration-150"
                      :class="[
                        isCollapsed ? 'h-7 w-7' : 'h-9 w-9',
                        t.value === true
                          ? 'border-grass-7 bg-grass-1 font-bold text-grass-7'
                          : t.value === false
                            ? 'border-tomato-7 bg-tomato-1 font-bold text-tomato-7'
                            : 'border-slate-300 bg-white hover:border-slate-400',
                        sessionStore.session?.status !== 'ongoing' || isBusy
                          ? 'pointer-events-none'
                          : '',
                        isBusy ? 'opacity-50' : ''
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
                      class="absolute -right-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-tomato-7 text-white shadow"
                      @click="onRemoveTeachingTrial(t.key)"
                    >
                      <Icon icon="ph:x-bold" class="h-2.5 w-2.5 text-white" />
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
                    class="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-slate-400 hover:bg-slate-100"
                    :class="{ 'h-9 w-9 text-lg': !isCollapsed, 'h-7 w-7 text-sm': isCollapsed }"
                    @click="onAddTeachingTrial"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Page indicators -->
            <div v-if="totalPages > 1" class="-mt-2 flex items-center justify-center gap-1.5">
              <button
                v-for="pageIdx in totalPages"
                :key="pageIdx"
                class="h-1.5 w-1.5 rounded-full transition-all duration-200"
                :class="[
                  currentPage === pageIdx - 1
                    ? 'scale-110 bg-slate-800'
                    : 'bg-slate-300 hover:bg-slate-400'
                ]"
                @click="onChangePage(pageIdx - 1)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. CARD FOOTER BUTTONS (shown only when expanded and not in decision gate) -->
    <div v-if="!isCollapsed && view !== 'decision-gate'" class="flex shrink-0 gap-2 p-2">
      <!-- Move view footer -->
      <template v-if="view === 'move'">
        <button
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          <Icon icon="ph:caret-left-bold" />
        </button>
        <button
          class="hover:bg-light-purple-6 flex h-9 grow items-center justify-center rounded-lg bg-light-purple-5 text-xs font-semibold text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          :disabled="!moveSel || isBusy"
          @click="onConfirmMove"
        >
          Move to: {{ usedTargets.find((t) => t.target_id === moveSel)?.target_code || '...' }}
        </button>
      </template>

      <!-- Description view footer -->
      <template v-else-if="view === 'desc'">
        <button
          class="flex h-9 grow items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          Back to result
        </button>
      </template>

      <!-- List view footer -->
      <template v-else-if="view === 'list'">
        <button
          class="flex h-9 grow items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          Back to result
        </button>
      </template>

      <!-- Regular active entry view footer -->
      <template v-else>
        <!-- Menu list button -->
        <button
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 active:scale-95"
          title="Targets list"
          @click="view = 'list'"
        >
          <Icon icon="ph:list" class="text-lg" />
        </button>

        <!-- Move to button -->
        <button
          class="flex h-9 grow items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95"
          @click="view = 'move'"
        >
          Move to
        </button>
      </template>
    </div>

    <!-- 6. DECISION GATE OVERLAY (desktop blubridge-vue design) -->
    <div
      v-if="view === 'decision-gate' && !isCollapsed"
      class="absolute inset-0 flex flex-col overflow-y-auto bg-black p-3.5"
      :style="{ background: 'linear-gradient(180deg, #F2F8CF 0%, #FFFFFF 100%)' }"
    >
      <div class="relative flex w-full grow flex-col gap-3 px-4 py-4">
        <img
          v-if="scoreOfActive >= targetGoal"
          src="@/assets/probing_confetti.svg"
          class="pointer-events-none absolute bottom-0 left-0 z-0 w-full object-cover"
        />
        <img
          v-if="scoreOfActive < targetGoal"
          src="@/assets/probing_failed.svg"
          class="pointer-events-none mx-auto w-20"
          :class="{
            'absolute right-2 top-2 z-0 opacity-50': activeMember?.status === 'mastered'
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

        <div class="relative flex flex-col gap-2">
          <div
            v-for="opt in gateOptions"
            :key="opt.id"
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-white p-3 text-center shadow-sm transition-all duration-300"
            :class="[
              gateSel?.id === opt.id ? 'border-lime-600 bg-lime-50/50' : 'border-slate-200 bg-white'
            ]"
            @click="gateSel = opt"
          >
            <div class="flex items-center gap-2">
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
