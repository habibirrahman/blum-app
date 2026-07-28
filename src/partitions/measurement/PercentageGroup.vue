<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import GroupMeasurement from './GroupMeasurement.vue'
import type { Measurement } from '@/lib/types'

defineOptions({ name: 'PercentageGroup' })

interface Props {
  measurement: Measurement
  measurementResults?: Record<string, any>
  isCollapsed?: boolean
}

defineProps<Props>()
</script>

<template>
  <GroupMeasurement
    :measurement="measurement"
    :measurement-results="measurementResults"
    :is-collapsed="isCollapsed"
    type="percentage"
  />
</template>
