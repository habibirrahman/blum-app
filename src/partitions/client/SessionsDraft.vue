<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import UpcomingSession from '../UpcomingSession.vue'
import type { Session } from '@/lib/types'
import SessionItem from '../SessionItem.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import { TransitionRoot } from '@headlessui/vue'
import { displayDate } from '@/lib/func'
import SessionItemLoader from '@/components/skeletons/SessionItemLoader.vue'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from 'vue-toastification'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const clientStore = useClientStore()
const sessionStore = useSessionStore()

const upcomingLoading = ref<boolean>(false)
const sessionsLoading = ref<boolean>(false)

const page = ref<number>(1)
const perPage = ref<number>(25)
watch(page, (val, old) => {
  if (val !== old) {
    fetchDraftSession()
  }
})

const query = ref<string>('')
const queryTimeout = ref<number | undefined>(undefined)
watch(query, () => {
  if (queryTimeout.value) {
    clearTimeout(queryTimeout.value)
    queryTimeout.value = undefined
  }

  queryTimeout.value = setTimeout(() => {
    sessionsLoading.value = true
    page.value = 1
    fetchDraftSession()
  }, 1500)

  return () => {
    if (queryTimeout.value) {
      clearTimeout(queryTimeout.value)
      queryTimeout.value = undefined
    }
  }
})

type Date = 'days' | 'isoWeeks' | 'months' | ''
const date = ref<Date>('')
const dateOptions: { value: Date; label: string }[] = [
  { value: 'days', label: 'Today' },
  { value: 'isoWeeks', label: 'This week' },
  { value: 'months', label: 'This month' }
]
watch(date, (val) => {
  if (val && status.value !== 'scheduled') {
    status.value = 'scheduled'
  }
  sessionsLoading.value = true
  page.value = 1
  fetchDraftSession()
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
  fetchDraftSession()
}
const onApplyStatus = () => {
  status.value = selectStatus.value
  if (selectStatus.value === 'unscheduled') {
    date.value = ''
  }
  showStatus.value = false
  page.value = 1
  fetchDraftSession()
}

type Sort = 'newest_session_id' | 'oldest_session_id' | 'most_recent_schedule' | 'earliest_schedule'
const sort = ref<Sort>('most_recent_schedule')
const selectSort = ref<Sort>('most_recent_schedule')
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
  sort.value = 'most_recent_schedule'
  selectSort.value = 'most_recent_schedule'
  showSort.value = false
  page.value = 1
  fetchDraftSession()
}
const onApplySort = () => {
  sort.value = selectSort.value
  showSort.value = false
  page.value = 1
  fetchDraftSession()
}

const params = computed<string>(() => {
  let p = `?page=${page.value}&per_page=${perPage.value}`
  if (query.value) p += `&query=${query.value}`
  p += `&status=draft,ongoing`
  return p
})

async function fetchUpcomingSessions() {
  upcomingLoading.value = true
  const id = Number(route.params.id)
  const { success } = await clientStore.getClientUpcomingSessions({ id })
  upcomingLoading.value = false
  if (!success) return
}

const fetchDraftSessionTimeout = ref<number | undefined>(undefined)
async function fetchDraftSession() {
  sessionsLoading.value = true
  const id = Number(route.params.id)
  const { success } = await clientStore.getClientDraftSessions({ id, params: params.value })
  sessionsLoading.value = false
  if (!success) return

  fetchDraftSessionTimeout.value = setTimeout(() => {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
  }, 100)

  return () => {
    if (fetchDraftSessionTimeout.value) {
      clearTimeout(fetchDraftSessionTimeout.value)
      fetchDraftSessionTimeout.value = undefined
    }
  }
}

onMounted(() => {
  fetchUpcomingSessions()
  fetchDraftSession()
})

onUnmounted(() => {
  // Clear timeout to prevent memory leak
  if (queryTimeout.value) {
    clearTimeout(queryTimeout.value)
    queryTimeout.value = undefined
  }
  if (fetchDraftSessionTimeout.value) {
    clearTimeout(fetchDraftSessionTimeout.value)
    fetchDraftSessionTimeout.value = undefined
  }
})

