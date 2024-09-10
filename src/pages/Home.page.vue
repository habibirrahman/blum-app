<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TransitionRoot } from '@headlessui/vue'
import { useAppStore } from '@/stores/app.store'
import { useSessionStore } from '@/stores/session.store'
import type { Session } from '@/lib/types'
import { Icon } from '@iconify/vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppPagination from '@/components/AppPagination.vue'
import UpcomingSession from '@/partitions/UpcomingSession.vue'
import SessionItem from '@/partitions/SessionItem.vue'
import moment from 'moment'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const sessionStore = useSessionStore()

const upcomingLoading = ref<boolean>(false)
const sessionsLoading = ref<boolean>(false)

const page = ref<number>(1)
const perPage = ref<number>(25)
watch(page, (val, old) => {
  if (val !== old) {
    fetchSessions()
  }
})

const query = ref<string>('')
const queryTimeout = ref<any>(null)
watch(query, () => {
  sessionsLoading.value = true
  clearTimeout(queryTimeout.value)
  queryTimeout.value = setTimeout(() => {
    page.value = 1
    fetchSessions()
  }, 1500)
})

type Date = 'isoWeeks' | 'months' | ''
const date = ref<Date>('')
const dateOptions: { value: Date; label: string }[] = [
  { value: 'isoWeeks', label: 'This week' },
  { value: 'months', label: 'This month' }
]
watch(date, (val) => {
  if (val && status.value !== 'scheduled') {
    status.value = 'scheduled'
  }
  sessionsLoading.value = true
  page.value = 1
  fetchSessions()
})

type Status = 'scheduled' | 'unscheduled' | ''
const status = ref<Status>('')
const selectStatus = ref<Status>('')
const statusOptions: { value: Status; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'unscheduled', label: 'Unscheduled' }
]
const showStatus = ref<boolean>(false)
watch(showStatus, () => {
  selectStatus.value = status.value
})
const onResetStatus = () => {
  status.value = ''
  selectStatus.value = ''
  showStatus.value = false
  page.value = 1
  fetchSessions()
}
const onApplyStatus = () => {
  status.value = selectStatus.value
  if (selectStatus.value === 'unscheduled') {
    date.value = ''
  }
  showStatus.value = false
  page.value = 1
  fetchSessions()
}

type Sort = 'newest_session_id' | 'oldest_session_id' | 'most_recent_schedule' | 'earliest_schedule'
const sort = ref<Sort>('newest_session_id')
const selectSort = ref<Sort>('newest_session_id')
const sortOptions: { value: Sort; label: string }[] = [
  { value: 'newest_session_id', label: 'Newest session ID' },
  { value: 'oldest_session_id', label: 'Oldest session ID' },
  { value: 'most_recent_schedule', label: 'Most recent schedule' },
  { value: 'earliest_schedule', label: 'Earliest schedule' }
]
const showSort = ref<boolean>(false)
watch(showSort, () => {
  selectSort.value = sort.value
})
const onResetSort = () => {
  sort.value = 'newest_session_id'
  selectSort.value = 'newest_session_id'
  showSort.value = false
  page.value = 1
  fetchSessions()
}
const onApplySort = () => {
  sort.value = selectSort.value
  showSort.value = false
  page.value = 1
  fetchSessions()
}

const params = computed<string>(() => {
  let p = `?page=${page.value}&per_page=25`
  if (query.value) p += `&query=${query.value}`
  if (date.value) {
    const d = moment()
    p += `&start_date=${d.startOf(date.value).format('YYYY-MM-DD')}`
    p += `&end_date=${d.endOf(date.value).format('YYYY-MM-DD')}`
  }
  if (status.value) p += `&status=${status.value}`
  p += `&sort=${sort.value}`
  return p
})

