<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import type { Measurement, MeasurementResultsFrequency } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import { useClock } from '@/composable/use-clock'
import dayjs from 'dayjs'

interface Props {
  measurement: Measurement
  measurementResults: MeasurementResultsFrequency
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const sessionStore = useSessionStore()
const toast = useToast()
const { now } = useClock()

/** DATA */

const currentScore = ref<number>(0)
const scoreLoading = ref<boolean>(false)

/** COMPUTED */

const durationInMinutes = computed(() => {
  if (!props.measurement) return 0
  return props.measurement.duration || props.measurement?.target?.duration || 0
})

const counterFromStartTimeInSeconds = computed(() => {
  const session = sessionStore.session
  if (!session) return 0
  const diff = now.value.diff(dayjs(session.start_time), 'second')
  return diff
})

const isDisabled = computed(() => {
  if (!props.measurement) return false
  if (!props.measurement.target) return false
  if (!durationInMinutes.value) return false
  if (props.measurement.target.frequency_format !== 'custom') return false

  return counterFromStartTimeInSeconds.value > durationInMinutes.value * 60
})

/** WATHCER */

watch(
  () => scoreLoading.value,
  (val) => {
    if (!val) {
      emit('toggle-updated', true)
    } else {
      emit('toggle-updated', false)
    }
  }
)

/** METHODS */

const onSaveScore = debounce(async function (score: number) {
  const finalScore = props.measurementResults.score + score

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: { score: finalScore } },
    data_result: { ...props.measurement, results: { score: finalScore } },
    last_data: { ...props.measurement }
  }

  scoreLoading.value = true
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false

  currentScore.value = data?.results?.score || 0

  if (!success) {
    toast.error(message)
    return
  }
}, 1000)

const onChangeScore = async (score: number) => {
  if (isDisabled.value) return

  // change state
  currentScore.value += score

  // save state
  const gapScore = currentScore.value - (props.measurementResults?.score || 0)

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: score === 1 ? `frequency_add` : `frequency_subtract`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: { score: currentScore.value } } },
    notes: `Target: ${props.measurement.target?.name} [${currentScore.value}]`,
    timestamp: new Date().toISOString()
  })

  onSaveScore(gapScore)
}

onMounted(() => {
  currentScore.value = props.measurementResults?.score || 0
})
</script>

<template>
  <div class="flex flex-col flex-grow gap-2 justify-between h-full">
    <div
      v-if="scoreLoading"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-20 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div
      class="flex flex-wrap flex-grow gap-x-3 gap-y-4 justify-center content-center items-center h-full"
      :class="{ 'scale-90': isCollapsed }"
    >
      <div
        class="space-y-1"
        :title="
          isDisabled ? `The selected duration has ended, no additional frequency can be added.` : ''
        "
      >
        <div
          class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] text-4xl font-bold transition-colors"
          :class="[
            scoreLoading || sessionStore.session?.status !== 'ongoing' || isDisabled
              ? 'pointer-events-none'
              : '',
            isDisabled ? 'bg-slate-4 text-slate-6' : 'bg-light-purple-5 text-white'
          ]"
          @click="onChangeScore(1)"
        >
          <div v-if="currentScore">{{ currentScore }}</div>
          <Icon v-else icon="stash:plus-solid" class="text-5xl" />
        </div>
        <div
          class="flex justify-center items-center h-5 rounded border border-slate-5 bg-pure-white"
          :class="{
            'pointer-events-none':
              scoreLoading ||
              !currentScore ||
              sessionStore.session?.status !== 'ongoing' ||
              isDisabled
          }"
          @click="onChangeScore(-1)"
        >
          <div
            class="w-6 h-1 rounded shrink-0"
            :class="{
              'bg-slate-5': !currentScore,
              'bg-slate-6': currentScore
            }"
          ></div>
        </div>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="pb-3 space-y-2 text-xs font-medium text-center shrink-0 text-slate-7"
    >
      <div class="flex justify-between items-center">
        <div>Goal</div>
        <div>{{ measurement.target?.goal }} attempt(s)</div>
      </div>
      <div
        v-if="measurement.target?.frequency_format === 'custom'"
        class="flex justify-between items-center"
      >
        <div>Duration</div>
        <div>{{ measurement.duration }} minute(s)</div>
      </div>
    </div>
  </div>
</template>
