<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'
import AppButton from './AppButton.vue'

const counterStore = useCounterStore()
</script>

<template>
  <div class="flex flex-col gap-1 p-4">
    <AppButton @click="counterStore.increment">increment</AppButton>
    <div>counter: {{ counterStore.count }}</div>
    <div>doubled it: {{ counterStore.doubleCount }}</div>
  </div>
</template>
