<script setup lang="ts">
import {
  useSessionStore,
  type UpdateMeasurementParams,
  type UpdateMeasurementResultsParams
} from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { type MeasurementType, type Measurement, type Target, type TargetType } from '@/lib/types'
import AppToggle from '@/components/AppToggle.vue'
import { getRandomString, getTargetType } from '@/lib/func'
import Prompting from './measurement/Prompting.vue'
import Frequency from './measurement/Frequency.vue'
import PartialIntervalRecording from './measurement/PartialIntervalRecording.vue'
import DurationLatency from './measurement/DurationLatency.vue'
import Percentage from './measurement/Percentage.vue'
import Probing from './measurement/Probing.vue'
import { useClientStore } from '@/stores/client.store'
import SkillBasedTreatment from './measurement/SkillBasedTreatment.vue'
import { useToast } from 'vue-toastification'

const toast = useToast()
const appStore = useAppStore()
const sessionStore = useSessionStore()
const clientStore = useClientStore()

interface Props {
  measurement: Measurement
  counter: number
  is_collapsed?: boolean
  review_mode?: boolean
  is_running?: boolean
}
interface Emits {
  (e: 'toggle-running'): void
  (e: 'toggle-saved', payload: { id: Measurement['id']; saved: boolean }): void
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'fetch-session'): void
}
const props = withDefaults(defineProps<Props>(), {
  is_collapsed: false,
  review_mode: false
})
const emit = defineEmits<Emits>()

onMounted(async () => {
  if (
    props.measurement.type === 'Measurement::Duration' ||
    props.measurement.type === 'Measurement::Latency'
  ) {
    laps.value = []
    Object.keys(props.measurement.results).forEach((lapIndex) => {
      const lap = props.measurement.results[lapIndex]
      if (parseInt(lapIndex) !== 0 || (lap.string !== '00:00:00' && lap.seconds !== 0)) {
        laps.value.push({
          lapNumber: parseInt(lapIndex),
          time: lap.string,
          seconds: lap.seconds
        })
      }
    })

    let totalSeconds = 0
    if (laps.value.length > 0) {
      laps.value.forEach((lap) => {
        const [h, m, s] = lap.time.split(':').map(Number)
        totalSeconds += h * 3600 + m * 60 + s
      })
      const seconds = String(totalSeconds % 60).padStart(2, '0')
      const minutes = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')

      lastTimer.value = `${hours}:${minutes}:${seconds}`
      lastLapTime.value = laps.value[laps.value.length - 1].time
    }
  }

  if (
    props.measurement.type === 'Measurement::Probing' ||
    props.measurement.type === 'Measurement::Prompting' ||
    props.measurement.type === 'Measurement::Sbt'
  ) {
    const { data } = await clientStore.getTarget({ id: props.measurement.target_id, plain: true })
    target.value = data || {}
  }

  isDropped.value = props.measurement.is_dropped || false
  cardLoading.value = false
})

const cardLoading = ref<boolean>(true)
const measurementType = computed<MeasurementType | TargetType | ''>(() => {
  const targetData: Target = props.measurement?.target || target.value || {}
  return props.measurement?.type || targetData?.type || ''
})

const display = ref<'target' | 'description' | 'comment'>('target')
watch(
  () => props.is_collapsed || props.review_mode,
  (val) => {
    if (val) display.value = 'target'
  }
)

const cardId = ref<string>('card-random-id')

// drop measurement property
const isDropped = ref<boolean>(false)
watch(
  () => props.measurement.is_dropped,
  (val) => {
    isDropped.value = val || false
    cardId.value = getRandomString('card-random-id')
  }
)
const isDropLoading = ref<boolean>(false)
const onDrop = async (bool: boolean) => {
  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { is_dropped: !bool },
    data_result: { ...props.measurement, is_dropped: !bool }
  }
  isDropLoading.value = true
  const { success, data } = await sessionStore.updateMeasurement(params)
  isDropLoading.value = false
  if (!success) return
  isDropped.value = data.is_dropped
  if (data.is_dropped && props.is_running) {
    emit('toggle-running')
  }
}

