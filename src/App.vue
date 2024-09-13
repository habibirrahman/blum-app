<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAppStore, type NetworkStatus } from './stores/app.store'
import { Icon } from '@iconify/vue'
import { Network } from '@capacitor/network'
import { useScreenSafeArea } from '@vueuse/core'
import AppButton from './components/AppButton.vue'

const {
  top: paddingTop,
  right: paddingRight,
  bottom: paddingBottom,
  left: paddingLeft
} = useScreenSafeArea()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const loadingApp = ref<boolean>(true)
const routeName = computed<string>(() => route.name?.toString() || 'signin')
const isShowRunningSession = computed<boolean>(
  () => appStore.running_sessions.length > 0 && routeName.value !== 'session-record'
)
const isUseNav = computed<boolean>(
  () =>
    routeName.value !== 'signin' &&
    !routeName.value.includes('record') &&
    !isShowRunningSession.value
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
  setTimeout(async () => {
    const { success } = await appStore.getAccount()
    loadingApp.value = false
    if (!success) {
      if (route.name !== 'signin') {
        router.push({ name: 'signin' })
      }
      return
    }
    if (route.name === 'signin') {
      router.push({ name: 'home' })
    }
  }, 1000)
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

onBeforeMount(() => {
  loadingApp.value = true
  setupNetwork()
})
onMounted(() => {
  fetchCurrentUser()
  Network.addListener('networkStatusChange', networkListener)
})
onUnmounted(() => {
  Network.removeAllListeners()
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
      route_name: 'clients',
      icon: 'ph:user-square',
      active_icon: 'ph:user-square-fill',
      label: 'Clients',
      is_active: routeName.value.includes('client')
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
  <div class="bg-white font-sans" :style="{ paddingLeft, paddingTop, paddingRight, paddingBottom }">
    <div v-if="loadingApp" class="grid h-screen w-screen place-items-center">
      <div class="flex animate-pulse items-center font-logo text-4xl font-bold text-light-purple-5">
        Blüm
      </div>
    </div>
    <div v-else :class="{ 'pb-14': isUseNav }">
      <div
        v-if="routeName !== 'session-record'"
        class="sticky left-0 top-0 z-[999] flex w-screen items-center justify-center bg-rose-3 text-sm font-medium text-rose-7 transition-all"
        :class="{ 'h-8': !networkStatus.connected, 'h-0': networkStatus.connected }"
      >
        <div v-if="!networkStatus.connected">You're offline. Connect to sync your data.</div>
      </div>

      <div
        v-if="isShowRunningSession"
        class="flex min-h-screen w-screen items-center justify-center bg-white"
      >
        <div
          class="fixed top-0 z-[1] h-[100vw] w-[100vw] -translate-y-1/2 rounded-full bg-prim-3 blur-2xl"
        ></div>
        <div class="z-[2] flex max-h-full flex-col items-center gap-4 px-6 py-6">
          <div class="flex flex-col items-center gap-2">
            <div class="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-lime-3">
              <div class="text-xl font-semibold uppercase text-lime-8">
                {{ appStore.running_sessions[0].client?.name?.charAt(0) }}
              </div>
            </div>
            <div class="text-center text-xl font-semibold text-dark-purple-1">
              You've started {{ appStore.running_sessions.length }} session(s) on the web:
            </div>
            <div class="flex w-full flex-col items-center gap-2">
              <div
                v-for="session in appStore.running_sessions"
                :key="session.id"
                class="max-w-[calc(100vw-48px)] truncate text-center text-sm text-light-purple-4"
              >
                Session ID {{ session?.id }} {{ session.client?.name }}
              </div>
            </div>
            <div
              v-if="appStore.running_sessions.length > 1"
              class="text-center text-sm text-light-purple-4"
            >
              You'll automatically join the earliest session (Session ID
              {{ appStore.running_sessions[0].id }}), then proceed to the other.
            </div>
          </div>
          <RouterLink
            :to="{
              name: 'session-record',
              params: { slug: appStore.running_sessions[0].slug },
              query: { redirect: '/home' }
            }"
            class="w-full"
            :class="{ 'pointer-events-none': !networkStatus.connected }"
          >
            <AppButton class="w-full" :disabled="!networkStatus.connected">
              <span v-if="networkStatus.connected">
                Join Session ID {{ appStore.running_sessions[0].id }}
              </span>
              <span v-else>Offline: connect to join session</span>
            </AppButton>
          </RouterLink>
        </div>
      </div>
      <RouterView v-else />
    </div>

    <footer v-if="isUseNav" class="fixed bottom-0 z-[100] flex h-14 w-screen bg-white">
      <nav
        class="grid h-full w-full items-center"
        :style="{ gridTemplateColumns: `repeat(${navigations.length}, minmax(0, 1fr))` }"
      >
        <RouterLink
          v-for="nav in navigations"
          :key="nav.route_name"
          :to="{ name: nav.route_name }"
          class="flex h-full w-full flex-col items-center justify-center gap-1 transition-all"
          :class="{ 'bg-prim-1': nav.is_active }"
        >
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
  </div>
</template>
