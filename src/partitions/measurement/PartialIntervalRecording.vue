<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, ref } from 'vue'
import type { Measurement } from '@/lib/types'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  counter: number
  is_collapsed: boolean
}
const props = withDefaults(defineProps<Props>(), {})

const intervalRound = computed<number>(() => {
  const intervalCount = props.measurement.target?.interval || 0
  if (!props.measurement.target || !intervalCount) {
    return 1
  }
  const duration = Object.keys(props.measurement.results).length * intervalCount
  return duration / intervalCount
})
const currentInterval = computed<number>(() => {
  const intervalCount = props.measurement.target?.interval
  if (!props.counter) return 0
  if (!props.measurement.target || !intervalCount) {
    return 1
  }
  const interval = Math.ceil(props.counter / (intervalCount * 60))
  return interval > intervalRound.value ? intervalRound.value : interval
})
const scoreInInterval = computed<number>(() => {
  if (!props.measurement.results) return 0
  if (!props.measurement.results[currentInterval.value - 1]) return 0
  return props.measurement.results[currentInterval.value - 1]
})
const totalScore = computed<number>(() => {
  if (!props.measurement.results) return 0
  return Object.values(props.measurement.results).reduce((a: any, b: any) => a + b, 0)
})
const percentageScore = computed<number>(() => {
  if (!props.measurement.results) return 0
  const res = Object.values(props.measurement.results).filter((a: any) => a)
  return Math.floor((res.length / intervalRound.value) * 100)
})

const scoreLoading = ref<boolean>(false)
const onAddScore = async () => {
  const interval = currentInterval.value - 1
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: interval,
    data_result: { ...props.measurement }
  }
  params.data_result.results[interval] = props.measurement.results[interval] + 1
  scoreLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false
}
</script>

<template>
  <div
    class="flex h-full flex-wrap content-center items-center gap-x-3 gap-y-4 transition-all"
    :class="{ 'justify-center': !is_collapsed, 'justify-between': is_collapsed }"
  >
    <div v-if="is_collapsed"></div>
    <div v-if="is_collapsed" class="flex flex-col items-center justify-between gap-2 text-slate-7">
      <div class="text-[32px] font-bold">{{ totalScore }}</div>
      <div class="text-xs">Total score</div>
    </div>
    <div
      class="flex shrink-0 items-center justify-center rounded-full bg-light-purple-5 transition-all"
      :class="{
        'pointer-events-none': scoreLoading,
        'aspect-square w-full max-w-[200px]': !is_collapsed,
        'h-[90px] w-[90px]': is_collapsed
      }"
      @click="onAddScore()"
    >
      <div class="text-sm font-semibold text-white">Incident</div>
    </div>
  </div>

  <div v-if="!is_collapsed" class="shrink-0 space-y-1 text-xs font-medium text-slate-7">
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
