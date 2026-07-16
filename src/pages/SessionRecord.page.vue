<script setup lang="ts">
import {
  useSessionStore,
  type ResolveAllMeasurementsParams,
  type UpdateMeasurementParams
} from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import AppButton from '@/components/AppButton.vue'
import MeasurementRecord from '@/partitions/MeasurementRecord.vue'
import type { Measurement, MeasurementResultsDurationOrLatency, Session, Target } from '@/lib/types'
import SessionComments from '@/partitions/SessionComments.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import { useToast } from 'vue-toastification'
import { TransitionRoot } from '@headlessui/vue'
import AppChip from '@/components/AppChip.vue'
import { useClock } from '@/composable/use-clock'
import dayjs from 'dayjs'
import { secondsToDuration } from '@/lib/func'
import type { PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const sessionStore = useSessionStore()
const { now } = useClock()

/** === DATA === */

const sessionLoading = ref<boolean>(true)
const cycleLoading = ref<boolean>(false)
const isRefreshing = ref<boolean>(false)
const showOffline = ref<boolean>(false)
const isScrolling = ref<boolean>(false)
const showReviewMode = ref<boolean>(false)
const showSessionComments = ref<boolean>(false)
const isMeasurementCollapsed = ref<boolean>(true)
const showEndSession = ref<boolean>(false)
const endSessionLoading = ref<boolean>(false)
const showActionRecommendations = ref<boolean>(false)
const isOpenMastered = ref<boolean>(true)
const isOpenMaintenance = ref<boolean>(true)
const exitSessionLoading = ref<boolean>(false)
const showLeaveSession = ref<boolean>(false)

const heightReload = 112

const endSessionStatus = ref<'normal' | 'group_reason' | 'empty_record'>('normal')
const redirect = ref<string>('/home')
const containerHeight = ref<string>('100%')
const groupReasons = ref<string[]>([])

const focusMeasurement = ref<Measurement['id']>(0)
const updatingMeasurementIds = ref<Measurement['id'][]>([])
const unsavedSbtIds = ref<Measurement['id'][]>([])
const unCompletedColdProbeIds = ref<Measurement['id'][]>([])
const runningDurationLatency = ref<Measurement[]>([])

const scrollingTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const collapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
// Periodic check untuk stuck items
const periodicCheckInterval = ref<ReturnType<typeof setInterval> | undefined>(undefined)

/** === COMPUTEDS === */

// Tambahkan computed untuk monitoring
const hasPendingSync = computed(() => {
  return sessionStore.pending_progress.length > 0
})

const pendingSyncStats = computed(() => sessionStore.pendingSyncStats)

const isDisabledAction = computed(() => {
  return (
    sessionLoading.value ||
    cycleLoading.value ||
    endSessionLoading.value ||
    exitSessionLoading.value ||
    isScrolling.value
  )
})

const recordingTime = computed<string>(() => {
  if (sessionStore.session?.status === 'draft') return '00:00:00'
  if (sessionStore.session?.status === 'cancelled') return '00:00:00'

  const time = sessionStore.session?.start_time
  let n = dayjs(sessionStore.session?.end_time)
  if (sessionStore.session?.status === 'ongoing') n = now.value
  const diff = n.diff(dayjs(time), 'second')
  return secondsToDuration(diff)
})

const normalMeasurements = computed<Measurement[]>(() => {
  if (showReviewMode.value) return sessionStore.session_measurements
  return sessionStore.session_measurements.filter((i) => !i.is_fixed)
})

const fixedMeasurement = computed<Measurement | undefined>(() =>
  sessionStore.session_measurements.find((i) => i.is_fixed)
)

const isAllMeasurementResultEmpty = computed<boolean>(() => {
  const isAllEmpty = []
  const recordMeasurments = sessionStore.session_measurements.filter((i) => !i.is_dropped)

  recordMeasurments.forEach((i) => {
    let isResultsEmpty = true
    if (i.type === 'Measurement::Percentage') {
      for (let key in i.results) {
        if (i.results[key] !== null) isResultsEmpty = false
      }
    }
    if (i.type === 'Measurement::TrialByTrial') {
      for (let key in i.results) {
        if (i.results[key] !== null) isResultsEmpty = false
      }
    }
    if (i.type === 'Measurement::Probing') {
      const arr = Object.keys(i.results)
      if (arr.length > 0) isResultsEmpty = false
    }
    if (i.type === 'Measurement::Duration') {
      for (let key in i.results) {
        const result = i.results[key]
        if (result && result.seconds !== 0 && result.string !== '00:00:00') isResultsEmpty = false
      }
    }
    if (i.type === 'Measurement::Latency') {
      for (let key in i.results) {
        const result = i.results[key]
        if (result && result.seconds !== 0 && result.string !== '00:00:00') isResultsEmpty = false
      }
    }
    if (i.type === 'Measurement::Pir') {
      for (let key in i.results) {
        if (i.results[key] > 0) isResultsEmpty = false
      }
    }
    if (i.type === 'Measurement::Frequency') {
      if (i.results['score'] > 0) isResultsEmpty = false
    }
    if (i.type === 'Measurement::Prompting') {
      if (i.target?.is_group) {
        for (let key in i.results) {
          if (i.results[key].prompt_id) isResultsEmpty = false
        }
      } else {
        for (let key in i.results) {
          if (i.results[key].score > 0) isResultsEmpty = false
        }
      }
    }
    if (i.type === 'Measurement::Sbt') {
      for (let key in i.results) {
        if (i.results[key].prompt_id) isResultsEmpty = false
      }
    }
    if (i.type === 'Measurement::ColdProbe') {
      if (
        i.target?.cold_probe_format === 'classic' &&
        i.results &&
        Object.keys(i.results).length > 0
      )
        isResultsEmpty = false
      if (i.target?.cold_probe_format === 'custom') {
        for (let key in i.results) {
          if (i.results[key] !== null) isResultsEmpty = false
        }
      }
    }
    isAllEmpty.push(isResultsEmpty)
  })
  if (isAllEmpty.length === 0) isAllEmpty.push(false)
  return !isAllEmpty.includes(false)
})

const masteredRecommendations = computed(() => {
  return sessionStore.session_recommendations.filter((r) => r.recommended_action === 'mastered')
})

const maintenanceRecommendations = computed(() => {
  return sessionStore.session_recommendations.filter(
    (r) => r.recommended_action === 'maintenance' || r.recommended_action?.includes('maintenance')
  )
})

const failedMaintenanceTargets = computed(() => {
  // Logic from blubridge to check if maintenance failed:
  // Usually if recommended_action is 'maintenance_failed' or action_recommendations.passed is false
  return maintenanceRecommendations.value.filter((r: any) => {
    // If we have explicit maintenance_state.has_failures
    if (r.maintenance_state && r.maintenance_state.has_failures !== undefined) {
      return r.maintenance_state.has_failures === true
    }
    // Alternatively, fallback to `!r.passed` or checking `recommended_action`
    if (r.recommended_action === 'maintenance_failed') return true
    return r.passed === false
  })
})

const passedMaintenanceTargets = computed(() => {
  return maintenanceRecommendations.value.filter((r: any) => {
    // If we have explicit maintenance_state.has_failures
    if (r.maintenance_state && r.maintenance_state.has_failures !== undefined) {
      return r.maintenance_state.has_failures === false
    }
    if (r.recommended_action === 'maintenance_failed') return false
    return r.passed === true
  })
})

const passedContinueMaintenanceTargets = computed(() => {
  return passedMaintenanceTargets.value.filter((r: any) => {
    return !!r.maintenance_state?.next_date
  })
})

const passedCompleteMaintenanceTargets = computed(() => {
  return passedMaintenanceTargets.value.filter((r: any) => {
    return !r.maintenance_state?.next_date
  })
})

/** === WATCHERS === */

// Watch network status dengan auto-sync
watch(
  () => appStore.network_status.connected,
  async (isConnected, wasConnected) => {
    if (!isConnected) {
      showOffline.value = true

      // record session activities
      sessionStore.addSessionActivity({
        action_label: `network_offline`,
        recordable: 'Network',
        notes: `Network disconnected`,
        timestamp: new Date().toISOString()
      })

      return
    }

    if (isConnected && !wasConnected) {
      console.log('[Session Page] Network reconnected')

      // Show syncing notification if there are pending items
      if (sessionStore.pending_progress.length > 0) {
        toast.info('Syncing data...')
      }

      // record session activities
      sessionStore.addSessionActivity({
        action_label: `network_online`,
        recordable: 'Network',
        notes: `Network reconnected`,
        timestamp: new Date().toISOString()
      })

      await syncSession({ isSwipe: true })
    }
  }
)

// Watch untuk notifikasi saat sync berhasil
watch(
  () => hasPendingSync.value,
  (isPending, wasPending) => {
    if (wasPending && !isPending) {
      console.log('[Session Page] All data synced')
    }
  }
)

watch(
  () => showReviewMode.value,
  (val) => {
    if (sessionStore.session?.status === 'ongoing') {
      document.getElementById('app')?.scroll({ top: heightReload, behavior: 'smooth' })
    }
    if (val) focusMeasurement.value = 0

    const el = document.getElementById('container-record-measurement')
    let realHeight = el?.clientHeight || 0
    if (val) realHeight = realHeight / 2
    if (fixedMeasurement.value) realHeight = realHeight + 128
    else realHeight = realHeight + 64
    containerHeight.value = `${realHeight + 44}px`
  }
)

watch(
  () => isMeasurementCollapsed.value,
  () => {
    document.getElementById('fixed-measurement')?.scrollTo({ top: 0, behavior: 'smooth' })
  }
)

/** === METHODS === */

interface FetchSessionProps {
  first?: boolean
  isSwipe?: boolean
}
// Improved syncSession dengan proper feedback
async function syncSession({ isSwipe }: FetchSessionProps = { isSwipe: false }) {
  if (!appStore.network_status.connected) {
    console.log('[syncSession] Skipped - offline')
    return
  }

  const pendingCount = sessionStore.pending_progress.length

  if (pendingCount > 0) {
    console.log(`[syncSession] Syncing ${pendingCount} pending items...`)
  }

  const { success, data } = await sessionStore.resolvePendingProgress()
  sessionLoading.value = false

  if (!success) return

  if (isSwipe && appStore.network_status.connected) {
    if (data && data.succeeded > 0) {
      toast.success(`${data.succeeded} item(s) synced`)
    } else {
      toast.success('Results are now up-to-date!')
    }
  }
}

async function fetchSession(
  { first, isSwipe }: FetchSessionProps = { first: false, isSwipe: false }
) {
  const slug = route.params?.slug as string
  const { success, data } = await sessionStore.getSession({ slug })
  const session = data as Session
  await sessionStore.getSessionComments({ id: session?.id, filter: '' })
  sessionLoading.value = false
  if (!success) return

  const app = document.getElementById('app')

  if (session.status === 'ongoing') {
    if (isSwipe && appStore.network_status.connected) {
      toast.success('Results are now up-to-date!')
    }

    if (first) {
      syncSession()
      app?.scroll({ top: heightReload, behavior: 'smooth' })
      app?.addEventListener('scroll', scrollListener)
    }
  }

  if (session.status === 'completed' || session.status === 'cancelled') {
    // await appStore.getRunningSessions()

    app?.removeEventListener('scroll', scrollListener)
  }

  // reset all state
  cycleLoading.value = false
  updatingMeasurementIds.value = []
  runningDurationLatency.value = []
  unsavedSbtIds.value = []
  unCompletedColdProbeIds.value = []
}

const scrollListener = async (e: any) => {
  let top = e.currentTarget.scrollTop

  isScrolling.value = true

  if (!appStore.network_status.connected && top < heightReload) {
    document.getElementById('app')?.scroll({ top: heightReload, behavior: 'instant' })
  }

  let timer = 1000
  if (scrollingTimeout.value) {
    clearTimeout(scrollingTimeout.value)
    scrollingTimeout.value = undefined
  }

  if (top <= 0 && runningDurationLatency.value.length) {
    top = 1
    timer = 2000
  }

  if (top >= heightReload) {
    isScrolling.value = false
    return
  }

  scrollingTimeout.value = setTimeout(async () => {
    if (top === 0 && !isRefreshing.value) {
      isRefreshing.value = true
      cycleLoading.value = true

      sessionStore.addSessionActivity({
        action_label: `session_refresh`,
        recordable: 'Session',
        recordable_id: sessionStore.session?.id,
        notes: `Refresh session (swipe up)`,
        timestamp: new Date().toISOString()
      })
      await fetchSession({ isSwipe: true })

      isRefreshing.value = false
      cycleLoading.value = false
    }
    if (top < heightReload) {
      document.getElementById('app')?.scroll({ top: heightReload, behavior: 'smooth' })
    }
    isScrolling.value = false
  }, timer)

  return () => {
    if (scrollingTimeout.value) {
      clearTimeout(scrollingTimeout.value)
      scrollingTimeout.value = undefined
    }
  }
}

const checkActionRecommendations = async () => {
  const { success, data } = await sessionStore.getSessionRecommendations()
  endSessionLoading.value = false
  showEndSession.value = false

  toast.success('The session has been completed.')

  if (!success) {
    onExitSession()
    return
  }

  if (data.action_recommendations.length) {
    showActionRecommendations.value = true
  } else {
    onExitSession()
  }
}

const generateSuccessMetric = (target?: Target) => {
  if (!target) return ''
  let prefix = ''
  let goalText: string | number | undefined = ''
  let suffix = ''
  // prefix
  if (
    target.success_metric === 'equal to or greater than goal' ||
    target.type_name === 'Prompting'
  ) {
    prefix = '≥ '
  }
  if (target.success_metric === 'less than goal') {
    prefix = '< '
  }
  // goal text
  if (target.type_name === 'Duration') {
    goalText = target.goal_time
  } else {
    goalText = target.goal
  }
  // suffix
  if (target.type_name === 'Percentage' || target.type_name === 'Partial interval recording') {
    suffix = '%'
  }
  if (target.type_name === 'Frequency') {
    suffix = ' attempt(s)'
  }
  if (target.type_name === 'Prompting') {
    suffix = ` attempt(s) ${target.success_metric} prompts`
  }
  return prefix + goalText + suffix
}

const onToggleUpdatedMeasurement = (payload: { id: Measurement['id']; updated: boolean }) => {
  if (payload.updated) {
    updatingMeasurementIds.value = updatingMeasurementIds.value.filter((i) => i !== payload.id)
  } else {
    if (!updatingMeasurementIds.value.includes(payload.id)) {
      updatingMeasurementIds.value.push(payload.id)
    }
  }
}

const onToggleSavedSbt = (payload: { id: Measurement['id']; saved: boolean }) => {
  if (payload.saved) {
    unsavedSbtIds.value = unsavedSbtIds.value.filter((i) => i !== payload.id)
  } else {
    if (!unsavedSbtIds.value.includes(payload.id)) {
      unsavedSbtIds.value.push(payload.id)
    }
  }
}

const handleCompletedColdProbe = ({
  id,
  isCompleted
}: {
  id: number | undefined
  isCompleted: boolean
}) => {
  if (id === undefined) return
  if (isCompleted) {
    unCompletedColdProbeIds.value = unCompletedColdProbeIds.value.filter((i) => i !== id)
  } else {
    if (!unCompletedColdProbeIds.value.includes(id)) {
      unCompletedColdProbeIds.value.push(id)
    }
  }
}

const onFocusMeasurement = (val: Measurement, checkReviewMode: boolean) => {
  let timer = 300
  if (val.id === focusMeasurement.value) return
  focusMeasurement.value = val.id

  if (checkReviewMode) {
    if (!showReviewMode.value) return
    showReviewMode.value = false
  }

  const measurements = sessionStore.session_measurements
  let isFirst = false
  if (measurements.length <= 1) return
  else {
    const first = fixedMeasurement.value
      ? sessionStore.session_measurements[1]
      : sessionStore.session_measurements[0]
    if (first.id === val.id) isFirst = true
  }

  collapseTimeout.value = setTimeout(() => {
    if (val.is_fixed) {
      isMeasurementCollapsed.value = false
    } else {
      if (isFirst) {
        const app = document.getElementById(`app`)
        app?.scrollTo({ top: 112, behavior: 'smooth' })
      } else {
        const record = document.getElementById(`measurement-record-${val.id}`)
        record?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }

      const menu = document.getElementById(`measurement-nav-${val.id}`)
      menu?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
  }, timer)

  return () => {
    if (collapseTimeout.value) {
      clearTimeout(collapseTimeout.value)
      collapseTimeout.value = undefined
    }
  }
}

const onTrunOffAllAndEndSession = async () => {
  showEndSession.value = false
  showReviewMode.value = true
  cycleLoading.value = true
  const length = sessionStore.session_measurements.length

  for (let idx = 0; idx < length; idx++) {
    const measurement: Measurement = sessionStore.session_measurements[idx]
    if (!measurement.is_dropped) {
      if (runningDurationLatency.value.find((i) => i.id === measurement.id)) {
        runningDurationLatency.value = runningDurationLatency.value.filter(
          (i) => i.id !== measurement.id
        )
      }
      if (unsavedSbtIds.value.includes(measurement.id)) {
        unsavedSbtIds.value = unsavedSbtIds.value.filter((i) => i !== measurement.id)
      }

      if (unCompletedColdProbeIds.value.includes(measurement.id)) {
        unCompletedColdProbeIds.value = unCompletedColdProbeIds.value.filter(
          (i) => i !== measurement.id
        )
      }

      const params: UpdateMeasurementParams = {
        id: measurement.id,
        measurement: { is_dropped: true },
        data_result: { ...measurement, is_dropped: true }
      }
      const { success, message } = await sessionStore.updateMeasurement(params)
      if (!success) {
        toast.error(message)
      }
    }
  }

  endSessionStatus.value = 'normal'
  cycleLoading.value = false
  showEndSession.value = true
}

const onKeepActiveAndEndSession = () => {
  showEndSession.value = false
  showReviewMode.value = true
  endSessionStatus.value = 'normal'
  showEndSession.value = true
}

const openLeaveSession = () => {
  if (sessionStore.session?.status === 'ongoing') showLeaveSession.value = true
  else if (sessionStore.session?.status === 'paused') showLeaveSession.value = true
  else onBackToClientSessionDraft()
}

// Back to client session draft
const onBackToClientSessionDraft = async () => {
  const clientId = sessionStore.session?.client_id
  if (clientId) {
    router.push(`/clients/${clientId}/sessions-draft`)
  }
}

const openEndSession = () => {
  const measurements = sessionStore.session_measurements || []

  const unfinishedProbings: Measurement[] = measurements.filter(
    (i) => i?.type === 'Measurement::Probing' && !i.submitted_at && !i.is_dropped
  )
  let isNotCompletedProbes = false
  let isNotSavedProbing = false
  unfinishedProbings.forEach((i) => {
    const probes = Object.keys(i.results || {}).length
    const trials = i.target?.probing_number_of_trial || 0
    if (probes < trials) isNotCompletedProbes = true
    else isNotSavedProbing = true
  })

  groupReasons.value = []
  runningDurationLatency.value = measurements.filter((i) => {
    const res = Object.values(i.results || {}) as MeasurementResultsDurationOrLatency[]
    return (
      (i.type === 'Measurement::Duration' || i.type === 'Measurement::Latency') &&
      !i.submitted_at &&
      !i.is_dropped &&
      res.some((r) => r.started_at && !r.ended_at)
    )
  })
  const unsavedSbt = unsavedSbtIds.value.length
  const unCompletedColdProbe = unCompletedColdProbeIds.value.length

  if (
    isNotCompletedProbes ||
    isNotSavedProbing ||
    runningDurationLatency.value.length ||
    unsavedSbt ||
    unCompletedColdProbe
  ) {
    endSessionStatus.value = 'group_reason'
    if (runningDurationLatency.value.length) {
      groupReasons.value.push(`${runningDurationLatency.value.length} timer(s) are still running`)
    }

    if (isNotCompletedProbes) groupReasons.value.push('Minimum required probes have not been met')
    if (isNotSavedProbing) groupReasons.value.push('Actions for probing have not been saved')
    if (unsavedSbt) groupReasons.value.push("The target with SBT hasn't saved its result")

    if (unCompletedColdProbe) {
      groupReasons.value.push("You haven't completed data collection for the cold probe")
    }
  } else if (isAllMeasurementResultEmpty.value) {
    endSessionStatus.value = 'empty_record'
  } else {
    endSessionStatus.value = 'normal'
  }
  showEndSession.value = true
}

const onEndSession = async () => {
  endSessionLoading.value = true

  // ✅ Resolve semua pending dulu sebelum end session
  if (sessionStore.pending_progress.length > 0) {
    await sessionStore.resolvePendingProgress()
  }

  const measurements = sessionStore.session_measurements || []
  const payload: ResolveAllMeasurementsParams = {
    params: measurements?.map((i) => {
      return { id: i.id, results: i.results }
    })
  }

  const { success: s1, message: m1 } = await sessionStore.resolveAllMeasurements(payload)
  if (!s1) {
    endSessionLoading.value = false
    toast.error(m1)
    return
  }

  const { success: s2, message: m2 } = await sessionStore.endSession()
  if (!s2) {
    endSessionLoading.value = false
    toast.error(m2)
    return
  }

  checkActionRecommendations()
  duplicateImageCommentsToClientDocument()
}

const onExitSession = async () => {
  exitSessionLoading.value = true
  // await appStore.getRunningSessions()
  exitSessionLoading.value = false

  const clientId = sessionStore.session?.client_id
  if (redirect.value === '/home' && clientId) {
    router.push(`/clients/${clientId}/sessions-draft`)
    return
  }

  router.push(redirect.value)
}

const duplicateImageCommentsToClientDocument = async () => {
  try {
    const { success, data } = await sessionStore.getSessionComments({
      id: sessionStore?.session?.id
    })
    if (!success || !data) return
    const uniqueBlobIds = new Set()
    data.forEach((comment: { images: any[] }) => {
      if (comment.images.length) {
        comment.images.forEach((image) => {
          if (image.blob_id) {
            uniqueBlobIds.add(image.blob_id)
          }
        })
      }
    })

    if (uniqueBlobIds.size === 0) {
      return
    }
    const documents = Array.from(uniqueBlobIds).map((blobId) => ({ blob_id: blobId }))

    const payload = {
      client_id: sessionStore?.session?.client_id,
      documents,
      session_id: sessionStore?.session?.id,
      session_slug: sessionStore?.session?.slug
    }

    await sessionStore.duplicateImagesToClientDocument(payload)
  } catch (error) {
    console.log('🚀 ~ duplicateImageCommentsToClientDocument ~ error:', error)
  }
}

let backButtonListener: PluginListenerHandle | undefined = undefined

onMounted(async () => {
  backButtonListener = await App.addListener('backButton', () => {
    if (showLeaveSession.value) {
      // modal udah kebuka, back kedua = tutup modal aja (opsional)
      showLeaveSession.value = false
      return
    }
    // tampilkan modal, JANGAN langsung navigasi
    openLeaveSession()
  })

  const app = document.getElementById('app')
  if (app) {
    app.style.backgroundColor = 'rgb(235 228 240 / var(--tw-bg-opacity))' /* #ebe4f0 */
  }

  // appStore.getRunningSessions()
  redirect.value = route.query.redirect?.toString() || '/home'

  // Generate session store dari storage
  await sessionStore.generateSessionStore()

  // Setup auto-sync (hanya sekali)
  if (!sessionStore._autoSyncInitialized) {
    sessionStore.setupAutoSync()
  }

  // Run storage maintenance on startup
  await sessionStore.runStorageMaintenance()

  // Restore & sync pending items
  if (appStore.network_status.connected && sessionStore.pending_progress.length > 0) {
    console.log('[Session Page] Processing pending items on mount')
    await sessionStore.resolvePendingProgress()
  }

  await fetchSession({ first: true })

  if (sessionStore.session?.status === 'ongoing') {
    // Setup periodic check untuk stuck items
    periodicCheckInterval.value = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

      const stuckItems = sessionStore.pending_progress.filter(
        (item) => item.timestamp && item.timestamp < fiveMinutesAgo
      )

      if (stuckItems.length > 0 && appStore.network_status.connected) {
        console.warn('[Session Page] Found stuck items, triggering sync')
        sessionStore.triggerSync(true)
      }
    }, 60000) // Check setiap 1 menit
  }

  return () => {
    if (periodicCheckInterval.value) {
      clearInterval(periodicCheckInterval.value)
      periodicCheckInterval.value = undefined
    }
  }
})