async function fetchUpcoming() {
  upcomingLoading.value = true
  const { success } = await sessionStore.getUpcomingSessions()
  upcomingLoading.value = false
  if (!success) return
}
async function fetchSessions() {
  sessionsLoading.value = true
  const { success } = await sessionStore.getSessions({ params: params.value })
  sessionsLoading.value = false
  if (!success) return
  document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  upcomingLoading.value = true
  /** generate session.store from storage */
  await sessionStore.generateSessionStore()
  fetchUpcoming()
  fetchSessions()
})

const showJoinConfirmation = ref<boolean>(false)
const sessionToJoin = ref<Session | null>(null)
const onOpenSession = (session: Session) => {
  sessionToJoin.value = null
  if (session.status === 'draft') {
    router.push({
      name: 'pre-session-record',
      params: { slug: session?.slug },
      query: { redirect: '/home' }
    })
  } else {
    if (session.user_id === appStore.account?.id) {
      router.push({
        name: 'session-record',
        params: { slug: session?.slug },
        query: { redirect: '/home' }
      })
    } else {
      sessionToJoin.value = session
      showJoinConfirmation.value = true
    }
  }
}
</script>

<template>
  <div
    v-if="upcomingLoading || sessionsLoading"
    class="fixed z-[99] grid h-screen w-screen place-content-center bg-slate-10/30"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-1" />
  </div>

  <div
    class="space-y-3 pt-3 transition-all"
    :class="{ 'bg-chestnut-1': sessionStore.upcoming_sessions_count }"
  >
    <div class="flex items-center gap-3 px-4">
      <div class="text-2xl text-[22px] font-bold text-dark-purple-1">Draft Sessions</div>
      <div
        v-if="!sessionsLoading"
        class="flex h-6 min-w-6 items-center justify-center rounded bg-light-purple-5 px-1 text-xs font-semibold text-white"
      >
        {{ sessionStore.sessions_count }}
      </div>
    </div>
    <div v-if="sessionStore.upcoming_sessions_count" class="space-y-1.5">
      <div class="flex items-center gap-1.5 px-4">
        <div class="text-xs font-semibold text-dark-purple-1">Your upcoming sessions for today</div>
        <div
          class="flex h-6 min-w-6 items-center justify-center rounded bg-white px-1 text-xs font-semibold text-dark-purple-1"
        >
          {{ sessionStore.upcoming_sessions_count }}
        </div>
      </div>
      <div class="pl-4">
        <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
          <RouterLink
            v-for="session in sessionStore.upcoming_sessions"
            :key="session.id"
            :to="{
              name: 'pre-session-record',
              params: { slug: session?.slug },
              query: { redirect: '/home' }
            }"
          >
            <UpcomingSession :session="session" />
          </RouterLink>
        </div>
      </div>
    </div>
  </div>

  <div class="sticky top-0 space-y-3 bg-white pt-3">
    <div class="px-4">
      <AppTextInput
        name="query"
        placeholder="Search draft by client name or ID"
        v-model="query"
        suffix_icon="ph:magnifying-glass"
      />
    </div>
    <div class="pl-4">
      <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
        <div
          v-for="opt in dateOptions"
          :key="opt.value"
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center rounded-full border px-3 text-xs font-medium transition-all"
          :class="[
            date === opt.value
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="date = date === opt.value ? '' : opt.value"
        >
          {{ opt.label }}
        </div>
        <div
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium capitalize transition-all"
          :class="[
            status
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="showStatus = true"
        >
          <span>{{ statusOptions.find((i) => i.value === status)?.label || 'All statuses' }}</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
        <div
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border border-slate-4 bg-white px-4 text-xs font-medium capitalize transition-all"
          @click="showSort = true"
        >
          <Icon icon="ph:arrows-down-up" class="text-base text-slate-8" />
          <span>{{ sortOptions.find((i) => i.value === sort)?.label }}</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="!sessionStore.sessions_count"
    class="flex h-64 w-full items-center justify-center px-4"
  >
    <div v-if="date" class="text-center text-sm text-slate-8">
      No draft sessions scheduled for this {{ date === 'isoWeeks' ? 'week' : 'month' }}.
    </div>
    <div v-else class="text-center text-sm text-slate-8">
      Oops! No draft sessions fit your filter criteria. Try changing the filter to find more
      results!
    </div>
  </div>
  <div v-else>
    <div class="px-4 pt-2 text-xs text-slate-7">
      <span>Showing </span>
      <span>
        {{ (page - 1) * perPage + 1 }}-{{
          page * perPage > sessionStore.sessions_count
            ? sessionStore.sessions_count
            : page * perPage
        }}
      </span>
      <span> of {{ sessionStore.sessions_count }}</span>
    </div>
    <div class="px-4">
      <SessionItem
        v-for="session in sessionStore.sessions"
        :key="session.id"
        :session="session"
        @click="onOpenSession(session)"
      />
    </div>
    <AppPagination
      :page="page"
      :total_count="sessionStore.sessions_count"
      @change="page = $event"
    />
  </div>

  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Statuses</div>
        <div class="cursor-pointer" @click="showStatus = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in statusOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between border-b border-slate-3"
        >
          <label :for="`status_filter_${opt.value}`" class="w-full text-sm">{{ opt.label }}</label>
          <input
            type="radio"
            name="status_filter"
            :id="`status_filter_${opt.value}`"
            :checked="selectStatus === opt.value"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="selectStatus = opt.value"
          />
        </div>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="onResetStatus">Reset</AppButton>
        <AppButton @click="onApplyStatus">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showSort" @close="showSort = false">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Sort by</div>
        <div class="cursor-pointer" @click="showSort = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in sortOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between border-b border-slate-3"
        >
          <label :for="`sort_by_${opt.value}`" class="w-full text-sm">{{ opt.label }}</label>
          <input
            type="radio"
            name="sort_by"
            :id="`sort_by_${opt.value}`"
            :checked="selectSort === opt.value"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="selectSort = opt.value"
          />
        </div>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="onResetSort">Reset</AppButton>
        <AppButton @click="onApplySort">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <TransitionRoot
    :show="showJoinConfirmation"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-75"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-75"
    class="fixed left-0 top-0 z-[101] flex h-screen w-screen items-center justify-center rounded border-2 bg-white"
  >
    <div
      class="absolute top-0 -z-[1] h-[100vw] w-[100vw] -translate-y-1/2 rounded-full bg-prim-3 blur-2xl"
    ></div>
    <div class="flex flex-col items-center gap-4 px-6">
      <div class="flex flex-col items-center gap-2">
        <div
          class="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-lime-3 text-xl font-semibold text-lime-8"
        >
          {{ sessionToJoin?.client?.name?.charAt(0) }}
        </div>
        <div class="text-sm text-light-purple-4">Session ID {{ sessionToJoin?.id }}</div>
        <div class="text-center text-xl font-semibold text-dark-purple-1">
          Session in progress for {{ sessionToJoin?.client?.name }}
        </div>
        <div class="flex flex-col items-center gap-4 text-sm text-light-purple-5">
          <div class="text-center">
            This session with
            <span class="font-semibold">{{ sessionToJoin?.client?.name }}</span> is currently being
            conducted by <span class="font-semibold">{{ sessionToJoin?.user?.name }}</span
            >.
          </div>
          <div class="text-center">
            If you join,
            <span class="font-semibold">you won't be able to leave until the session ends.</span>
          </div>
          <div class="text-center">Are you sure you want to join?</div>
        </div>
      </div>
      <RouterLink
        :to="{
          name: 'session-record',
          params: { slug: sessionToJoin?.slug },
          query: { redirect: '/home' }
        }"
        class="w-full"
      >
        <AppButton kind="outline" class="w-full">Join this session</AppButton>
      </RouterLink>
      <AppButton class="w-full" @click="showJoinConfirmation = false">Cancel</AppButton>
    </div>
  </TransitionRoot>
</template>
