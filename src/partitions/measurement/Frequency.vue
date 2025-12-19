<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { onMounted, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurement_results: Measurement['results']
  is_collapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const currentScore = ref<number>(0)
onMounted(() => {
  currentScore.value = props.measurement?.results?.score || 0
})

const scoreLoading = ref<boolean>(false)

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

const onSaveScore = debounce(async function (score: number) {
  const finalScore = props.measurement_results.score + score

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
  // change state
  currentScore.value += score

  // save state
  const gapScore = currentScore.value - (props.measurement?.results?.score || 0)

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
</script>

<template>
  <div class="flex flex-col justify-between flex-grow h-full gap-2">
    <div
      v-if="scoreLoading"
      class="absolute z-10"
      :class="[is_collapsed ? 'right-16 top-4' : 'bottom-16 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div
      class="flex flex-wrap items-center content-center justify-center flex-grow h-full gap-x-3 gap-y-4"
      :class="{ 'scale-90': is_collapsed }"
    >
      <div class="space-y-1">
        <div
          class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] bg-light-purple-5 text-4xl font-bold text-white transition-all"
          :class="{
            'pointer-events-none': scoreLoading || sessionStore.session?.status !== 'ongoing'
          }"
          @click="onChangeScore(1)"
        >
          <div v-if="currentScore">{{ currentScore }}</div>
          <Icon v-else icon="stash:plus-solid" class="text-5xl" />
        </div>
        <div
          class="flex items-center justify-center h-5 border rounded border-slate-5 bg-pure-white"
          :class="{
            'pointer-events-none':
              scoreLoading || !currentScore || sessionStore.session?.status !== 'ongoing'
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

    <div v-if="!is_collapsed" class="pb-3 text-xs font-medium text-center shrink-0 text-slate-7">
      Goal: {{ measurement.target?.goal }} attempt(s) per session
    </div>
  </div>
</template>
