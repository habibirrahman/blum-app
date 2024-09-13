<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  is_collapsed: boolean
}
const props = withDefaults(defineProps<Props>(), {})

const page = ref<number>(1)
watch(
  () => props.is_collapsed,
  () => {
    setTimeout(() => {
      const el = `${props.measurement.id}-percentage-boxes-${1}`
      const boxes = document.getElementById(el)
      boxes?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 300)
  }
)
const onScroll = (e: any) => {
  const left = e.currentTarget.scrollLeft
  const current = Math.floor(left / (320 - 32)) + 1
  if (page.value !== current) page.value = current
}

const perPage = computed<number>(() => (props.is_collapsed ? 5 : 30))
const pageCount = computed<number>(() => {
  const boxes = Object.keys(props.measurement.results).length
  return Math.ceil(boxes / perPage.value)
})
interface PercentageBox {
  key: number | string
  value: null | boolean
}
const percentageBoxesPages = computed<PercentageBox[][]>(() => {
  const boxes: PercentageBox[] = Object.keys(props.measurement.results).map((key) => ({
    key,
    value: props.measurement.results[key]
  }))
  const res: PercentageBox[][] = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    const arr = [...boxes.slice(start, end)]
    res.push(arr)
  }
  return res
})
const percentageScore = computed<number>(() => {
  const results = props.measurement.results
  const trials = Object.values(results).length
  const totalSuccess = Object.values(results).filter((i) => i).length
  return (totalSuccess / trials) * 100 || 0
})

const percentageLoading = ref<boolean>(false)
const onChangePercentage = async (box: PercentageBox) => {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: {},
    data_result: { ...props.measurement }
  }
  let val = null
  if (box.value === null) val = true
  if (box.value === true) val = false
  if (box.value === false) val = null
  params.results[box.key] = val
  params.data_result.results[box.key] = val
  percentageLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  percentageLoading.value = false
}
</script>

<template>
  <div class="flex h-full content-center items-center justify-center">
    <div
      class="flex w-[calc(320px-32px)] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4"
      @scroll="onScroll"
    >
      <div
        v-for="(percentageBoxes, idx) in percentageBoxesPages"
        :key="`${measurement.id}-percentage-boxes-${idx + 1}`"
        :id="`${measurement.id}-percentage-boxes-${idx + 1}`"
        class="flex w-[calc(320px-32px)] shrink-0 snap-start justify-center"
      >
        <div
          class="flex max-w-72 flex-wrap content-center items-start justify-center transition-all"
          :class="{
            'gap-x-4 gap-y-4': !is_collapsed,
            'gap-x-2 gap-y-2': is_collapsed
          }"
        >
          <div
            v-for="box in percentageBoxes"
            :key="box.key"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded border text-2xl transition-all"
            :class="{
              'pointer-events-none':
                percentageLoading || sessionStore.session?.status !== 'ongoing',
              'border-slate-5 bg-white': box.value === null,
              'border-grass-7 bg-grass-1': box.value === true,
              'border-tomato-7 bg-tomato-1': box.value === false
            }"
            @click="onChangePercentage(box)"
          >
            <Icon v-if="box.value === true" icon="ph:check" class="text-grass-7" />
            <Icon v-if="box.value === false" icon="ph:x" class="text-tomato-7" />
          </div>
        </div>
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
      ></div>
    </div>
    <div
      v-if="!is_collapsed"
      class="flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-7"
    >
      <div>Goal: {{ measurement.target?.goal }}%</div>
      <div>Score: {{ percentageScore.toFixed(0) }}%</div>
    </div>
  </div>
</template>
