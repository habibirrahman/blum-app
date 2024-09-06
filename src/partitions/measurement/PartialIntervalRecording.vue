<script setup lang="ts">
import { useSessionStore, type MeasurementResultsParams } from '@/stores/session.store'
import { computed, ref } from 'vue'
import type { Measurement } from '@/lib/types'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  counter: number
}
const props = withDefaults(defineProps<Props>(), {})

const intervalRound = computed(() => {
  const intervalCount = props.measurement.target?.interval || 0
  if (!props.measurement.target || !intervalCount) {
    return 1
  }
  const duration = Object.keys(props.measurement.results).length * intervalCount
  return duration / intervalCount
})
const currentInterval = computed(() => {
  const intervalCount = props.measurement.target?.interval
  if (!props.counter) return 0
  if (!props.measurement.target || !intervalCount) {
    return 1
  }
  const interval = Math.ceil(props.counter / (intervalCount * 60))
  return interval > intervalRound.value ? intervalRound.value : interval
})
const scoreInInterval = computed(() => {
  if (!props.measurement.results) return 0
  if (!props.measurement.results[currentInterval.value - 1]) return 0
  return props.measurement.results[currentInterval.value - 1]
})
const totalScore = computed(() => {
  if (!props.measurement.results) return 0
  return Object.values(props.measurement.results).reduce((a: any, b: any) => a + b, 0)
})
const percentageScore = computed(() => {
  if (!props.measurement.results) return 0
  const res = Object.values(props.measurement.results).filter((a: any) => a)
  return Math.floor((res.length / intervalRound.value) * 100)
})

const scoreLoading = ref<boolean>(false)
const onAddScore = async () => {
  const params: MeasurementResultsParams = {
    id: props.measurement.id,
    results: currentInterval.value - 1
  }
  scoreLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false
}
</script>

<template>
  <div class="flex h-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-4">
    <div
      class="flex h-[200px] w-[200px] shrink-0 items-center justify-center rounded-full bg-light-purple-5"
      :class="{ 'pointer-events-none': scoreLoading }"
      @click="onAddScore()"
    >
      <div class="text-sm font-semibold text-white">Incident</div>
    </div>
  </div>
  <div class="shrink-0 space-y-1 text-xs font-medium text-slate-7">
    <div class="flex items-center justify-between">
      <div>Interval</div>
      <div>{{ currentInterval }} / {{ intervalRound }}</div>
    </div>
    <div class="flex items-center justify-between">
      <div>Score in interval</div>
      <div>{{ scoreInInterval }}</div>
    </div>
    <div class="flex items-center justify-between">
      <div>Total score</div>
      <div>{{ totalScore }}</div>
    </div>
    <div class="flex items-center justify-between">
      <div>Percentage</div>
      <div>{{ percentageScore }}%</div>
    </div>
  </div>
</template>
