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
import type { Measurement, Session, Target } from '@/lib/types'
import SessionComments from '@/partitions/SessionComments.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import { useToast } from 'vue-toastification'
import { TransitionRoot } from '@headlessui/vue'
import AppChip from '@/components/AppChip.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const sessionStore = useSessionStore()

const sessionLoading = ref<boolean>(false)
const cycleLoading = ref<boolean>(false)
const redirect = ref<string>('/home')
const heightReload = 112

interface FetchSessionProps {
  first?: boolean
  is_swiped?: boolean
}
async function syncSession({ is_swiped }: FetchSessionProps = { is_swiped: false }) {
  const { success } = await sessionStore.resolvePendingProgress()
  sessionLoading.value = false
  if (!success) return
  if (is_swiped && appStore.network_status.connected) {
    toast.success('Results are now up-to-date!')
  }
}
async function fetchSession(
  { first, is_swiped }: FetchSessionProps = { first: false, is_swiped: false }
) {
  const slug = route.params?.slug as string
  const { success, data } = await sessionStore.getSession({ slug })
  const session = data as Session
  await sessionStore.getSessionComments({ id: session.id, filter: '' })
  sessionLoading.value = false
  cycleLoading.value = false
  if (!success) return

  const app = document.getElementById('app')
  const recordingTime = session.current_recording_time
    ? (session.current_recording_time[0] as number)
    : 0

  if (session.status === 'ongoing') {
    if (is_swiped && appStore.network_status.connected) {
      toast.success('Results are now up-to-date!')
    }
    counter.value = recordingTime
    counterTimer()

    if (first) {
      syncSession()
      app?.scroll({ top: heightReload, behavior: 'smooth' })
      app?.addEventListener('scroll', scrollListener)
    }
  }

  if (session.status === 'completed' || session.status === 'cancelled') {
    await appStore.getRunningSessions()
    clearInterval(counterInterval.value)
    counter.value = recordingTime
    app?.removeEventListener('scroll', scrollListener)
  }

  // reset all state
  runningDurationIds.value = []
  unsavedSbtIds.value = []
  unCompletedColdProbeIds.value = []
}

const showOffline = ref<boolean>(false)
watch(
  () => appStore.network_status.connected,
  async (val) => {
    if (!val) showOffline.value = true
    if (val) {
      sessionLoading.value = true
      syncSession({ is_swiped: true })
    }
  }
)

const scrollingTimeout = ref<any>(null)
const scrollListener = (e: any) => {
  let top = e.currentTarget.scrollTop
  if (!appStore.network_status.connected && top < heightReload) {
    document.getElementById('app')?.scroll({ top: heightReload, behavior: 'instant' })
  }
  let timer = 1000
  clearTimeout(scrollingTimeout.value)
  if (top <= 0 && runningDurationIds.value.length) {
    top = 1
    timer = 2000
  }
  scrollingTimeout.value = setTimeout(() => {
    if (top === 0) {
      cycleLoading.value = true
      fetchSession({ is_swiped: true })
    }
    if (top < heightReload) {
      document.getElementById('app')?.scroll({ top: heightReload, behavior: 'smooth' })
    }
  }, timer)
}

onMounted(() => {
  const app = document.getElementById('app')
  if (app) {
    app.style.backgroundColor = 'rgb(235 228 240 / var(--tw-bg-opacity))' /* #ebe4f0 */
  }
  appStore.getRunningSessions()

  sessionLoading.value = true
  /** generate session.store from storage */
  sessionStore.generateSessionStore()
  fetchSession({ first: true })
  redirect.value = route.query.redirect?.toString() || '/home'
})
onUnmounted(() => {
  const app = document.getElementById('app')
  if (app) {
    app.style.backgroundColor = 'rgb(255 255 255 / var(--tw-bg-opacity))' /* #ffffff */
    app.removeEventListener('scroll', scrollListener)
  }
})

const counter = ref<number>(0)
const counterInterval = ref<any>(null)
const unCompletedColdProbeIds = ref<Measurement['id'][]>([])
const counterTimer = () => {
  clearInterval(counterInterval.value)
  counterInterval.value = setInterval(() => {
    counter.value += 1
  }, 1000)
}
const recordingTime = computed<string>(() => {
  let hours: number | string = '00'
  let minutes: number | string = '00'
  let seconds: number | string = '00'
  seconds = (counter.value % 60).toString().padStart(2, '0')
  if (counter.value >= 60) {
    minutes = Math.floor(counter.value / 60)
    if (counter.value >= 3600) minutes = minutes % 60
    minutes = minutes.toString().padStart(2, '0')
  }
  if (counter.value >= 3600) {
    hours = Math.floor(counter.value / 3600)
      .toString()
      .padStart(2, '0')
  }
  return `${hours}:${minutes}:${seconds}`
})

