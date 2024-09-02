<script setup lang="ts">
import { kApp } from 'konsta/vue';
import { onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import router from './router'
import { getAccountStorage } from './plugins/preferences.plugin'

import { useAccountStore } from './stores/account.store'
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'

const route = useRoute()
const store = useAccountStore()
const { access } = storeToRefs(store)

async function check() {
  const { success, data } = await getAccountStorage()
  if (success && data) {
    store.assign(data)
    if (route.name === 'signin') {
      router.push({ name: 'home' })
    }
  } else if (route.name !== 'signin') {
    router.push({ name: 'signin' })
  }
}
onMounted(() => {
  check()
})
watch(access, () => {
  check()
})
</script>

<template>
  <k-app safe-areas theme="ios">
    <header v-if="$route.name !== 'signin'" class="space-y-4 p-4">
      <div class="flex flex-col items-center justify-center gap-4">
        <img alt="logo" src="@/assets/logo.svg" width="125" height="125" />
        <div v-if="store.access">Signed in as: {{ store.user.name }}</div>
      </div>
    </header>

    <RouterView />

    <footer
      v-if="$route.name !== 'signin'"
      class="fixed bottom-0 flex h-10 w-full border-t border-light-purple-1 bg-white"
    >
      <nav class="flex h-full w-full items-center justify-between">
        <RouterLink :to="{ name: 'home' }">
          <Icon icon="ph:house" />
        </RouterLink>
        <RouterLink :to="{ name: 'about' }">
          <Icon icon="ph:user" />
        </RouterLink>
      </nav>
    </footer>
  </k-app>
</template>

<style scoped>
nav a {
  @apply text-light-purple-5 flex h-full w-full items-center justify-center text-2xl transition-all duration-300 hover:bg-light-purple-2 hover:text-dark-purple-2;
}

nav a.router-link-exact-active {
  @apply bg-light-purple-1 text-dark-purple-2;
}
</style>
