<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { onMounted, ref } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  is_collapsed: boolean
}
interface Emits {
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const currentScore = ref<number>(0)
onMounted(() => {
  currentScore.value = props.measurement?.results?.score || 0
})

const scoreLoading = ref<boolean>(false)

const onSaveScore = debounce(async function (score: number) {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: score,
    data_result: {
      ...props.measurement,
      results: { score }
    }
  }
  scoreLoading.value = true
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false
  if (!success) {
    currentScore.value = props.measurement?.results?.score || 0
    emit('fetch-session')
    toast.error(message)
  }
  currentScore.value = data?.results?.score || 0
}, 1000)

const onChangeScore = async (score: number) => {
  // change state
  currentScore.value += score

  // save state
  const gapScore = currentScore.value - (props.measurement?.results?.score || 0)
  onSaveScore(gapScore)
}
</script>

<template>
  <div
    class="flex flex-wrap items-center content-center justify-center h-full gap-x-3 gap-y-4"
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

  <div v-if="!is_collapsed" class="text-xs font-medium text-center shrink-0 text-slate-7">
    Goal: {{ measurement.target?.goal }} attempt(s) per session
  </div>
</template>
