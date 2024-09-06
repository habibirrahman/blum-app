<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import Button from '@/components/Button.vue'
import MeasurementRecord from '@/partitions/MeasurementRecord.vue'
import type { Measurement } from '@/lib/types'

const route = useRoute()
const appStore = useAppStore()
const sessionStore = useSessionStore()

const sessionLoading = ref<boolean>(false)
const redirect = ref<string>('/home')

async function fetchSession() {
  sessionLoading.value = true
  const slug = route.params.slug.toString()
  const { success, data } = await sessionStore.getSession({ slug })
  sessionLoading.value = false
  if (!success) return
  counter.value = data.current_recording_time[0]
  counterTimer()
  document.getElementById('app')?.scroll({
    top: 0,
    behavior: 'smooth'
  })
}

onMounted(() => {
  fetchSession()
  redirect.value = route.query.redirect?.toString() || '/home'
})

const counter = ref<number>(0)
const counterTimer = () => {
  if (counter.value >= 0) {
    setTimeout(() => {
      counter.value += 1
      counterTimer()
    }, 1000)
  }
}
const recordingTime = computed<string>(() => {
  let hours: number | string = '00'
  let minutes: number | string = '00'
  let seconds: number | string = '00'
  seconds = (counter.value % 60).toString().padStart(2, '0')
  if (counter.value >= 60) {
    minutes = Math.floor(counter.value / 60)
    if (counter.value >= 3600) minutes = minutes % 60
    minutes = minutes.toString().padStart(2, '0')
  }
  if (counter.value >= 3600) {
    hours = Math.floor(counter.value / 3600)
      .toString()
      .padStart(2, '0')
  }
  return `${hours}:${minutes}:${seconds}`
})

const runningMeasurements = ref<Measurement['id'][]>([])
const onToggleRunning = (id: Measurement['id']) => {
  const idx = runningMeasurements.value.indexOf(id)
  if (idx > -1) runningMeasurements.value.splice(idx, 1)
  else runningMeasurements.value.push(id)
}
</script>

<template>
  <div
    v-if="sessionLoading"
    class="fixed z-[1000] grid h-screen w-screen place-content-center"
    :style="{ background: 'linear-gradient(180deg, #FFFFFF 0%, #EBE4F0 15.77%)' }"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-5" />
  </div>
  <div class="sticky top-0 z-10 flex h-13 shrink-0 items-center gap-3 bg-white px-4">
    <div class="flex items-center gap-2">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-prim-3 bg-prim-1 text-xs font-semibold text-light-purple-4"
      >
        {{ sessionStore.session_measurements.length }}
      </div>
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded">
        <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
      </div>
    </div>
    <div class="flex w-full items-center justify-end gap-2">
      <div class="text-xs font-medium text-slate-6">ID {{ sessionStore.session?.id }}</div>
      <div
        class="h-2 w-2 shrink-0 rounded-full transition-all"
        :class="{ 'bg-tomato-7': counter % 2 === 0, 'bg-slate-6': counter % 2 === 1 }"
      ></div>
      <div
        class="grid w-16 grid-cols-5 items-center text-xs font-semibold text-slate-8 transition-all"
      >
        <div class="flex justify-center">{{ recordingTime.split(':')[0] }}</div>
        <div class="flex justify-center">:</div>
        <div class="flex justify-center">{{ recordingTime.split(':')[1] }}</div>
        <div class="flex justify-center">:</div>
        <div class="flex justify-center">{{ recordingTime.split(':')[2] }}</div>
      </div>
    </div>
    <Button class="px-4">End</Button>
  </div>
  <div class="space-y-4 bg-prim-3 px-4 pb-36 pt-4">
    <MeasurementRecord
      v-for="measurement in sessionStore.session_measurements"
      :key="measurement.id"
      :measurement="measurement"
      :counter="counter"
      @toggle-running="onToggleRunning"
    />
    <!-- <div class="text-xs">
      <pre>{{ sessionStore.session_measurements }}</pre>
    </div> -->
  </div>
  <!-- <div class="fixed bottom-0 z-10 h-36 w-screen bg-prim-3 px-4">
  </div> -->
</template>
