<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import AppToggle from '@/components/AppToggle.vue'

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggleUpdated', bool: boolean): void
  (e: 'fetchSession'): void
  (e: 'afterCommit'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const results = ref<Measurement['results']>({})

onMounted(() => {
  results.value = { ...props.measurementResults }
})

const page = ref<number>(1)
watch(
  () => props.isCollapsed,
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

const perPage = computed<number>(() => (props.isCollapsed ? 5 : 30))
interface PercentageBox {
  key: number | string
  value: null | boolean
}
const currentBoxes = computed<PercentageBox[]>(() => {
  const boxes = Object.keys(results.value).map((key) => {
    return { key, value: results.value[key] }
  })
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
      emit('toggleUpdated', true)
    } else {
      emit('toggleUpdated', false)
    }
  }
)

const onSavePercentage = debounce(async function (box: PercentageBox) {
  // igonre save for the same box
  // if (percentageLoadingBox.value === box.key) return

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
  console.log('[onSavePercentage] start')
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  percentageLoadingBox.value = null

  results.value = { ...data.results }

  if (!success) {
    toast.error(message)
    return
  }
}, 1000)

const onChangePercentage = async (box: PercentageBox) => {
  if (percentageLoadingBox.value && percentageLoadingBox.value !== box.key) {
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
  await sessionStore.addSessionActivity({
    action_label: `percentage_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: results.value } },
    notes: `Target: ${props.measurement.target?.name} [${box.key}: ${val}]`,
    timestamp: new Date().toISOString()
  })

  onSavePercentage(box)
}

// draft
const switchLoading = ref<boolean>(false)
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
  setTimeout(() => {
    emit('afterCommit')
    switchLoading.value = false
  }, 300)
}
</script>

<template>
  <div class="flex flex-col justify-between flex-grow h-full gap-2">
    <div
      v-if="percentageLoadingBox !== null"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-20 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

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
            class="flex flex-wrap items-start content-center justify-center transition-all max-w-72"
            :class="{
              'gap-x-4 gap-y-4': !isCollapsed,
              'gap-x-2 gap-y-2': isCollapsed
            }"
          >
            <div
              v-for="box in percentageBoxes"
              :key="box.key"
              class="flex items-center justify-center w-10 h-10 text-2xl transition-all border rounded shrink-0"
              :class="{
                'pointer-events-none':
                  (percentageLoadingBox && percentageLoadingBox !== box.key) ||
                  sessionStore.session?.status !== 'ongoing',
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

    <div class="pb-3 space-y-2 shrink-0" :class="{ '-translate-y-2': isCollapsed }">
      <div class="flex items-center justify-center h-2 gap-2">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="w-2 h-2 transition-all rounded-full"
        ></div>
      </div>

      <div
        v-if="!isCollapsed"
        class="flex items-center justify-center gap-2 text-xs font-medium text-center text-slate-7"
      >
        <div>Goal: {{ measurement.target?.goal }}%</div>
        <div>Score: {{ percentageScore.toFixed(0) }}%</div>
      </div>

      <div
        v-if="sessionStore.session?.status === 'draft' && measurement?.target?.probing_enable"
        class="z-10 flex items-center justify-between w-full px-4 py-2 rounded-full bg-lime-2"
      >
        <div class="text-sm font-semibold text-lime-7">Set as probing</div>
        <div class="flex items-center gap-1">
          <Icon
            v-if="switchLoading"
            icon="mingcute:loading-fill"
            class="text-xl animate-spin text-lime-7"
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
