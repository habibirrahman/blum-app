<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
import router from '@/router'
import { useAppStore } from '@/stores/app.store'
import { ref } from 'vue'

const appStore = useAppStore()
const signoutLoading = ref<boolean>(false)

async function onSignout() {
  signoutLoading.value = true
  const { success } = await appStore.signout()
  signoutLoading.value = false
  if (success) {
    router.push({ name: 'signin' })
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-4">
    <div class="text-xs">
      <pre>{{ appStore.user }}</pre>
    </div>
    <AppButton :loading="signoutLoading" @click="() => onSignout()">Sign out</AppButton>
  </div>
</template>
