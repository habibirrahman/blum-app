<script setup lang="ts">
import type { Target } from '@/lib/types'
import { displayDate } from '@/lib/func'
import AppChip from '@/components/AppChip.vue'

interface Props {
  target: Target
}

const props = withDefaults(defineProps<Props>(), {})
</script>

<template>
  <div
    class="flex h-[154px] flex-col justify-center gap-1.5 border-l-[6px] px-3"
    :style="{ borderColor: target.curriculum_color }"
  >
    <div class="flex">
      <AppChip :chip="target.status" />
    </div>
    <div class="truncate text-xs text-slate-8">
      {{ target.curriculum_name }}
    </div>
    <div class="truncate text-sm font-semibold">
      {{ target.name }}
    </div>
    <div class="line-clamp-3 text-xs text-slate-8">
      {{ target.description }}
    </div>
  </div>
</template>
