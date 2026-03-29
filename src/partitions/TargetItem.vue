<script setup lang="ts">
import type { Target } from '@/lib/types'
import AppChip from '@/components/AppChip.vue'
import { getTargetType } from '@/lib/func'
import AppCheckInput from '@/components/AppCheckInput.vue'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import moment from 'moment'

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
  const nextDate = moment(new Date(props.target.maintenance_next_date))
  const today = moment().startOf('day')
  if (nextDate.isSameOrBefore(today, 'day') && props.target.maintenance_status === 'overdue') {
    return 'text-tomato-7'
  }
  return 'text-info'
})

const maintenanceBadgeText = computed<string>(() => {
  if (!props.target.in_maintenance || !props.target.maintenance_next_date) return ''
  const nextDate = moment(new Date(props.target.maintenance_next_date))
  const today = moment().startOf('day')
  if (nextDate.isSameOrBefore(today, 'day') && props.target.maintenance_status === 'overdue') {
    return `Maintenance overdue on ${nextDate.format('DD MMM YY')}`
  }
  if (nextDate.isSame(today, 'day')) {
    return 'Maintenance due today'
  }
  return `Maintenance on ${nextDate.format('DD MMM YY')}`
})
</script>

<template>
  <div class="flex h-[154px] border-l-[6px]" :style="{ borderColor: target.curriculum_color }">
    <div
      class="flex flex-col flex-1 gap-1.5 justify-center px-4 truncate cursor-pointer"
      @click="handleOpenDetail"
    >
      <div v-if="showStatus" class="flex gap-2 items-center">
        <AppChip :chip="target.status" />
        <div v-if="showBadge && target.in_maintenance" class="p-1 rounded bg-orange-3">
          <Icon icon="mynaui:info-waves-solid" class="text-orange-6" />
        </div>
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

      <div
        v-if="target.in_maintenance && target.maintenance_next_date"
        class="flex gap-1 items-center pointer-events-none"
      >
        <Icon icon="circum:calendar" :class="maintenanceBadgeColor"/>
        <div class="mt-0.5 text-xs" :class="maintenanceBadgeColor" v-html="maintenanceBadgeText"></div>
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
