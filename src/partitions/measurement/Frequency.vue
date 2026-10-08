<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsV2Params } from '@/stores/session.store'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Measurement, MeasurementFrequency } from '@/lib/types'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'
import { debounce } from '@/lib/func'
import { useClock } from '@/composables/use-clock'
import dayjs from 'dayjs'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'

interface Props {
  measurement: Measurement
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

const submitLoading = ref<boolean>(false)
const isOpenEdit = ref<boolean>(false)

const currentScore = ref<number>(0)
const scoreInput = ref<number>(0)

/** COMPUTED */

const _currentRecordingTime = computed(() => {
  const recording = sessionStore.session?.current_recording_time?.[0] || 0
  return dayjs().add(recording * -1, 'seconds')
})

const durationInMinutes = computed(() => {
  if (!props.measurement) return 0
  return props.measurement.duration || props.measurement?.target?.duration || 0
})

const counterFromStartTimeInSeconds = computed(() => {
  // Hanya butuh tick `now` setiap detik kalau format custom (perlu auto-disable saat durasi habis).
  // Untuk format lain, tidak perlu depend ke `now` sama sekali — menghindari re-render tiap detik.
  if (props.measurement?.target?.frequency_format !== 'custom') return 0

  if (sessionStore.session?.status === 'paused') {
    return sessionStore.session?.current_recording_time?.[0] || 0
  }

  const n = now.value
  const diff = n.diff(_currentRecordingTime.value, 'seconds')
  return diff
})

const isDisabled = computed(() => {
  if (!props.measurement) return false
  if (!props.measurement.target) return false
  if (!durationInMinutes.value) return false
  if (props.measurement.target.frequency_format !== 'custom') return false

  if (sessionStore.session?.status === 'draft') return false
  if (sessionStore.session?.status === 'completed') return false
  if (sessionStore.session?.status === 'cancelled') return false

  return counterFromStartTimeInSeconds.value > durationInMinutes.value * 60
})

/** WATHCER */

watch(
  () => submitLoading.value,
  (val) => {
    emit('toggle-updated', !val)
  }
)

/** METHODS */

const _onSaveScore = async (scoreDelta: number) => {
  const results = props.measurement.results as MeasurementFrequency['results']
  const baseScore = results.score
  const finalScore = baseScore + scoreDelta

  const payload: UpdateMeasurementResultsV2Params = {
    id: props.measurement.id,
    params: { results: scoreDelta },
    dataResult: { ...props.measurement, results: { score: finalScore } },
    lastData: { ...props.measurement }
  }

  submitLoading.value = true
  const { success, data, message } = await sessionStore.updateMeasurementResultsV2(payload)
  submitLoading.value = false

  if (!success) {
    const results = props.measurement.results as MeasurementFrequency['results']
    currentScore.value = results.score
    toast.error(message)
    return
  }

  if (data?.results) {
    currentScore.value = data.results.score
  }

  isOpenEdit.value = false
}

const onSaveScore = debounce(_onSaveScore, 1000)

const onChangeScore = async (score: number) => {
  if (sessionStore.session?.status !== 'ongoing' || isDisabled.value) return

  // change state
  currentScore.value += score

  // Calculate difference from original to send delta API
  const results = props.measurement.results as MeasurementFrequency['results']
  const baseScore = results.score
  const gapScore = currentScore.value - baseScore

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: score === 1 ? `frequency_add` : `frequency_subtract`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: { score: currentScore.value } } },
    notes: `Target: ${props.measurement.target?.name} [${currentScore.value}]`,
    timestamp: new Date().toISOString()
  })

  onSaveScore(gapScore)
}

// modal edit score with number input

const openEdit = async () => {
  if (sessionStore.session?.status !== 'ongoing') return

  isOpenEdit.value = true
  scoreInput.value = currentScore.value

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `frequency_open_edit`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    notes: `Opened edit score modal`,
    timestamp: new Date().toISOString()
  })

  const id = `frequency-score-${props.measurement.id}`
  const input = document.getElementById(id) as HTMLInputElement
  input?.focus()
}

