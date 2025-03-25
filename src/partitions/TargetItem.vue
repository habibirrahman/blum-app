<script setup lang="ts">
import type { Target } from '@/lib/types'
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
    <div class="text-xs truncate text-slate-8">
      {{ target.curriculum_name }}
    </div>
    <div class="text-sm font-semibold truncate">
      {{ target.name }}
    </div>
    <div class="text-xs whitespace-pre-line line-clamp-3 text-slate-8">
      {{ target.description }}
    </div>
  </div>
</template>
