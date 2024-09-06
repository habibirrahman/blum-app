<script setup lang="ts">
import type { TargetStatus, TargetType } from '@/lib/types'
import { computed, ref } from 'vue'

interface Props {
  chip?: 'chip' | null | TargetStatus
}

const props = withDefaults(defineProps<Props>(), {
  chip: 'chip'
})

interface ChipAsset {
  label: string
  class: string
  color: string
  backgroundColor: string
}
const assets = ref<{ [key: string]: ChipAsset }>({
  chip: {
    label: 'Chip',
    class: 'text-slate-7 bg-slate-2',
    color: '',
    backgroundColor: ''
  },
  in_progress: {
    label: 'In acquisition',
    class: 'text-tulip-8 bg-tulip-2',
    color: '',
    backgroundColor: ''
  },
  pending: {
    label: 'Pending',
    class: 'text-slate-7 bg-slate-2',
    color: '',
    backgroundColor: ''
  },
  paused: {
    label: 'Pause',
    class: 'text-light-purple-4 bg-light-purple-1',
    color: '',
    backgroundColor: ''
  },
  discontinued: {
    label: 'Discontinued',
    class: 'text-tomato-7 bg-tomato-2',
    color: '',
    backgroundColor: ''
  },
  mastered: {
    label: 'Mastered',
    class: 'text-grass-8 bg-grass-2',
    color: '',
    backgroundColor: ''
  }
})

const current = computed<ChipAsset>(() => {
  if (!props.chip) return assets.value['chip']
  return assets.value[props.chip]
})
</script>

<template>
  <div
    class="flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-semibold"
    :class="current.class"
  >
    {{ current.label }}
  </div>
</template>
