<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, ref } from 'vue'
import type { Measurement } from '@/lib/types'
import { useToast } from 'vue-toastification'
import { Icon } from '@iconify/vue/dist/iconify.js'

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurement_results: Measurement['results']
  counter: number
  is_collapsed: boolean
}
interface Emits {
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
defineEmits<Emits>()

const intervalRound = computed<number>(() => {
  const intervalCount = props.measurement.target?.interval || 0
  if (!props.measurement.target || !intervalCount) {
    return 1
  }
  const duration = Object.keys(props.measurement_results).length * intervalCount
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
  if (!props.measurement_results) return 0
  if (!props.measurement_results[currentInterval.value - 1]) return 0
  return props.measurement_results[currentInterval.value - 1]
})
const totalScore = computed<number>(() => {
  if (!props.measurement_results) return 0
  const results: number[] = Object.values(props.measurement_results)
  return results.reduce((a, b) => a + b, 0) || 0
})
const percentageScore = computed<number>(() => {
  if (!props.measurement_results) return 0
  const res = Object.values(props.measurement_results).filter((a: any) => a)
  return Math.floor((res.length / intervalRound.value) * 100)
})

const scoreLoading = ref<boolean>(false)

const onAddScore = async () => {
  const interval = currentInterval.value - 1
  const finalResults = props.measurement_results
  finalResults[interval] = finalResults[interval] + 1

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  scoreLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `pir_incident`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }
}
</script>

<template>
  <div class="flex flex-col justify-between flex-grow h-full gap-2">
    <div v-if="scoreLoading" class="absolute z-10 bottom-4 right-4">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div
      class="flex flex-wrap items-center content-center flex-grow h-full transition-all gap-x-3 gap-y-4"
      :class="{ 'justify-center': !is_collapsed, 'justify-between': is_collapsed }"
    >
      <div v-if="is_collapsed"></div>
      <div
        v-if="is_collapsed"
        class="flex flex-col items-center justify-between gap-2 text-slate-7"
      >
        <div class="text-[32px] font-bold">{{ totalScore }}</div>
        <div class="text-xs">Total score</div>
      </div>
      <div
        class="flex items-center justify-center transition-all rounded-full shrink-0 bg-light-purple-5"
        :class="{
          'pointer-events-none': scoreLoading || sessionStore.session?.status !== 'ongoing',
          'h-[200px] w-[200px]': !is_collapsed,
          'h-[90px] w-[90px]': is_collapsed
        }"
        @click="onAddScore()"
      >
        <div class="text-sm font-semibold text-white">Incident</div>
      </div>
    </div>

    <div v-if="!is_collapsed" class="pb-3 space-y-1 text-xs font-medium shrink-0 text-slate-7">
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
  </div>
</template>
