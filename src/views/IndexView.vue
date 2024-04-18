<script setup lang="ts">
import AppButton from '@/components/AppButton.vue'
function onClick(text: string) {
  alert(text)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-4">
    <AppButton @click="onClick('alert')">Alert</AppButton>
  </div>
</template>

<style></style>