const updatingMeasurementIds = ref<Measurement['id'][]>([])
const onToggleUpdatedMeasurment = (payload: { id: Measurement['id']; updated: boolean }) => {
  if (payload.updated) {
    updatingMeasurementIds.value = updatingMeasurementIds.value.filter((i) => i !== payload.id)
  } else {
    if (!updatingMeasurementIds.value.includes(payload.id)) {
      updatingMeasurementIds.value.push(payload.id)
    }
  }
}

const runningDurationIds = ref<Measurement['id'][]>([])
const onToggleRunningDuration = (data: Measurement) => {
  const found = runningDurationIds.value.includes(data.id)
  if (found) {
    runningDurationIds.value = runningDurationIds.value.filter((i) => i !== data.id)
  } else {
    runningDurationIds.value.push(data.id)
  }
}

const unsavedSbtIds = ref<Measurement['id'][]>([])
const onToggleSavedSbt = (payload: { id: Measurement['id']; saved: boolean }) => {
  if (payload.saved) {
    unsavedSbtIds.value = unsavedSbtIds.value.filter((i) => i !== payload.id)
  } else {
    if (!unsavedSbtIds.value.includes(payload.id)) {
      unsavedSbtIds.value.push(payload.id)
    }
  }
}

const showReviewMode = ref<boolean>(false)
const containerHeight = ref<string>('100%')
watch(showReviewMode, (val) => {
  if (sessionStore.session?.status === 'ongoing') {
    document.getElementById('app')?.scroll({ top: heightReload, behavior: 'smooth' })
  }
  if (val) focusMeasurement.value = 0
  setTimeout(() => {
    const el = document.getElementById('container-record-measurement')
    let realHeight = el?.clientHeight || 0
    if (val) realHeight = realHeight / 2
    if (fixedMeasurement.value) realHeight = realHeight + 128
    else realHeight = realHeight + 64
    containerHeight.value = `${realHeight + 44}px`
  }, 1000)
})
const focusMeasurement = ref<Measurement['id']>(0)
const onFocusMeasurement = (val: Measurement) => {
  let timer = 500
  if (val.id === focusMeasurement.value) return
  focusMeasurement.value = val.id

  if (!showReviewMode.value) return
  showReviewMode.value = false

  const measurements = sessionStore.session_measurements
  let isFirst = false
  if (measurements.length <= 1) return
  else {
    const first = fixedMeasurement.value
      ? sessionStore.session_measurements[1]
      : sessionStore.session_measurements[0]
    if (first.id === val.id) isFirst = true
  }

  setTimeout(() => {
    if (val.is_fixed) {
      isMeasurementCollapsed.value = false
    } else {
      setTimeout(() => {
        if (isFirst) {
          const app = document.getElementById(`app`)
          app?.scrollTo({ top: 112, behavior: 'smooth' })
        } else {
          const record = document.getElementById(`measurement-record-${val.id}`)
          record?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        }
      }, timer + timer)
      setTimeout(() => {
        const menu = document.getElementById(`measurement-nav-${val.id}`)
        menu?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }, timer)
    }
  }, timer)
}
const showSessionComments = ref<boolean>(false)

const normalMeasurements = computed<Measurement[]>(() => {
  if (showReviewMode.value) return sessionStore.session_measurements
  return sessionStore.session_measurements.filter((i) => !i.is_fixed)
})
const fixedMeasurement = computed<Measurement | undefined>(() =>
  sessionStore.session_measurements.find((i) => i.is_fixed)
)
const isMeasurementCollapsed = ref<boolean>(true)
watch(isMeasurementCollapsed, () => {
  document.getElementById('fixed-measurement')?.scrollTo({ top: 0, behavior: 'smooth' })
})

