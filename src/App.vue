<script setup lang="ts">
import { kApp } from 'konsta/vue'
import { computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import router from './router'
import { getAccountStorage } from './plugins/preferences.plugin'

import { useAccountStore } from './stores/account.store'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'

const route = useRoute()
const store = useAccountStore()
const { access } = storeToRefs(store)

async function fetchCurrentUser() {
  const { success, data } = await getAccountStorage()
  if (success && data) {
    store.assignAccount(data)
    if (route.name === 'signin') {
      router.push({ name: 'home' })
    }
  } else if (route.name !== 'signin') {
    router.push({ name: 'signin' })
  }
}
const routeName = computed<string>(() => route.name?.toString() || '')
const isUseNav = computed<boolean>(() => routeName.value !== 'signin')
watch(access, () => {
  fetchCurrentUser()
})
onMounted(() => {
  fetchCurrentUser()
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
    <!-- <header v-if="routeName !== 'signin'" class="space-y-4 p-4">
      <div class="flex flex-col items-center justify-center gap-4">
        <img alt="logo" src="@/assets/logo.svg" width="125" height="125" />
        <div v-if="store.access">Signed in as: {{ store.user.name }}</div>
      </div>
    </header> -->
    <div :class="{ 'pb-14': isUseNav }">
      <RouterView />
    </div>

    <footer v-if="isUseNav" class="fixed bottom-0 flex h-14 w-screen bg-white">
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
