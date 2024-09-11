<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { ref } from 'vue'
import type { Measurement } from '@/lib/types'
import { Icon } from '@iconify/vue'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  is_collapsed: boolean
}
const props = withDefaults(defineProps<Props>(), {})

const scoreLoading = ref<boolean>(false)
const onChangeScore = async (score: number) => {
  const currentScore = props.measurement.results?.score || 0
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: currentScore + score,
    data_result: {
      ...props.measurement,
      results: { score: currentScore + score }
    }
  }
  scoreLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false
}
</script>

<template>
  <div
    class="flex h-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-4"
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
        <div v-if="measurement.results?.score">{{ measurement.results?.score }}</div>
        <Icon v-else icon="ph:plus-bold" />
      </div>
      <div
        class="flex h-5 items-center justify-center rounded border border-slate-5 bg-pure-white"
        :class="{
          'pointer-events-none':
            scoreLoading ||
            !measurement.results?.score ||
            sessionStore.session?.status !== 'ongoing'
        }"
        @click="onChangeScore(-1)"
      >
        <div class="h-1 w-6 shrink-0 rounded bg-slate-5"></div>
      </div>
    </div>
  </div>

  <div v-if="!is_collapsed" class="shrink-0 text-center text-xs font-medium text-slate-7">
    Goal: {{ measurement.target?.goal }} attempt(s) per session
  </div>
</template>
