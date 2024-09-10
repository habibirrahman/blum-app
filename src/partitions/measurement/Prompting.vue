<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, ref, watch } from 'vue'
import type { Measurement } from '@/lib/types'
import { promptColors } from '@/lib/data'
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
  () => (page.value = 1)
)
const perPage = computed<number>(() => (props.is_collapsed ? 3 : 9))
const pageCount = computed<number>(() => {
  const results = props.measurement.results ? Object.keys(props.measurement.results) : []
  const boxes = results.filter((i) => props.measurement.results[i].enabled).length
  return Math.ceil(boxes / perPage.value)
})

type PromptColors =
  | 'cherry'
  | 'blush'
  | 'gold'
  | 'daffodil'
  | 'lake'
  | 'mint'
  | 'sky'
  | 'hydrangeas'
  | 'grey'
  | 'primary'
type PromptShapes = 'square' | 'circle' | 'triangle' | 'diamond'
interface PromptBoxes {
  id: number | string
  name: string
  color: PromptColors
  score: number
  shape: PromptShapes
  enabled: boolean
  position: number
  abbreviation: string
}
const promptBoxes = computed<PromptBoxes[]>(() => {
  if (props.measurement.results) {
    const keys = Object.keys(props.measurement.results)
    if (keys && keys.length) {
      const prompts: PromptBoxes[] = keys
        .map((key) => ({ ...props.measurement.results[key], key }) as PromptBoxes)
        .filter((i) => i.enabled)
        .sort((a, b) => a.position - b.position)
      const start = (page.value - 1) * perPage.value
      const end = page.value * perPage.value
      return prompts.slice(start, end)
    } else return []
  } else return []
})

const scoreLoading = ref<boolean>(false)
const onChangeScore = async (prompt: any, score: number) => {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: { ...props.measurement.results },
    data_result: { ...props.measurement }
  }
  params.results[prompt.key] = {
    ...prompt,
    score: prompt.score + score
  }
  params.data_result.results = params.results
  scoreLoading.value = true
  const { success } = await sessionStore.updateMeasurementResults(params)
  scoreLoading.value = false
}
</script>

<template>
  <div class="flex h-full content-center items-center justify-center">
    <div
      class="flex w-[calc(240px+24px)] flex-wrap items-center justify-center gap-x-3 gap-y-4"
      :class="{ '-translate-y-2 scale-75': is_collapsed }"
    >
      <div v-for="prompt in promptBoxes" :key="prompt.id" class="space-y-1">
        <div
          class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] border text-4xl font-bold transition-all"
          :class="{ 'pointer-events-none': scoreLoading }"
          :style="{
            backgroundColor: promptColors[prompt.color].primaryColor,
            borderColor: promptColors[prompt.color].secondaryColor,
            color: promptColors[prompt.color].textColor
          }"
          @click="onChangeScore(prompt, 1)"
        >
          <div class="absolute top-px text-xs font-semibold">{{ prompt.abbreviation }}</div>
          <div v-if="prompt.score">{{ prompt.score }}</div>
          <Icon v-else icon="ph:plus-bold" />
        </div>
        <div
          class="flex h-5 items-center justify-center rounded border border-slate-5 bg-pure-white px-5"
          :class="{ 'pointer-events-none': scoreLoading || !prompt.score }"
          @click="onChangeScore(prompt, -1)"
        >
          <div class="h-1 w-6 shrink-0 rounded bg-slate-5"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="shrink-0 space-y-2" :class="{ '-translate-y-1': is_collapsed }">
    <div class="flex h-2 items-center justify-center gap-2">
      <div
        v-for="n in pageCount"
        :key="n"
        :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
        class="h-2 w-2 rounded-full transition-all"
        @click="page = n"
      ></div>
    </div>
    <div v-if="!is_collapsed" class="text-center text-xs font-medium text-slate-7">
      Goal: {{ measurement.target?.goal }} attempt(s)
      {{ measurement.target?.success_metric }} prompt
    </div>
  </div>
</template>
