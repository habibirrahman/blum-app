<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { displayDate, getTargetType } from '@/lib/func'
import AppButton from '@/components/AppButton.vue'
import moment from 'moment'
import { useAppStore } from '@/stores/app.store'
import AppActionSheet from '@/components/AppActionSheet.vue'
import CommentItem from '@/partitions/CommentItem.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const sessionStore = useSessionStore()

const redirect = ref<string>('/home')
const isScheduled = computed<boolean>(() => sessionStore.session?.appointment_id !== null)

const sessionLoading = ref<boolean>(false)
const commentsLoading = ref<boolean>(false)
const showComments = ref<boolean>(true)

async function fetchComments() {
  const id = sessionStore.session?.id
  commentsLoading.value = true
  const { success } = await sessionStore.getSessionComments({ id, filter: 'general' })
  commentsLoading.value = false
  if (!success) return
  setTimeout(() => {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
  }, 100)
}
async function fetchSession() {
  const slug = route.params.slug.toString()
  sessionLoading.value = true
  commentsLoading.value = true
  const { success } = await sessionStore.getSession({ slug })
  sessionLoading.value = false
  if (!success) {
    setTimeout(() => {
      document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    }, 100)
    return
  }
  fetchComments()
}

onMounted(() => {
  appStore.getRunningSessions()

  fetchSession()
  redirect.value = route.query.redirect?.toString() || '/home'
})

interface Schedule {
  icon: string
  title?: string
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

const showActionBeforeLunch = ref<boolean>(false)
const isLunchBeforeSchedule = ref<boolean>(false)
const isLunchNotAssigned = ref<boolean>(false)
const actionBeforeLunchStatus = computed<'before_schedule' | 'not_assigned' | 'both'>(() => {
  if (isLunchBeforeSchedule.value && !isLunchNotAssigned.value) return 'before_schedule'
  else if (!isLunchBeforeSchedule.value && isLunchNotAssigned) return 'not_assigned'
  else return 'both'
})
const startSessionLoading = ref<boolean>(false)
const lunchDetails = computed<Schedule[]>(() => [
  {
    icon: 'ph:calendar-blank',
    label: displayDate({ date: sessionStore.session?.appointment?.date, format: 'DD MMM YYYY' })
  },
  {
    icon: 'ph:clock-light',
    label: `${sessionStore.session?.appointment?.start_time_string} - ${sessionStore.session?.appointment?.end_time_string}`
  },
  { icon: 'ph:user', label: sessionStore.session?.appointment?.user?.name }
])
const onLaunchSession = async () => {
  startSessionLoading.value = true
  const { success } = await sessionStore.startSession()
  startSessionLoading.value = false
  if (!success) return
  showActionBeforeLunch.value = false
  router.push({ name: 'session-record', params: { slug: sessionStore.session?.slug } })
}
const onStartSession = () => {
  isLunchBeforeSchedule.value = false
  isLunchNotAssigned.value = false
  let showAction = false
  if (!sessionStore.session?.appointment_id) {
    onLaunchSession()
    return
  }
  const t = sessionStore.session.appointment?.start_time_string || '24:00'
  const d = `${sessionStore.session.appointment?.date}T${t}:00`
  const startDate = moment(d)
  if (moment().isBefore(startDate)) {
    isLunchBeforeSchedule.value = true
    showAction = true
  }
  if (sessionStore.session.appointment?.user_id !== appStore.account?.id) {
    isLunchNotAssigned.value = true
    showAction = true
  }
  if (showAction) showActionBeforeLunch.value = true
  else onLaunchSession()
}
</script>

<template>
  <div class="sticky top-0 z-[10] bg-white">
    <div class="flex items-center justify-between gap-4 px-4 py-3">
      <div class="flex items-center gap-3 truncate">
        <RouterLink :to="redirect" class="flex items-center justify-center w-8 h-8 shrink-0">
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </RouterLink>
        <div class="truncate text-[22px] text-xl font-bold">
          {{ sessionStore.session?.client?.name }}
        </div>
      </div>
      <div class="text-xs shrink-0 text-slate-8">Session ID {{ sessionStore.session?.id }}</div>
    </div>
  </div>

