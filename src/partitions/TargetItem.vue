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
  (e: 'toggle-check'): void
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
  emit('toggle-check')
}

const handleOpenDetail = () => {
  emit('open')
}
</script>

<template>
  <div class="flex h-[154px] border-l-[6px]" :style="{ borderColor: target.curriculum_color }">
    <div
      class="flex flex-col flex-1 gap-1.5 justify-center px-4 truncate cursor-pointer"
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
      <div v-if="showType" class="text-xs font-medium text-slate-8">
        {{ getTargetType(target.type) }}
      </div>
    </div>

    <div
      v-if="isChecked !== undefined && useAction"
      class="flex justify-end items-center pr-4 shrink-0"
    >
      <AppCheckInput
        :name="`check-${target.id}`"
        :checked="isChecked"
        @change.stop="handleCheckboxClick"
      />
    </div>
  </div>
</template>
