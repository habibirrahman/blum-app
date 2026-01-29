<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import type { Measurement } from '@/lib/types'
import AppButton from '@/components/AppButton.vue'
import { Icon } from '@iconify/vue/dist/iconify.js'
import { computed, ref } from 'vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppTimeInput from '@/components/AppTimeInput.vue'

const sessionStore = useSessionStore()

interface DurationLap {
  lapNumber: number
  time: string
  seconds: number
}

interface Props {
  measurement: Measurement
  measurementResults: Measurement['results']
  isStarted: boolean
  timer: string
  updateLoading: boolean
  isCollapsed: boolean
  laps: DurationLap[]
  lapLoading: boolean
  currentLapTime: string
  resetConfirmation: boolean
  isDisabledAction?: boolean
}
interface Emits {
  (e: 'toggleTimer'): void
  (e: 'recordLap'): void
  (e: 'resetLapsConfirm'): void
  (e: 'resetLapsCancel'): void
  (e: 'resetLaps'): void
  (e: 'generateLaps', laps: DurationLap[]): void
  (e: 'fetchSession'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const submitLoading = ref<boolean>(false)
const isOpenEdit = ref<boolean>(false)
const editLapNumber = ref<number>(0)
const editLapInput = ref<string>('')

const onOpenEdit = (lap: DurationLap) => {
  editLapNumber.value = lap.lapNumber
  editLapInput.value = lap.time
  isOpenEdit.value = true
}

const lapLength = computed(() => {
  return props.laps?.length || 0
})

const onUpdateLap = async () => {
  console.log('updating lap', editLapNumber.value, editLapInput.value)

  const [h, m, s] = editLapInput.value.split(':').map(Number)
  const inSeconds = h * 3600 + m * 60 + s || 0 // Fallback to 0 if NaN

  const laps = [...props.laps]
  laps[editLapNumber.value].time = editLapInput.value
  laps[editLapNumber.value].seconds = inSeconds

  const finalResults = Object.fromEntries(
    laps.map((i: any, idx: number) => [idx, { string: i.time, seconds: i.seconds }])
  )

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: finalResults },
    data_result: { ...props.measurement, results: finalResults },
    last_data: { ...props.measurement }
  }

  submitLoading.value = true

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `duration_update_lap`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    params: { measurement: { results: finalResults } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { data } = await sessionStore.updateMeasurementResults(params)
  submitLoading.value = false

  emit('generateLaps', data.results)
  isOpenEdit.value = false
}

const getTextColorClass = (lap: { lapNumber: number; time: string }) => {
  if (props.isStarted && lap.lapNumber === lapLength.value - 1) {
    const timeToCheck = props.currentLapTime

    if (props.measurement.target?.success_metric === 'less than goal') {
      return isTimeSuccessful(timeToCheck, 'less') ? 'text-grass-7' : 'text-tomato-7'
    } else {
      return isTimeSuccessful(timeToCheck, 'greater') ? 'text-grass-7' : 'text-tomato-7'
    }
  } else {
    if (props.measurement.target?.success_metric === 'less than goal') {
      return lap.time < (props.measurement.target?.goal_time ?? '00:00:00')
        ? 'text-grass-7'
        : 'text-tomato-7'
    } else {
      return lap.time >= (props.measurement.target?.goal_time ?? '00:00:00')
        ? 'text-grass-7'
        : 'text-tomato-7'
    }
  }
}

const isTimeSuccessful = (timeString: string, compareMode: string) => {
  try {
    const parts = timeString.split(':')
    let timeValue = 0

    if (parts.length === 2) {
      const minutes = parseInt(parts[0])
      const seconds = parseFloat(parts[1])
      timeValue = minutes * 60 + seconds
    } else if (parts.length === 3) {
      const hours = parseInt(parts[0])
      const minutes = parseInt(parts[1])
      const seconds = parseFloat(parts[2])
      timeValue = hours * 3600 + minutes * 60 + seconds
    }

    const goalParts = (props.measurement.target?.goal_time ?? '00:00:00').split(':')
    let goalValue = 0

    if (goalParts.length === 2) {
      const minutes = parseInt(goalParts[0])
      const seconds = parseFloat(goalParts[1])
      goalValue = minutes * 60 + seconds
    } else if (goalParts.length === 3) {
      const hours = parseInt(goalParts[0])
      const minutes = parseInt(goalParts[1])
      const seconds = parseFloat(goalParts[2])
      goalValue = hours * 3600 + minutes * 60 + seconds
    }

    if (compareMode === 'less') {
      return timeValue < goalValue
    } else {
      return timeValue >= goalValue
    }
  } catch (e) {
    console.error('Error parsing time:', e)
    return false
  }
}
</script>

<template>
  <!-- duration latency -->
  <div v-if="!resetConfirmation" class="flex flex-col justify-between flex-grow h-full gap-2">
    <div
      v-if="updateLoading || lapLoading"
      class="absolute z-10"
      :class="[isCollapsed ? 'right-16 top-4' : 'bottom-16 right-4']"
    >
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div
      class="flex flex-col items-center content-center justify-center flex-grow h-full transition-all gap-x-3"
      :class="{ 'gap-y-4': !isCollapsed, 'gap-y-2 ps-3': isCollapsed }"
    >
      <div v-if="isCollapsed" class="font-semibold text-slate-7">Lap {{ lapLength }}</div>
      <div
        class="grid grid-cols-5 items-center text-3xl text-[32px] font-bold transition-all"
        :class="{ 'text-slate-6': !isStarted, 'text-slate-8': isStarted }"
      >
        <div class="flex justify-center">{{ timer.split(':')[0] }}</div>
        <div class="flex justify-center pb-2">:</div>
        <div class="flex justify-center">{{ timer.split(':')[1] }}</div>
        <div class="flex justify-center pb-2">:</div>
        <div class="flex justify-center">{{ timer.split(':')[2] }}</div>
      </div>