// Cleanup saat unmount
onUnmounted(() => {
  backButtonListener?.remove()

  const app = document.getElementById('app')
  if (app) {
    app.style.backgroundColor = 'rgb(255 255 255 / var(--tw-bg-opacity))' /* #ffffff */
    app.removeEventListener('scroll', scrollListener)
  }

  // Clear interval to prevent memory leaks
  if (periodicCheckInterval.value) {
    clearInterval(periodicCheckInterval.value)
    periodicCheckInterval.value = undefined
  }

  // Clear timeout to prevent memory leaks
  if (scrollingTimeout.value) {
    clearTimeout(scrollingTimeout.value)
    scrollingTimeout.value = undefined
  }
  if (collapseTimeout.value) {
    clearTimeout(collapseTimeout.value)
    collapseTimeout.value = undefined
  }

  // Trigger sync sebelum unmount jika ada perubahan
  if (hasPendingSync.value && appStore.network_status.connected) {
    console.log('[Session Page] Syncing before unmount')
    sessionStore.triggerSync(true)
  }
})
</script>

<template>
  <div class="sticky top-0 z-[10] flex h-14 shrink-0 items-center gap-3 bg-white px-4">
    <div class="flex gap-2 items-center">
      <AppButton kind="plain" @click="openLeaveSession">
        <Icon :icon="'ph:caret-left'" class="text-xl" />
      </AppButton>

      <div
        class="flex justify-center items-center w-8 h-8 text-xs font-semibold rounded border transition-colors shrink-0"
        :class="{
          'border-prim-3 bg-prim-1 text-light-purple-4': !showReviewMode,
          'border-light-purple-3 bg-light-purple-1 text-dark-purple-4': showReviewMode
        }"
        @click="showReviewMode = !showReviewMode"
      >
        {{ sessionStore.session_measurements.length }}
      </div>

      <!-- Pending sync indicator -->
      <div v-if="hasPendingSync && !sessionLoading" class="flex">
        <div
          class="flex gap-1 items-center px-2 h-6 text-xs rounded-full bg-tulip-1 text-tulip-7"
          :title="`${pendingSyncStats.total} item(s) pending sync`"
        >
          <Icon icon="ph:cloud-arrow-up" class="text-sm animate-pulse" />
          <span class="font-medium">{{ pendingSyncStats.total }}</span>
        </div>
      </div>

      <div
        class="flex relative justify-center items-center w-8 h-8 rounded shrink-0"
        @click="showSessionComments = true"
      >
        <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
        <div
          class="absolute top-1 right-1 w-2 h-2 rounded-full transition-opacity bg-light-purple-5"
          :class="[sessionStore.session_comments?.length ? 'opacity-100' : 'opacity-0']"
        ></div>
      </div>
    </div>

    <div class="flex gap-2 justify-end items-center w-full">
      <div class="text-xs font-medium text-slate-6">ID {{ sessionStore.session?.id }}</div>
      <div
        class="w-2 h-2 rounded-full transition-colors shrink-0"
        :class="[
          sessionStore.session?.status === 'ongoing' ? 'animate-pulse-recording' : 'bg-slate-6'
        ]"
      ></div>
      <div class="grid grid-cols-5 items-center w-16 text-xs font-semibold text-slate-8">
        <div class="flex justify-center">{{ recordingTime.split(':')[0] }}</div>
        <div class="flex justify-center">:</div>
        <div class="flex justify-center">{{ recordingTime.split(':')[1] }}</div>
        <div class="flex justify-center">:</div>
        <div class="flex justify-center">{{ recordingTime.split(':')[2] }}</div>
      </div>
    </div>

    <AppButton
      v-if="sessionStore.session?.status === 'ongoing'"
      class="px-4"
      :disabled="
        !appStore.network_status.connected ||
        updatingMeasurementIds.length > 0 ||
        sessionLoading ||
        cycleLoading
      "
      @click="openEndSession"
    >
      {{ appStore.network_status.connected ? 'End' : 'Offline' }}
    </AppButton>
    <AppButton v-else kind="outline" :loading="exitSessionLoading" @click="onExitSession">
      Close
    </AppButton>
  </div>

  <div
    class="fixed left-1/2 z-[9] -translate-x-1/2 pt-safe"
    :class="[cycleLoading || endSessionLoading ? 'top-[60px]' : '-top-[60px]']"
  >
    <div class="flex justify-center items-center w-10 h-10 bg-white rounded-full shadow">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>
  </div>

  <div
    v-if="!sessionLoading && sessionStore.session?.status === 'ongoing'"
    class="flex justify-center items-end px-4 h-28 text-sm font-semibold text-center bg-prim-3 text-light-purple-5"
  >
    <div v-if="runningDurationLatency.length">
      <div>Can't refresh while the timer is running.</div>
      <div>Please stop the timer first.</div>
    </div>
    <div v-else>
      <div v-if="!appStore.network_status.connected">
        Can't refresh while your connection is lost
      </div>
      <div v-else>Pull down to refresh the results.</div>
    </div>
  </div>

  <div
    class="flex flex-col items-center w-full min-h-screen bg-prim-3"
    :style="{ height: containerHeight }"
  >
    <div
      v-if="showReviewMode"
      class="flex justify-center items-end px-4 pt-4 pb-2 w-full text-sm font-semibold text-center bg-prim-3 text-light-purple-5"
    >
      <div class="truncapy-3 space-y-3te">{{ sessionStore.session?.client?.name }}</div>
    </div>
    <div
      id="container-record-measurement"
      class="flex flex-wrap gap-4 justify-center px-4 py-4 w-full transition-all duration-500"
      :class="{
        'origin-top scale-50 object-top': showReviewMode,
        'min-w-[calc((320px*2)+(16px*3))]': showReviewMode,
        'sm:min-w-[calc((320px*3)+(16px*4))]': showReviewMode,
        'md:min-w-[calc((320px*4)+(16px*5))]': showReviewMode,
        'lg:min-w-[calc((320px*6)+(16px*7))]': showReviewMode,
        'xl:min-w-[calc((320px*7)+(16px*8))]': showReviewMode,
        '2xl:min-w-[calc((320px*9)+(16px*10))]': showReviewMode
      }"
    >
      <div v-if="sessionLoading" class="flex flex-wrap gap-4 justify-center w-full">
        <div
          v-for="n in 8"
          :key="n"
          class="h-[540px] w-[320px] shrink-0 animate-pulse rounded bg-prim-1"
        ></div>
      </div>
      <div v-else class="flex w-full flex-wrap justify-center gap-4 pb-[50vh]">
        <MeasurementRecord
          v-for="measurement in normalMeasurements"
          :key="measurement.id"
          :id="`measurement-record-${measurement.id}`"
          :measurement="measurement"
          :review-mode="showReviewMode"
          :is-disabled-action="isDisabledAction"
          @toggle-updated="onToggleUpdatedMeasurement($event)"
          @toggle-saved="onToggleSavedSbt($event)"
          @check-completed-cold-probe="handleCompletedColdProbe"
          @click="onFocusMeasurement(measurement, true)"
          @fetch-session="fetchSession({ first: false, isSwipe: false })"
        />
      </div>
    </div>
  </div>

  <div
    v-if="!sessionLoading && fixedMeasurement && !showReviewMode"
    id="fixed-measurement"
    class="fixed bottom-0 z-[9] flex w-screen bg-prim-3 px-safe pb-safe"
  >
    <div
      class="flex grow"
      :class="{
        'max-h-[160px] justify-center': isMeasurementCollapsed,
        'no-scrollbar h-[calc(100vh-56px)] flex-col items-center gap-4 overflow-y-auto py-4':
          !isMeasurementCollapsed
      }"
    >
      <div v-if="!isMeasurementCollapsed" class="flex flex-col gap-1 items-center">
        <Icon icon="ph:lock-fill" class="text-2xl text-center text-prim-5" />
        <div class="text-xs font-medium text-center text-prim-5">
          You're viewing a locked target.
        </div>
      </div>
      <MeasurementRecord
        :measurement="fixedMeasurement"
        :is-collapsed="isMeasurementCollapsed"
        :is-disabled-action="isDisabledAction"
        @toggle-updated="onToggleUpdatedMeasurement($event)"
        @toggle-saved="onToggleSavedSbt($event)"
        @toggle-collapsed="isMeasurementCollapsed = $event"
        @check-completed-cold-probe="handleCompletedColdProbe"
        @fetch-session="fetchSession({ first: false, isSwipe: false })"
      />
      <div
        v-if="!isMeasurementCollapsed"
        class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-prim-1"
        @click="isMeasurementCollapsed = true"
      >
        <Icon icon="ph:x" class="text-[32px] text-light-purple-5" />
      </div>
    </div>
  </div>

  <div
    v-if="!sessionLoading && !fixedMeasurement"
    class="fixed z-20 w-screen transition-all duration-500 delay-500 bg-prim-3 px-safe pb-safe"
    :class="{ 'bottom-0': !showReviewMode, '-bottom-36': showReviewMode }"
  >
    <div class="flex gap-6 items-center pl-4 h-16 grow">
      <div class="relative" @click="showReviewMode = !showReviewMode">
        <div
          class="flex justify-center items-center w-8 h-10 text-xs font-semibold bg-white rounded text-dark-purple-1"
        >
          {{ sessionStore.session_measurements.length }}
        </div>
        <div
          class="absolute top-0 -z-[1] h-10 w-8 rounded bg-prim-4 transition-all duration-500"
          :class="{ 'left-2 rotate-[15deg]': !showReviewMode, 'left-0 rotate-0': showReviewMode }"
        ></div>
      </div>
      <div
        class="flex overflow-x-auto gap-2 items-center py-3 pr-4 snap-x snap-mandatory scroll-smooth"
      >
        <div
          v-for="opt in sessionStore.session_measurements"
          :key="opt.id"
          :id="`measurement-nav-${opt.id}`"
          class="flex items-center px-3 h-8 text-xs font-medium rounded-full border transition-colors cursor-pointer max-w-64 shrink-0 snap-start"
          :class="[
            focusMeasurement === opt.id
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="onFocusMeasurement(opt, false)"
        >
          <div class="truncate">{{ opt.target?.name }}</div>
        </div>
      </div>
    </div>
  </div>

  <SessionComments :show="showSessionComments" @close="showSessionComments = false" />

  <AppActionSheet :show="showOffline" @close="showOffline = false">
    <div class="flex flex-col gap-4 items-center py-3">
      <div class="text-xl font-semibold text-center">Oops! You're offline</div>
      <div class="text-sm text-center">
        Your connection is lost. You can keep tracking data, but you'll need to go online to end the
        session.
      </div>
      <AppButton kind="plain" class="w-full" @click="showOffline = false">
        Back to session
      </AppButton>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showEndSession" @close="showEndSession = false">
    <div v-if="endSessionStatus === 'normal'" class="flex flex-col gap-4 items-center py-3">
      <div class="text-xl font-semibold text-center">End this session?</div>
      <div class="text-sm text-center">
        Are you sure you want to end this session? Make sure you've reviewed all data before
        finalizing.
      </div>
      <div class="grid grid-cols-2 gap-2 w-full">
        <AppButton kind="plain" @click="showEndSession = false">Cancel</AppButton>
        <AppButton :loading="endSessionLoading" @click="onEndSession">End now</AppButton>
      </div>
    </div>
    <div v-if="endSessionStatus === 'group_reason'" class="flex flex-col gap-4 items-center py-3">
      <div class="text-xl font-semibold text-center">Session can't be ended</div>
      <div class="flex flex-col gap-2 w-full">
        <div class="text-sm">You can't end the session because of the following reason(s):</div>
        <div class="pr-4 pl-4 w-full text-sm text-left">
          <ul class="list-disc">
            <li v-for="(text, idx) in groupReasons" :key="idx">{{ text }}</li>
          </ul>
        </div>
        <div class="text-sm">Please address these issues before ending the session.</div>
      </div>
      <AppButton kind="plain" class="w-full" @click="showEndSession = false">
        Back to session
      </AppButton>
    </div>
    <div v-if="endSessionStatus === 'empty_record'" class="flex flex-col gap-4 items-center py-3">
      <div class="text-xl font-semibold text-center">It seems you haven't recorded any data</div>
      <img
        alt="measurement_droped"
        class="w-full h-auto rounded"
        src="@/assets/measurement_droped.png"
      />
      <div class="text-sm text-center">
        Please note that if you end the session now, the targets will record the data as ''0''. To
        prevent any data recording, you can deactivate the toggle on each target. Would you like to
        turn off the toggle for all targets?
      </div>
      <AppButton class="w-full" @click="onTrunOffAllAndEndSession">
        Turn off all and end session
      </AppButton>
      <AppButton kind="outline" class="w-full" @click="onKeepActiveAndEndSession">
        Keep active and end session
      </AppButton>
      <AppButton kind="plain" class="w-full" @click="showEndSession = false">
        Back to session
      </AppButton>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showLeaveSession" @close="showLeaveSession = false">
    <div class="flex flex-col gap-4 items-center py-3">
      <div class="text-xl font-semibold text-center">Leave this session?</div>
      <div class="text-sm text-center">
        Recording keeps running and your attempts are saved. The session stays open and won't be
        finalized until you or another assigned therapist ends it.
      </div>
      <div class="grid grid-cols-2 gap-2 w-full">
        <AppButton kind="plain" @click="showLeaveSession = false">Cancel</AppButton>
        <AppButton @click="onBackToClientSessionDraft">Leave</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <TransitionRoot
    :show="showActionRecommendations"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-75"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-75"
    class="no-scrollbar fixed left-0 top-0 z-[21] h-screen w-screen overflow-y-auto bg-white p-safe"
  >
    <div class="fixed top-0 z-[999999] w-screen bg-white pt-safe"></div>
    <div class="fixed bottom-0 z-[999999] w-screen bg-white pb-safe"></div>

    <div class="sticky top-0 z-[10] flex h-14 shrink-0 grow items-center gap-3 bg-white px-4">
      <div class="flex justify-center items-center w-8 h-8 rounded shrink-0 bg-orange-3">
        <Icon icon="ph:seal-warning-fill" class="text-2xl text-orange-6" />
      </div>
      <div class="text-2xl text-[22px] font-bold">Action recommendation</div>
    </div>

    <div class="flex overflow-y-auto flex-col gap-3 px-4 pb-4 grow">
      <div class="pt-2 text-sm text-slate-8">
        The following targets are the targets that meet the criteria for recommendation. Please go
        to the
        <span class="font-semibold">'Recommendation'</span>
        tab on the web version to proceed with the next steps.
      </div>

      <!-- MASTERED -->
      <div
        v-if="masteredRecommendations.length"
        class="flex flex-col mt-2 rounded border border-slate-3"
      >
        <div class="flex flex-col">
          <div
            class="flex justify-between items-center px-4 py-3 cursor-pointer select-none"
            @click="isOpenMastered = !isOpenMastered"
          >
            <div class="text-sm font-bold">Mastered</div>
            <Icon :icon="isOpenMastered ? 'ph:caret-up' : 'ph:caret-down'" class="text-xl" />
          </div>

          <div v-if="isOpenMastered" class="flex flex-col px-4 pb-2">
            <div class="flex gap-1 items-center pb-3">
              <AppChip chip="in_progress" />
              <Icon icon="ph:arrow-right" class="text-lg text-slate-6" />
              <AppChip chip="mastered" />
            </div>

            <div
              v-for="(recommendation, index) in masteredRecommendations"
              :key="recommendation.id"
              class="flex flex-col gap-2 py-3"
              :class="{ 'border-b border-slate-3': index !== masteredRecommendations.length - 1 }"
            >
              <div class="text-sm font-semibold">{{ recommendation.target?.name }}</div>
              <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                <div class="truncate">Success metric</div>
                <div class="truncate">{{ generateSuccessMetric(recommendation.target) }}</div>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                <div class="flex truncate">Total successful sessions</div>
                <div class="truncate">
                  {{ recommendation.target?.total_success || recommendation.total_success || 0 }}
                  session(s)
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                <div class="flex truncate">Number of consecutive success</div>
                <div class="truncate">
                  {{
                    recommendation.target?.consecutive_success ||
                    recommendation.consecutive_success ||
                    0
                  }}
                  times
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MAINTENANCE -->
      <div
        v-if="maintenanceRecommendations.length"
        class="flex flex-col mt-2 mb-24 rounded border border-slate-3"
      >
        <div class="flex flex-col">
          <div
            class="flex justify-between items-center px-4 py-3 cursor-pointer select-none"
            @click="isOpenMaintenance = !isOpenMaintenance"
          >
            <div class="text-sm font-bold">Maintenance</div>
            <Icon :icon="isOpenMaintenance ? 'ph:caret-up' : 'ph:caret-down'" class="text-xl" />
          </div>

          <div v-if="isOpenMaintenance" class="flex flex-col px-4 pb-2">
            <!-- For failed targets -->
            <template v-if="failedMaintenanceTargets.length">
              <div class="flex gap-1 items-center pt-1 pb-3">
                <AppChip chip="mastered" />
                <Icon icon="ph:arrow-right" class="text-lg text-slate-6" />
                <AppChip chip="in_progress" />
              </div>

              <div
                v-for="(recommendation, index) in failedMaintenanceTargets"
                :key="recommendation.id"
                class="flex flex-col gap-2 py-3"
                :class="{
                  'border-b border-slate-3':
                    index !== failedMaintenanceTargets.length - 1 ||
                    passedMaintenanceTargets.length > 0
                }"
              >
                <div class="text-sm font-semibold">{{ recommendation.target?.name }}</div>
                <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                  <div class="flex items-center">Success metric</div>

                  <div v-if="recommendation.target?.type_name === 'Cold Probe'" class="flex">
                    <div
                      class="flex gap-1 items-center px-2 py-0.5 w-max bg-white rounded-full border border-success-2 text-success"
                    >
                      <Icon icon="ph:check-circle-fill" class="text-success-4" />
                      <span class="text-[10px] font-medium leading-[14px]">Passed</span>
                    </div>
                  </div>
                  <div v-else class="truncate">
                    {{ generateSuccessMetric(recommendation.target) }}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                  <div class="flex items-center">Result</div>
                  <div class="flex">
                    <div
                      class="flex w-max items-center gap-1 rounded-full border border-[#F4BFBA] bg-white px-2 py-0.5 text-[#932A20]"
                    >
                      <Icon icon="ph:x-circle-fill" class="text-[#DD3F30]" />
                      <span class="text-[10px] font-medium leading-[14px]">Failed</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- For passed targets (continue next maintenance) -->
            <template v-if="passedContinueMaintenanceTargets.length">
              <div
                class="flex gap-1 items-center pb-3"
                :class="{ 'pt-4': failedMaintenanceTargets.length > 0 }"
              >
                <AppChip chip="mastered" />
                <Icon icon="ph:arrow-right" class="text-lg text-slate-6" />
                <span class="text-sm font-medium text-slate-7">Continue next maintenance</span>
              </div>

              <div
                v-for="(recommendation, index) in passedContinueMaintenanceTargets"
                :key="recommendation.id"
                class="flex flex-col gap-2 py-3"
                :class="{
                  'border-b border-slate-3':
                    index !== passedContinueMaintenanceTargets.length - 1 ||
                    passedCompleteMaintenanceTargets.length > 0
                }"
              >
                <div class="text-sm font-semibold">{{ recommendation.target?.name }}</div>
                <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                  <div class="flex items-center">Success metric</div>
                  <div v-if="recommendation.target?.type_name === 'Cold Probe'" class="flex">
                    <div
                      class="flex gap-1 items-center px-2 py-0.5 w-max bg-white rounded-full border border-success-2 text-success"
                    >
                      <Icon icon="ph:check-circle-fill" class="text-success-4" />
                      <span class="text-[10px] font-medium leading-[14px]">Passed</span>
                    </div>
                  </div>
                  <div v-else class="truncate">
                    {{ generateSuccessMetric(recommendation.target) }}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                  <div class="flex items-center">Result</div>
                  <div class="flex">
                    <div
                      class="flex gap-1 items-center px-2 py-0.5 w-max bg-white rounded-full border border-success-2 text-success"
                    >
                      <Icon icon="ph:check-circle-fill" class="text-success-4" />
                      <span class="text-[10px] font-medium leading-[14px]">Passed</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- For passed targets (maintenance complete) -->
            <template v-if="passedCompleteMaintenanceTargets.length">
              <div
                class="flex gap-1 items-center pb-3"
                :class="{
                  'pt-4':
                    failedMaintenanceTargets.length > 0 ||
                    passedContinueMaintenanceTargets.length > 0
                }"
              >
                <AppChip chip="mastered" />
                <Icon icon="ph:arrow-right" class="text-lg text-slate-6" />
                <span class="text-sm font-medium text-slate-7">Maintenance complete</span>
              </div>

              <div
                v-for="(recommendation, index) in passedCompleteMaintenanceTargets"
                :key="recommendation.id"
                class="flex flex-col gap-2 py-3"
                :class="{
                  'border-b border-slate-3': index !== passedCompleteMaintenanceTargets.length - 1
                }"
              >
                <div class="text-sm font-semibold">{{ recommendation.target?.name }}</div>
                <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                  <div class="flex items-center">Success metric</div>
                  <div v-if="recommendation.target?.type_name === 'Cold Probe'" class="flex">
                    <div
                      class="flex gap-1 items-center px-2 py-0.5 w-max bg-white rounded-full border border-success-2 text-success"
                    >
                      <Icon icon="ph:check-circle-fill" class="text-success-4" />
                      <span class="text-[10px] font-medium leading-[14px]">Passed</span>
                    </div>
                  </div>
                  <div v-else class="truncate">
                    {{ generateSuccessMetric(recommendation.target) }}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
                  <div class="flex items-center">Result</div>
                  <div class="flex">
                    <div
                      class="flex gap-1 items-center px-2 py-0.5 w-max bg-white rounded-full border border-success-2 text-success"
                    >
                      <Icon icon="ph:check-circle-fill" class="text-success-4" />
                      <span class="text-[10px] font-medium leading-[14px]">Passed</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div class="fixed bottom-0 w-screen bg-white px-safe pb-safe">
      <div class="flex items-center px-4 h-16 grow">
        <AppButton class="w-full" :loading="exitSessionLoading" @click="onExitSession">
          Close session
        </AppButton>
      </div>
    </div>
  </TransitionRoot>
</template>
