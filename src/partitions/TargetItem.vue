<script setup lang="ts">
import type { Target } from '@/lib/types'
import AppChip from '@/components/AppChip.vue'
import { getTargetType } from '@/lib/func'
import AppCheckInput from '@/components/AppCheckInput.vue'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import dayjs from 'dayjs'

interface Props {
  target: Target
  showType?: boolean
  showStatus?: boolean
  isChecked?: boolean
  useAction?: boolean
  showBadge?: boolean
}

interface Emits {
  (e: 'toggle-check'): void
  (e: 'open'): void
}

const emit = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {
  showType: false,
  showStatus: true,
  isChecked: false,
  showBadge: false
})

const handleCheckboxClick = (event: Event) => {
  event.stopPropagation()
  emit('toggle-check')
}

const handleOpenDetail = () => {
  emit('open')
}

const maintenanceBadgeColor = computed<string>(() => {
  if (!props.target.in_maintenance || !props.target.maintenance_next_date) return 'info'
  const nextDate = dayjs(new Date(props.target.maintenance_next_date))
  const today = dayjs().startOf('day')
  if (
    (nextDate.isSame(today) || nextDate.isBefore(today)) &&
    props.target.maintenance_status === 'overdue'
  ) {
    return 'text-tomato-7'
  }
  return 'text-info'
})

const maintenanceBadgeText = computed<string>(() => {
  if (!props.target.in_maintenance || !props.target.maintenance_next_date) return ''
  const nextDate = dayjs(new Date(props.target.maintenance_next_date))
  const today = dayjs().startOf('day')
  if (
    (nextDate.isSame(today) || nextDate.isBefore(today)) &&
    props.target.maintenance_status === 'overdue'
  ) {
    return `Maintenance overdue on ${nextDate.format('DD MMM YY')}`
  }
  if (nextDate.isSame(today)) {
    return 'Maintenance due today'
  }
  return `Maintenance on ${nextDate.format('DD MMM YY')}`
})
</script>

<template>
  <div class="flex h-[154px] border-l-[6px]" :style="{ borderColor: target.curriculum_color }">
    <div
      class="flex flex-1 cursor-pointer flex-col justify-center gap-1.5 truncate px-4"
      @click="handleOpenDetail"
    >
      <div v-if="showStatus" class="flex items-center gap-2">
        <AppChip :chip="target.status" />
        <div v-if="showBadge && target.in_maintenance" class="rounded bg-orange-3 p-1">
          <Icon icon="mynaui:info-waves-solid" class="text-orange-6" />
        </div>
      </div>
      <div class="truncate text-xs text-slate-8">
        {{ target.curriculum_name }}
      </div>
      <div class="truncate text-sm font-semibold">
        {{ target.name }}
      </div>
      <div class="line-clamp-3 whitespace-pre-line text-xs text-slate-8">
        {{ target.description }}
      </div>
      <div v-if="showType" class="text-xs font-medium text-slate-8">
        {{ getTargetType(target.type) }}
      </div>

      <div
        v-if="target.in_maintenance && target.maintenance_next_date"
        class="pointer-events-none flex items-center gap-1"
      >
        <Icon icon="circum:calendar" :class="maintenanceBadgeColor" />
        <div
          class="mt-0.5 text-xs"
          :class="maintenanceBadgeColor"
          v-html="maintenanceBadgeText"
        ></div>
      </div>
    </div>

    <div
      v-if="isChecked !== undefined && useAction"
      class="flex shrink-0 items-center justify-end pr-4"
    >
      <AppCheckInput
        :name="`check-${target.id}`"
        :checked="isChecked"
        @change.stop="handleCheckboxClick"
      />
    </div>
  </div>
</template>