const onUpdateScore = async () => {
  if (sessionStore.session?.status !== 'ongoing') return

  // Calculate difference from original to send delta API
  const results = props.measurement.results as MeasurementFrequency['results']
  const baseScore = results.score
  const gapScore = scoreInput.value - baseScore

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `frequency_update_score`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: { score: currentScore.value } } },
    notes: `Updated score from ${baseScore} to ${scoreInput.value}`,
    timestamp: new Date().toISOString()
  })

  _onSaveScore(gapScore)
}

onMounted(() => {
  const results = props.measurement.results as MeasurementFrequency['results']
  currentScore.value = results.score || 0
})

onBeforeUnmount(() => {
  onSaveScore.cancel()
})
</script>

<template>
  <div class="flex flex-col flex-grow gap-2 justify-between h-full">
    <!-- Loading stste -->
    <div
      v-if="submitLoading"
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
          class="relative flex h-20 min-w-20 shrink-0 items-center justify-center rounded-[20px] px-2 font-bold transition-colors"
          :class="[
            sessionStore.session?.status !== 'ongoing' || isDisabled ? 'pointer-events-none' : '',
            isDisabled ? 'bg-slate-4 text-slate-6' : 'bg-light-purple-5 text-white'
          ]"
          @click="onChangeScore(1)"
        >
          <div v-if="currentScore" class="text-4xl">{{ currentScore }}</div>
          <Icon v-else icon="stash:plus-solid" class="text-5xl" />
        </div>
        <div
          class="flex justify-center items-center h-5 rounded border border-slate-5 bg-pure-white"
          :class="{
            'pointer-events-none':
              !currentScore || sessionStore.session?.status !== 'ongoing' || isDisabled
          }"
          @click="onChangeScore(-1)"
        >
          <div
            class="w-6 h-1 rounded shrink-0"
            :class="{
              'bg-slate-5': !currentScore,
              'bg-slate-7': currentScore
            }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="!isCollapsed" class="pb-3 shrink-0">
      <div class="flex justify-center mb-4">
        <AppButton
          class="rounded-full !border-transparent !bg-prim-2 !text-light-purple-5 hover:!bg-prim-3"
          :disabled="sessionStore.session?.status !== 'ongoing'"
          @click="openEdit"
        >
          <Icon icon="ph:pencil-simple" />
          <span>Edit number</span>
        </AppButton>
      </div>

      <div class="flex justify-between items-center">
        <div class="=text-slate-7 text-xs">Goal</div>
        <div class="=text-slate-7 text-xs font-semibold">
          {{ measurement.target?.goal }} attempt(s)
        </div>
      </div>

      <div
        v-if="measurement.target?.frequency_format === 'custom'"
        class="flex justify-between items-center"
      >
        <div class="=text-slate-7 text-xs">Duration</div>
        <div class="=text-slate-7 text-xs font-semibold">{{ measurement.duration }} minute(s)</div>
      </div>
    </div>

    <!-- Edit score modal -->
    <AppActionSheet :show="isOpenEdit" @close="isOpenEdit = false">
      <div class="flex flex-col gap-4 py-3 w-full">
        <div class="text-xl font-semibold text-left">Edit number</div>

        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <div class="text-sm font-medium text-slate-7">
              {{ measurement.target?.curriculum_name }}
            </div>
            <div class="text-base font-semibold text-slate-8">{{ measurement.target?.name }}</div>
          </div>

          <AppTextInput
            name="frequency-score"
            :id="`frequency-score-${props.measurement.id}`"
            label="Count"
            type="number"
            min="0"
            v-model="scoreInput"
            :disabled="submitLoading"
          />

          <div
            class="flex gap-4 justify-center items-center mt-4 w-full h-14 rounded bg-cornflower-2"
          >
            <div class="text-sm font-bold text-slate-10">
              {{ currentScore }}
            </div>
            <Icon icon="ph:arrow-right" class="text-lg text-cornflower-8" />
            <div class="text-sm font-bold text-cornflower-8">
              {{ scoreInput }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 items-center">
          <AppButton kind="plain" @click="isOpenEdit = false">Cancel</AppButton>

          <AppButton v-if="currentScore === scoreInput" @click="isOpenEdit = false">Done</AppButton>
          <AppButton v-else :loading="submitLoading" @click="onUpdateScore">Save</AppButton>
        </div>
      </div>
    </AppActionSheet>
    <!-- end edit lap modal -->
  </div>
</template>
