<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { displayDate, getMeasurementType, getTargetType } from '@/lib/func'
import AppButton from '@/components/AppButton.vue'

const route = useRoute()
const sessionStore = useSessionStore()

const sessionLoading = ref<boolean>(false)
const redirect = ref<string>('/home')
const isScheduled = computed<boolean>(() => sessionStore.session?.appointment_id !== null)

async function fetchSession() {
  sessionLoading.value = true
  const slug = route.params.slug.toString()
  const { success } = await sessionStore.getSession({ slug })
  sessionLoading.value = false
  if (!success) return
  document.getElementById('app')?.scroll({
    top: 0,
    behavior: 'smooth'
  })
}

onMounted(() => {
  fetchSession()
  redirect.value = route.query.redirect?.toString() || '/home'
})

interface Schedule {
  icon: string
  title: string
  label?: string
}
const scheduleDetails = computed<Schedule[]>(() => [
  { icon: 'ph:user', title: 'Assigned to', label: sessionStore.session?.appointment?.user?.name },
  {
    icon: 'ph:calendar-blank',
    title: 'Date',
    label: displayDate({ date: sessionStore.session?.appointment?.date, format: 'DD MMM YYYY' })
  },
  {
    icon: 'ph:clock-light',
    title: 'Time',
    label: `${sessionStore.session?.appointment?.start_time_string} - ${sessionStore.session?.appointment?.end_time_string}`
  },
  { icon: 'ph:door', title: 'Room', label: sessionStore.session?.appointment?.room?.name },
  {
    icon: 'ph:map-pin-simple-area',
    title: 'Branch',
    label: sessionStore.session?.appointment?.room?.branch?.name
  }
])
</script>

<template>
  <div v-if="!sessionLoading" class="sticky top-0 z-10 bg-white">
    <div class="flex items-center justify-between gap-4 px-4 py-3">
      <div class="flex items-center gap-3 truncate">
        <RouterLink :to="redirect" class="flex h-8 w-8 shrink-0 items-center justify-center">
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </RouterLink>
        <div class="truncate text-[22px] text-xl font-bold">
          {{ sessionStore.session?.client?.name }}
        </div>
      </div>
      <div class="shrink-0 text-xs text-slate-8">Session ID {{ sessionStore.session?.id }}</div>
    </div>
  </div>
  <div
    class="fixed z-[1] h-screen w-screen"
    :class="{ 'top-36': isScheduled, 'top-14': !isScheduled }"
    :style="{ background: 'linear-gradient(180deg, #FFFFFF 0%, #EBE4F0 15.77%)' }"
  ></div>
  <div
    v-if="sessionLoading"
    class="relative z-[2] flex h-[calc(100vh/2)] w-full items-center justify-center"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-5" />
  </div>
  <div v-else class="relative z-[2] pb-12">
    <div v-if="isScheduled" class="flex flex-col">
      <div class="py-3 text-center text-xs text-slate-7">This session is scheduled:</div>
      <div class="pl-4">
        <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
          <div
            v-for="(item, idx) in scheduleDetails"
            :key="item.title"
            class="flex snap-start gap-2"
          >
            <div v-if="idx > 0" class="h-10 w-0.5 shrink-0 bg-slate-3"></div>
            <div class="flex h-10 items-center gap-2">
              <div
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-light-purple-1"
              >
                <Icon :icon="item.icon" class="text-light-purple-4" />
              </div>
              <div class="flex h-10 w-[104px] flex-col justify-between truncate">
                <div class="text-xs text-slate-7">{{ item.title }}</div>
                <div class="truncate text-sm font-medium text-dark-purple-1">{{ item.label }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="space-y-6 py-6">
      <div
        v-if="!sessionStore.session_measurements.length"
        class="flex h-[calc(100vh/2)] flex-col items-center justify-center px-4 text-center text-sm text-dark-purple-1"
      >
        <div>Whoops, no targets here!</div>
        <div>Add targets from the desktop to kick off your session.</div>
      </div>
      <div v-else class="px-4 text-center text-sm text-dark-purple-1">
        Before you begin this session, take a moment to review the targets and the comments.
      </div>
      <div v-if="sessionStore.session_comments?.length" class="space-y-2 px-4">
        <div class="flex h-7.5 items-center justify-center gap-1 text-dark-purple-1">
          <div class="text-2xl font-bold">{{ sessionStore.session_comments?.length }}</div>
          <div class="text-sm">comment(s)</div>
        </div>
        <div
          v-for="comment in sessionStore.session_comments"
          :key="comment.id"
          class="w-full space-y-2 rounded border border-prim-4 bg-white px-4 py-3"
          :style="{ boxShadow: '4px 4px 0px 0px #D6C7E066' }"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex h-5 items-center truncate rounded-full bg-lime-4 p-2">
              <div class="truncate text-xs font-medium text-lime-9">{{ comment.user_name }}</div>
            </div>
            <div class="text-xs text-slate-8">{{ displayDate({ date: comment.created_at }) }}</div>
          </div>
          <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
          <div class="whitespace-pre-line text-sm text-slate-8" v-html="comment.body"></div>
        </div>
      </div>
      <div v-if="sessionStore.session?.number_of_measurements" class="space-y-2 px-4">
        <div class="flex h-7.5 items-center justify-center gap-1 text-dark-purple-1">
          <div class="text-2xl font-bold">{{ sessionStore.session?.number_of_measurements }}</div>
          <div class="text-sm">target(s)</div>
        </div>
        <div
          v-for="measurement in sessionStore.session_measurements"
          :key="measurement.id"
          class="w-full rounded border border-prim-4 bg-white"
          :style="{
            boxShadow: '4px 4px 0px 0px #D6C7E066'
          }"
        >
          <div
            class="h-[6px] w-full shrink-0 rounded-t"
            :style="{ backgroundColor: measurement.target?.curriculum_color }"
          ></div>
          <div class="space-y-2 px-4 py-3">
            <div class="space-y-0.5 truncate">
              <div class="truncate text-xs font-medium">
                {{ measurement.target?.curriculum_name }}
              </div>
              <div class="truncate text-sm font-semibold">{{ measurement.target?.name }}</div>
            </div>
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              <div>{{ getTargetType(measurement?.target?.type) }}</div>
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
                <div>
                  Goal and success metric: Achieve target with
                  {{ measurement.target?.success_metric }} prompt, minimum
                  {{ measurement.target?.goal }} attempt(s) per session
                </div>
                <div>
                  Prompts used in this session:
                  {{
                    Object.keys(measurement.results)
                      .map((key) => measurement.results[key].name)
                      .join(', ')
                  }}
                </div>
              </div>
            </div>
            <div
              v-if="measurement.type === 'Measurement::Probing'"
              class="h-0.5 w-full shrink-0 bg-slate-3"
            ></div>
            <div
              v-if="measurement.type === 'Measurement::Probing'"
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
            <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              {{ measurement.target?.description }}
            </div>
            <div
              v-if="measurement.target?.last_phase_line"
              class="h-0.5 w-full shrink-0 bg-slate-3"
            ></div>
            <div
              v-if="measurement.target?.last_phase_line"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              Data from this session will be added to the
              <span class="font-semibold">{{ measurement.target.last_phase_line?.label }}</span>
              phase.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="fixed bottom-0 z-10 flex h-[68px] w-screen items-center bg-prim-3 px-4">
    <AppButton :disabled="!sessionStore.session?.number_of_measurements" size="sm" class="w-full"
      >Start session</AppButton
    >
  </div>
</template>
