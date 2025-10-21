<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import { useAppStore } from '@/stores/app.store'

const sessionStore = useSessionStore()
const toast = useToast()
const app = useAppStore()

interface Props {
  measurement: Measurement
  is_collapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const results = ref<Measurement['results']>({})

onMounted(() => {
  results.value = { ...props.measurement.results }
})

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
interface PercentageBox {
  key: number | string
  value: null | boolean
  removeable: boolean
}
const currentBoxes = computed<PercentageBox[]>(() => {
  const boxes = Object.keys(results.value).map((key, idx) => {
    const removeable = idx >= (props.measurement.target?.number_of_trial || 0)
    return { key, value: results.value[key], removeable }
  })
  const filledBoxed = [...boxes].filter((i) => i.value !== null)
  if (filledBoxed.length === boxes.length) {
    boxes.push({ key: 'placeholder', value: null, removeable: false })
  }
  return boxes
})
const pageCount = computed<number>(() => {
  return Math.ceil(currentBoxes.value.length / perPage.value)
})
const percentageBoxesPages = computed<PercentageBox[][]>(() => {
  const res: PercentageBox[][] = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    const arr = [...currentBoxes.value.slice(start, end)]
    res.push(arr)
  }
  return res
})
const percentageScore = computed<number>(() => {
  const trials = Object.values(results.value).length
  const totalSuccess = Object.values(results.value).filter((i) => i).length
  return (totalSuccess / trials) * 100 || 0
})

const percentageLoadingBox = ref<PercentageBox['key'] | null>(null)

watch(
  () => percentageLoadingBox.value,
  (val) => {
    if (val === null) {
      emit('toggle-updated', true)
    } else {
      emit('toggle-updated', false)
    }
  }
)

const onSavePercentage = debounce(async function (box: PercentageBox) {
  let val = null
  if (box.value === null) val = true
  if (box.value === true) val = false
  if (box.value === false) val = null

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: {},
    data_result: { ...props.measurement, results: results.value }
  }
  params.results[box.key] = val
  params.data_result.results[box.key] = val

  percentageLoadingBox.value = box.key
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null
  if (!success) {
    results.value = { ...props.measurement.results }
    emit('fetch-session')
    toast.error(message)
    return
  }

  results.value = { ...data.results }
}, 1000)

const onChangePercentage = async (box: PercentageBox) => {
  if (percentageLoadingBox.value && percentageLoadingBox.value !== box.key) {
    return
  }

  if (box.key === 'placeholder') {
    onAddBox()
    return
  }

  // change state
  let val = null
  if (box.value === null) val = true
  if (box.value === true) val = false
  if (box.value === false) val = null

  results.value[box.key] = val

  // save state
  percentageLoadingBox.value = box.key
  onSavePercentage(box)
}

const onAddBox = async () => {
  if (percentageLoadingBox.value !== null) return

  const boxes = Object.keys(results.value)

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: {},
    data_result: { ...props.measurement, results: results.value }
  }
  params.results[boxes.length] = null
  params.data_result.results[boxes.length] = null

  percentageLoadingBox.value = 'add-box'
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null

  if (!success) {
    results.value = { ...props.measurement.results }
    emit('fetch-session')
    toast.error(message)
    return
  }

  results.value = { ...data.results }
}

const onRemoveBox = async (box: PercentageBox) => {
  if (percentageLoadingBox.value !== null) return

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: {},
    data_result: { ...props.measurement, results: results.value }
  }
  params.results[box.key] = 'deleted'

  percentageLoadingBox.value = 'remove-box'
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null
  if (!success) {
    results.value = { ...props.measurement.results }
    emit('fetch-session')
    toast.error(message)
    return
  }

  results.value = { ...data.results }
}
</script>

<template>
  <div class="flex flex-col justify-between flex-grow h-full gap-2">
    <div class="flex items-center content-center justify-center flex-grow h-full">
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
            class="flex flex-wrap items-start content-center justify-center py-2 transition-all max-w-72"
            :class="{
              'gap-x-4 gap-y-4': !is_collapsed,
              'gap-x-2 gap-y-2': is_collapsed
            }"
          >
            <div v-for="box in percentageBoxes" :key="box.key" class="relative">
              <div
                v-if="box.removeable"
                class="absolute -right-1.5 -top-1.5 z-10 flex h-3 w-3 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-tomato-7 text-white hover:bg-tomato-9"
                :class="{ 'pointer-events-none opacity-50': !app.network_status.connected }"
                @click="onRemoveBox(box)"
              >
                <Icon icon="ph:x" class="w-2 h-2 text-white" />
              </div>
              <div
                class="flex items-center justify-center w-10 h-10 text-2xl transition-all border rounded shrink-0"
                :class="{
                  'pointer-events-none':
                    (percentageLoadingBox && percentageLoadingBox !== box.key) ||
                    sessionStore.session?.status !== 'ongoing',
                  'border-slate-5 bg-white': box.value === null,
                  'border-grass-7 bg-grass-1': box.value === true,
                  'border-tomato-7 bg-tomato-1': box.value === false,
                  'border-dashed border-slate-5 bg-slate-2': box.key === 'placeholder'
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
    </div>

    <div class="pb-3 space-y-2 shrink-0" :class="{ '-translate-y-2': is_collapsed }">
      <div class="flex items-center justify-center h-2 gap-2">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="w-2 h-2 transition-all rounded-full"
        ></div>
      </div>
      <div v-if="!is_collapsed" class="z-10 text-center">
        <div
          class="flex items-center justify-center gap-2 text-xs font-medium text-center text-slate-7"
        >
          <div>Goal: {{ measurement.target?.goal }}%</div>
          <div>Score: {{ percentageScore.toFixed(0) }}%</div>
        </div>
        <div class="text-xs font-medium text-center text-slate-7">
          <div>Minimum {{ measurement.target?.number_of_trial }} trial(s)</div>
        </div>
      </div>
    </div>
  </div>
</template>