  <div
    class="fixed z-[1] h-screen w-screen p-safe"
    :class="{ 'top-36': isScheduled, 'top-14': !isScheduled }"
    :style="{
      background:
        'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(235, 228, 240, 1) 15.77%)'
    }"
  ></div>

  <div class="relative z-[2] pb-12">
    <div v-if="isScheduled" class="flex flex-col">
      <div class="py-3 text-xs text-center text-slate-7">This session is scheduled:</div>
      <div class="pl-4">
        <div class="flex gap-2 pb-3 pr-4 overflow-x-auto snap-x snap-mandatory scroll-smooth">
          <div
            v-for="(item, idx) in scheduleDetails"
            :key="item.title"
            class="flex gap-2 snap-start"
          >
            <div v-if="idx > 0" class="h-10 w-0.5 shrink-0 bg-slate-3"></div>
            <div class="flex items-center h-10 gap-2">
              <div
                class="flex items-center justify-center rounded h-7 w-7 shrink-0 bg-light-purple-1"
              >
                <Icon :icon="item.icon" class="text-light-purple-4" />
              </div>
              <div class="flex h-10 w-[104px] flex-col justify-between truncate">
                <div class="text-xs text-slate-7">{{ item.title }}</div>
                <div class="text-sm font-medium truncate text-dark-purple-1">{{ item.label }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="py-6 space-y-6">
      <div v-if="sessionLoading">
        <div class="w-64 h-4 rounded-full shrink-0 animate-pulse bg-prim-1"></div>
      </div>
      <div
        v-else-if="sessionStore.session_measurements.length"
        class="px-4 text-sm text-center text-dark-purple-1"
      >
        Before you begin this session, take a moment to review the targets and the comments.
      </div>

      <div v-if="commentsLoading" class="px-4 space-y-2">
        <div class="flex h-[30px] items-center justify-center">
          <div class="w-32 h-4 rounded-full shrink-0 animate-pulse bg-prim-1"></div>
        </div>
        <div
          v-for="n in 2"
          :key="n"
          class="w-full h-32 rounded shrink-0 animate-pulse bg-prim-1"
        ></div>
      </div>
      <div v-else-if="sessionStore.session_comments.length" class="px-4 space-y-2">
        <div
          class="flex h-[30px] items-center justify-center gap-1 text-dark-purple-1"
          @click="showComments = !showComments"
        >
          <div class="text-2xl font-bold">{{ sessionStore.session_comments.length }}</div>
          <div class="text-sm">comment(s)</div>
          <Icon
            icon="ph:caret-up"
            class="text-sm transition-all"
            :class="{ 'rotate-180': !showComments }"
          />
        </div>
        <div class="space-y-2 overflow-hidden transition-all" :class="{ 'h-0': !showComments }">
          <CommentItem
            v-for="comment in sessionStore.session_comments"
            :key="comment.id"
            :comment="comment"
          />
        </div>
      </div>

      <div v-if="sessionLoading" class="px-4 space-y-2">
        <div class="flex h-[30px] items-center justify-center">
          <div class="w-32 h-4 rounded-full shrink-0 animate-pulse bg-prim-1"></div>
        </div>
        <div
          v-for="n in 8"
          :key="n"
          class="w-full h-32 rounded shrink-0 animate-pulse bg-prim-1"
        ></div>
      </div>
      <div
        v-else-if="!sessionStore.session_measurements.length"
        class="flex h-[calc(100vh/2)] flex-col items-center justify-center px-4 text-center text-sm text-dark-purple-1"
      >
        <div>Whoops, no targets here!</div>
        <div>Add targets from the desktop to kick off your session.</div>
      </div>
      <div v-else class="px-4 space-y-2">
        <div class="flex h-[30px] items-center justify-center gap-1 text-dark-purple-1">
          <div class="text-2xl font-bold">{{ sessionStore.session_measurements.length }}</div>
          <div class="text-sm">target(s)</div>
        </div>
        <div
          v-for="measurement in sessionStore.session_measurements"
          :key="measurement.id"
          class="w-full bg-white border rounded border-prim-4"
          :style="{
            boxShadow: '4px 4px 0px 0px #D6C7E066'
          }"
        >
          <div
            class="h-[6px] w-full shrink-0 rounded-t"
            :style="{ backgroundColor: measurement.target?.curriculum_color }"
          ></div>
          <div class="px-4 py-3 space-y-2">
            <div class="space-y-0.5 truncate">
              <div class="text-xs font-medium truncate">
                {{ measurement.target?.curriculum_name }}
              </div>
              <div class="text-sm font-semibold truncate">{{ measurement.target?.name }}</div>
            </div>
            <!-- target information -->
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
                        const found = measurement?.target?.prompts?.find(
                          (i) => i.id === Number(key)
                        )
                        const percentage = found?.score || 0
                        return { ...measurement.results[key], percentage }
                      })
                      ?.sort((a, b) => a.position - b.position)
                      ?.map((prompt) => {
                        if (measurement?.target?.prompting_format === 'custom') {
                          return `${prompt?.name} (${prompt?.percentage}%)`
                        }
                        return prompt?.name
                      })
                      ?.join(', ')
                  }}
                </div>
              </div>
              <div v-if="measurement.target?.type === 'Target::Sbt'" class="space-y-0.5">
                <div>
                  Prompts used in this session:
                  {{ measurement.target?.prompts?.map((i) => i.name).join(', ') }}
                </div>
              </div>
            </div>
            <!-- end target information -->
            <!-- probing -->
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
            <!-- end probing -->
            <!-- target description -->
            <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              <div v-if="!measurement.target?.description" class="italic">No description</div>
              <div v-else class="whitespace-pre-line">{{ measurement.target?.description }}</div>
            </div>
            <!-- end target description -->
            <!-- last phase line -->
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
            <!-- end last phase line -->
            <!-- sbt -->
            <div
              v-if="measurement.target?.type === 'Target::Sbt'"
              class="h-0.5 w-full shrink-0 bg-slate-3"
            ></div>
            <div
              v-if="measurement.target?.type === 'Target::Sbt'"
              class="space-y-2 text-sm text-wrap text-slate-8"
            >
              <div
                v-for="task in measurement.target?.target_tasks"
                :key="task?.id"
                class="text-sm text-slate-8"
              >
                <div class="font-semibold">{{ task?.code }} - {{ task?.title }}</div>
                <div class="whitespace-pre-line">
                  {{ task?.description || '-' }}
                </div>
              </div>
            </div>
            <div
              v-if="measurement.target?.type === 'Target::Sbt'"
              class="h-0.5 w-full shrink-0 bg-slate-3"
            ></div>
            <div
              v-if="measurement.target?.type === 'Target::Sbt'"
              class="space-y-2 text-sm text-wrap text-slate-8"
            >
              <div
                v-for="problemBehavior in measurement.target?.target_problem_behaviors"
                :key="problemBehavior?.id"
                class="text-sm text-slate-8"
              >
                <div class="font-semibold">
                  {{ problemBehavior?.code }} - {{ problemBehavior?.code_definition }}
                </div>
                <div class="whitespace-pre-line">
                  {{ problemBehavior?.description || '-' }}
                </div>
              </div>
            </div>
            <!-- end sbt -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="fixed bottom-0 z-[10] w-screen bg-prim-3 px-safe pb-safe">
    <div class="flex h-[68px] grow items-center px-4">
      <AppButton
        :disabled="!sessionStore.session_measurements.length || !appStore.network_status.connected"
        class="w-full"
        :loading="startSessionLoading"
        @click="onStartSession"
      >
        {{
          appStore.network_status.connected ? 'Start session' : 'Offline: connect to start session'
        }}
      </AppButton>
    </div>
  </div>

  <AppActionSheet :show="showActionBeforeLunch" @close="showActionBeforeLunch = false">
    <div class="flex flex-col items-center gap-4">
      <div
        v-if="actionBeforeLunchStatus === 'before_schedule'"
        class="flex flex-col items-center gap-4"
      >
        <div class="text-xl font-semibold text-center">Session launch before schedule</div>
        <div class="text-sm text-center">This session is scheduled for:</div>
        <div class="flex flex-wrap justify-center w-full gap-3">
          <div
            v-for="item in lunchDetails"
            :key="item.icon"
            class="flex h-8 max-w-[calc((100%-0.75rem)/2)] shrink-0 items-center gap-2 rounded bg-light-purple-1 px-3"
          >
            <Icon :icon="item.icon" class="text-light-purple-4" />
            <div class="text-sm font-medium truncate text-dark-purple-1">{{ item.label }}</div>
          </div>
        </div>
        <div class="text-sm text-center">Are you sure you want to start the session now?</div>
      </div>
      <div
        v-if="actionBeforeLunchStatus === 'not_assigned'"
        class="flex flex-col items-center gap-4"
      >
        <div class="text-xl font-semibold text-center">You're not assigned to this session</div>
        <div class="text-sm text-center">
          This session is assigned to
          <span class="font-medium">{{ sessionStore.session?.appointment?.user?.name }}.</span> Do
          you wish to proceed?
        </div>
      </div>
      <div v-if="actionBeforeLunchStatus === 'both'" class="flex flex-col items-center gap-4">
        <div class="text-xl font-semibold text-center">Early start for unassigned session</div>
        <div class="text-sm text-center">
          The session scheduled for
          <span class="font-medium">{{
            displayDate({ date: sessionStore.session?.appointment?.date, format: 'DD MMM YYYY' })
          }}</span>
          at
          <span class="font-medium">{{
            sessionStore.session?.appointment?.start_time_string
          }}</span>
          with
          <span class="font-medium">{{ sessionStore.session?.appointment?.user?.name }}</span> is
          early and not assigned to you. Are you sure you want to start?
        </div>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="showActionBeforeLunch = false">Cancel</AppButton>
        <AppButton :loading="startSessionLoading" @click="onLaunchSession">Proceed</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