const endSessionStatus = ref<'normal' | 'group_reason' | 'empty_record'>('normal')
const groupReasons = ref<string[]>([])
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
const showEndSession = ref<boolean>(false)
const endSessionLoading = ref<boolean>(false)
const openEndSession = () => {
  const unfinishedProbings: Measurement[] = sessionStore.session_measurements.filter(
    (i) => i?.type === 'Measurement::Probing' && !i.submitted_at && !i.is_dropped
  )
  let isNotCompletedProbes = false
  let isNotSavedProbing = false
  unfinishedProbings.forEach((i) => {
    const probes = Object.keys(i.results).length
    const trials = i.target?.probing_number_of_trial || 0
    if (probes < trials) isNotCompletedProbes = true
    else isNotSavedProbing = true
  })

  groupReasons.value = []
  const runningDuration = runningDurationIds.value.length
  const unsavedSbt = unsavedSbtIds.value.length
  const unCompletedColdProbe = unCompletedColdProbeIds.value.length
  if (
    isNotCompletedProbes ||
    isNotSavedProbing ||
    runningDuration ||
    unsavedSbt ||
    unCompletedColdProbe
  ) {
    endSessionStatus.value = 'group_reason'
    if (runningDuration) groupReasons.value.push(`${runningDuration} timer(s) are still running`)
    if (isNotCompletedProbes) groupReasons.value.push('Minimum required probes have not been met')
    if (isNotSavedProbing) groupReasons.value.push('Actions for probing have not been saved')
    if (unsavedSbt) groupReasons.value.push("The target with SBT hasn't saved its result")
    if (unCompletedColdProbe)
      groupReasons.value.push("You haven't completed data collection for the cold probe")
  } else if (isAllMeasurementResultEmpty.value) {
    endSessionStatus.value = 'empty_record'
  } else {
    endSessionStatus.value = 'normal'
  }
  showEndSession.value = true
}
const onTrunOffAllAndEndSession = async () => {
  showEndSession.value = false
  showReviewMode.value = true
  cycleLoading.value = true
  const length = sessionStore.session_measurements.length
  for (let idx = 0; idx < length; idx++) {
    const measurement: Measurement = sessionStore.session_measurements[idx]
    if (!measurement.is_dropped) {
      if (runningDurationIds.value.includes(measurement.id)) {
        runningDurationIds.value = runningDurationIds.value.filter((i) => i !== measurement.id)
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
        return
      }
    }
  }
  endSessionStatus.value = 'normal'
  setTimeout(() => {
    cycleLoading.value = false
    showEndSession.value = true
  }, 500)
}
const onKeepActiveAndEndSession = () => {
  showEndSession.value = false
  showReviewMode.value = true
  endSessionStatus.value = 'normal'
  setTimeout(() => {
    showEndSession.value = true
  }, 500)
}
const onEndSession = async () => {
  endSessionLoading.value = true

  const measurements = sessionStore.session_measurements || []
  const payload: ResolveAllMeasurementsParams = {
    params: measurements?.map((i) => {
      let results: Measurement['results'] = {}

      if (i.type === 'Measurement::Sbt') {
        // handle SBT results

        const res = Object.values(i.results).filter(
          (i: any) => Number(i.prompt_id) && Number(i.target_task_id)
        )
        results = Object.fromEntries(res.map((i, idx) => [idx + 1, i]))

        // end handle SBT results
      } else if (i.type === 'Measurement::Prompting' && i.target?.is_group) {
        // handle TA results

        const res = Object.values(i.results).filter(
          (i: any) => Number(i.prompt_id) && Number(i.target_id)
        )
        results = Object.fromEntries(res.map((i, idx) => [idx + 1, i]))

        // end handle TA results
      } else {
        // other
        results = { ...i.results }
      }

      return { id: i.id, results }
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

const showActionRecommendations = ref<boolean>(false)
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

const exitSessionLoading = ref<boolean>(false)
const onExitSession = async () => {
  exitSessionLoading.value = true
  await appStore.getRunningSessions()
  exitSessionLoading.value = false
  router.push(redirect.value)
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
</script>

<template>
  <div class="sticky top-0 z-[100] flex h-[52px] shrink-0 items-center gap-3 bg-white px-4">
    <div class="flex items-center gap-2">
      <div
        class="flex items-center justify-center w-8 h-8 text-xs font-semibold transition-all border rounded shrink-0"
        :class="{
          'border-prim-3 bg-prim-1 text-light-purple-4': !showReviewMode,
          'border-light-purple-3 bg-light-purple-1 text-dark-purple-4': showReviewMode
        }"
        @click="showReviewMode = !showReviewMode"
      >
        {{ sessionStore.session_measurements.length }}
      </div>
      <div
        class="relative flex items-center justify-center w-8 h-8 rounded shrink-0"
        @click="showSessionComments = true"
      >
        <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
        <div
          class="absolute w-2 h-2 transition-all rounded-full right-1 top-1 bg-light-purple-5"
          :class="[sessionStore.session_comments?.length ? 'opacity-100' : 'opacity-0']"
        ></div>
      </div>
    </div>
    <div class="flex items-center justify-end w-full gap-2">
      <div class="text-xs font-medium text-slate-6">ID {{ sessionStore.session?.id }}</div>
      <div
        class="w-2 h-2 transition-all rounded-full shrink-0"
        :class="{ 'bg-tomato-7': counter % 2 === 0, 'bg-slate-6': counter % 2 === 1 }"
      ></div>
      <div
        class="grid items-center w-16 grid-cols-5 text-xs font-semibold transition-all text-slate-8"
      >
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
      :disabled="!appStore.network_status.connected || updatingMeasurementIds.length > 0"
      @click="openEndSession"
    >
      {{ appStore.network_status.connected ? 'End' : 'Offline' }}
    </AppButton>
    <AppButton v-else kind="outline" :loading="exitSessionLoading" @click="onExitSession">
      Close
    </AppButton>
  </div>

  <div
    class="fixed left-1/2 z-[9] -translate-x-1/2 transition-all pt-safe"
    :class="{ 'top-[60px]': cycleLoading, '-top-[60px]': !cycleLoading }"
  >
    <div class="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>
  </div>

  <div
    v-if="!sessionLoading && sessionStore.session?.status === 'ongoing'"
    class="flex items-end justify-center px-4 text-sm font-semibold text-center h-28 bg-prim-3 text-light-purple-5"
  >
    <div v-if="runningDurationIds.length">
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
      class="flex items-end justify-center w-full px-4 pt-4 pb-2 text-sm font-semibold text-center bg-prim-3 text-light-purple-5"
    >
      <div class="truncapy-3 space-y-3te">{{ sessionStore.session?.client?.name }}</div>
    </div>
    <div
      id="container-record-measurement"
      class="flex flex-wrap justify-center w-full gap-4 px-4 py-4 transition-all duration-500"
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
      <div v-if="sessionLoading" class="flex flex-wrap justify-center w-full gap-4">
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
          :counter="counter"
          :review_mode="showReviewMode"
          :is_running="runningDurationIds.includes(measurement.id)"
          @toggle-updated="onToggleUpdatedMeasurment($event)"
          @toggle-running="onToggleRunningDuration(measurement)"
          @toggle-saved="onToggleSavedSbt($event)"
          @check-completed-cold-probe="handleCompletedColdProbe"
          @click="onFocusMeasurement(measurement)"
          @fetch-session="fetchSession({ first: false, is_swiped: false })"
        />
      </div>
    </div>
  </div>

  <div
    v-if="!sessionLoading && fixedMeasurement && !showReviewMode"
    id="fixed-measurement"
    class="fixed bottom-0 z-[10] flex w-screen bg-prim-3 transition-all px-safe pb-safe"
  >
    <div
      class="flex grow"
      :class="{
        'max-h-[180px] justify-center': isMeasurementCollapsed,
        'no-scrollbar h-[calc(100vh-52px)] flex-col items-center gap-4 overflow-y-auto py-4':
          !isMeasurementCollapsed
      }"
    >
      <div v-if="!isMeasurementCollapsed" class="flex flex-col items-center gap-1">
        <Icon icon="ph:lock-fill" class="text-2xl text-center text-prim-5" />
        <div class="text-xs font-medium text-center text-prim-5">
          You're viewing a locked target.
        </div>
      </div>
      <MeasurementRecord
        :measurement="fixedMeasurement"
        :counter="counter"
        :is_collapsed="isMeasurementCollapsed"
        :is_running="runningDurationIds.includes(fixedMeasurement.id)"
        @toggle-updated="onToggleUpdatedMeasurment($event)"
        @toggle-running="onToggleRunningDuration(fixedMeasurement)"
        @toggle-saved="onToggleSavedSbt($event)"
        @toggle-collapsed="isMeasurementCollapsed = $event"
        @check-completed-cold-probe="handleCompletedColdProbe"
        @fetch-session="fetchSession({ first: false, is_swiped: false })"
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
    class="fixed z-[10] w-screen bg-prim-3 transition-all delay-500 duration-500 px-safe pb-safe"
    :class="{ 'bottom-0': !showReviewMode, '-bottom-36': showReviewMode }"
  >
    <div class="flex items-center h-16 gap-6 pl-4 grow">
      <div class="relative" @click="showReviewMode = !showReviewMode">
        <div
          class="flex items-center justify-center w-8 h-10 text-xs font-semibold bg-white rounded text-dark-purple-1"
        >
          {{ sessionStore.session_measurements.length }}
        </div>
        <div
          class="absolute top-0 -z-[1] h-10 w-8 rounded bg-prim-4 transition-all duration-500"
          :class="{ 'left-2 rotate-[15deg]': !showReviewMode, 'left-0 rotate-0': showReviewMode }"
        ></div>
      </div>
      <div
        class="flex items-center gap-2 py-3 pr-4 overflow-x-auto snap-x snap-mandatory scroll-smooth"
      >
        <div
          v-for="opt in sessionStore.session_measurements"
          :key="opt.id"
          :id="`measurement-nav-${opt.id}`"
          class="flex items-center h-8 px-3 text-xs font-medium transition-all border rounded-full cursor-pointer max-w-32 shrink-0 snap-start"
          :class="[
            focusMeasurement === opt.id
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="onFocusMeasurement(opt)"
        >
          <div class="truncate">{{ opt.target?.name }}</div>
        </div>
      </div>
    </div>
  </div>

  <SessionComments :show="showSessionComments" @close="showSessionComments = false" />

  <AppActionSheet :show="showOffline" @close="showOffline = false">
    <div class="flex flex-col items-center gap-4">
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
    <div v-if="endSessionStatus === 'normal'" class="flex flex-col items-center gap-4">
      <div class="text-xl font-semibold text-center">End this session?</div>
      <div class="text-sm text-center">
        Are you sure you want to end this session? Make sure you've reviewed all data before
        finalizing.
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="showEndSession = false">Cancel</AppButton>
        <AppButton :loading="endSessionLoading" @click="onEndSession">End now</AppButton>
      </div>
    </div>
    <div v-if="endSessionStatus === 'group_reason'" class="flex flex-col items-center gap-4">
      <div class="text-xl font-semibold text-center">Session can't be ended</div>
      <div class="flex flex-col w-full gap-2">
        <div class="text-sm">You can't end the session because of the following reason(s):</div>
        <div class="w-full pl-4 pr-4 text-sm text-left">
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
    <div v-if="endSessionStatus === 'empty_record'" class="flex flex-col items-center gap-4">
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
      <div class="flex items-center justify-center w-8 h-8 rounded shrink-0 bg-orange-3">
        <Icon icon="ph:seal-warning-fill" class="text-2xl text-orange-6" />
      </div>
      <div class="text-2xl text-[22px] font-bold">Passing success metric</div>
    </div>
    <div class="flex flex-col gap-3 px-4 grow">
      <div class="flex items-center gap-1">
        <AppChip chip="in_progress" />
        <Icon icon="ph:arrow-right" class="text-lg text-slate-6" />
        <AppChip chip="mastered" />
      </div>
      <div class="text-sm text-slate-8">
        The following targets have reached their success criteria. Please go to the
        <span class="font-semibold">'Recommendation'</span>
        tab on the web version to proceed with the next steps.
      </div>
      <div>
        <div
          v-for="recommendation in sessionStore.session_recommendations"
          :key="recommendation.id"
          class="flex flex-col gap-2 py-3 border-b border-slate-3"
        >
          <div class="text-sm font-semibold">{{ recommendation.target?.name }}</div>
          <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
            <div class="truncate">Success metric</div>
            <div class="truncate">{{ generateSuccessMetric(recommendation.target) }}</div>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
            <div class="truncate">Total successful sessions</div>
            <div class="truncate">{{ recommendation.target?.total_success }} session(s)</div>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm text-slate-8">
            <div class="truncate">Number of consecutive success</div>
            <div class="truncate">{{ recommendation.target?.consecutive_success }} session(s)</div>
          </div>
        </div>
      </div>
    </div>
    <div class="fixed bottom-0 w-screen bg-white px-safe pb-safe">
      <div class="flex items-center h-16 px-4 grow">
        <AppButton class="w-full" :loading="exitSessionLoading" @click="onExitSession">
          Close session
        </AppButton>
      </div>
    </div>
  </TransitionRoot>
</template>
