<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, type RouteParamsRaw } from 'vue-router'
import { useClientStore } from '@/stores/client.store'
import SessionsDraft from '@/partitions/client/SessionsDraft.vue'
import PastSessions from '@/partitions/client/PastSessions.vue'
import Targets from '@/partitions/client/Targets.vue'
import Profile from '@/partitions/client/Profile.vue'
import SessionItemLoader from '@/components/skeletons/SessionItemLoader.vue'

const route = useRoute()
const clientStore = useClientStore()

const clientLoading = ref<boolean>(true)

interface Tab {
  params: RouteParamsRaw
  label: string
  is_active: boolean
}
const tabs = computed<Tab[]>(() => {
  return [
    {
      params: { id: route.params.id, tab: 'sessions-draft' },
      label: 'Sessions Draft',
      is_active: route.params.tab === 'sessions-draft'
    },
    {
      params: { id: route.params.id, tab: 'past-sessions' },
      label: 'Past sessions',
      is_active: route.params.tab === 'past-sessions'
    },
    {
      params: { id: route.params.id, tab: 'targets' },
      label: 'Targets',
      is_active: route.params.tab === 'targets'
    },
    {
      params: { id: route.params.id, tab: 'profile' },
      label: 'Profile',
      is_active: route.params.tab === 'profile'
    }
  ]
})

const fetchClientTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
async function fetchClient() {
  clientLoading.value = true
  const id = Number(route.params.id)
  const { success } = await clientStore.getClient({ id })
  clientLoading.value = false
  if (!success) return
  fetchClientTimeout.value = setTimeout(() => {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
  }, 100)

  return () => {
    if (fetchClientTimeout.value) {
      clearTimeout(fetchClientTimeout.value)
      fetchClientTimeout.value = undefined
    }
  }
}

onMounted(() => {
  fetchClient()
})

onUnmounted(() => {
  // Clear timeout to prevent memory leaks
  if (fetchClientTimeout.value) {
    clearTimeout(fetchClientTimeout.value)
    fetchClientTimeout.value = undefined
  }
})
</script>

<template>
  <div class="sticky top-0 z-10 bg-chestnut-1">
    <div class="flex justify-center items-center w-full h-10 font-semibold text-dark-purple-1">
      <div class="px-4 truncate">
        {{ clientStore.client?.name }}
      </div>
    </div>
    <div class="flex items-end h-10">
      <div
        class="flex overflow-x-auto gap-2 px-4 border-b snap-x snap-mandatory scroll-smooth border-chestnut-2"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.label"
          :to="{
            name: 'client',
            params: tab.params
          }"
          class="flex h-7 shrink-0 items-center border-b-[3px] px-3 text-xs font-medium transition-colors"
          :class="{
            'border-transparent text-slate-7': !tab.is_active,
            'border-light-purple-5 text-light-purple-5': tab.is_active
          }"
        >
          {{ tab.label }}
        </RouterLink>
      </div>
    </div>
  </div>

  <div v-if="clientLoading">
    <div class="px-4 pt-3">
      <div class="w-56 h-8 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
    </div>
    <div class="px-4 pt-3">
      <div class="w-full h-9 rounded animate-pulse shrink-0 bg-slate-3"></div>
    </div>
    <div class="flex gap-2 px-4 pt-3">
      <div
        v-for="n in 3"
        :key="n"
        class="w-24 h-8 rounded-full animate-pulse shrink-0 bg-slate-3"
      ></div>
    </div>
    <div class="flex flex-col px-4 pt-5">
      <div class="w-24 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
      <SessionItemLoader v-for="n in 12" :key="n" />
    </div>
    <!-- <div class="flex flex-col gap-3 items-center px-4 py-6">
      <div class="h-[60px] w-[60px] shrink-0 animate-pulse rounded-full bg-slate-3"></div>
      <div class="flex flex-col gap-2 items-center">
        <div class="w-56 h-6 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
        <div class="w-24 h-6 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
        <div class="flex gap-1 items-center">
          <div v-for="n in 2" :key="n" class="w-12 h-5 rounded animate-pulse bg-slate-3"></div>
        </div>
      </div>
    </div>
    <div class="px-4">
      <div v-for="n in 12" :key="n" class="flex flex-col gap-1.5 py-3 border-b border-slate-3">
        <div class="w-12 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
        <div class="w-48 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
      </div>
    </div> -->
  </div>
  <div v-else>
    <SessionsDraft v-if="route.params.tab === 'sessions-draft'" />
    <PastSessions v-if="route.params.tab === 'past-sessions'" />
    <Targets v-if="route.params.tab === 'targets'" />
    <Profile v-if="route.params.tab === 'profile'" />
  </div>
</template>