// comment property
const commentInput = ref<string>('')
const commentLoading = ref<boolean>(false)
watch(display, (val) => {
  if (val === 'comment') commentInput.value = props.measurement.comment || ''
})
const isDisabledSaveComment = computed<boolean>(
  () => commentInput.value === (props.measurement.comment || '')
)
const onSaveComment = async () => {
  const params: UpdateMeasurementParams = {
    id: props.measurement.id,
    measurement: { comment: commentInput.value },
    data_result: { ...props.measurement, comment: commentInput.value }
  }
  commentLoading.value = true
  const { success } = await sessionStore.updateMeasurement(params)
  commentLoading.value = false
  if (!success) return
  display.value = 'target'
}

// duration property
const durationCounter = ref<number>(0)
const durationStarted = ref<boolean>(false)
const durationInterval = ref<any>(null)
const durationLoading = ref<boolean>(false)
const lapLoading = ref<boolean>(false)
const laps = ref<any[]>([])
const lastLapTime = ref<any>(null)
const lastTimer = ref<any>(null)
const lapsLoadingReset = ref<boolean>(false)
const resetConfirmation = ref<boolean>(false)
const lapTimer = ref<number>(0)

const durationTimerRunning = computed<string>(() => {
  let baseSeconds = 0
  if (lastTimer.value) {
    const [h, m, s] = lastTimer.value.split(':').map(Number)
    baseSeconds = h * 3600 + m * 60 + s
  }

  const totalSeconds = baseSeconds + (durationCounter.value || 0)

  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
})

const currentLapTime = computed<string>(() => {
  let baseSeconds = 0
  if (lastLapTime.value) {
    const [h, m, s] = lastLapTime.value.split(':').map(Number)
    baseSeconds = h * 3600 + m * 60 + s
  }

  const totalSeconds = baseSeconds + (lapTimer.value || 0)

  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds / 60) % 60)).padStart(2, '0')
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')

  return `${hours}:${minutes}:${seconds}`
})

const onStartDurationTimer = () => {
  durationInterval.value = setInterval(() => {
    durationCounter.value++
    lapTimer.value++
  }, 1000)
}
const onToggleDurationTimer = async () => {
  if (!durationStarted.value) {
    durationStarted.value = true
    onStartDurationTimer()
    if (laps.value.length === 0) {
      const lapTime = currentLapTime.value
      laps.value.push({
        lapNumber: 0,
        time: lapTime,
        seconds: lapTimer.value
      })
    }
    emit('toggle-running')
  } else {
    clearInterval(durationInterval.value)
    if (laps.value.length > 0) {
      laps.value[laps.value.length - 1].time = currentLapTime.value
      laps.value[laps.value.length - 1].seconds = lapTimer.value
    }
    const formattedResults = {}
    laps.value.forEach((lap, index) => {
      formattedResults[index] = lap.time
    })

    const params = {
      id: props.measurement.id,
      results: formattedResults
    }
    durationLoading.value = true
    const { success, message } = await sessionStore.updateMeasurementResults(params)
    durationLoading.value = false
    if (!success) {
      onStartDurationTimer()
      emit('fetch-session')
      toast.error(message)
      return
    }
    durationStarted.value = false
    emit('toggle-running')
  }
}
const onRecordLap = async () => {
  if (!durationStarted.value) return
  if (lapLoading.value) return
  lapLoading.value = true

  const currentLapTimer = currentLapTime.value

  if (laps.value.length > 0) {
    laps.value[laps.value.length - 1].time = currentLapTimer
    laps.value[laps.value.length - 1].seconds = lapTimer.value
  }

  const lapNumber = laps.value.length
  laps.value.push({
    lapNumber,
    time: '00:00:00',
    seconds: 0
  })

  const formattedResults = {}
  laps.value.forEach((lap, index) => {
    formattedResults[index] = lap.time
  })

  const params = {
    id: props.measurement.id,
    results: formattedResults
  }

  const { success } = await sessionStore.updateMeasurementResults(params)
  lapLoading.value = false
  lapTimer.value = 0
  lastLapTime.value = null

  if (!success) {
    laps.value.pop()
    clearInterval(durationInterval.value)
    onStartDurationTimer()
  }
}
const onResetLaps = async () => {
  if (resetConfirmation.value) {
    laps.value = []
    lastLapTime.value = null
    lastTimer.value = null
    lapTimer.value = 0
    durationCounter.value = 0
    lapsLoadingReset.value = true

    const params = {
      id: props.measurement.id,
      results: { 0: '00:00:00' }
    }

    const { success } = await sessionStore.updateMeasurementResults(params)
    lapsLoadingReset.value = false

    if (!success) {
      lapsLoadingReset.value = false
      return
    }
  }
  resetConfirmation.value = false
}

