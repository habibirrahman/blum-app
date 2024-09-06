<script setup lang="ts">
import { useSessionStore, type MeasurementResultsParams } from '@/stores/session.store'
import { computed, ref } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
}
const props = withDefaults(defineProps<Props>(), {})

interface PercentageBox {
  key: number | string
  value: null | boolean
}
const page = ref<number>(1)
const perPage = computed<number>(() => 30)
const pageCount = computed<number>(() => {
  const boxes = Object.keys(props.measurement.results).length
  return Math.ceil(boxes / perPage.value)
})
const percentageBoxes = computed(() => {
  const boxes: PercentageBox[] = Object.keys(props.measurement.results).map((key) => ({
    key,
    value: props.measurement.results[key]
  }))
  const start = (page.value - 1) * perPage.value
  const end = page.value * perPage.value
  return boxes.slice(start, end)
})
const percentageScore = computed(() => {
  const results = props.measurement.results
  const trials = Object.values(results).length
  const totalSuccess = Object.values(results).filter((i) => i).length
  return ((totalSuccess / trials) * 100 || 0).toFixed(0)
})

const percentageLoading = ref<boolean>(false)
const onChangePercentage = async (box: PercentageBox) => {
  const params: MeasurementResultsParams = {
    id: props.measurement.id,
    results: {}
  }
  let val = null
  if (box.value === null) val = true
  if (box.value === true) val = false
  if (box.value === false) val = null
  params.results[box.key] = val
  percentageLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  percentageLoading.value = false
}
</script>

<template>
  <div class="flex h-full content-center items-center justify-center">
    <div class="flex w-72 flex-wrap items-center justify-center gap-x-4 gap-y-4">
      <div
        v-for="box in percentageBoxes"
        :key="box.key"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded border transition-all"
        :class="{
          'pointer-events-none': percentageLoading,
          'border-slate-5 bg-white': box.value === null,
          'border-grass-7 bg-grass-1': box.value === true,
          'border-tomato-7 bg-tomato-1': box.value === false
        }"
        @click="onChangePercentage(box)"
      >
        <Icon v-if="box.value === true" icon="ph:check" class="text-2xl text-grass-7" />
        <Icon v-if="box.value === false" icon="ph:x" class="text-2xl text-tomato-7" />
      </div>
    </div>
  </div>
  <div class="shrink-0 space-y-2">
    <div class="flex h-2 items-center justify-center gap-2">
      <div
        v-for="n in pageCount"
        :key="n"
        :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
        class="h-2 w-2 rounded-full transition-all"
        @click="page = n"
      ></div>
    </div>
    <div
      class="flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-7"
    >
      <div>Goal: {{ measurement.target?.goal }}%</div>
      <div>Score: {{ percentageScore }}%</div>
    </div>
  </div>
</template>
