<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import AppButton from '@/components/AppButton.vue'
import AppCheckInput from '@/components/AppCheckInput.vue'
import type { Target } from '@/lib/types'
import { useSessionStore } from '@/stores/session.store'
import moment from 'moment'
import AppChip from '@/components/AppChip.vue'

const props = defineProps<{
  targets: Target[]
  sessionId: string | number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit'): void
}>()

const sessionStore = useSessionStore()
const selectedIds = ref<number[]>([])
const loading = ref(false)

onMounted(() => {
  selectedIds.value = props.targets.map((t) => t.id!).filter(Boolean) as number[]
})

const isAllSelected = computed(() => {
  return props.targets.length > 0 && selectedIds.value.length === props.targets.length
})

const isIndeterminate = computed(() => {
  return selectedIds.value.length > 0 && selectedIds.value.length < props.targets.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = props.targets.map((t) => t.id!).filter(Boolean) as number[]
  }
}

const toggleSelect = (id: number | undefined) => {
  if (!id) return
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const maintenanceDateText = (target: Target) => {
  if (!target.maintenance_next_date) return ''
  const nextDate = moment(target.maintenance_next_date)
  return `Maintenance scheduled for ${nextDate.format('DD MMM YY')}`
}

const onSubmit = async () => {
  loading.value = true
  if (!selectedIds.value.length) {
    emit('submit')
    loading.value = false
    return
  }
  const { success } = await sessionStore.advanceMaintenanceSession({
    id: Number(props.sessionId),
    target_ids: selectedIds.value
  })
  loading.value = false
  if (success) {
    emit('submit')
  }
}
</script>

<template>
  <div class="flex fixed top-0 left-0 z-50 flex-col w-screen h-screen bg-slate-1 p-safe">
    <div class="flex flex-col h-full bg-white">
      <!-- Header -->
      <div class="flex justify-between items-center px-4 h-14 shrink-0">
        <div class="text-lg font-semibold text-slate-10">Upcoming maintenance targets detected</div>
        <button
          @click="emit('close')"
          class="flex justify-center items-center w-8 h-8 rounded-full hover:bg-slate-2"
        >
          <Icon icon="ph:x" class="w-5 h-5 text-slate-9" />
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1">
        <div class="px-4 pb-4 text-sm text-slate-8">
          Select which targets to maintain today. Selected targets will be run in the maintenance
          phase. The next maintenance date for selected targets will be rescheduled automatically.
        </div>

        <!-- Select all -->
        <div
          class="flex justify-between items-center px-4 h-12 cursor-pointer border-slate-3"
          @click="toggleSelectAll"
        >
          <div class="text-sm text-slate-7">{{ selectedIds.length }} target(s) selected for maintenance</div>
          <AppCheckInput
            name="select-all"
            :checked="isAllSelected"
            v-model:indeterminate="isIndeterminate"
            class="pointer-events-none"
          />
        </div>

        <!-- List -->
        <div
          v-for="target in targets"
          :key="target.id"
          class="flex w-full border-b cursor-pointer border-slate-3"
          @click="toggleSelect(target.id)"
        >
          <div
            class="w-2 shrink-0"
            :style="{ backgroundColor: target.curriculum_color || '#F3F0F7' }"
          ></div>
          <div class="flex justify-between items-center px-4 py-3 w-full bg-white">
            <div class="flex flex-col gap-1 pr-4">
              <div class="flex gap-2 items-center">
                <AppChip chip="mastered" />
                <div class="max-w-[150px] truncate text-xs font-medium text-slate-6">
                  {{ target.curriculum_name }}
                </div>
              </div>
              <div class="text-sm font-bold text-slate-9">{{ target.name }}</div>
              <div class="text-sm line-clamp-2 text-slate-6">
                {{ target.description || '' }}
              </div>
              <div
                v-if="target.maintenance_next_date"
                class="flex gap-1 items-center mt-1 text-xs font-medium text-info-6"
              >
                <Icon icon="ph:calendar-blank" class="w-4 h-4 text-info" />
                <div class="text-info">{{ maintenanceDateText(target) }}</div>
              </div>
            </div>
            <div class="pointer-events-none shrink-0">
              <AppCheckInput
                :name="'check-' + target.id"
                :checked="selectedIds.includes(target.id!)"
              />
            </div>
          </div>
        </div>
        <div class="h-24"></div>
        <!-- padding bottom -->
      </div>

      <!-- Footer -->
      <div class="fixed bottom-0 left-0 p-4 w-full bg-white border-t border-slate-3 pb-safe">
        <div class="flex h-[130px] flex-col gap-5">
          <div class="flex gap-2 items-center p-2 rounded bg-cornflower-2">
            <Icon icon="ph:info-fill" class="w-5 h-5 text-cornflower-8" />
            <div class="text-sm text-cornflower-8">
              Data from this session for <b>unselected targets</b> will be recorded in <b>teaching phase.</b>
            </div>
          </div>
          <AppButton
            class="w-full"
            :loading="loading"
            @click="onSubmit"
          >
            Confrim & start session
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
