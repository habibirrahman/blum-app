<script setup lang="ts">
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import { getTargetType } from '@/lib/func'
import type { Target, ActionRecommendation } from '@/lib/types'
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useClientStore } from '@/stores/client.store'
import { useToast } from 'vue-toastification'
import moment from 'moment'

interface Props {
  showDetails: boolean
  loading: boolean
  target: Target | null
  editAble?: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const clientStore = useClientStore()
const toast = useToast()

const sortedPrompts = computed(() => {
  return [...(props.target?.prompts || [])].sort((a, b) => (a?.position || 0) - (b?.position || 0))
})

const actionRecommendation = computed(() => {
  const empty = {
    id: null,
    target_id: props.target?.id,
    recommended_action: 'mastered', // mastered | activate_next_target | maintenance
    total_success: null,
    consecutive_success: null,
    visible: false,
    passed: false,
    is_enabled: false,
    accepted_at: null,
    accepted_by_id: null
  }
  const arr = props.target?.action_recommendations || []

  if (arr.length === 0) return empty
  const mastered = arr.find((i) => i.recommended_action === 'mastered')
  return mastered || empty
})

const nextTargetRecommendation = computed(() => {
  const empty = {
    id: null,
    target_id: props.target?.id,
    recommended_action: 'activate_next_target', // mastered | activate_next_target | maintenance
    total_success: null,
    consecutive_success: null,
    visible: false,
    passed: false,
    is_enabled: false,
    accepted_at: null,
    accepted_by_id: null
  }
  const arr = props.target?.action_recommendations || []

  if (arr.length === 0) return empty
  const nextTarget = arr.find((i) => i.recommended_action === 'activate_next_target')
  return nextTarget || empty
})

const maintenanceRecommendation = computed(() => {
  const empty: ActionRecommendation = {
    id: null as any,
    target_id: props.target?.id as number,
    recommended_action: 'maintenance',
    total_success: null as any,
    consecutive_success: null as any,
    visible: false,
    passed: false,
    is_enabled: false,
    accepted_at: null as any,
    accepted_by_id: null as any,
    maintenance_state: null,
    maintenance_config: null
  }
  const arr = props.target?.action_recommendations || []
  if (arr.length === 0) return empty
  const maintenance = arr.find((i) => i.recommended_action === 'maintenance')
  return maintenance || empty
})

const nextTargetDetails = computed(() => {
  return props.target?.progression?.next_target
})

const ordinalSuffix = (i: number) => {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) return i + 'st'
  if (j === 2 && k !== 12) return i + 'nd'
  if (j === 3 && k !== 13) return i + 'rd'
  return i + 'th'
}

const lastMaintenanceActivityText = computed(() => {
  const state = maintenanceRecommendation.value?.maintenance_state
  const config = maintenanceRecommendation.value?.maintenance_config
  
  if (!state || !config) {
    return 'Maintenance has not started yet.'
  }

  // If completed maintenance
  if (state.completed && state.completed_at && state.completed_session_order) {
    const formattedCompletedAt = moment(new Date(state.completed_at)).format('DD MMM YYYY')
    const ordinal = ordinalSuffix(state.completed_session_order)
    return `${ordinal} maintenance session <span class="font-semibold">passed on ${formattedCompletedAt}</span>.`
  }

  if (!props.target?.in_maintenance) {
    return 'Maintenance has not started yet.'
  }

  const result = props.target?.last_maintenance_session_result
  const nextDateStr = state.next_date
  const formattedNextDate = nextDateStr ? moment(new Date(nextDateStr)).format('DD MMM YYYY') : ''

  // If no previous session result yet, just show next scheduled date
  if (!result) {
    if (!formattedNextDate) return '-'
    if (config.approach === 'manual') {
      return `Maintenance session scheduled for <span class="font-semibold">${formattedNextDate}</span>.`
    }

    const currentOrder = state.current_order || 1
    return `${ordinalSuffix(currentOrder)} maintenance session scheduled for <span class="font-semibold">${formattedNextDate}</span>.`
  }

  const isPassed = result.verb === 'maintenance_session_passed'
  const resultText = isPassed ? 'passed' : 'failed'
  const recordedAt = moment(new Date(result.recorded_at)).format('DD MMM YYYY')

  if (config.approach === 'manual') {
    let text = `Maintenance session <span class="font-semibold">${resultText} on ${recordedAt}</span>.`
    if (formattedNextDate) {
      text += ` Next session scheduled for <span class="font-semibold">${formattedNextDate}</span>.`
    }
    return text
  }

  // Automation approach
  const sessionOrder = result.session_order || 1
  let rescheduledOrder = result.rescheduled_order

  let text = `${ordinalSuffix(sessionOrder)} maintenance session <span class="font-semibold">${resultText} on ${recordedAt}</span>.`

  if (formattedNextDate && rescheduledOrder) {
    if (isPassed) {
      text += ` ${ordinalSuffix(rescheduledOrder)} maintenance session scheduled for <span class="font-semibold">${formattedNextDate}</span>.`
    } else {
      const failure = config.on_failure
      if (failure === 'restart_from_first') {
        rescheduledOrder = 1
      }
      text += ` Rescheduled ${ordinalSuffix(rescheduledOrder)} maintenance session for <span class="font-semibold">${formattedNextDate}</span>.`
    }
  }
  return text
})

