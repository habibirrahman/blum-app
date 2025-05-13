<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import type { Measurement, Target } from '@/lib/types'
import { promptColors } from '@/lib/data'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurement_results: Measurement['results']
  target: Target
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
  results.value = { ...props.measurement_results }
})
watch(
  () => props.measurement_results,
  (val) => {
    results.value = { ...val }
  }
)

const page = ref<number>(1)
watch(
  () => props.is_collapsed,
  () => {
    setTimeout(() => {
      const el = `${props.measurement.id}-prompt-boxes-${1}`
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

const perPage = computed<number>(() => (props.is_collapsed ? 3 : 9))
const pageCount = computed<number>(() => {
  const res = Object.keys(results.value) || []
  const boxes = res.filter((i) => results.value[i].enabled).length
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
interface PromptBox {
  key: number | string
  id: number | string
  name: string
  color: PromptColors
  score: number
  shape: PromptShapes
  enabled: boolean
  position: number
  abbreviation: string
}
const promptBoxesPages = computed<PromptBox[][]>(() => {
  if (!results.value) return []
  const keys = Object.keys(results.value)
  if (!keys || !keys.length) return []

  const prompts: PromptBox[] = keys
    .map((key) => ({ ...results.value[key], key }) as PromptBox)
    .filter((i) => i.enabled)
    .sort((a, b) => a.position - b.position)
  const res: PromptBox[][] = []
  for (let idx = 1; idx <= pageCount.value; idx++) {
    const start = (idx - 1) * perPage.value
    const end = idx * perPage.value
    const arr = [...prompts.slice(start, end)]
    res.push(arr)
  }
  return res
})

const getPromptScore = (id: number | string) => {
  const found = props.target?.prompts?.find((i) => i.id === Number(id))
  return found ? Number(found.score || 0) : 0
}

const currentScore = computed<number>(() => {
  if (!results.value) return 0
  const keys = Object.keys(results.value)
  if (!keys || !keys.length) return 0
  let count = 0
  let total = 0

  for (let idx = 0; idx < keys.length; idx++) {
    const key = keys[idx]
    if (results.value[key].enabled) {
      const promptScore = getPromptScore(key)
      const attempt = Number(results.value[key].score || 0)

      count += attempt
      total += attempt * promptScore
    }
  }
  const final = total / (count || 0)
  return Math.round(final || 0)
})

const scoreLoadingBox = ref<PromptBox['key'] | null>(null)
const typeLoadingBox = ref<number | null>(null)

watch(
  () => scoreLoadingBox.value,
  (val) => {
    if (val === null) {
      emit('toggle-updated', true)
    } else {
      emit('toggle-updated', false)
    }
  }
)

const onSaveScore = debounce(async function (prompt: any, score: number) {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    results: {},
    data_result: { ...props.measurement, results: results.value }
  }

  params.results[prompt.key] = score
  params.data_result.results[prompt.key] = { ...prompt, score: prompt.score + score }

  // scoreLoadingBox.value = prompt.key
  // typeLoadingBox.value = prompt.score
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoadingBox.value = null
  typeLoadingBox.value = null
  if (!success) {
    results.value = { ...props.measurement_results }
    emit('fetch-session')
    toast.error(message)
  }

  results.value = { ...data.results }
}, 1000)

const onChangeScore = async (prompt: any, score: number) => {
  if (scoreLoadingBox.value !== null && scoreLoadingBox.value !== prompt.key) {
    return
  }
  if (typeLoadingBox.value !== null && typeLoadingBox.value !== score) {
    return
  }

  // change state
  const newScore = results.value[prompt.key].score + score
  results.value[prompt.key] = {
    ...results.value[prompt.key],
    score: newScore
  }

  // save state
  const gapScore = newScore - props.measurement_results[prompt.key].score
  scoreLoadingBox.value = prompt.key
  typeLoadingBox.value = score
  onSaveScore(prompt, gapScore)
}
</script>

<template>
  <div class="flex items-center content-center justify-center h-full">
    <div
      class="flex w-[calc(320px-32px)] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4"
      @scroll="onScroll"
    >
      <div
        v-for="(promptBoxes, idx) in promptBoxesPages"
        :key="`${measurement.id}-prompt-boxes-${idx + 1}`"
        :id="`${measurement.id}-prompt-boxes-${idx + 1}`"
        class="flex w-[calc(320px-32px)] shrink-0 snap-start justify-center"
      >
        <div
          class="flex w-[calc(240px+24px)] flex-wrap content-center items-start justify-center gap-x-3 gap-y-4"
          :class="{ '-translate-y-1 scale-75': is_collapsed }"
        >
          <div v-for="prompt in promptBoxes" :key="prompt.id" class="space-y-1">
            <div
              class="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] border text-4xl font-bold transition-all"
              :class="{
                'cursor-wait':
                  (scoreLoadingBox !== null && scoreLoadingBox !== prompt.key) ||
                  (typeLoadingBox !== null && typeLoadingBox !== 1),
                'pointer-events-none': sessionStore.session?.status !== 'ongoing'
              }"
              :style="{
                backgroundColor: promptColors[prompt.color].primaryColor,
                borderColor: promptColors[prompt.color].secondaryColor,
                color: promptColors[prompt.color].textColor
              }"
              @click="onChangeScore(prompt, 1)"
            >
              <div class="absolute text-xs font-semibold top-px">{{ prompt.abbreviation }}</div>
              <div v-if="prompt.score">{{ prompt.score }}</div>
              <Icon v-else icon="stash:plus-solid" class="text-5xl" />
            </div>
            <div
              class="flex items-center justify-center h-5 px-5 border rounded border-slate-5 bg-pure-white"
              :class="{
                'cursor-wait':
                  (scoreLoadingBox !== null && scoreLoadingBox !== prompt.key) ||
                  (typeLoadingBox !== null && typeLoadingBox !== -1),
                'pointer-events-none': !prompt.score || sessionStore.session?.status !== 'ongoing'
              }"
              @click="onChangeScore(prompt, -1)"
            >
              <div
                class="w-6 h-1 transition-all rounded shrink-0"
                :class="{ 'bg-slate-5': !prompt.score, 'bg-slate-6': prompt.score }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="space-y-2 shrink-0" :class="{ '-translate-y-4': is_collapsed }">
    <div class="flex items-center justify-center h-2 gap-2">
      <div
        v-for="n in pageCount"
        :key="n"
        :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
        class="w-2 h-2 transition-all rounded-full"
      ></div>
    </div>
    <div v-if="!is_collapsed">
      <div
        v-if="measurement?.target?.prompting_format === 'classic'"
        class="text-xs font-medium text-center text-slate-7"
      >
        Goal: {{ measurement.target?.goal }} attempt(s)
        {{ measurement.target?.success_metric }} prompt
      </div>
      <div
        v-if="measurement?.target?.prompting_format === 'custom'"
        class="text-xs font-medium text-center text-slate-7"
      >
        <span v-if="measurement?.target?.success_metric === 'equal to or greater than goal'">
          Goal: ≥ {{ `${measurement?.target?.goal}%` }}
        </span>
        <span v-if="measurement?.target?.success_metric === 'less than goal'">
          Goal: {{ '<' }} {{ `${measurement?.target?.goal}%` }}
        </span>
        <span class="w-2 shrink-0"></span>
        Score {{ `${currentScore}%` }}
      </div>
    </div>
  </div>
</template>