const showJoinConfirmation = ref<boolean>(false)
const sessionToJoin = ref<Session | null>(null)
const onOpenSession = (event: Event, session: Session) => {
  const target = event.target as HTMLElement
  // Check if the clicked element or its parent has the ID
  if (target.id === 'action-button' || target.closest('#action-button')) {
    return
  }

  sessionToJoin.value = null
  if (session.status === 'draft') {
    router.push({
      name: 'pre-session-record',
      params: { slug: session?.slug },
      query: { redirect: `/clients/${route.params.id}/${route.params.tab}` }
    })
  } else {
    if (session.user_id === appStore.account?.id) {
      router.push({
        name: 'session-record',
        params: { slug: session?.slug },
        query: { redirect: `/clients/${route.params.id}/${route.params.tab}` }
      })
    } else {
      sessionToJoin.value = session
      showJoinConfirmation.value = true
    }
  }
}

const createLoading = ref<boolean>(false)
const onCreateSession = async () => {
  try {
    createLoading.value = true
    const payload = { client_id: clientStore.client?.id }

    const { data, success, message } = await sessionStore.createSession(payload)
    createLoading.value = false

    if (!success) {
      toast.error(message)
      return
    }

    toast.success('Success! The session has been added')
    router.push({
      name: 'session-select-target',
      params: { slug: data.slug },
      query: {
        redirect: `/clients/${clientStore.client?.id}/sessions-draft`,
        after_submit: `pre-session-record`
      }
    })
  } catch (error) {
    createLoading.value = false
    console.error(error)
  }
}
</script>

