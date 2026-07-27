<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import { useAppStore } from '@/stores/app.store'
import AppToggle from '@/components/AppToggle.vue'

const sessionStore = useSessionStore()
const toast = useToast()
const app = useAppStore()

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
  (e: 'after-commit'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const results = ref<Measurement['results']>({})

const page = ref<number>(1)

const collapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
watch(
  () => props.isCollapsed,
  () => {
    collapseTimeout.value = setTimeout(() => {
      const el = `${props.measurement.id}-percentage-boxes-${1}`
      const boxes = document.getElementById(el)
      boxes?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 300)

    return () => {
      if (collapseTimeout.value) {
        clearTimeout(collapseTimeout.value)
        collapseTimeout.value = undefined
      }
    }
  }
)
const onScroll = (e: any) => {
  const left = e.currentTarget.scrollLeft
  const current = Math.floor(left / (320 - 32)) + 1
  if (page.value !== current) page.value = current
}

const perPage = computed<number>(() => (props.isCollapsed ? 5 : 30))
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

  const finalResults = results.value
  finalResults[box.key] = val

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  percentageLoadingBox.value = box.key
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null

  results.value = { ...data.results }

  if (!success) {
    toast.error(message)
    return
  }
}, 1000)

const onChangePercentage = async (box: PercentageBox) => {
  if (sessionStore.session?.status !== 'ongoing') return
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

  // record session activities
  sessionStore.addSessionActivity({
    action_label: `tbt_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: results.value } },
    notes: `Target: ${props.measurement.target?.name} [${box.key}: ${val}]`,
    timestamp: new Date().toISOString()
  })

  onSavePercentage(box)
}

const onAddBox = async () => {
  if (percentageLoadingBox.value !== null) return

  const finalResults = results.value
  const length = Object.keys(finalResults).length

  finalResults[length] = null

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  percentageLoadingBox.value = 'add-box'

  // record session activities
  sessionStore.addSessionActivity({
    action_label: `tbt_add`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null

  results.value = { ...data.results }

  if (!success) {
    toast.error(message)
    return
  }
}

const onRemoveBox = async (box: PercentageBox) => {
  if (percentageLoadingBox.value !== null) return

  const lastResults = results.value
  lastResults[box.key] = 'deleted'

  const finalResults: Record<string, boolean | null> = {}
  let idx = 0
  for (let key in lastResults) {
    if (lastResults[key] === true || lastResults[key] === false || lastResults[key] === null) {
      finalResults[idx] = lastResults[key]
      idx++
    }
  }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  percentageLoadingBox.value = 'remove-box'

  // record session activities
  sessionStore.addSessionActivity({
    action_label: `tbt_delete`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name} [${box.key}]`,
    timestamp: new Date().toISOString()
  })

  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null

  results.value = { ...data.results }

  if (!success) {
    toast.error(message)
    return
  }
}

// draft
const switchLoading = ref<boolean>(false)
const changeProbingTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const onChangeProbing = async () => {
  if (sessionStore.session?.status !== 'draft') return
  if (switchLoading.value) return

  const checked = props.measurement.type?.includes('Probing')
  const temp = {
    session_id: sessionStore.session.id,
    target_id: props.measurement.target_id,
    measurement_id: props.measurement.id,
    position: props.measurement.position,
    is_fixed: props.measurement.is_fixed
  }

  if (!checked) {
    const updateParams = {
      id: temp.measurement_id,
      measurement: { visible: false },
      data_result: props.measurement
    }

    switchLoading.value = true
    const { success: successUpdate } = await sessionStore.updateMeasurement(updateParams)
    if (!successUpdate) {
      switchLoading.value = false
      return
    }

    const createParams = {
      id: temp.session_id,
      target_id: temp.target_id,
      measurement: {
        type: 'Measurement::Probing' as Measurement['type'],
        position: temp.position,
        is_fixed: temp.is_fixed
      }
    }
    const { success: succesCreate } = await sessionStore.createMeasurement(createParams)
    if (!succesCreate) {
      switchLoading.value = false
      return
    }
  } else {
    const payload = {
      id: temp.measurement_id
    }

    switchLoading.value = true
    const { success } = await sessionStore.deleteMeasurement(payload)
    if (!success) {
      switchLoading.value = false
      return
    }
  }
  changeProbingTimeout.value = setTimeout(() => {
    emit('after-commit')
    switchLoading.value = false
  }, 300)

  return () => {
    if (changeProbingTimeout.value) {
      clearTimeout(changeProbingTimeout.value)
      changeProbingTimeout.value = undefined
    }
  }
}

