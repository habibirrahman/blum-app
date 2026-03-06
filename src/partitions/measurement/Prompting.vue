<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import type { Measurement, Target } from '@/lib/types'
import { promptColors } from '@/lib/data'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import AppButton from '@/components/AppButton.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppToggle from '@/components/AppToggle.vue'

const sessionStore = useSessionStore()
const toast = useToast()

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  target: Target
  isCollapsed: boolean
}
interface Emits {
  (e: 'toggle-updated', bool: boolean): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const results = ref<Measurement['results']>({})

onMounted(() => {
  results.value = { ...props.measurementResults }
})
watch(
  () => props.measurementResults,
  (val) => {
    results.value = { ...val }
  }
)

const page = ref<number>(1)
watch(
  () => props.isCollapsed,
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

const perPage = computed<number>(() => (props.isCollapsed ? 3 : 9))
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

const onSaveScore = debounce(async function (key: number | string, prompt: any, score: number) {
  const finalResults = results.value
  finalResults[key] = { ...prompt, score: prompt.score + score }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  scoreLoadingBox.value = key
  typeLoadingBox.value = prompt.score
  const { success, data, message } = await sessionStore.updateMeasurementResults(params)
  scoreLoadingBox.value = null
  typeLoadingBox.value = null

  results.value = { ...data.results }

  if (!success) {
    toast.error(message)
    return
  }
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
  const gapScore = newScore - props.measurementResults[prompt.key].score
  scoreLoadingBox.value = prompt.key
  typeLoadingBox.value = score

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: score === 1 ? `prompting_add` : `prompting_subtract`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: results.value } },
    notes: `Target: ${props.measurement.target?.name} [${prompt.key} ${prompt.name}: ${newScore}]`,
    timestamp: new Date().toISOString()
  })

  onSaveScore(prompt.key, props.measurementResults[prompt.key], gapScore)
}

interface Prompt {
  key: string | number
  abbreviation: string
  color: string
  enabled: boolean
  name: string
  position: number
  score: number
  shape: string
}

const shapes: Record<string, string> = {
  square: 'ph:square-fill',
  circle: 'ph:circle-fill',
  triangle: 'ph:triangle-fill',
  diamond: 'ph:diamond-fill'
}

const defaultPrompts = ref<Prompt[]>([])
const saveLoading = ref<boolean>(false)
const showCustomize = ref<boolean>(false)

watch(
  () => showCustomize.value,
  (val) => {
    if (!val) return

    const results = props.measurementResults
    const keys = Object.keys(results)
    if (keys && keys.length) {
      const n = keys.map((i) => ({ ...results[i], key: i })).sort((a, b) => a.position - b.position)
      defaultPrompts.value = n
    }
  }
)

const onToggleEnabledPrompt = (prompt: Prompt) => {
  const index = defaultPrompts.value.findIndex((i) => Number(i.key) === Number(prompt.key))
  if (index > -1) {
    defaultPrompts.value[index].enabled = !prompt.enabled
  }
}

const onSavePrompts = async () => {
  const payload = {
    id: props.measurement.id,
    measurement: { results: {} as Record<string, Prompt> },
    data_result: props.measurement
  }
  defaultPrompts.value.forEach((i) => {
    payload.measurement.results[i.key] = i
  })

  saveLoading.value = true
  await sessionStore.updateMeasurement(payload)
  saveLoading.value = false

  showCustomize.value = false
}
</script>

<template>
  <div class="flex flex-col justify-between flex-grow h-full gap-2">
    <div
      v-if="scoreLoadingBox !== null"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-16 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div class="flex items-center content-center justify-center flex-grow h-full">
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
            :class="{ '-translate-y-1 scale-75': isCollapsed }"
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

    <div class="pb-3 space-y-2 shrink-0" :class="{ '-translate-y-4': isCollapsed }">
      <div class="flex items-center justify-center h-2 gap-2">
        <div
          v-for="n in pageCount"
          :key="n"
          :class="{ 'bg-slate-7': n === page, 'bg-slate-4': n !== page }"
          class="w-2 h-2 transition-all rounded-full"
        ></div>
      </div>
      <div v-if="!isCollapsed">
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

    <AppButton
      v-if="sessionStore.session?.status === 'draft'"
      kind="outline"
      @click="showCustomize = !showCustomize"
    >
      Customize prompt visibility
    </AppButton>
  </div>

  <AppActionSheet :show="showCustomize" @close="showCustomize = false">
    <div>
      <div class="sticky top-0 z-10 flex items-center justify-between py-3 bg-white">
        <div class="text-xl font-semibold">Customize prompt visibility</div>
        <div class="cursor-pointer" @click="showCustomize = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="prompt in defaultPrompts"
          :key="prompt.key"
          class="flex items-center justify-between w-full border-b h-14 border-slate-3"
          :class="[
            prompt.name === measurement.target?.success_metric
              ? 'cursor-not-allowed'
              : 'cursor-pointer'
          ]"
        >
          <div
            class="flex items-center h-10 gap-3 truncate"
            :class="{ 'pointer-events-none': prompt.name === measurement.target?.success_metric }"
            @click="onToggleEnabledPrompt(prompt)"
          >
            <Icon
              :icon="shapes[prompt.shape]"
              class="text-2xl"
              :style="{ color: promptColors[prompt.color].primaryColor }"
            />
            <div class="text-sm truncate text-slate-8">
              {{ prompt.name }}
            </div>
            <div
              v-if="prompt.name === measurement.target?.success_metric"
              class="text-xs italic truncate text-slate-6"
            >
              as success metric
            </div>
          </div>

          <AppToggle
            :name="`toggle-prompt-${prompt.key}`"
            :checked="prompt.enabled"
            :disabled="prompt.name === measurement.target?.success_metric"
            @change="onToggleEnabledPrompt(prompt)"
          />
        </div>
      </div>

      <div class="sticky bottom-0 z-10 flex items-center justify-between py-3 bg-white">
        <AppButton class="w-full" :loading="saveLoading" @click="onSavePrompts"> Apply </AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
