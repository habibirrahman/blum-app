<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import type { Measurement } from '@/lib/types'
import AppButton from '@/components/AppButton.vue'
import { useToast } from 'vue-toastification'

const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  is_started: boolean
  timer: string
  update_loading: boolean
  is_collapsed: boolean
  laps: []
  lapLoading: boolean
  lapsLoadingReset: boolean
  currentLapTime: string
}
interface Emits {
  (e: 'toggle-timer'): void
  (e: 'record-lap'): void
  (e: 'reset-laps-confirm'): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const getTextColorClass = (lap) => {
  if (props.is_started && lap.lapNumber === props.laps.length - 1) {
    const timeToCheck = props.currentLapTime

    if (props.measurement.target.success_metric === 'less than goal') {
      return isTimeSuccessful(timeToCheck, 'less') ? 'text-grass-7' : 'text-rose-7'
    } else {
      return isTimeSuccessful(timeToCheck, 'greater') ? 'text-grass-7' : 'text-rose-7'
    }
  } else {
    if (props.measurement.target.success_metric === 'less than goal') {
      return lap.time < props.measurement.target.goal_time ? 'text-grass-7' : 'text-rose-7'
    } else {
      return lap.time >= props.measurement.target.goal_time ? 'text-grass-7' : 'text-rose-7'
    }
  }
}

const isTimeSuccessful = (timeString, compareMode) => {
  try {
    const parts = timeString.split(':')
    let timeValue

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

    const goalParts = props.measurement.target.goal_time.split(':')
    let goalValue

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
  <div
    class="flex flex-col items-center content-center justify-center flex-grow-0 h-full transition-all gap-x-3"
    :class="{ 'gap-y-4': !is_collapsed, 'gap-y-2 ps-3': is_collapsed }"
  >
    <div
      class="grid grid-cols-5 items-center text-3xl text-[32px] font-bold transition-all"
      :class="{ 'text-slate-6': !is_started, 'text-slate-8': is_started }"
    >
      <div class="flex justify-center">{{ timer.split(':')[0] }}</div>
      <div class="flex justify-center pb-2">:</div>
      <div class="flex justify-center">{{ timer.split(':')[1] }}</div>
      <div class="flex justify-center pb-2">:</div>
      <div class="flex justify-center">{{ timer.split(':')[2] }}</div>
    </div>
    <div class="flex items-center w-full gap-3">
      <AppButton
        v-if="is_started || (!is_started && laps && laps.length === 0)"
        :loading="lapLoading"
        class="w-2/4 rounded-full"
        color="prim"
        :disabled="!is_started && sessionStore.session?.status !== 'ongoing'"
        :class="{ 'opacity-50': !is_started }"
        @click="$emit('record-lap')"
      >
        Lap
      </AppButton>
      <AppButton
        v-if="!is_started && laps && laps.length > 0"
        label="Reset"
        class="w-2/4 rounded-full"
        color="prim"
        :disabled="sessionStore.session?.status !== 'ongoing'"
        @click="$emit('reset-laps-confirm')"
        >Reset</AppButton
      >
      <AppButton
        class="w-2/4 rounded-full"
        :class="{
          'pointer-events-none': sessionStore.session?.status !== 'ongoing'
        }"
        :color="is_started ? 'tomato' : 'grass'"
        :loading="update_loading"
        @click="emit('toggle-timer')"
      >
        {{ is_started ? 'Stop' : 'Start' }}
      </AppButton>
    </div>
    <div
      v-if="laps.length > 0 && !is_collapsed"
      class="w-full mt-2 overflow-scroll"
      style="max-height: calc(100vh - 10rem); scrollbar-width: none"
    >
      <div
        v-for="lap in laps.slice().sort((a, b) => b.lapNumber - a.lapNumber)"
        :key="lap.lapNumber + 1"
      >
        <div
          v-if="measurement.target.success_metric === 'less than goal'"
          class="flex justify-between py-2 pb-2 border-b"
        >
          <div :class="getTextColorClass(lap)">{{ `Lap ${lap.lapNumber + 1}` }}</div>
          <div :class="getTextColorClass(lap)" class="font-semibold">
            {{ is_started && lap.lapNumber === laps.length - 1 ? currentLapTime : lap.time }}
          </div>
        </div>
        <div
          class="flex justify-between py-2 pb-2 border-b"
          v-if="measurement.target.success_metric === 'equal to or greater than goal'"
        >
          <div :class="getTextColorClass(lap)">{{ `Lap ${lap.lapNumber + 1}` }}</div>
          <div :class="getTextColorClass(lap)" class="font-semibold">
            {{ is_started && lap.lapNumber === laps.length - 1 ? currentLapTime : lap.time }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="!is_collapsed" class="text-xs font-medium text-center shrink-0 text-slate-7">
    Goal: {{ measurement.target?.goal_time }}
  </div>
</template>