const loadingImport = ref<boolean>(false)
const onImportTarget = async (targetId: Target['id']) => {
  if (loadingImport.value) return
  if (!clientStore.client?.id) return
  if (!targetId) return

  const data = {
    client_id: clientStore.client.id,
    target_ids: targetId + ''
  }

  loadingImport.value = true
  const { success, message } = await clientStore.createBulkTarget({ data })
  loadingImport.value = false
  if (!success) {
    toast.error(message)
    return
  }

  toast.success(
    `Success! ${nextTargetDetails.value?.name} has been added from the databank. Please note that it may take some time to complete the process.`
  )
  emit('close')
}
</script>

<template>
  <AppActionSheet :show="showDetails" @close="emit('close')">
    <div v-if="loading">
      <div class="flex flex-col gap-2 w-full">
        <div class="w-32 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
        <div class="w-3/4 h-6 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
      </div>
      <div class="flex flex-col mt-4">
        <div v-for="n in 5" :key="n" class="flex flex-col gap-1 py-3 border-b border-slate-3">
          <div class="w-24 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
          <div class="w-2/3 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
        </div>
      </div>
      <div class="flex sticky bottom-0 justify-center pt-4 w-full bg-white">
        <div class="h-[38px] w-1/3 shrink-0 animate-pulse rounded bg-slate-3"></div>
      </div>
    </div>
    <div v-else>
      <div class="flex sticky top-0 z-10 flex-col gap-2 py-3 w-full bg-white">
        <div class="flex">
          <AppChip :chip="target?.status" />
        </div>
        <div class="text-lg font-semibold">{{ target?.name }}</div>
      </div>

      <div class="flex flex-col">
        <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
          <div class="text-xs text-slate-8">Curriculum:</div>
          <div class="text-sm">{{ target?.curriculum_name }}</div>
        </div>
        <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
          <div class="text-xs text-slate-8">Description:</div>
          <div class="text-sm whitespace-pre-line">{{ target?.description }}</div>
        </div>
        <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
          <div class="text-xs text-slate-8">Data collection method:</div>
          <div class="text-sm">{{ getTargetType(target?.type) }}</div>
        </div>
        <div
          v-if="target?.type === 'Target::Duration' || target?.type === 'Target::Latency'"
          class="flex flex-col"
        >
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Goal time:</div>
            <div class="text-sm">{{ target?.goal_time }}</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Success metric:</div>
            <div class="text-sm capitalize-first">{{ target?.success_metric }}</div>
          </div>
        </div>
        <div v-if="target?.type === 'Target::Percentage'" class="flex flex-col">
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Goal:</div>
            <div class="text-sm">{{ target?.goal }}%</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Number of trials:</div>
            <div class="text-sm">{{ target?.number_of_trial }} trial(s)</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Success metric:</div>
            <div class="text-sm capitalize-first">{{ target?.success_metric }}</div>
          </div>
        </div>
        <div
          v-if="
            (target?.type === 'Target::Percentage' || target?.type === 'Target::TrialByTrial') &&
            target?.probing_enable
          "
          class="flex flex-col"
        >
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-sm font-semibold text-slate-10">Probing</div>
            <div class="flex flex-col px-4 py-3 border border-slate-3 bg-slate-1">
              <div class="flex flex-col gap-1 pb-3 border-b border-slate-3">
                <div class="text-xs text-slate-8">Minimum number of trials:</div>
                <div class="text-sm">{{ target?.probing_number_of_trial }}</div>
              </div>
              <div class="flex flex-col gap-1 pt-3">
                <div class="text-xs text-slate-8">Goal for probing</div>
                <div class="text-sm capitalize-first">≥ {{ target?.probing_goal }}%</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="target?.type === 'Target::TrialByTrial'" class="flex flex-col">
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Goal:</div>
            <div class="text-sm">{{ target?.goal }}%</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Number of minimum trial:</div>
            <div class="text-sm">{{ target?.number_of_trial }} trial(s)</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Success metric:</div>
            <div class="text-sm capitalize-first">{{ target?.success_metric }}</div>
          </div>
        </div>
        <div v-if="target?.type === 'Target::Pir'" class="flex flex-col">
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Goal:</div>
            <div class="text-sm">{{ target?.goal }}%</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Interval:</div>
            <div class="text-sm">{{ target?.interval }} minute(s)</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Duration:</div>
            <div class="text-sm">{{ target?.duration }} minute(s)</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Success metric:</div>
            <div class="text-sm capitalize-first">{{ target?.success_metric }}</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Interval start timing:</div>
            <div class="text-sm">
              <span v-if="target?.interval_start_timing === 'start_with_session'">
                Start with session
              </span>
              <span v-if="target?.interval_start_timing === 'custom_start'">Custom start</span>
            </div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Overtime handling:</div>
            <div class="text-sm">
              <span v-if="target?.allow_overtime_recording"> Allow overtime recording </span>
              <span v-else>Planned duration</span>
            </div>
          </div>
        </div>
        <div v-if="target?.type === 'Target::Frequency'" class="flex flex-col">
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Goal:</div>
            <div class="text-sm">{{ target?.goal }} attempt(s) per session</div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Success metric:</div>
            <div class="text-sm capitalize-first">{{ target?.success_metric }}</div>
          </div>
          <div
            v-if="target.frequency_format === 'custom'"
            class="flex flex-col gap-1 py-3 border-b border-slate-3"
          >
            <div class="text-xs text-slate-8">Duration:</div>
            <div class="text-sm capitalize-first">{{ target?.duration }} minute(s)</div>
          </div>
        </div>
        <div v-if="target?.type === 'Target::Prompting'" class="flex flex-col">
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Format:</div>
            <div class="text-sm capitalize-first">
              {{ target?.prompting_format }}
            </div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Prompts:</div>
            <div class="text-sm">
              {{
                sortedPrompts
                  ?.map((i) => {
                    if (target?.prompting_format === 'custom') {
                      return `${i.name} (${i.score}%)`
                    }
                    return i.name
                  })
                  ?.join(', ')
              }}
            </div>
          </div>
          <div v-if="target?.is_group" class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Targets within this group:</div>
            <div class="flex flex-col gap-2">
              <div
                v-for="member in target?.members"
                :key="member?.id"
                class="text-sm text-slate-10"
              >
                <div class="font-semibold">{{ member?.code_definition }} - {{ member?.name }}</div>
                <div class="whitespace-pre-line">
                  {{ member?.description || '-' }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="target?.is_group" class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Problem behaviors:</div>
            <div class="flex flex-col gap-2">
              <div
                v-for="problemBehavior in target?.target_problem_behaviors"
                :key="problemBehavior?.id"
                class="text-sm text-slate-10"
              >
                <div class="font-semibold">
                  {{ problemBehavior?.code }} - {{ problemBehavior?.code_definition }}
                </div>
                <div class="whitespace-pre-line">
                  {{ problemBehavior?.description || '-' }}
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="target?.prompting_format === 'classic'"
            class="flex flex-col gap-1 py-3 border-b border-slate-3"
          >
            <div class="text-xs text-slate-8">Goal and success metric:</div>
            <div class="text-sm">
              Achieve target with
              <span class="font-semibold">{{ target?.success_metric }}</span> prompt, minimum
              <span class="font-semibold">{{ target?.goal }}</span> attempt(s) per session
            </div>
          </div>
          <div
            v-if="target?.prompting_format === 'custom'"
            class="flex flex-col gap-1 py-3 border-b border-slate-3"
          >
            <div class="text-xs text-slate-8">Goal:</div>
            <div class="text-sm">{{ target?.goal }}%</div>
          </div>
          <div
            v-if="target?.prompting_format === 'custom'"
            class="flex flex-col gap-1 py-3 border-b border-slate-3"
          >
            <div class="text-xs text-slate-8">Success metric:</div>
            <div class="text-sm capitalize-first">{{ target?.success_metric }}</div>
          </div>
        </div>
        <div v-if="target?.type === 'Target::Sbt'" class="flex flex-col">
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Prompts:</div>
            <div class="text-sm">
              {{ target?.prompts?.map((i) => i.name).join(', ') }}
            </div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Tasks:</div>
            <div class="flex flex-col gap-2">
              <div
                v-for="task in target?.target_tasks"
                :key="task?.id"
                class="text-sm text-slate-10"
              >
                <div class="font-semibold">{{ task?.code }} - {{ task?.title }}</div>
                <div class="whitespace-pre-line">
                  {{ task?.description || '-' }}
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1 py-3 border-b border-slate-3">
            <div class="text-xs text-slate-8">Problem behaviors:</div>
            <div class="flex flex-col gap-2">
              <div
                v-for="problemBehavior in target?.target_problem_behaviors"
                :key="problemBehavior?.id"
                class="text-sm text-slate-10"
              >
                <div class="font-semibold">
                  {{ problemBehavior?.code }} - {{ problemBehavior?.code_definition }}
                </div>
                <div class="whitespace-pre-line">
                  {{ problemBehavior?.description || '-' }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!target?.type?.includes('Sbt') && !target?.is_group" class="flex flex-col">
          <div class="py-3 space-y-4">
            <div class="flex gap-2 items-center">
              <div class="p-1 bg-orange-3" :style="{ borderRadius: '4px' }">
                <Icon
                  icon="mynaui:info-waves-solid"
                  class="rotate-180 text-[20px] text-[#FD853A]"
                />
              </div>
              <div class="text-sm font-semibold text-slate-10">Action recommendations</div>
            </div>

            <!-- passing success metric -->
            <div class="px-4 py-3 space-y-4 rounded border border-slate-4 bg-slate-1">
              <!-- header -->
              <div class="space-y-1">
                <div class="text-sm font-semibold text-slate-10">Passing success metric</div>
                <div class="flex gap-2 items-center">
                  <AppChip chip="in_progress" />
                  <div class="text-sm text-slate-8">to</div>
                  <AppChip chip="mastered" />
                </div>
              </div>
              <!-- end header -->

              <!-- content -->
              <div class="space-y-4">
                <!-- mastered action recommendation -->
                <div
                  v-if="
                    actionRecommendation.total_success === null &&
                    actionRecommendation.consecutive_success === null
                  "
                >
                  <div class="text-sm italic text-slate-8">
                    Currently, no action has been set for this recommendation.
                  </div>
                </div>
                <div v-else class="space-y-4">
                  <div
                    v-if="actionRecommendation.total_success !== null"
                    class="flex flex-col gap-1"
                  >
                    <div class="text-sm text-slate-8">Total success:</div>
                    <div class="text-sm text-slate-10">
                      Completing at least {{ actionRecommendation.total_success }} successful
                      session(s)
                    </div>
                  </div>
                  <div
                    v-if="actionRecommendation.consecutive_success !== null"
                    class="flex flex-col gap-1"
                  >
                    <div class="text-sm text-slate-8">Consecutive success:</div>
                    <div class="flex flex-wrap gap-1 items-center">
                      <div class="text-sm text-slate-10">
                        Successful for {{ actionRecommendation.consecutive_success }} consecutive
                        sessions
                      </div>
                    </div>
                  </div>
                </div>
                <!-- end mastered action recommendation -->

                <!-- activate next target recommendation -->
                <div
                  v-if="
                    target?.progression &&
                    target?.progression?.next_target &&
                    nextTargetRecommendation.is_enabled
                  "
                  class="pt-4 space-y-1 border-t border-slate-4"
                >
                  <div class="text-sm text-slate-8">Next target recommendation:</div>
                  <div class="text-sm text-slate-10">
                    Updating
                    <span class="font-semibold">{{ nextTargetDetails?.name + ' ' }}</span> from
                  </div>
                  <div class="flex gap-2 items-center">
                    <AppChip chip="pending" />
                    <div class="text-sm text-slate-8">to</div>
                    <AppChip chip="in_progress" />
                  </div>

                  <div
                    v-if="nextTargetDetails?.status === 'create'"
                    class="text-xs italic text-slate-8"
                  >
                    The next target hasn't been imported yet. You can import it after this target is
                    mastered or
                    <span
                      class="font-semibold underline cursor-pointer"
                      @click="onImportTarget(nextTargetDetails.id)"
                    >
                      import now.
                    </span>
                  </div>
                </div>
                <!-- end activate next target recommendation -->
              </div>
              <!-- end content -->
            </div>
            <!-- end passing success metric -->

            <!-- maintenance -->
            <div
              v-if="maintenanceRecommendation?.is_enabled"
              class="px-4 py-3 space-y-4 rounded border border-slate-4 bg-slate-1"
            >
              <!-- header -->
              <div class="space-y-1">
                <div class="text-sm font-semibold text-slate-10">Maintenance</div>
                <div class="flex gap-2 items-center">
                  <AppChip chip="mastered" />
                  <div class="text-sm text-slate-8">to</div>
                  <AppChip chip="in_progress" />
                </div>
              </div>
              <!-- end header -->

              <!-- content -->
              <div v-if="!maintenanceRecommendation?.maintenance_config">
                <div class="text-sm italic text-slate-8">
                  Currently, no maintenance configuration has been set for this recommendation.
                </div>
              </div>
              <div v-else class="space-y-4">
                <!-- manual -->
                <div v-if="maintenanceRecommendation?.maintenance_config?.approach === 'manual'" class="space-y-4">
                  <div class="text-sm text-slate-10">
                    With manual approach, will have maintenance session 
                    every {{ maintenanceRecommendation?.maintenance_config?.frequency?.interval_amount }} {{ maintenanceRecommendation?.maintenance_config?.frequency?.interval_unit }}.
                  </div>
                </div>

                <!-- automation -->
                <div v-if="maintenanceRecommendation?.maintenance_config?.approach === 'automation'" class="space-y-4">
                  <div class="text-sm text-slate-10">
                    With automation approach, will have {{ maintenanceRecommendation?.maintenance_config?.total_sessions || 1 }} maintenance session(s).
                  </div>
                  <div class="flex flex-col gap-1">
                    <div
                      v-for="(schedule, index) in maintenanceRecommendation?.maintenance_config?.schedules || []"
                      :key="index"
                      class="text-sm text-slate-10"
                    >
                      <span v-if="index === 0">
                        1st maintenance {{ schedule.interval_amount }} {{ schedule.interval_unit }} after mastered.
                      </span>
                      <span v-else>
                        {{ (index as number) + 1 }}{{ ['st', 'nd', 'rd'][(index as number)] || 'th' }} maintenance {{ schedule.interval_amount }} {{ schedule.interval_unit }} after previous...
                      </span>
                    </div>
                  </div>
                  <div class="text-sm text-slate-10">
                    If a session goal is not met, the schedule will {{ maintenanceRecommendation?.maintenance_config?.on_failure === 'repeat_current' ? 'retry the failed session until the success metric is successfully passed' : 'restart from 1st maintenance session' }}.
                  </div>
                </div>

                <!-- last activity -->
                <div class="pt-4 space-y-2 border-t border-slate-4">
                  <div class="text-sm text-slate-8">Last maintenance activity:</div>
                  <div class="text-sm text-slate-10" v-html="lastMaintenanceActivityText"></div>
                </div>
              </div>
              <!-- end content -->
            </div>
            <!-- end maintenance -->
          </div>
        </div>
      </div>

      <div class="flex sticky bottom-0 z-10 gap-2 items-center py-3 w-full bg-white">
        <AppButton kind="plain" class="w-full" @click="emit('close')">Close</AppButton>
        <RouterLink
          v-if="editAble"
          class="w-full"
          :to="{
            name: 'edit-client-target',
            params: {
              id: clientStore.client?.id,
              target_id: target?.id
            }
          }"
        >
          <AppButton class="w-full" @click="() => {}">Edit details</AppButton>
        </RouterLink>
      </div>
    </div>
  </AppActionSheet>
</template>
