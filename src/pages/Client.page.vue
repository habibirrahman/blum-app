<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteParamsRaw } from 'vue-router'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import DraftSessions from '@/partitions/client/DraftSessions.vue'
import PastSessions from '@/partitions/client/PastSessions.vue'
import Targets from '@/partitions/client/Targets.vue'
import Profile from '@/partitions/client/Profile.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
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
      params: { id: route.params.id, tab: 'draft-sessions' },
      label: 'Draft sessions',
      is_active: route.params.tab === 'draft-sessions'
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

async function fetchClient() {
  clientLoading.value = true
  const id = Number(route.params.id)
  const { success } = await clientStore.getClient({ id })
  clientLoading.value = false
  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }
}

onMounted(() => {
  appStore.getRunningSessions()

  fetchClient()
})
</script>

<template>
  <div class="sticky top-safe z-10 bg-chestnut-1">
    <div class="flex h-10 w-full items-center justify-center font-semibold text-dark-purple-1">
      <div class="truncate px-4">
        {{ clientStore.client?.name }}
      </div>
    </div>
    <div class="flex h-10 items-end">
      <div
        class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth border-b border-chestnut-2 px-4"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.label"
          :to="{
            name: 'client',
            params: tab.params
          }"
          class="flex h-7 shrink-0 items-center border-b-[3px] px-3 text-xs font-medium transition-all"
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

  <div
    v-if="clientLoading"
    class="grid h-[calc(100vh-80px)] w-screen place-content-center bg-slate-10/30"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-1" />
  </div>
  <div v-else>
    <DraftSessions v-if="route.params.tab === 'draft-sessions'" />
    <PastSessions v-if="route.params.tab === 'past-sessions'" />
    <Targets v-if="route.params.tab === 'targets'" />
    <Profile v-if="route.params.tab === 'profile'" />
  </div>
</template>
