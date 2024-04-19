<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ref, onUpdated } from 'vue'
import { getAccount } from './plugins/preferences'
import router from './router'

const route = useRoute()
const access = ref<string>('')
const email = ref<string>('')
async function check() {
  const status = await getAccount()
  console.log(status)
  console.log(route.name)
  if (status.success) {
    access.value = status.data?.access || ''
    email.value = status.data?.email || ''
  } else if (route.name !== 'signin') {
    router.push({ name: 'signin' })
  }
}
onUpdated(() => {
  check()
})
</script>

<template>
  <header v-if="$route.name !== 'signin'" class="space-y-4 p-4">
    <div class="flex flex-col items-center justify-center gap-4">
      <img alt="logo" src="@/assets/logo.svg" width="125" height="125" />
      <div v-if="access">Signed in as: {{ email }}</div>
    </div>
  </header>

  <RouterView />

  <footer
    v-if="$route.name !== 'signin'"
    class="fixed bottom-0 flex h-10 w-full border-t border-light-purple-100 bg-white"
  >
    <nav class="flex h-full w-full items-center justify-between">
      <RouterLink to="/">
        <Icon icon="ph:list" />
      </RouterLink>
      <RouterLink to="/home">
        <Icon icon="ph:house" />
      </RouterLink>
      <RouterLink to="/about">
        <Icon icon="ph:info" />
      </RouterLink>
    </nav>
  </footer>
</template>

<style scoped>
nav a {
  @apply flex h-full w-full items-center justify-center text-2xl text-light-purple transition-all duration-300 hover:bg-light-purple-200 hover:text-dark-purple-200;
}

nav a.router-link-exact-active {
  @apply bg-light-purple-100 text-dark-purple-200;
}
</style>
