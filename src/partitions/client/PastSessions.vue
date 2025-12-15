<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import moment from 'moment'
import type { Session } from '@/lib/types'
import SessionItem from '../SessionItem.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import SessionItemLoader from '@/components/skeletons/SessionItemLoader.vue'

const route = useRoute()
const router = useRouter()
const clientStore = useClientStore()

const sessionsLoading = ref<boolean>(false)

const page = ref<number>(1)
const perPage = ref<number>(25)
watch(page, (val, old) => {
  if (val !== old) {
    fetchPastSessions()
  }
})

const query = ref<string>('')
const queryTimeout = ref<any>(null)
watch(query, () => {
  clearTimeout(queryTimeout.value)
  queryTimeout.value = setTimeout(() => {
    sessionsLoading.value = true
    page.value = 1
    fetchPastSessions()
  }, 1500)
})

type Date = 'days' | 'isoWeeks' | 'months' | ''
const date = ref<Date>('')
const dateOptions: { value: Date; label: string }[] = [
  { value: 'days', label: 'This day' },
  { value: 'isoWeeks', label: 'This week' },
  { value: 'months', label: 'This month' }
]
watch(date, () => {
  sessionsLoading.value = true
  page.value = 1
  fetchPastSessions()
})

type Sort = 'newest_session_id' | 'oldest_session_id' | 'newest' | 'oldest'
const sort = ref<Sort>('newest_session_id')
const selectSort = ref<Sort>('newest_session_id')
const sortOptions: { value: Sort; label: string }[] = [
  { value: 'newest_session_id', label: 'Newest session ID' },
  { value: 'oldest_session_id', label: 'Oldest session ID' },
  { value: 'newest', label: 'Most recent completed session' },
  { value: 'oldest', label: 'Oldest completed session' }
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
  fetchPastSessions()
}
const onApplySort = () => {
  sort.value = selectSort.value
  showSort.value = false
  page.value = 1
  fetchPastSessions()
}

const params = computed<string>(() => {
  let p = `?page=${page.value}&per_page=25`
  if (query.value) p += `&query=${query.value}`
  if (date.value) {
    const d = moment()
    p += `&start_date=${d.startOf(date.value).format('YYYY-MM-DD')}`
    p += `&end_date=${d.endOf(date.value).format('YYYY-MM-DD')}`
  }
  p += `&sort=${sort.value}`
  return p
})

async function fetchPastSessions() {
  sessionsLoading.value = true
  const id = Number(route.params.id)
  const { success } = await clientStore.getClientPastSessions({ id, params: params.value })
  sessionsLoading.value = false
  if (!success) return
  setTimeout(() => {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
  }, 100)
}

onMounted(() => {
  fetchPastSessions()
})

const getSessionTitle = (session: Session) => {
  if (session.status === 'completed') {
    return session.user_id ? `With ${session.user?.name}` : 'No therapist'
  }
  if (session.status === 'cancelled') {
    return session.appointment?.user_id ? `With ${session.appointment?.user?.name}` : 'No therapist'
  }
  return 'No therapist'
}

const onOpenSession = (session: Session) => {
  router.push({
    name: 'session-record',
    params: { slug: session?.slug },
    query: { redirect: `/clients/${route.params.id}/${route.params.tab}` }
  })
}
</script>

<template>
  <div class="pt-3 space-y-3 transition-all">
    <div class="flex items-center gap-3 px-4">
      <div class="text-2xl text-[22px] font-bold text-dark-purple-1">Past Sessions</div>
      <div v-if="sessionsLoading" class="w-6 h-6 rounded shrink-0 animate-pulse bg-slate-3"></div>
      <div
        v-else
        class="flex items-center justify-center h-6 px-1 text-xs font-semibold text-white rounded min-w-6 bg-light-purple-5"
      >
        {{ clientStore.past_sessions_count }}
      </div>
    </div>
  </div>

  <div class="pt-3 space-y-3 bg-white">
    <div class="px-4">
      <AppTextInput
        name="query"
        placeholder="Search session by therapist name or ID"
        v-model="query"
        suffix_icon="ph:magnifying-glass"
      />
    </div>
    <div class="pl-4">
      <div class="flex gap-2 pb-3 pr-4 overflow-x-auto snap-x snap-mandatory scroll-smooth">
        <div
          v-for="opt in dateOptions"
          :key="opt.value"
          class="flex items-center h-8 px-3 text-xs font-medium transition-all border rounded-full cursor-pointer shrink-0 snap-start"
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
          class="flex items-center h-8 gap-1 px-4 text-xs font-medium transition-all bg-white border rounded-full cursor-pointer shrink-0 snap-start border-slate-4"
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
      <div class="w-24 h-4 rounded-full shrink-0 animate-pulse bg-slate-3"></div>
    </div>
    <div class="px-4">
      <SessionItemLoader v-for="n in perPage" :key="n" />
    </div>
  </div>
  <div
    v-else-if="!clientStore.past_sessions_count"
    class="flex items-center justify-center w-full h-64 px-4"
  >
    <div v-if="date" class="text-sm text-center text-slate-8">
      No sessions completed for
      {{ date === 'days' ? 'today' : date === 'isoWeeks' ? 'this week' : 'this month' }}.
    </div>
    <div v-else-if="query" class="text-sm text-center text-slate-8">
      Sorry, no drafts match your search. Try searching with a different therapist name or session
      ID.
    </div>
    <div v-else class="text-sm text-center text-slate-8">
      No sessions completed or canceled yet. Once they are, you'll see them here.
    </div>
  </div>
  <div v-else>
    <div class="px-4 pt-2 text-xs text-slate-7">
      <span>Showing </span>
      <span>
        {{ (page - 1) * perPage + 1 }}-{{
          page * perPage > clientStore.past_sessions_count
            ? clientStore.past_sessions_count
            : page * perPage
        }}
      </span>
      <span> of {{ clientStore.past_sessions_count }}</span>
    </div>
    <div class="px-4">
      <SessionItem
        v-for="session in clientStore.past_sessions"
        :key="session.id"
        :session="session"
        :title="getSessionTitle(session)"
        @click="onOpenSession(session)"
      />
    </div>
    <AppPagination
      :page="page"
      :per_page="perPage"
      :total_count="clientStore.past_sessions_count"
      @change="page = $event"
    />
  </div>

  <AppActionSheet :show="showSort" @close="showSort = false">
    <div>
      <div class="sticky top-0 z-10 flex items-center justify-between w-full py-3 bg-white">
        <div class="text-xl font-semibold">Sort by</div>
        <div class="cursor-pointer" @click="showSort = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in sortOptions"
          :key="opt.value"
          class="flex items-center justify-between w-full border-b h-14 border-slate-3"
        >
          <label :for="`sort_by_${opt.value}`" class="w-full text-sm">{{ opt.label }}</label>
          <input
            type="radio"
            name="sort_by"
            :id="`sort_by_${opt.value}`"
            :checked="selectSort === opt.value"
            :value="opt.value"
            class="rounded-full shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="selectSort = opt.value"
          />
        </div>
      </div>

      <div class="sticky bottom-0 z-10 grid w-full grid-cols-2 gap-2 py-3 bg-white">
        <AppButton kind="plain" @click="onResetSort">Reset</AppButton>
        <AppButton @click="onApplySort">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
