<script setup lang="ts">
import { computed, onBeforeMount, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAppStore, type NetworkStatus } from './stores/app.store'
import { Icon } from '@iconify/vue'
import { Network } from '@capacitor/network'
import AppButton from './components/AppButton.vue'
import { App } from '@capacitor/app'
import { Device } from '@capacitor/device'
import axios from 'axios'
import AppActionSheet from '@/components/AppActionSheet.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const loadingApp = ref<boolean>(true)
const updateRequired = ref<boolean>(false)
const routeName = computed<string>(() => route.name?.toString() || 'signin')
const isShowRunningSession = computed<boolean>(
  () => appStore.running_sessions.length > 0 && routeName.value !== 'session-record'
)
const isUseNav = computed<boolean>(
  () =>
    routeName.value !== 'signin' &&
    !routeName.value.includes('record') &&
    !isShowRunningSession.value &&
    routeName.value !== 'edit-client-target' &&
    routeName.value !== 'session-draft' &&
    routeName.value !== 'session-select-target'
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

// Function to compare version numbers
function compareVersions(currentVersion: string, requiredVersion: string): number {
  const current = currentVersion.split('.').map(Number)
  const required = requiredVersion.split('.').map(Number)

  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const currentPart = current[i] || 0
    const requiredPart = required[i] || 0

    if (currentPart < requiredPart) return -1
    if (currentPart > requiredPart) return 1
  }
  return 0
}

// Function to compare build numbers
function compareBuildNumbers(
  currentBuild: string | number,
  requiredBuild: string | number
): boolean {
  const current = typeof currentBuild === 'string' ? parseInt(currentBuild) : currentBuild
  const required = typeof requiredBuild === 'string' ? parseInt(requiredBuild) : requiredBuild
  return current < required
}

// Function to check if update is required
async function checkForUpdates() {
  try {
    const [deviceInfo, appInfo] = await Promise.all([Device.getInfo(), App.getInfo()])

    // Fetch latest app version from API
    const { data } = await axios.get('/api/v1/app_versions?current=true')

    if (!data?.app_versions) {
      return
    }

    // Find the version info for current platform
    const platformVersionInfo = data.app_versions.find(
      (item: any) => item.platform === deviceInfo.platform
    )

    if (!platformVersionInfo) {
      return
    }

    // Check if current version is outdated
    const isVersionOutdated = compareVersions(appInfo.version, platformVersionInfo.version) < 0
    const isBuildOutdated = compareBuildNumbers(appInfo.build, platformVersionInfo.build)

    // Update is required if either version or build is outdated
    updateRequired.value = isVersionOutdated || isBuildOutdated
  } catch (error) {
    updateRequired.value = false
  }
}

// Function to handle update action
async function handleUpdateApp() {
  try {
    const deviceInfo = await Device.getInfo()

    if (deviceInfo.platform === 'android') {
      window.open('https://play.google.com/store/apps/details?id=id.simpul.blum', '_system')
    } else if (deviceInfo.platform === 'ios') {
      window.open('https://apps.apple.com/id/app/blum-aba/id6743465528?l=id', '_system')
    } else {
      window.location.reload()
    }
  } catch (error) {
    window.location.reload()
  }
}

onBeforeMount(() => {
  loadingApp.value = true
  setupNetwork()
})

onMounted(async () => {
  fetchCurrentUser()
  Network.addListener('networkStatusChange', networkListener)

  // Check for updates after getting device info
  await checkForUpdates()
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
      label: 'Upcoming',
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

const isHeightFull = computed<boolean>(
  () => routeName.value === 'signin' || routeName.value === 'profile' || isShowRunningSession.value
)
</script>

<template>
  <div class="fixed top-0 z-[999999] w-screen bg-white pt-safe"></div>
  <div class="fixed bottom-0 z-[999999] w-screen bg-white pb-safe"></div>

  <div v-if="loadingApp" class="grid w-full h-full tracking-wide font-blum place-items-center">
    <div class="flex items-center text-4xl font-bold animate-pulse font-logo text-light-purple-5">
      Blüm
    </div>
  </div>
  <div
    v-else
    class="tracking-wide font-blum"
    :class="{ 'pb-14': isUseNav, 'h-full': isHeightFull }"
  >
    <div
      v-if="routeName !== 'session-record'"
      class="sticky left-0 top-0 z-[999] flex w-full items-center justify-center bg-rose-3 text-sm font-medium text-rose-7 transition-all"
      :class="{ 'h-8': !networkStatus.connected, 'h-0': networkStatus.connected }"
    >
      <div v-if="!networkStatus.connected">You're offline. Connect to sync your data.</div>
    </div>

    <div
      v-if="isShowRunningSession"
      class="flex items-center justify-center w-full h-full bg-white"
    >
      <div
        class="fixed top-0 z-[1] h-[100vw] w-[100vw] -translate-y-1/2 rounded-full bg-prim-3 blur-2xl"
      ></div>
      <div class="z-[2] flex max-h-full flex-col items-center gap-4 px-6">
        <div class="flex flex-col items-center gap-2 pt-6">
          <div class="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-lime-3">
            <div class="text-xl font-semibold uppercase text-lime-8">
              {{ appStore.running_sessions[0].client?.name?.charAt(0) }}
            </div>
          </div>
          <div class="text-xl font-semibold text-center text-dark-purple-1">
            You've started {{ appStore.running_sessions.length }} session(s) on the web:
          </div>
          <div class="flex flex-col items-center w-full gap-2">
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
            class="text-sm text-center text-light-purple-4"
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
          class="w-full pb-6"
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

  <footer
    v-if="!loadingApp && isUseNav"
    class="font-blum fixed bottom-0 z-[100] flex w-screen bg-white tracking-wide px-safe pb-safe"
  >
    <nav
      class="grid items-center w-full h-14"
      :style="{ gridTemplateColumns: `repeat(${navigations.length}, minmax(0, 1fr))` }"
    >
      <RouterLink
        v-for="nav in navigations"
        :key="nav.route_name"
        :to="{ name: nav.route_name }"
        class="flex flex-col items-center justify-center w-full h-full gap-1 transition-all"
        :class="{ 'bg-prim-1': nav.is_active }"
      >
        <Icon v-if="nav.is_active" :icon="nav.active_icon" class="text-xl text-light-purple-5" />
        <Icon v-else :icon="nav.icon" class="text-xl text-slate-7" />
        <div
          class="w-full px-3 text-xs text-center truncate transition-all"
          :class="{ 'text-light-purple-5': nav.is_active, 'text-slate-7': !nav.is_active }"
        >
          {{ nav.label }}
        </div>
      </RouterLink>
    </nav>
  </footer>

  <!-- Update Required Modal -->
  <AppActionSheet :show="updateRequired">
    <div class="space-y-5 tracking-wide font-blum">
      <div class="text-2xl font-semibold text-center text-slate-10">Update required</div>
      <div class="text-sm text-center text-slate-8">
        To continue using Blüm, please update to the latest version. We've made important
        improvements to ensure everything runs smoothly.
      </div>
      <div class="flex flex-col gap-3">
        <AppButton kind="plain" class="w-full" @click="handleUpdateApp"> Update Now </AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
