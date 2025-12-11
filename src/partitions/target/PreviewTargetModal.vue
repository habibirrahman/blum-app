<script setup lang="ts">
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import { getTargetType } from '@/lib/func'
import type { Target } from '@/lib/types'
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useClientStore } from '@/stores/client.store'
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

const sortedPrompts = computed(() => {
  return [...(props.target?.prompts || [])].sort((a, b) => (a?.position || 0) - (b?.position || 0))
})

const actionRecommendation = computed(() => {
  const empty = {
    id: null,
    target_id: props.target?.id,
    total_success: null,
    consecutive_success: null
  }
  if (!props.target?.action_recommendations) return empty
  if (!props.target.action_recommendations.length) return empty
  return props.target.action_recommendations[0]
})

const onEdit = () => {}
</script>

<template>
  <AppActionSheet :show="showDetails" @close="emit('close')">
    <div v-if="loading">
      <div class="flex flex-col w-full gap-2">
        <div class="w-32 h-4 rounded-full shrink-0 animate-pulse bg-slate-3"></div>
        <div class="w-3/4 h-6 rounded-full shrink-0 animate-pulse bg-slate-3"></div>
      </div>
      <div class="flex flex-col mt-4">
        <div v-for="n in 5" :key="n" class="flex flex-col gap-1 py-3 border-b border-slate-3">
          <div class="w-24 h-4 rounded-full shrink-0 animate-pulse bg-slate-3"></div>
          <div class="w-2/3 h-4 rounded-full shrink-0 animate-pulse bg-slate-3"></div>
        </div>
      </div>
      <div class="sticky bottom-0 flex justify-center w-full pt-4 bg-white">
        <div class="h-[38px] w-1/3 shrink-0 animate-pulse rounded bg-slate-3"></div>
      </div>
    </div>
    <div v-else class="space-y-4">
      <div class="sticky top-0 flex flex-col w-full gap-2 bg-white">
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
            <div class="flex items-center gap-2">
              <div class="p-1 bg-orange-3" :style="{ borderRadius: '4px' }">
                <Icon
                  icon="mynaui:info-waves-solid"
                  class="rotate-180 text-[20px] text-[#FD853A]"
                />
              </div>
              <div class="text-sm font-semibold text-slate-10">Action recommendations</div>
            </div>
            <div class="px-4 py-3 border rounded border-slate-4 bg-slate-1">
              <div class="mb-4 space-y-1">
                <div class="text-sm font-semibold text-slate-10">Passing success metric</div>
                <div class="flex items-center gap-2">
                  <AppChip chip="in_progress" />
                  <div class="text-sm text-slate-8">to</div>
                  <AppChip chip="mastered" />
                </div>
              </div>
              <div
                v-if="
                  actionRecommendation.total_success === null &&
                  actionRecommendation.consecutive_success === null
                "
              >
                <div class="text-sm italic to-slate-8">
                  Currently, no action has been set for this recommendation.
                </div>
              </div>
              <div v-else class="space-y-4">
                <div v-if="actionRecommendation.total_success !== null" class="flex flex-col gap-1">
                  <div class="text-sm text-slate-8">Total success:</div>
                  <div class="text-sm to-slate-10">
                    Completing at least {{ actionRecommendation.total_success }} successful
                    session(s)
                  </div>
                </div>
                <div
                  v-if="actionRecommendation.consecutive_success !== null"
                  class="flex flex-col gap-1"
                >
                  <div class="text-sm text-slate-8">Consecutive success:</div>
                  <div class="flex flex-wrap items-center gap-1">
                    <div class="text-sm to-slate-10">
                      Successful for {{ actionRecommendation.consecutive_success }} consecutive
                      sessions
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sticky bottom-0 flex items-center w-full gap-2 pt-4 bg-white pb-safe">
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
          <AppButton class="w-full" @click="onEdit">Edit details</AppButton>
        </RouterLink>
      </div>
    </div>
  </AppActionSheet>
</template>
