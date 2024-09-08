<script setup lang="ts">
import { kApp } from 'konsta/vue'
import { computed, onBeforeMount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import router from './router'
import { useAppStore, type NetworkStatus } from './stores/app.store'
import { Icon } from '@iconify/vue'
import { Network } from '@capacitor/network'

const route = useRoute()
const appStore = useAppStore()

const loadingApp = ref<boolean>(false)
const routeName = computed<string>(() => route.name?.toString() || '')
const isUseNav = computed<boolean>(
  () => routeName.value !== 'signin' && !routeName.value.includes('record')
)
const networkStatus: NetworkStatus = reactive({
  connected: false,
  connection_type: 'none'
})
watch(
  () => networkStatus.connected,
  () => {
    appStore.setNetworkStatus(networkStatus)
  }
)

async function fetchCurrentUser() {
  loadingApp.value = true
  const { success } = await appStore.getAccount()
  loadingApp.value = false
  if (!success) {
    if (routeName.value !== 'signin') {
      router.push({ name: 'signin' })
    }
    return
  }

  if (routeName.value === 'signin') {
    router.push({ name: 'home' })
  }
}

const networkListener = (status: any) => {
  const { connected, connectionType } = status
  networkStatus.connected = connected
  networkStatus.connection_type = connectionType
}

async function setupNetwork() {
  const status = await Network.getStatus()
  const { connected, connectionType } = status
  networkStatus.connected = connected
  networkStatus.connection_type = connectionType
}

onBeforeMount(async () => {
  await setupNetwork()
  await fetchCurrentUser()
})
onMounted(() => {
  Network.addListener('networkStatusChange', networkListener)
})

interface Nav {
  route_name: string
  icon: string
  active_icon: string
  label: string
  is_active: boolean
}
const navigations = computed<Nav[]>(() => {
  return [
    {
      route_name: 'home',
      icon: 'ph:file',
      active_icon: 'ph:file-fill',
      label: 'Draft Sessions',
      is_active: routeName.value.includes('home')
    },
    {
      route_name: 'about',
      icon: 'ph:user-square',
      active_icon: 'ph:user-square-fill',
      label: 'Clients',
      is_active: routeName.value.includes('about')
    },
    {
      route_name: 'about',
      icon: 'ph:camera',
      active_icon: 'ph:camera-fill',
      label: 'Scan Sessions',
      is_active: routeName.value.includes('about')
    },
    {
      route_name: 'profile',
      icon: 'ph:user-circle',
      active_icon: 'ph:user-circle-fill',
      label: 'Profile',
      is_active: routeName.value.includes('profile')
    }
  ]
})
</script>

<template>
  <k-app safe-areas theme="ios" class="font-sans">
    <div v-if="loadingApp" class="grid h-screen w-screen place-items-center">
      <div class="flex animate-pulse items-center font-logo text-4xl font-bold text-light-purple-5">
        Blüm
      </div>
    </div>
    <div v-else :class="{ 'pb-14': isUseNav }">
      <div
        class="fixed left-0 z-[999] h-1 w-screen bg-tomato-7 transition-all"
        :class="{ 'top-0': !networkStatus.connected, '-top-1': networkStatus.connected }"
      ></div>
      <RouterView />
    </div>

    <footer v-if="isUseNav" class="fixed bottom-0 z-[100] flex h-14 w-screen bg-white">
      <nav class="grid h-full w-full grid-cols-4 items-center">
        <RouterLink v-for="nav in navigations" :key="nav.route_name" :to="{ name: nav.route_name }">
          <Icon v-if="nav.is_active" :icon="nav.active_icon" class="text-xl text-light-purple-5" />
          <Icon v-else :icon="nav.icon" class="text-xl text-slate-7" />
          <div
            class="w-full truncate px-3 text-center text-xs transition-all"
            :class="{ 'text-light-purple-5': nav.is_active, 'text-slate-7': !nav.is_active }"
          >
            {{ nav.label }}
          </div>
        </RouterLink>
      </nav>
    </footer>
  </k-app>
</template>

<style scoped>
nav a {
  @apply flex h-full w-full flex-col items-center justify-center gap-1 transition-all hover:bg-light-purple-1;
}

/* nav a.router-link-exact-active {
  @apply bg-light-purple-1 text-dark-purple-2;
} */
</style>
