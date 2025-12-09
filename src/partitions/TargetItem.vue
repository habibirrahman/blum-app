<script setup lang="ts">
import type { Target } from '@/lib/types'
import AppChip from '@/components/AppChip.vue'
import { getTargetType } from '@/lib/func';

interface Props {
  target: Target
  showType?: boolean
  showStatus?: boolean
  isChecked?: boolean
  useAction?: boolean
}

interface Emits {
  (e: 'toggleCheck'): void
  (e: 'open'): void
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

const handleOpenDetail = () => {
  emit('open')
}
</script>

<template>
  <div class="flex h-[154px] border-l-[6px]" :style="{ borderColor: target.curriculum_color }">
    <div
      class="flex flex-1 flex-col justify-center gap-1.5 px-4 cursor-pointer"
      @click="handleOpenDetail"
    >
      <div v-if="showStatus" class="flex">
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
      <div v-if="showType" class="text-xs text-slate-8 font-medium">
        {{ getTargetType(target.type) }}
      </div>
    </div>

    <div
      v-if="isChecked !== undefined && useAction"
      class="flex items-center justify-end pr-4 shrink-0 w-20"
    >
      <input
        type="checkbox"
        :checked="isChecked"
        @change="handleCheckboxClick"
        class="rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
      />
    </div>
  </div>
</template>