// prompting & sbt property
const target = ref<Target>()
const onToggleSaved = (saved: boolean) => {
  emit('toggle-saved', { id: props.measurement.id, saved })
}
</script>

<template>
  <div
    class="relative transition-all rounded shrink-0"
    :class="{
      'h-[540px] w-[320px]': !is_collapsed,
      'h-[120px] w-full': is_collapsed && !measurementType.includes('Sbt'),
      'h-[180px] w-full':
        is_collapsed &&
        (measurementType.includes('Sbt') ||
          measurementType.includes('Duration') ||
          measurementType.includes('Latency'))
    }"
  >
    <div
      v-if="review_mode && measurement.is_fixed"
      class="absolute left-0 flex items-center justify-center w-16 h-16 bg-white rounded-full -top-6"
    >
      <Icon icon="ph:lock-fill" class="text-[40px] text-prim-5" />
    </div>
    <div class="flex flex-col h-full" :class="{ 'pointer-events-none': review_mode }">
      <div
        class="h-[6px] w-full shrink-0 rounded-t"
        :style="{ backgroundColor: measurement.target?.curriculum_color }"
      ></div>
      <div
        v-if="!is_collapsed"
        id="measurememt-header"
        class="flex items-center justify-between w-full px-4 h-9 shrink-0 bg-prim-2"
      >
        <div
          class="flex items-center justify-center w-6 h-6 transition-all rounded"
          :class="{ 'bg-white': display === 'description' }"
          @click="display = display === 'description' ? 'target' : 'description'"
        >
          <Icon icon="ph:article" class="text-2xl text-light-purple-5" />
        </div>
        <div
          class="relative flex items-center justify-center w-6 h-6 transition-all rounded"
          :class="{ 'bg-white': display === 'comment' }"
          @click="display = display === 'comment' ? 'target' : 'comment'"
        >
          <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
          <div
            class="absolute w-2 h-2 transition-all rounded-full right-px top-px bg-light-purple-5"
            :class="[measurement.comment ? 'opacity-100' : 'opacity-0']"
          ></div>
        </div>
        <div>
          <AppToggle
            :name="`toggle_measurement_${measurement.id}`"
            :checked="!isDropped"
            :loading="isDropLoading"
            :disabled="sessionStore.session?.status !== 'ongoing'"
            @change="onDrop"
          />
        </div>
      </div>

      <div v-if="cardLoading" class="flex flex-col items-center justify-center h-full bg-white">
        <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
      </div>
      <div
        v-else
        id="measurememt-body"
        class="flex flex-col h-full px-4 pt-3 bg-white rounded-b"
        :class="{ 'no-scrollbar overflow-y-auto': !is_collapsed }"
      >
        <div v-if="!is_collapsed" class="flex flex-col gap-1">
          <div class="text-sm font-semibold text-slate-7">
            {{ measurement.target?.curriculum_name }}
          </div>
          <div
            class="text-sm font-semibold text-slate-9"
            :class="{ 'truncate ': display === 'target' || display === 'comment' }"
          >
            {{ measurement.target?.name }}
          </div>
        </div>
        <div v-if="display === 'target'" class="flex h-full pb-3 transition-all">
          <div
            v-if="is_collapsed"
            class="flex items-center justify-center w-8 h-full rounded-full shrink-0 bg-slate-4"
            @click="emit('toggle-collapsed', false)"
          >
            <Icon icon="ph:caret-double-up" class="text-xl text-slate-7" />
          </div>
          <div v-if="isDropped" class="flex flex-col items-center justify-center flex-grow gap-4">
            <Icon icon="solar:clipboard-remove-bold" class="w-20 h-20 text-tulip-6" />
            <div v-if="!is_collapsed" class="space-y-2 w-72">
              <div class="font-semibold text-center">Entry not recorded</div>
              <div class="text-sm text-center text-slate-8">
                This entry will not be saved when the Session ends. Toggle back to save this entry
                recording.
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col justify-between flex-grow h-full">
            <DurationLatency
              v-if="
                (measurementType.includes('Duration') || measurementType.includes('Latency')) &&
                !resetConfirmation
              "
              :measurement="measurement"
              :is_started="durationStarted"
              :timer="durationTimerRunning"
              :update_loading="durationLoading"
              :lapLoading="lapLoading"
              :laps="laps"
              :currentLapTime="currentLapTime"
              :lapsLoadingReset="lapsLoadingReset"
              :is_collapsed="is_collapsed"
              @toggle-timer="onToggleDurationTimer"
              @record-lap="onRecordLap"
              @reset-laps-confirm="resetConfirmation = true"
              @fetch-session="emit('fetch-session')"
            />
            <div
              v-if="
                resetConfirmation &&
                (measurementType.includes('Duration') || measurementType.includes('Latency'))
              "
              class="flex flex-col items-center justify-center h-full gap-2"
            >
              <div class="font-semibold text-slate-8">Reset all recorded laps?</div>
              <div class="text-center text-slate-8">
                This will clear all existing lap records and begin again from Lap 1. You won’t be
                able to recover previous data.
              </div>
              <div class="flex items-center justify-center w-full gap-2 pr-2">
                <AppButton kind="plain" class="w-2/4" @click="resetConfirmation = false"
                  >Cancel</AppButton
                >
                <AppButton class="w-2/4" color="tomato-7" @click="onResetLaps">Reset</AppButton>
              </div>
            </div>
            <Frequency
              v-if="measurementType.includes('Frequency')"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
              @fetch-session="emit('fetch-session')"
            />
            <PartialIntervalRecording
              v-if="measurementType.includes('Pir')"
              :measurement="measurement"
              :counter="counter"
              :is_collapsed="is_collapsed"
              @fetch-session="emit('fetch-session')"
            />
            <Percentage
              v-if="measurementType.includes('Percentage')"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
              @fetch-session="emit('fetch-session')"
            />
            <Probing
              v-if="measurementType.includes('Probing')"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
              @toggle-collapsed="emit('toggle-collapsed', $event)"
              @fetch-session="emit('fetch-session')"
            />
            <Prompting
              v-if="measurementType.includes('Prompting') && target"
              :measurement="measurement"
              :measurement_results="measurement.results || {}"
              :target="target"
              :is_collapsed="is_collapsed"
              @fetch-session="emit('fetch-session')"
            />
            <SkillBasedTreatment
              v-if="measurementType.includes('Sbt') && target"
              :measurement="measurement"
              :measurement_results="measurement.results || {}"
              :target="target"
              :is_collapsed="is_collapsed"
              @toggle-saved="onToggleSaved($event)"
              @fetch-session="emit('fetch-session')"
            />
          </div>
        </div>
        <div v-if="display === 'description'" class="flex flex-col justify-between h-full pt-3">
          <div class="flex flex-col gap-3">
            <!-- target information -->
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              <div>{{ getTargetType(measurement.target?.type) }}</div>
              <div v-if="measurement.target?.type === 'Target::Duration'" class="space-y-0.5">
                <div>Goal time: {{ measurement.target.goal_time }}</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Percentage'" class="space-y-0.5">
                <div>Goal: {{ measurement.target.goal }}%</div>
                <div>Number of trials: {{ measurement.target.number_of_trial }} trial(s)</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Pir'" class="space-y-0.5">
                <div>Goal: {{ measurement.target.goal }}%</div>
                <div>Interval: {{ measurement.target.interval }} minute(s)</div>
                <div>Duration: {{ measurement.target.duration }} minute(s)</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Frequency'" class="space-y-0.5">
                <div>Goal: {{ measurement.target.goal }} attempt(s) per session</div>
                <div>Success metric: {{ measurement.target?.success_metric }}</div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Prompting'" class="space-y-0.5">
                <div class="capitalize">Format: {{ measurement.target?.prompting_format }}</div>
                <div v-if="measurement.target?.prompting_format === 'classic'">
                  Goal and success metric: Achieve target with
                  {{ measurement.target?.success_metric }} prompt, minimum
                  {{ measurement.target?.goal }} attempt(s) per session
                </div>
                <div v-if="measurement.target?.prompting_format === 'custom'">
                  Goal: {{ measurement.target?.goal }}%
                </div>
                <div v-if="measurement.target?.prompting_format === 'custom'">
                  Success metric: {{ measurement.target?.success_metric }}
                </div>
                <div>
                  Prompts used in this session:
                  {{
                    Object.keys(measurement.results || {})
                      ?.map((key) => {
                        const found = target?.prompts?.find((i) => i.id === Number(key))
                        const percentage = found?.score || 0
                        return { ...measurement.results[key], percentage }
                      })
                      ?.sort((a, b) => a.position - b.position)
                      ?.map((prompt) => {
                        if (target?.prompting_format === 'custom') {
                          return `${prompt?.name} (${prompt?.percentage}%)`
                        }
                        return prompt?.name
                      })
                      ?.join(', ')
                  }}
                </div>
              </div>
            </div>
            <!-- end target information -->
            <!-- probing -->
            <div
              v-if="measurementType.includes('Probing')"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              <div>Probing activated</div>
              <div>
                Goal: score
                {{
                  measurement.target?.success_metric === 'equal to or greater than goal' ? '≥' : '<'
                }}
                {{ measurement.target?.probing_goal }}% in minimum
                {{ measurement.target?.probing_number_of_trial }} trial(s)
              </div>
            </div>
            <!-- end probing -->
            <!-- target description -->
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              <div v-if="!measurement.target?.description" class="italic">No description</div>
              <div v-else class="whitespace-pre-line">{{ measurement.target?.description }}</div>
            </div>
            <!-- end target description -->
            <!-- last past line -->
            <div
              v-if="measurement.target?.last_phase_line"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              Data from this session will be added to the
              <span class="font-semibold">{{ measurement.target.last_phase_line?.label }}</span>
              phase.
            </div>
            <!-- end last past line -->
            <!-- sbt -->
            <div v-if="measurement.target?.type === 'Target::Sbt'">
              <!-- sbt taks -->
              <div class="py-3 space-y-3 bordert-2 border-slate-4">
                <div v-for="taskCode in target?.target_tasks" :key="taskCode.id" class="space-y-1">
                  <div class="text-sm font-semibold text-slate-8">
                    {{ taskCode.code }} - {{ taskCode.code_definition }}
                  </div>
                  <div class="text-sm whitespace-pre-line text-slate-8">
                    {{ taskCode.description }}
                  </div>
                </div>
              </div>
              <!-- sbt problem behavior -->
              <div class="py-3 space-y-3 bordert-2 border-slate-4">
                <div
                  v-for="problemBehavior in target?.target_problem_behaviors"
                  :key="problemBehavior.id"
                  class="space-y-1"
                >
                  <div class="text-sm font-semibold text-slate-8">
                    {{ problemBehavior.code }} - {{ problemBehavior.code_definition }}
                  </div>
                  <div class="text-sm whitespace-pre-line text-slate-8">
                    {{ problemBehavior.description }}
                  </div>
                </div>
              </div>
            </div>
            <!-- end sbt -->
          </div>
          <div class="sticky bottom-0 w-full py-3 bg-white">
            <AppButton kind="outline" class="w-full" @click="display = 'target'">Close</AppButton>
          </div>
        </div>
        <div v-if="display === 'comment'" class="flex flex-col justify-between h-full gap-3">
          <div
            v-if="sessionStore.session?.status !== 'ongoing'"
            class="pt-3 text-sm text-wrap text-slate-8"
          >
            {{ measurement.comment || '-' }}
          </div>
          <AppTextInput
            v-else
            :name="`measurement-comment-${measurement.id}`"
            type="textarea"
            placeholder="Type your comment here..."
            v-model="commentInput"
            borderless
            class="h-full mt-2"
          />
          <div class="sticky bottom-0 w-full py-3 bg-white">
            <AppButton
              v-if="sessionStore.session?.status !== 'ongoing'"
              kind="outline"
              class="w-full"
              @click="display = 'target'"
            >
              Close
            </AppButton>
            <div v-else class="grid grid-cols-2">
              <AppButton kind="plain" class="w-full" @click="display = 'target'">Cancel</AppButton>
              <AppButton
                class="w-full"
                :disabled="isDisabledSaveComment"
                :loading="commentLoading"
                @click="onSaveComment"
              >
                Save
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