      <div class="flex items-center w-full gap-3">
        <AppButton
          class="grow rounded-full !bg-prim-2"
          :class="{
            'pointer-events-none': sessionStore.session?.status !== 'ongoing'
          }"
          kind="plain"
          :loading="lapLoading"
          :disabled="(!isStarted && !lapLength) || isDisabledAction"
          @click="$emit('recordLap')"
        >
          <Icon icon="ph:plus-bold" class="text-lg" />
          <span>Lap</span>
        </AppButton>
        <AppButton
          class="rounded-full grow"
          :class="[
            sessionStore.session?.status !== 'ongoing' ? 'pointer-events-none' : '',
            isStarted ? '!bg-tomato-2' : '!bg-grass-2'
          ]"
          kind="plain"
          :color="isStarted ? 'tomato' : 'grass'"
          :loading="updateLoading"
          :disabled="isStarted ? false : isDisabledAction"
          @click="emit('toggleTimer')"
        >
          {{ isStarted ? 'Stop' : lapLength > 0 ? 'Resume' : 'Start' }}
        </AppButton>
        <AppButton
          v-if="!isStarted && lapLength > 0"
          class="rounded-full !bg-prim-2"
          :class="{
            'pointer-events-none': sessionStore.session?.status !== 'ongoing'
          }"
          kind="plain"
          :disabled="isDisabledAction"
          @click="$emit('resetLapsConfirm')"
        >
          <Icon icon="ph:arrow-clockwise-bold" class="text-lg" />
        </AppButton>
      </div>

      <div
        v-if="lapLength > 0 && !isCollapsed"
        class="w-full mt-2 overflow-scroll"
        :style="{
          maxHeight: 'calc(100vh - 10rem)',
          scrollbarWidth: 'none'
        }"
      >
        <div
          v-for="lap in laps.slice().sort((a, b) => b.lapNumber - a.lapNumber)"
          :key="lap.lapNumber + 1"
          class="flex items-center justify-between gap-2 border-b border-slate-4"
        >
          <div class="flex justify-between w-full gap-2 py-2">
            <div :class="getTextColorClass(lap)">{{ `Lap ${lap.lapNumber + 1}` }}</div>
            <div :class="getTextColorClass(lap)" class="font-semibold">
              {{ isStarted && lap.lapNumber === lapLength - 1 ? currentLapTime : lap.time }}
            </div>
          </div>

          <AppButton
            v-if="!isStarted && sessionStore.session?.status === 'ongoing'"
            kind="plain"
            @click="onOpenEdit(lap)"
          >
            <Icon icon="ph:pencil-simple-bold" />
          </AppButton>
        </div>
      </div>
    </div>

    <div
      v-if="!isCollapsed && !resetConfirmation"
      class="pb-3 text-xs font-medium text-center shrink-0 text-slate-7"
    >
      Goal:
      {{ measurement.target?.success_metric === 'equal to or greater than goal' ? '≥' : '' }}
      {{ measurement.target?.success_metric === 'less than goal' ? '<' : '' }}
      {{ measurement.target?.goal_time }}
    </div>
  </div>
  <!-- end duration latency -->

  <!-- confirm reset laps -->
  <div
    v-if="resetConfirmation"
    class="flex flex-col items-center justify-center flex-grow h-full gap-2"
  >
    <div class="font-semibold text-slate-8">Reset all recorded laps?</div>
    <div class="text-center text-slate-8">
      This will clear all existing lap records and begin again from Lap 1. You won't be able to
      recover previous data.
    </div>
    <div class="flex items-center justify-center w-full gap-2 pr-2">
      <AppButton class="w-2/4" kind="plain" @click="$emit('resetLapsCancel')">Cancel</AppButton>
      <AppButton class="w-2/4" color="tomato" @click="$emit('resetLaps')">Reset</AppButton>
    </div>
  </div>
  <!-- end confirm reset laps -->

  <!-- edit lap modal -->
  <AppActionSheet :show="isOpenEdit" @close="isOpenEdit = false">
    <div class="flex flex-col w-full gap-4 py-3">
      <div class="text-xl font-semibold text-left">Edit lap {{ measurement.target?.name }}</div>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <div class="text-sm font-semibold text-slate-8">
            {{ measurement.target?.curriculum_name }}
          </div>
          <div class="text-base font-semibold text-slate-10">{{ measurement.target?.name }}</div>
        </div>
        <AppTimeInput
          :label="`Lap ${editLapNumber + 1}`"
          :name="`lap-${editLapNumber + 1}`"
          v-model="editLapInput"
          format="hms"
          :disabled="submitLoading"
        />
      </div>
      <div class="grid items-center grid-cols-2 gap-4">
        <AppButton kind="plain" @click="isOpenEdit = false">Cancel</AppButton>
        <AppButton :loading="submitLoading" @click="onUpdateLap">Save</AppButton>
      </div>
    </div>
  </AppActionSheet>
  <!-- end edit lap modal -->
</template>
