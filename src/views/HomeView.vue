<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
import { removeAccount } from '@/plugins/preferences'
import router from '@/router'
import { ref } from 'vue'

const loading = ref<boolean>(false)

async function onSignout() {
  loading.value = true
  const { succces } = await removeAccount()
  setTimeout(() => {
    loading.value = false
    if (succces) {
      router.push({ name: 'signin' })
    }
  }, 2000)
}

function onClick(text: string) {
  alert(text)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-4">
    <AppButton :loading="loading" @click="() => onSignout()">Sign out</AppButton>
    <AppButton @click="onClick('alert description')">Alert</AppButton>
  </div>
</template>