onMounted(() => {
  results.value = { ...props.measurementResults }
})

onUnmounted(() => {
  // Clear timeout to prevent memory leak
  if (collapseTimeout.value) {
    clearTimeout(collapseTimeout.value)
    collapseTimeout.value = undefined
  }
  if (changeProbingTimeout.value) {
    clearTimeout(changeProbingTimeout.value)
    changeProbingTimeout.value = undefined
  }
})
</script>

<template>
  <div class="flex h-full flex-grow flex-col justify-between gap-2">
    <div
      v-if="percentageLoadingBox !== null"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-20 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="animate-spin text-2xl text-light-purple-5" />
    </div>

    <div class="flex h-full flex-grow content-center items-center justify-center">
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
            class="flex max-w-72 flex-wrap content-center items-start justify-center py-2"
            :class="{
              'gap-x-4 gap-y-4': !isCollapsed,
              'gap-x-2 gap-y-2': isCollapsed
            }"
          >
            <div v-for="box in percentageBoxes" :key="box.key" class="relative">
              <div
                v-if="box.removeable"
                class="absolute -right-1.5 -top-1.5 z-10 flex h-3 w-3 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-tomato-7 text-white hover:bg-tomato-9"
                :class="{ 'pointer-events-none opacity-50': !app.network_status.connected }"
                @click="onRemoveBox(box)"
              >
                <Icon icon="ph:x" class="h-2 w-2 text-white" />
              </div>
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded border text-2xl transition-colors"
                :class="{
                  'pointer-events-none':
                    (percentageLoadingBox && percentageLoadingBox !== box.key) ||
                    sessionStore.session?.status !== 'ongoing',
                  'border-slate-5 bg-white': box.value === null,
                  'border-grass-7 bg-grass-1': box.value === true,
                  'border-tomato-7 bg-tomato-1': box.value === false,
                  'border-2 border-dashed border-slate-5 bg-slate-2': box.key === 'placeholder'
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

    <div class="shrink-0 space-y-2 pb-3" :class="{ '-translate-y-2': isCollapsed }">
      <div class="flex h-2 items-center justify-center gap-2">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="h-2 w-2 rounded-full transition-colors"
        ></div>
      </div>

      <div v-if="!isCollapsed" class="z-10 text-center">
        <div
          class="flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-7"
        >
          <div>Goal: {{ measurement.target?.goal }}%</div>
          <div>Score: {{ percentageScore.toFixed(0) }}%</div>
        </div>
        <div class="text-center text-xs font-medium text-slate-7">
          <div>Minimum {{ measurement.target?.number_of_trial }} trial(s)</div>
        </div>
      </div>

      <div
        v-if="sessionStore.session?.status === 'draft' && measurement?.target?.probing_enable"
        class="pointer-events-auto z-10 flex w-full items-center justify-between rounded-full bg-lime-2 px-4 py-2"
      >
        <div class="text-sm font-semibold text-lime-7">Set as probing</div>
        <div class="flex items-center gap-1">
          <Icon
            v-if="switchLoading"
            icon="mingcute:loading-fill"
            class="animate-spin text-xl text-lime-7"
          />
          <div class="text-sm font-semibold text-lime-7">
            {{ measurement.type?.includes('Probing') ? 'Yes' : 'No' }}
          </div>
          <AppToggle
            :name="`toggle-probing-${measurement.id}`"
            color="lime"
            :loading="switchLoading"
            :checked="measurement.type?.includes('Probing')"
            @change="onChangeProbing"
          />
        </div>
      </div>
    </div>
  </div>
</template>