<template>
  <div
    class="space-y-3 pt-3 transition-colors"
    :class="{ 'bg-chestnut-1': clientStore.upcoming_sessions_count }"
  >
    <div class="flex items-center gap-3 px-4">
      <div class="text-2xl text-[22px] font-bold text-dark-purple-1">Sessions Draft</div>
      <div v-if="sessionsLoading" class="h-6 w-6 shrink-0 animate-pulse rounded bg-slate-3"></div>
      <div
        v-else
        class="flex h-6 min-w-6 items-center justify-center rounded bg-light-purple-5 px-1 text-xs font-semibold text-white"
      >
        {{ clientStore.draft_sessions_count }}
      </div>
    </div>
    <div v-if="clientStore.upcoming_sessions_count" class="space-y-1.5">
      <div class="px-4 text-xs font-semibold text-dark-purple-1">
        {{ clientStore.upcoming_sessions.length }} upcoming session(s) assigned to you this week
      </div>
      <div class="pl-4">
        <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
          <RouterLink
            v-for="session in clientStore.upcoming_sessions"
            :key="session.id"
            :to="{
              name: 'pre-session-record',
              params: { slug: session?.slug },
              query: { redirect: `/clients/${route.params.id}/${route.params.tab}` }
            }"
          >
            <UpcomingSession
              :session="session"
              :title="
                displayDate({
                  date: session.appointment?.date,
                  format: 'dddd, DD MMM YYYY',
                  empty: 'No scheduled date'
                })
              "
            />
          </RouterLink>
        </div>
      </div>
    </div>
  </div>

  <div class="space-y-3 bg-white pt-3">
    <div class="flex items-center gap-4 px-4">
      <AppTextInput
        name="query"
        placeholder="Search draft by client name or ID"
        v-model="query"
        suffix-icon="ph:magnifying-glass"
        class="flex-grow"
      />
      <AppButton :loading="createLoading" @click="onCreateSession">
        <Icon icon="ph:plus" />
      </AppButton>
    </div>
    <div class="pl-4">
      <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
        <div
          v-for="opt in dateOptions"
          :key="opt.value"
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center rounded-full border px-3 text-xs font-medium transition-colors"
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
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-colors"
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
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border border-slate-4 bg-white px-4 text-xs font-medium"
          @click="showSort = true"
        >
          <Icon icon="ph:arrows-down-up" class="text-base text-slate-8" />
          <span>{{ sortOptions.find((i) => i.value === sort)?.label }}</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
      </div>
    </div>
  </div>

  <div v-if="sessionsLoading">
    <div class="px-4 pt-2">
      <div class="h-4 w-24 shrink-0 animate-pulse rounded-full bg-slate-3"></div>
    </div>
    <div class="px-4">
      <SessionItemLoader v-for="n in perPage" :key="n" />
    </div>
  </div>
  <div
    v-else-if="!clientStore.draft_sessions_count"
    class="flex h-64 w-full items-center justify-center px-4"
  >
    <div v-if="date" class="text-center text-sm text-slate-8">
      No sessions draft scheduled for
      {{ date === 'days' ? 'today' : date === 'isoWeeks' ? 'this week' : 'this month' }}.
    </div>
    <div v-else-if="query" class="text-center text-sm text-slate-8">
      Sorry, no drafts match your search. Try searching with a different therapist name or session
      ID.
    </div>
    <div v-else class="text-center text-sm text-slate-8">No sessions draft are available yet.</div>
  </div>
  <div v-else>
    <div class="px-4 pt-2 text-xs text-slate-7">
      <span>Showing </span>
      <span>
        {{ (page - 1) * perPage + 1 }}-{{
          page * perPage > clientStore.draft_sessions_count
            ? clientStore.draft_sessions_count
            : page * perPage
        }}
      </span>
      <span> of {{ clientStore.draft_sessions_count }}</span>
    </div>
    <div class="px-4">
      <SessionItem
        v-for="session in clientStore.draft_sessions"
        :key="session.id"
        :session="session"
        :title="session.appointment_id ? `With ${session.appointment?.user?.name}` : `Unscheduled`"
        @click="onOpenSession($event, session)"
        @after-commit="fetchDraftSession"
      />
    </div>
    <AppPagination
      :page="page"
      :per-page="perPage"
      :total-count="clientStore.draft_sessions_count"
      @change="page = $event"
    />
  </div>

  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div>
      <div class="sticky top-0 z-10 flex w-full items-center justify-between bg-white py-3">
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

      <div class="sticky bottom-0 z-10 grid w-full grid-cols-2 gap-2 bg-white py-3">
        <AppButton kind="plain" @click="onResetStatus">Reset</AppButton>
        <AppButton @click="onApplyStatus">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showSort" @close="showSort = false">
    <div>
      <div class="sticky top-0 z-10 flex w-full items-center justify-between bg-white py-3">
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

      <div class="sticky bottom-0 z-10 grid w-full grid-cols-2 gap-2 bg-white py-3">
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
    class="fixed left-0 top-0 z-[101] flex h-screen w-screen items-center justify-center bg-white p-safe"
  >
    <div class="fixed top-0 z-[999999] w-screen bg-white pt-safe"></div>
    <div class="fixed bottom-0 z-[999999] w-screen bg-white pb-safe"></div>

    <div
      class="fixed top-0 z-[1] h-[100vw] w-[100vw] -translate-y-1/2 rounded-full bg-prim-3 blur-2xl"
    ></div>
    <div class="z-[2] flex flex-col items-center gap-4 px-6">
      <div class="flex flex-col items-center gap-2">
        <div class="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-lime-3">
          <div class="text-xl font-semibold uppercase text-lime-8">
            {{ sessionToJoin?.client?.name?.charAt(0) }}
          </div>
        </div>
        <div class="text-sm text-light-purple-4">
          <span v-if="!sessionToJoin?.name">Session ID </span>
          <span>{{ sessionToJoin?.id }}</span>
          <span v-if="sessionToJoin?.name"> - {{ sessionToJoin?.name }}</span>
        </div>
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
          query: { redirect: `/clients/${route.params.id}/${route.params.tab}` }
        }"
        class="w-full"
      >
        <AppButton kind="outline" class="w-full">Join this session</AppButton>
      </RouterLink>
      <AppButton class="w-full" @click="showJoinConfirmation = false">Cancel</AppButton>
    </div>
  </TransitionRoot>
</template>
