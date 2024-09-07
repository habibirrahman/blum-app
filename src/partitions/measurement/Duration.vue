<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref } from 'vue'
import type { Measurement } from '@/lib/types'
import AppButton from '@/components/AppButton.vue'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
}
interface Emits {
  (e: 'toggle-running'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const started = ref<boolean>(false)
const counter = ref<number>(0)
const timerInterval = ref<any>(null)
const durationTiming = computed(() => {
  let hours: number | string = '00'
  let minutes: number | string = '00'
  let seconds: number | string = '00'
  if (counter.value) {
    seconds = (counter.value % 60).toString().padStart(2, '0')
    if (counter.value >= 60) {
      minutes = Math.floor(counter.value / 60)
      if (counter.value >= 3600) minutes = minutes % 60
      minutes = minutes.toString().padStart(2, '0')
    }
    if (counter.value >= 3600) {
      hours = Math.floor(counter.value / 3600)
        .toString()
        .padStart(2, '0')
    }
  }
  return `${hours}:${minutes}:${seconds}`
})
const timerLoading = ref<boolean>(false)
const onStartTimer = () => {
  timerInterval.value = setInterval(() => {
    counter.value++
  }, 1000)
}
const onToggleTimer = async () => {
  if (!started.value) {
    started.value = true
    onStartTimer()
    emit('toggle-running')
  } else {
    clearInterval(timerInterval.value)
    const params: UpdateMeasurementResultsParams = {
      id: props.measurement.id,
      results: durationTiming.value
    }
    const results: Measurement['results'] = durationTiming.value
    timerLoading.value = true
    const { success } = await sessionStore.updateMeasurementResults(params)
    timerLoading.value = false
    if (!success) {
      onStartTimer()
      return
    }
    started.value = false
    emit('toggle-running')
  }
}

onMounted(() => {
  if (props.measurement.results && props.measurement.results.seconds) {
    counter.value = props.measurement.results.seconds
  }
})
</script>

<template>
  <div class="flex h-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-4">
    <div
      class="grid w-48 grid-cols-5 items-center text-4xl font-bold transition-all"
      :class="{ 'text-slate-6': !started, 'text-slate-8': started }"
    >
      <div class="flex justify-center">{{ durationTiming.split(':')[0] }}</div>
      <div class="flex justify-center pb-2">:</div>
      <div class="flex justify-center">{{ durationTiming.split(':')[1] }}</div>
      <div class="flex justify-center pb-2">:</div>
      <div class="flex justify-center">{{ durationTiming.split(':')[2] }}</div>
    </div>
    <AppButton class="w-60 rounded-full" :loading="timerLoading" @click="onToggleTimer">
      {{ started ? 'Stop timer' : 'Start timer' }}
    </AppButton>
  </div>
  <div class="shrink-0 text-center text-xs font-medium text-slate-7">
    Goal: {{ measurement.target?.goal_time }}
  </div>
</template>
