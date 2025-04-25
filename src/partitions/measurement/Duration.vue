<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import type { Measurement } from '@/lib/types'
import AppButton from '@/components/AppButton.vue'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  is_started: boolean
  timer: string
  update_loading: boolean
  is_collapsed: boolean
}
interface Emits {
  (e: 'toggle-timer'): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()
</script>

<template>
  <div
    class="flex flex-col items-center content-center justify-center flex-grow-0 h-full transition-all gap-x-3"
    :class="{ 'gap-y-4': !is_collapsed, 'gap-y-2': is_collapsed }"
  >
    <div
      class="grid grid-cols-5 items-center text-3xl text-[32px] font-bold transition-all"
      :class="{ 'text-slate-6': !is_started, 'text-slate-8': is_started }"
    >
      <div class="flex justify-center">{{ timer.split(':')[0] }}</div>
      <div class="flex justify-center pb-2">:</div>
      <div class="flex justify-center">{{ timer.split(':')[1] }}</div>
      <div class="flex justify-center pb-2">:</div>
      <div class="flex justify-center">{{ timer.split(':')[2] }}</div>
    </div>
    <AppButton
      class="w-full rounded-full max-w-56"
      :class="{ 'pointer-events-none': sessionStore.session?.status !== 'ongoing' }"
      :loading="update_loading"
      @click="emit('toggle-timer')"
    >
      {{ is_started ? 'Stop timer' : 'Start timer' }}
    </AppButton>
  </div>

  <div v-if="!is_collapsed" class="text-xs font-medium text-center shrink-0 text-slate-7">
    Goal: {{ measurement.target?.goal_time }}
  </div>
</template>
