<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementParams } from '@/stores/session.store'
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
  const slug = route.params.slug.toString()
  const { success, data } = await sessionStore.getSession({ slug })
  const session = data as Session
  await sessionStore.getSessionComments({ id: session.id, filter: '' })
  sessionLoading.value = false
  cycleLoading.value = false
  if (!success) return
  if (is_swiped && appStore.network_status.connected) {
    toast.success('Results are now up-to-date!')
  }
  counter.value = session.current_recording_time ? (session.current_recording_time[0] as number) : 0
  if (session.status === 'ongoing') {
    counterTimer()
  }
  const app = document.getElementById('app')
  if (first && session.status === 'ongoing') {
    syncSession()
    app?.scroll({ top: heightReload, behavior: 'smooth' })
    app?.addEventListener('scroll', scrollListener)
  }
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
  if (top <= 0 && runningMeasurements.value.length) {
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

const runningMeasurements = ref<Measurement[]>([])
const onToggleRunning = (data: Measurement) => {
  const found = runningMeasurements.value.find((i) => i.id === data.id)
  if (found) {
    runningMeasurements.value = runningMeasurements.value.filter((i) => i.id !== data.id)
  } else {
    runningMeasurements.value.push(data)
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
  if (!showReviewMode.value) timer = 100
  showReviewMode.value = false
  if (val.id === focusMeasurement.value) return
  focusMeasurement.value = val.id

  const measurements = sessionStore.session_measurements
  if (measurements.length <= 1) return
  else {
    const first = fixedMeasurement.value
      ? sessionStore.session_measurements[1]
      : sessionStore.session_measurements[0]
    if (first.id === val.id) return
  }

  setTimeout(() => {
    if (val.is_fixed) {
      isMeasurementCollapsed.value = false
    } else {
      setTimeout(() => {
        const record = document.getElementById(`measurement-record-${val.id}`)
        record?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
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
  const isEmpties = []
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
      if (i.results['seconds'] > 0) isResultsEmpty = false
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
      for (let key in i.results) {
        if (i.results[key].score > 0) isResultsEmpty = false
      }
    }
    isEmpties.push(isResultsEmpty)
  })
  if (isEmpties.length === 0) isEmpties.push(false)
  return !isEmpties.includes(false)
})
const showEndSession = ref<boolean>(false)
const endSessionLoading = ref<boolean>(false)
const openEndSession = () => {
  const unfinishedProbings: Measurement[] = sessionStore.session_measurements.filter(
    (i) => i.type === 'Measurement::Probing' && !i.submitted_at && !i.is_dropped
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
  const running = runningMeasurements.value.length
  if (running || isNotCompletedProbes || isNotSavedProbing) {
    endSessionStatus.value = 'group_reason'
    if (running) groupReasons.value.push(`${running} timer(s) are still running`)
    if (isNotCompletedProbes) groupReasons.value.push('Minimum required probes have not been met')
    if (isNotSavedProbing) groupReasons.value.push('Actions for probing have not been saved')
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
      const params: UpdateMeasurementParams = {
        id: measurement.id,
        measurement: { is_dropped: true },
        data_result: { ...measurement, is_dropped: true }
      }
      const { success } = await sessionStore.updateMeasurement(params)
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
  const { success } = await sessionStore.endSession()
  if (!success) {
    endSessionLoading.value = false
    return
  }
  checkActionRecommendations()
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

const onExitSession = () => {
  router.push(redirect.value)
}
</script>

<template>
  <div class="sticky top-0 z-[10] flex h-[52px] shrink-0 items-center gap-3 bg-white px-4">
    <div class="flex items-center gap-2">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded border text-xs font-semibold transition-all"
        :class="{
          'border-prim-3 bg-prim-1 text-light-purple-4': !showReviewMode,
          'border-light-purple-3 bg-light-purple-1 text-dark-purple-4': showReviewMode
        }"
        @click="showReviewMode = !showReviewMode"
      >
        {{ sessionStore.session_measurements.length }}
      </div>
      <div
        class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded"
        @click="showSessionComments = true"
      >
        <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
        <div
          class="absolute right-1 top-1 h-2 w-2 rounded-full bg-light-purple-5 transition-all"
          :class="[sessionStore.session_comments?.length ? 'opacity-100' : 'opacity-0']"
        ></div>
      </div>
    </div>
    <div class="flex w-full items-center justify-end gap-2">
      <div class="text-xs font-medium text-slate-6">ID {{ sessionStore.session?.id }}</div>
      <div
        class="h-2 w-2 shrink-0 rounded-full transition-all"
        :class="{ 'bg-tomato-7': counter % 2 === 0, 'bg-slate-6': counter % 2 === 1 }"
      ></div>
      <div
        class="grid w-16 grid-cols-5 items-center text-xs font-semibold text-slate-8 transition-all"
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
      :disabled="!appStore.network_status.connected"
      @click="openEndSession"
    >
      {{ appStore.network_status.connected ? 'End' : 'Offline' }}
    </AppButton>
    <RouterLink v-else :to="redirect">
      <AppButton kind="outline">Close</AppButton>
    </RouterLink>
  </div>

  <div
    class="fixed left-1/2 z-[9] -translate-x-1/2 transition-all pt-safe"
    :class="{ 'top-[60px]': cycleLoading, '-top-[60px]': !cycleLoading }"
  >
    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow">
      <Icon icon="mingcute:loading-fill" class="animate-spin text-2xl text-light-purple-5" />
    </div>
  </div>

  <div
    v-if="!sessionLoading && sessionStore.session?.status === 'ongoing'"
    class="flex h-28 items-end justify-center bg-prim-3 px-4 text-center text-sm font-semibold text-light-purple-5"
  >
    <div v-if="runningMeasurements.length">
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
    class="flex min-h-screen w-full flex-col items-center bg-prim-3"
    :style="{ height: containerHeight }"
  >
    <div
      v-if="showReviewMode"
      class="flex w-full items-end justify-center bg-prim-3 px-4 pb-2 pt-4 text-center text-sm font-semibold text-light-purple-5"
    >
      <div class="truncate">{{ sessionStore.session?.client?.name }}</div>
    </div>
    <div
      id="container-record-measurement"
      class="flex w-full flex-wrap justify-center gap-4 px-4 py-4 transition-all duration-500"
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
      <div v-if="sessionLoading" class="flex w-full flex-wrap justify-center gap-4">
        <div
          v-for="n in 8"
          :key="n"
          class="h-[520px] w-[320px] shrink-0 animate-pulse rounded bg-prim-1"
        ></div>
      </div>
      <div v-else class="flex w-full flex-wrap justify-center gap-4">
        <MeasurementRecord
          v-for="measurement in normalMeasurements"
          :key="measurement.id"
          :id="`measurement-record-${measurement.id}`"
          :measurement="measurement"
          :counter="counter"
          :review_mode="showReviewMode"
          @toggle-running="onToggleRunning"
          @click="onFocusMeasurement(measurement)"
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
        'h-[120px] justify-center': isMeasurementCollapsed,
        'no-scrollbar h-[calc(100vh-52px)] flex-col items-center gap-4 overflow-y-auto py-4':
          !isMeasurementCollapsed
      }"
    >
      <div v-if="!isMeasurementCollapsed" class="flex flex-col items-center gap-1">
        <Icon icon="ph:lock-fill" class="text-center text-2xl text-prim-5" />
        <div class="text-center text-xs font-medium text-prim-5">
          You're viewing a locked target.
        </div>
      </div>
      <MeasurementRecord
        :measurement="fixedMeasurement"
        :counter="counter"
        :is_collapsed="isMeasurementCollapsed"
        @toggle-running="onToggleRunning"
        @toggle-collapsed="isMeasurementCollapsed = $event"
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
    <div class="flex h-16 grow items-center gap-6 pl-4">
      <div class="relative" @click="showReviewMode = !showReviewMode">
        <div
          class="flex h-10 w-8 items-center justify-center rounded bg-white text-xs font-semibold text-dark-purple-1"
        >
          {{ sessionStore.session_measurements.length }}
        </div>
        <div
          class="absolute top-0 -z-[1] h-10 w-8 rounded bg-prim-4 transition-all duration-500"
          :class="{ 'left-2 rotate-[15deg]': !showReviewMode, 'left-0 rotate-0': showReviewMode }"
        ></div>
      </div>
      <div
        class="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth py-3 pr-4"
      >
        <div
          v-for="opt in sessionStore.session_measurements"
          :key="opt.id"
          :id="`measurement-nav-${opt.id}`"
          class="flex h-8 max-w-32 shrink-0 cursor-pointer snap-start items-center rounded-full border px-3 text-xs font-medium transition-all"
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
      <div class="text-center text-xl font-semibold">Oops! You're offline</div>
      <div class="text-center text-sm">
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
      <div class="text-center text-xl font-semibold">End this session?</div>
      <div class="text-center text-sm">
        Are you sure you want to end this session? Make sure you've reviewed all data before
        finalizing.
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="showEndSession = false">Cancel</AppButton>
        <AppButton :loading="endSessionLoading" @click="onEndSession">End now</AppButton>
      </div>
    </div>
    <div v-if="endSessionStatus === 'group_reason'" class="flex flex-col items-center gap-4">
      <div class="text-center text-xl font-semibold">Session can't be ended</div>
      <div class="text-center text-sm">
        You can't end the session because of the following reason(s):
      </div>
      <div class="w-full px-4 text-sm">
        <ul class="list-disc">
          <li v-for="(text, idx) in groupReasons" :key="idx">{{ text }}</li>
        </ul>
      </div>
      <div class="text-center text-sm">Please address these issues before ending the session.</div>
      <AppButton kind="plain" class="w-full" @click="showEndSession = false">
        Back to session
      </AppButton>
    </div>
    <div v-if="endSessionStatus === 'empty_record'" class="flex flex-col items-center gap-4">
      <div class="text-center text-xl font-semibold">It seems you haven't recorded any data</div>
      <img
        alt="measurement_droped"
        class="h-auto w-full rounded"
        src="@/assets/measurement_droped.png"
      />
      <div class="text-center text-sm">
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
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-orange-3">
        <Icon icon="ph:seal-warning-fill" class="text-2xl text-orange-6" />
      </div>
      <div class="text-2xl text-[22px] font-bold">Passing success metric</div>
    </div>
    <div class="flex grow flex-col gap-3 px-4">
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
          class="flex flex-col gap-2 border-b border-slate-3 py-3"
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
      <div class="flex h-16 grow items-center px-4">
        <AppButton class="w-full" @click="onExitSession">Close session</AppButton>
      </div>
    </div>
  </TransitionRoot>
</template>
