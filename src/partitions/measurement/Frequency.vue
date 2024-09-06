<script setup lang="ts">
import { useSessionStore, type MeasurementResultsParams } from '@/stores/session.store'
import { ref } from 'vue'
import type { Measurement } from '@/lib/types'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
}
const props = withDefaults(defineProps<Props>(), {})

const scoreLoading = ref<boolean>(false)
const onChangeScore = async (score: number) => {
  const params: MeasurementResultsParams = {
    id: props.measurement.id,
    results: props.measurement.results?.score + score
  }
  scoreLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false
}
</script>

<template>
  <div class="flex h-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-4">
    <div class="space-y-1">
      <div
        class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] bg-light-purple-5 font-bold text-white"
        :class="{ 'pointer-events-none': scoreLoading }"
        @click="onChangeScore(1)"
      >
        <div v-if="measurement.results?.score" class="text-4xl">
          {{ measurement.results?.score }}
        </div>
        <div v-else class="mb-1 text-5xl">+</div>
      </div>
      <div
        class="flex h-5 items-center justify-center rounded border border-slate-5 bg-pure-white"
        :class="{ 'pointer-events-none': scoreLoading || !measurement.results?.score }"
        @click="onChangeScore(-1)"
      >
        <div class="h-1 w-6 shrink-0 rounded bg-slate-5"></div>
      </div>
    </div>
  </div>
  <div class="shrink-0 text-center text-xs font-medium text-slate-7">
    Goal: {{ measurement.target?.goal }} attempt(s) per session
  </div>
</template>
