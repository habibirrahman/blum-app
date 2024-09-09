<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
import HelloWorld from '@/components/HelloWorld.vue'

import { useToast } from 'vue-toastification'
const toast = useToast()
const showSuccess = () => {
  toast.success('Results are now up-to-date!')
  toast.success("Oops! The email or password doesn't match. Please try again.")
}
const showError = () => {
  toast.error('Error toast')
  toast.error("Oops! The email or password doesn't match. Please try again.")
}
</script>
<template>
  <div class="about">
    <h1>This is an about page</h1>
    <HelloWorld />
  </div>
  <div class="flex flex-col gap-4 p-4">
    <AppButton @click="showSuccess">Success</AppButton>
    <AppButton @click="showError">Error</AppButton>
  </div>
</template>
