<script setup lang="ts">
import type { Target } from '@/lib/types'
import AppChip from '@/components/AppChip.vue'
import { getTargetType } from '@/lib/func'
import AppCheckInput from '@/components/AppCheckInput.vue'

interface Props {
  target: Target
  showType?: boolean
  showStatus?: boolean
  isChecked?: boolean
  useAction?: boolean
}

interface Emits {
  (e: 'toggleCheck'): void
}

const emit = defineEmits<Emits>()

withDefaults(defineProps<Props>(), {
  showType: false,
  showStatus: true,
  isChecked: false
})

const handleCheckboxClick = (event: Event) => {
  event.stopPropagation()
  emit('toggleCheck')
}
</script>

<template>
  <div
    class="flex h-[154px] flex-col justify-center gap-1.5 border-l-[6px] px-4"
    :style="{ borderColor: target.curriculum_color }"
  >
    <div v-if="showStatus" class="flex">
      <AppChip :chip="target.status" />
    </div>
    <div class="flex items-center justify-between gap-4">
      <div class="text-xs truncate text-slate-8">
        {{ target.curriculum_name }}
      </div>
      <AppCheckInput
        v-if="isChecked !== undefined && useAction"
        :name="`check-${target.id}`"
        :checked="isChecked"
        @change.stop="handleCheckboxClick"
      />
      <!-- <input
        type="checkbox"
        class="rounded shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
      /> -->
    </div>
    <div class="text-sm font-semibold truncate">
      {{ target.name }}
    </div>
    <div class="text-xs whitespace-pre-line line-clamp-3 text-slate-8">
      {{ target.description }}
    </div>
    <div v-if="showType" class="text-xs font-medium text-slate-8">
      {{ getTargetType(target.type) }}
    </div>
  </div>
</template>
