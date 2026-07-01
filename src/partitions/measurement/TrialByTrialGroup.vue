<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { useAppStore } from '@/stores/app.store'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import axios from 'axios'
import type { Measurement } from '@/lib/types'

defineOptions({ name: 'TrialByTrialGroup' })

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  isCollapsed: boolean
}

interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
  (e: 'after-commit'): void
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const sessionStore = useSessionStore()
const appStore = useAppStore()
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

const resultsState = ref<Record<string, MemberResult>>({})
const activeMemberId = ref<number>(0)
const view = ref<'list' | 'entry' | 'move' | 'decision-gate'>('entry')
const moveSel = ref<number | null>(null)
const gateSel = ref<GateOption | null>(null)
const saveLoading = ref(false)
const saving = ref(false)

const isBusy = computed(() => saving.value || saveLoading.value)

function isMemberProbing(memberId: number) {
  const res = resultsState.value[String(memberId)]
  return res && res.probing !== null
}

const targetGoal = computed(() => Number(props.measurement.target?.goal || 0))
const usedTargets = computed(() => props.measurement.used_targets || [])

const activeMember = computed(() =>
  usedTargets.value.find((t) => t.target_id === activeMemberId.value)
)

const activeMemberResults = computed(() => {
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

const isProbingPhase = computed(() => {
  const res = activeMemberResults.value
  if (res.decision === 'acq-teach' || res.decision === 'fail-teach') {
    return false
  }
  return res.probing !== null
})

const currentTrials = computed(() => {
  const res = activeMemberResults.value
  const map = isProbingPhase.value ? res.probing : res.teaching
  if (!map) return []
  return Object.keys(map)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({
      key,
      value: map[key]
    }))
})

// Pagination
const currentPage = ref(0)
const pageSize = computed(() => (isProbingPhase.value ? 5 : 25))
const totalPages = computed(() => {
  const len = currentTrials.value.length
  return Math.max(1, Math.ceil(len / pageSize.value))
})

const paginatedTrials = computed(() => {
  const start = currentPage.value * pageSize.value
  const end = start + pageSize.value
  return currentTrials.value.slice(start, end)
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
      activeMemberId.value = newVal[0].target_id
    }
  },
  { immediate: true }
)

const minTrialsOfActive = computed(() => {
  if (isProbingPhase.value) {
    return activeMember.value?.probing_number_of_trial || 3
  }
  return activeMember.value?.number_of_trial || 2
})

const answeredCountOfActive = computed(() => {
  return currentTrials.value.filter((t) => t.value !== null).length
})

const scoreOfActive = computed(() => {
  const answered = currentTrials.value.filter((t) => t.value !== null)
  if (answered.length === 0) return 0
  const correct = answered.filter((t) => t.value === true).length
  return Math.round((correct / answered.length) * 100)
})

