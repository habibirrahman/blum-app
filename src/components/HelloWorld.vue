<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'
import Button from './Button.vue'

const counterStore = useCounterStore()
</script>

<template>
  <div class="flex flex-col gap-1 p-4">
    <Button @click="counterStore.increment">increment</Button>
    <div>counter: {{ counterStore.count }}</div>
    <div>doubled it: {{ counterStore.doubleCount }}</div>
  </div>
</template>
