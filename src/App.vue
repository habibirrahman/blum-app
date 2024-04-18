<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <header class="p-4">
    <div class="flex justify-center p-4">
      <img alt="logo" src="@/assets/logo.svg" width="125" height="125" />
    </div>

    <HelloWorld />
  </header>

  <RouterView />

  <footer class="border-light-purple-100 fixed bottom-0 flex h-10 w-full border-t bg-white">
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
  @apply text-light-purple hover:text-dark-purple-200 hover:bg-light-purple-200 flex h-full w-full items-center justify-center text-2xl transition-all duration-300;
}

nav a.router-link-exact-active {
  @apply text-dark-purple-200 bg-light-purple-100;
}
</style>
