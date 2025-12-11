<script setup lang="ts">
import type { ClientStatus, TargetStatus } from '@/lib/types'
import { computed, ref } from 'vue'

interface Props {
  chip?: 'chip' | null | TargetStatus | ClientStatus
  label?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {})

interface ChipAsset {
  label: string
  class: string
  color: string
  backgroundColor: string
}
const assets = ref<{ [key: string]: ChipAsset }>({
  chip: {
    label: 'Chip',
    class: 'bg-slate-2 text-slate-7',
    color: '',
    backgroundColor: ''
  },
  in_progress: {
    label: 'In acquisition',
    class: 'bg-tulip-2 text-tulip-8',
    color: '',
    backgroundColor: ''
  },
  pending: {
    label: 'Pending',
    class: 'bg-slate-2 text-slate-7',
    color: '',
    backgroundColor: ''
  },
  paused: {
    label: 'Pause',
    class: 'bg-light-purple-1 text-light-purple-4',
    color: '',
    backgroundColor: ''
  },
  discontinued: {
    label: 'Discontinued',
    class: 'bg-tomato-2 text-tomato-7 ',
    color: '',
    backgroundColor: ''
  },
  mastered: {
    label: 'Mastered',
    class: 'bg-grass-2 text-grass-8 ',
    color: '',
    backgroundColor: ''
  },
  active: {
    label: 'Active',
    class: 'bg-lime-2 text-lime-8',
    color: '',
    backgroundColor: ''
  },
  archived: {
    label: 'Discharged',
    class: 'bg-rose-2 text-rose-7',
    color: '',
    backgroundColor: ''
  },
  at_risk_of_discharge: {
    label: 'At risk of discharge',
    class: 'bg-orange-2 text-orange-7',
    color: '',
    backgroundColor: ''
  }
})

const current = computed<ChipAsset>(() => {
  if (!props.chip) {
    return {
      label: props.label || 'chip',
      class: props.class || 'bg-slate-2 text-slate-7',
      color: '',
      backgroundColor: ''
    }
  }
  return assets.value[props.chip]
})
</script>

<template>
  <div
    class="flex items-center h-5 px-2 text-xs font-semibold rounded-full shrink-0"
    :class="current.class"
  >
    {{ current.label }}
  </div>
</template>
