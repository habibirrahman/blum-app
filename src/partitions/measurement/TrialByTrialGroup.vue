<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import GroupMeasurement from './GroupMeasurement.vue'
import type { Measurement } from '@/lib/types'

defineOptions({ name: 'TrialByTrialGroup' })

interface Props {
  measurement: Measurement
  measurementResults?: Record<string, any>
  isCollapsed?: boolean
}

interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'fetch-session'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <GroupMeasurement
    :measurement="measurement"
    :measurement-results="measurementResults"
    :is-collapsed="isCollapsed"
    type="tbt"
    @toggle-updated="emit('toggle-updated', $event)"
    @toggle-collapsed="emit('toggle-collapsed', $event)"
    @fetch-measurements="emit('fetch-session')"
  />
</template>