const gateOptions = computed(() => {
  if (!activeMember.value) return []
  const isPending = activeMember.value.status === 'pending'
  const isMastered = activeMember.value.status === 'mastered'
  const passed = scoreOfActive.value >= targetGoal.value

  const passedOptions = [
    {
      id: 'pass_and_mastered',
      visible: true,
      marked_as: 'mastered',
      title: 'Mark as',
      status: 'Mastered',
      message: 'No further teaching needed. The target will be added to the cumulative graph.'
    },
    {
      id: 'pass_and_conduct_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: isPending ? 'Mark as' : 'Keep as',
      status: 'In acquisition',
      message: 'Conduct teaching immediately.'
    },
    {
      id: 'pass_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: isPending ? 'Mark as' : 'Keep as',
      status: 'In acquisition',
      message: 'Postpone teaching to the next session.'
    }
  ]

  const failedOptions = [
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

  const passedInMastered = [
    {
      id: 'pass_and_keep_mastered',
      visible: true,
      marked_as: 'mastered',
      title: 'Keep as',
      status: 'Mastered',
      message: 'No further action is required.'
    },
    {
      id: 'pass_and_conduct_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'In acquisition',
      message: 'Conduct teaching immediately.'
    },
    {
      id: 'pass_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'In acquisition',
      message: 'Postpone teaching to the next session.'
    }
  ]

  const failedInMastered = [
    {
      id: 'fail_and_restart_teaching',
      visible: false,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'In acquisition',
      message: 'Restart teaching immediately.'
    },
    {
      id: 'fail_and_postpone_teaching',
      visible: true,
      marked_as: 'in_progress',
      title: 'Reopen target to',
      status: 'In acquisition',
      message: 'Postpone teaching to the next session.'
    },
    {
      id: 'fail_and_keep_mastered',
      visible: true,
      marked_as: 'mastered',
      title: 'Keep as',
      status: 'Mastered',
      message: 'No further action is required.'
    }
  ]

  if (isMastered) {
    return passed ? passedInMastered : failedInMastered
  } else {
    return passed ? passedOptions : failedOptions
  }
})

function getStatusColor(status?: string) {
  if (!status) return 'bg-slate-100 text-slate-800'
  const s = status.toLowerCase()
  if (s.includes('mastered')) return 'text-grass-8 bg-grass-2'
  if (s.includes('progress') || s.includes('acquisition')) return 'text-tulip-8 bg-tulip-2'
  return 'bg-slate-100 text-slate-800'
}

interface ListEntry {
  id: number
  target_code: string
  target_name: string
  score: number
  locked: boolean
  probing: boolean
}

const listEntries = computed<ListEntry[]>(() => {
  const out: ListEntry[] = []
  usedTargets.value.forEach((member) => {
    const memberIdStr = String(member.target_id)
    const res = resultsState.value[memberIdStr]
    if (!res) return

    const scoreOfMap = (map: Record<string, boolean | null> | null) => {
      if (!map) return 0
      const vals = Object.values(map).filter((v) => v !== null)
      if (vals.length === 0) return 0
      const correct = vals.filter((v) => v === true).length
      return Math.round((correct / vals.length) * 100)
    }

    if (res.probing !== null) {
      out.push({
        id: member.target_id,
        target_code: member.target_code,
        target_name: member.target_name,
        score: scoreOfMap(res.probing),
        locked: res.submitted,
        probing: true
      })
      if (res.decision === 'acq-teach' || res.decision === 'fail-teach') {
        out.push({
          id: member.target_id,
          target_code: member.target_code,
          target_name: member.target_name,
          score: scoreOfMap(res.teaching),
          locked: false,
          probing: false
        })
      }
    } else {
      out.push({
        id: member.target_id,
        target_code: member.target_code,
        target_name: member.target_name,
        score: scoreOfMap(res.teaching),
        locked: false,
        probing: false
      })
    }
  })
  return out
})

function getMemberPhase(memberId: number) {
  const memberRes = resultsState.value[String(memberId)]
  if (!memberRes) return 'teach'
  if (memberRes.decision === 'acq-teach' || memberRes.decision === 'fail-teach') {
    return 'teach'
  }
  return memberRes.probing !== null ? 'probe' : 'teach'
}

function getMemberTrials(memberId: number) {
  const memberRes = resultsState.value[String(memberId)]
  if (!memberRes) return []
  const phase = getMemberPhase(memberId)
  const trialsMap = phase === 'probe' ? memberRes.probing : memberRes.teaching
  if (!trialsMap) return []
  return Object.keys(trialsMap).map((key) => ({
    key,
    value: trialsMap[key]
  }))
}

function getMemberAnsweredCount(memberId: number) {
  const trials = getMemberTrials(memberId)
  return trials.filter((t) => t.value !== null).length
}

function getMemberMinTrials(memberId: number) {
  const member = usedTargets.value.find((t) => t.target_id === memberId)
  if (!member) return 2
  const phase = getMemberPhase(memberId)
  return phase === 'probe' ? member.probing_number_of_trial || 3 : member.number_of_trial || 2
}

function getMemberScore(memberId: number) {
  const trials = getMemberTrials(memberId)
  const answered = trials.filter((t) => t.value !== null)
  if (answered.length === 0) return 0
  const correct = answered.filter((t) => t.value === true).length
  return Math.round((correct / answered.length) * 100)
}

function getMemberFillPct(memberId: number) {
  const answered = getMemberAnsweredCount(memberId)
  const min = getMemberMinTrials(memberId)
  return Math.min(100, Math.round((answered / min) * 100))
}

async function saveResultsToServer() {
  if (!sessionStore.session?.status) return

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

const debouncedSaveResults = debounce(saveResultsToServer, 1000)

function ensureScaffoldedResults() {
  const state = props.measurementResults
    ? JSON.parse(JSON.stringify(props.measurementResults))
    : {}
  resultsState.value = state
}

function switchToMember(memberId: number) {
  activeMemberId.value = memberId
  view.value = 'entry'
  moveSel.value = null
  gateSel.value = null
}

function onRecordProbe(val: boolean) {
  if (sessionStore.session?.status !== 'ongoing') return
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

  // record activity
  sessionStore.addSessionActivity({
    action_label: `tbt_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `Group TBT Target Member ${activeMember.value?.target_code} Probing: ${val}`,
    timestamp: new Date().toISOString()
  })

  debouncedSaveResults()
  autoAlignPage()
}

function onRecordTeaching(val: boolean) {
  if (sessionStore.session?.status !== 'ongoing') return
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes || !memberRes.teaching) return

  const teaching = memberRes.teaching
  const sortedKeys = Object.keys(teaching).sort((a, b) => Number(a) - Number(b))
  const firstNullKey = sortedKeys.find((k) => teaching[k] === null)

  if (firstNullKey !== undefined) {
    memberRes.teaching[firstNullKey] = val
  } else {
    const nextKey = sortedKeys.length > 0 ? String(Math.max(...sortedKeys.map(Number)) + 1) : '0'
    memberRes.teaching[nextKey] = val
  }

  // record activity
  sessionStore.addSessionActivity({
    action_label: `tbt_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `Group TBT Target Member ${activeMember.value?.target_code} Teaching: ${val}`,
    timestamp: new Date().toISOString()
  })

  debouncedSaveResults()
  autoAlignPage()
}

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

  // record activity
  sessionStore.addSessionActivity({
    action_label: `tbt_delete`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `Group TBT Target Member ${activeMember.value?.target_code} Probing trial deleted`,
    timestamp: new Date().toISOString()
  })

  debouncedSaveResults()
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

  // record activity
  sessionStore.addSessionActivity({
    action_label: `tbt_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `Group TBT Target Member ${activeMember.value?.target_code} Teaching cycle: ${nextVal}`,
    timestamp: new Date().toISOString()
  })

  debouncedSaveResults()
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

  // record activity
  sessionStore.addSessionActivity({
    action_label: `tbt_add`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `Group TBT Target Member ${activeMember.value?.target_code} Teaching trial added`,
    timestamp: new Date().toISOString()
  })

  debouncedSaveResults()
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

  // record activity
  sessionStore.addSessionActivity({
    action_label: `tbt_delete`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: resultsState.value } },
    notes: `Group TBT Target Member ${activeMember.value?.target_code} Teaching trial deleted`,
    timestamp: new Date().toISOString()
  })

  debouncedSaveResults()
}

function onSubmitProbing() {
  const memberIdStr = String(activeMemberId.value)
  const memberRes = resultsState.value[memberIdStr]
  if (!memberRes) return

  memberRes.submitted = true
  view.value = 'decision-gate'
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
  } else if (opt.id === 'fail_and_start_teaching' || opt.id === 'fail_and_restart_teaching') {
    choiceKey = 'fail-teach'
  } else if (opt.id === 'fail_and_next' || opt.id === 'fail_and_postpone_teaching') {
    choiceKey = 'fail-next'
  }

  memberRes.decision = choiceKey

  if (choiceKey === 'acq-teach' || choiceKey === 'fail-teach') {
    const minTeaching = activeMember.value?.number_of_trial || 2
    const freshTeaching: Record<string, boolean | null> = {}
    for (let i = 0; i < minTeaching; i++) {
      freshTeaching[String(i)] = null
    }
    memberRes.teaching = freshTeaching
  } else {
    memberRes.teaching = null
  }

  view.value = 'entry'
  gateSel.value = null

  await saveResultsToServer()
}

function onConfirmMove() {
  if (moveSel.value) {
    switchToMember(moveSel.value)
  }
}

watch(
  () => props.measurementResults,
  () => {
    ensureScaffoldedResults()
  },
  { deep: true }
)

onMounted(() => {
  ensureScaffoldedResults()
  if (usedTargets.value.length > 0) {
    activeMemberId.value = usedTargets.value[0].target_id
  }
})

onBeforeUnmount(() => {
  debouncedSaveResults.cancel()
})
</script>

<template>
  <div class="flex h-full grow flex-col justify-between overflow-hidden">
    <div
      v-if="saving || saveLoading"
      class="absolute right-16 top-4 z-10"
    >
      <Icon icon="mingcute:loading-fill" class="animate-spin text-2xl text-light-purple-5" />
    </div>

    <!-- 1. Tabs Row (Ratios) -->
    <div class="flex shrink-0 items-center justify-center gap-1.5 overflow-x-auto px-2 py-2 border-b border-slate-100 bg-slate-50/50">
      <button
        v-for="member in usedTargets"
        :key="member.target_id"
        class="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border text-xs font-semibold transition-all duration-200"
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
          class="absolute right-0 bottom-0 left-0 transition-all duration-300"
          :style="{
            height: getMemberFillPct(member.target_id) + '%',
            backgroundColor: getMemberPhase(member.target_id) === 'probe' ? 'rgba(101, 163, 13, 0.1)' : 'rgba(139, 92, 246, 0.1)'
          }"
        />
        <span class="relative z-10">{{ member.target_code }}</span>
      </button>
    </div>

    <!-- MAIN DISPLAY CONTAINER -->
    <div class="relative flex grow flex-col justify-between overflow-hidden bg-white p-3">
      <!-- 1. MEMBER LIST VIEW -->
      <div
        v-if="view === 'list'"
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
                class="bg-lime-2 text-lime-7 rounded px-1.5 py-0.5 text-[10px] font-medium"
              >
                Probing
              </span>
              <Icon v-if="!e.locked" icon="ph:pencil-simple" class="text-sm text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- 2. SWITCH MEMBER OVERLAY -->
      <div v-else-if="view === 'move'" class="flex grow flex-col justify-between overflow-hidden">
        <div class="flex grow flex-col items-center justify-center gap-4 py-6">
          <div class="flex flex-col items-center">
            <div class="text-3xl font-extrabold text-slate-800">{{ scoreOfActive }}%</div>
            <div class="mt-1 text-xs font-medium text-slate-400">Score</div>
            <button
              v-if="activeMemberResults.submitted && !activeMemberResults.decision"
              class="text-light-purple-5 mt-1.5 text-xs hover:underline font-semibold"
              @click="view = 'decision-gate'"
            >
              Change
            </button>
          </div>
          <div class="my-2 w-full max-w-[200px] border-t border-slate-100" />
          <div class="flex flex-col items-center gap-2">
            <div class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Next
            </div>
            <div class="mt-1 flex flex-wrap justify-center gap-2">
              <button
                v-for="member in usedTargets"
                :key="'move-' + member.target_id"
                class="flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-bold transition-all duration-200"
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
          </div>
        </div>
      </div>

      <!-- 3. DECISION GATE OVERLAY -->
      <div
        v-else-if="view === 'decision-gate'"
        class="absolute inset-0 z-50 flex flex-col justify-between overflow-y-auto p-3.5 bg-gradient-to-b from-lime-50 to-white"
      >
        <div class="relative z-10 flex w-full grow flex-col gap-3 px-2 py-4">
          <div v-if="scoreOfActive >= targetGoal" class="space-y-1 text-center">
            <Icon icon="ph:check-circle-fill" class="mx-auto text-4xl text-grass-7" />
            <h3 class="text-sm font-bold text-lime-800">This member target has probed out ({{ scoreOfActive }}%).</h3>
            <p class="text-xs font-medium text-lime-700">What action would you like to take?</p>
          </div>
          <div v-else class="space-y-1 text-center">
            <Icon icon="ph:warning-circle-fill" class="mx-auto text-4xl text-tomato-7" />
            <h3 class="text-sm font-bold text-lime-800">Goal not met ({{ scoreOfActive }}% vs {{ targetGoal }}%).</h3>
            <p class="text-xs font-medium text-lime-700">Do you want to begin teaching now or postpone it?</p>
          </div>

          <div class="flex flex-col gap-2 mt-4">
            <div
              v-for="opt in gateOptions"
              :key="opt.id"
              class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center shadow-sm transition-all duration-300"
              :class="[gateSel?.id === opt.id ? 'border-lime-600 bg-lime-50/50' : 'border-slate-200 bg-white']"
              @click="gateSel = opt"
            >
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-slate-800">{{ opt.title }}</span>
                <div
                  v-if="opt.status"
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="getStatusColor(opt.status)"
                >
                  {{ opt.status }}
                </div>
              </div>
              <span v-if="opt.message" class="text-xs text-slate-500">{{ opt.message }}</span>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-between border-t border-slate-100 px-2 pt-2">
          <button
            class="text-xs font-bold text-slate-600 hover:text-slate-950"
            @click="view = 'entry'"
          >
            Cancel
          </button>

          <button
            class="rounded-lg bg-lime-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-lime-800 disabled:opacity-40"
            :disabled="!gateSel || saveLoading"
            @click="saveDecision"
          >
            {{ saveLoading ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- 4. MEMBER ENTRY VIEW -->
      <div v-else class="flex grow flex-col justify-between overflow-hidden">
        <div class="mb-2 flex flex-col pb-2 border-b border-slate-100 gap-2">
          <div class="flex shrink-0 items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-bold text-slate-800">{{ activeMember?.target_code }} - {{ activeMember?.target_name }}</span>
            </div>

            <div class="flex items-center gap-3 text-xs">
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
          <div class="flex shrink-0 items-center gap-2">
            <span
              v-if="isProbingPhase"
              class="bg-lime-1 text-lime-7 rounded-full px-2 py-0.5 text-xs font-bold"
            >
              Probing
            </span>
            <span
              v-if="activeMemberResults.decision"
              class="rounded-full px-2 py-0.5 text-xs font-bold"
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

        <!-- Scrollable Trials Area -->
        <div class="flex w-full grow flex-col items-center justify-center overflow-y-auto py-2">
          <!-- Probing view (Large Yes/No buttons + circular slots) -->
          <div v-if="isProbingPhase" class="flex w-full flex-col items-center gap-4">
            <div
              :id="`probing-scroll-${measurement.id}`"
              class="scrollbar-hide flex w-full max-w-[280px] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3"
              @scroll="onScroll"
            >
              <div
                v-for="(pageTrials, pageIdx) in probingPages"
                :key="'probing-page-' + pageIdx"
                :id="`tbt-group-probing-${measurement.id}-page-${pageIdx}`"
                class="flex w-full shrink-0 snap-center justify-center"
              >
                <div class="flex max-w-[280px] flex-wrap items-center justify-center gap-3">
                  <div v-for="(t, idx) in pageTrials" :key="t.key" class="group relative">
                    <div
                      class="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-200"
                      :class="[
                        t.value === true
                          ? 'border-grass-7 bg-grass-1 text-grass-7'
                          : t.value === false
                            ? 'border-tomato-7 bg-tomato-1 text-tomato-7'
                            : 'border-dashed border-slate-300 bg-slate-50 text-transparent',
                      ]"
                    >
                      <Icon v-if="t.value === true" icon="ph:check" />
                      <Icon v-if="t.value === false" icon="ph:x" />
                    </div>
                    <button
                      v-if="
                        sessionStore.session?.status === 'ongoing' &&
                        !activeMemberResults.submitted &&
                        t.value !== null
                      "
                      class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-black"
                      @click="onRemoveProbe(pageIdx * 5 + idx)"
                    >
                      <Icon icon="ph:x" class="h-2.5 w-2.5" />
                    </button>
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
                    ? 'bg-slate-800 scale-110'
                    : 'bg-slate-300 hover:bg-slate-400',
                ]"
                @click="onChangePage(pageIdx - 1)"
              />
            </div>

            <!-- Buttons -->
            <div class="mt-2 flex items-center gap-4">
              <button
                class="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold shadow-md transition-all active:scale-95 bg-tomato-7 text-white hover:bg-tomato-8"
                :disabled="
                  sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted || isBusy
                "
                @click="onRecordProbe(false)"
              >
                <Icon icon="ph:x-bold" />
              </button>
              <button
                class="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold shadow-md transition-all active:scale-95 bg-grass-7 text-white hover:bg-grass-8"
                :disabled="
                  sessionStore.session?.status !== 'ongoing' || activeMemberResults.submitted || isBusy
                "
                @click="onRecordProbe(true)"
              >
                <Icon icon="ph:check-bold" />
              </button>

              <!-- Submit probing -->
              <button
                v-if="!activeMemberResults.submitted && answeredCountOfActive >= minTrialsOfActive"
                class="bg-light-purple-5 hover:bg-light-purple-6 ml-2 flex h-16 w-16 flex-col items-center justify-center rounded-full text-xs font-bold text-white shadow-md transition-all active:scale-95"
                :disabled="sessionStore.session?.status !== 'ongoing' || isBusy"
                @click="onSubmitProbing"
              >
                <span>Submit</span>
              </button>

              <!-- Review Gate button -->
              <button
                v-if="activeMemberResults.submitted && !activeMemberResults.decision"
                class="bg-light-purple-5 hover:bg-light-purple-6 ml-2 flex h-10 items-center justify-center rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95"
                @click="view = 'decision-gate'"
              >
                Review Gate
              </button>
            </div>
          </div>

          <!-- Teaching view (Square cells click cycle) -->
          <div v-else class="flex w-full flex-col items-center gap-4">
            <div
              :id="`teaching-scroll-${measurement.id}`"
              class="scrollbar-hide flex w-full max-w-[280px] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3"
              @scroll="onScroll"
            >
              <div
                v-for="(pageTrials, pageIdx) in teachingPages"
                :key="'teaching-page-' + pageIdx"
                :id="`tbt-group-teaching-${measurement.id}-page-${pageIdx}`"
                class="flex w-full shrink-0 snap-center justify-center"
              >
                <div class="flex max-w-[280px] flex-wrap items-center justify-center gap-2.5">
                  <div v-for="t in pageTrials" :key="t.key" class="group relative">
                    <button
                      class="flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all duration-150"
                      :class="[
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
                      class="bg-tomato-7 absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white shadow"
                      @click="onRemoveTeachingTrial(t.key)"
                    >
                      <Icon icon="ph:x" class="h-2.5 w-2.5" />
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
                    class="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-lg text-slate-400 transition-colors hover:border-slate-400 hover:bg-slate-100"
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

    <!-- 5. CARD FOOTER BUTTONS -->
    <div class="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50/50 p-2">
      <!-- Move view footer -->
      <template v-if="view === 'move'">
        <button
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95"
          @click="view = 'entry'"
        >
          <Icon icon="ph:caret-left-bold" />
        </button>
        <button
          class="bg-light-purple-5 hover:bg-light-purple-6 flex h-9 grow items-center justify-center rounded-lg text-xs font-semibold text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          :disabled="!moveSel || isBusy"
          @click="onConfirmMove"
        >
          Move to: {{ usedTargets.find((t) => t.target_id === moveSel)?.target_code || '...' }}
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
  </div>
</template>
