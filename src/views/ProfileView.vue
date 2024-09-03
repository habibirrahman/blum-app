<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
import router from '@/router'
import { useAccountStore } from '@/stores/account.store'
import { ref } from 'vue'

const store = useAccountStore()
const loading = ref<boolean>(false)

async function onSignout() {
  loading.value = true
  const { success } = await store.signout()
  loading.value = false
  if (success) {
    router.push({ name: 'signin' })
  }
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
