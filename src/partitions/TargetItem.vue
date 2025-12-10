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
      class="flex flex-1 cursor-pointer flex-col justify-center gap-1.5 px-4"
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
      class="flex items-center justify-end w-20 pr-4 shrink-0"
    >
      <AppCheckInput
        :name="`check-${target.id}`"
        :checked="isChecked"
        @change.stop="handleCheckboxClick"
      />
    </div>
  </div>
</template>
