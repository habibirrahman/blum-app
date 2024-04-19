<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
import { removeAccount } from '@/plugins/preferences'
import router from '@/router'

async function onSignout() {
  const status = await removeAccount()
  if (status.succces) {
    router.push({ name: 'signin' })
  }
}
function onClick(text: string) {
  alert(text)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-4">
    <AppButton @click="() => onSignout()">Sign out</AppButton>
    <AppButton @click="onClick('alert description')">Alert</AppButton>
  </div>
</template>

<style></style>
