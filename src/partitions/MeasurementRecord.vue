<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import type { Measurement } from '@/lib/types'
import AppToggle from '@/components/AppToggle.vue'
import { getTargetType } from '@/lib/func'
import Prompting from './measurement/Prompting.vue'
import Frequency from './measurement/Frequency.vue'
import PartialIntervalRecording from './measurement/PartialIntervalRecording.vue'
import Duration from './measurement/Duration.vue'
import Percentage from './measurement/Percentage.vue'
import Probing from './measurement/Probing.vue'

const appStore = useAppStore()
const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  counter: number
  is_collapsed?: boolean
  review_mode?: boolean
}
interface Emits {
  (e: 'toggle-running', id: Measurement['id']): void
  (e: 'toggle-collapsed', bool: boolean): void
  (e: 'set-focus'): void
}
const props = withDefaults(defineProps<Props>(), {
  is_collapsed: false,
  review_mode: false
})
const emit = defineEmits<Emits>()

const display = ref<'target' | 'description' | 'comment'>('target')
watch(
  () => props.is_collapsed || props.review_mode,
  (val) => {
    if (val) display.value = 'target'
  }
)

const isDropped = ref<boolean>(false)
const isDropLoading = ref<boolean>(false)
const onDrop = async (bool: boolean) => {
  const measurement: Measurement = {
    is_dropped: !bool
  }
  isDropLoading.value = true
  const { success, data } = await sessionStore.updateMeasurement({
    id: props.measurement.id,
    measurement
  })
  isDropLoading.value = false
  if (!success) return
  isDropped.value = data.is_dropped
}

const commentInput = ref<string>('')
const commentLoading = ref<boolean>(false)
watch(display, (val) => {
  if (val === 'comment') commentInput.value = props.measurement.comment || ''
})
const isDisabledSaveComment = computed<boolean>(
  () => commentInput.value === (props.measurement.comment || '')
)
const onSaveComment = async () => {
  const measurement: Measurement = {
    comment: commentInput.value
  }
  commentLoading.value = true
  const { success } = await sessionStore.updateMeasurement({
    id: props.measurement.id,
    measurement
  })
  commentLoading.value = false
  if (!success) return
  display.value = 'target'
}

onMounted(() => {
  isDropped.value = props.measurement.is_dropped || false
})
</script>

<template>
  <div
    class="relative w-[320px] shrink-0 rounded transition-all"
    :class="{ 'h-[500px]': !is_collapsed, 'h-[118px]': is_collapsed }"
    @click="emit('set-focus')"
  >
    <div
      v-if="review_mode && measurement.is_fixed"
      class="absolute -top-6 left-0 flex h-16 w-16 items-center justify-center rounded-full bg-white"
    >
      <Icon icon="ph:lock-fill" class="text-[40px] text-prim-5" />
    </div>
    <div class="flex h-full flex-col" :class="{ 'pointer-events-none': review_mode }">
      <div
        class="h-[6px] w-full shrink-0 rounded-t"
        :style="{ backgroundColor: measurement.target?.curriculum_color }"
      ></div>
      <div
        v-if="!is_collapsed"
        class="flex h-9 w-full shrink-0 items-center justify-between bg-prim-2 px-4"
      >
        <div
          class="flex h-6 w-6 items-center justify-center rounded transition-all"
          :class="{ 'bg-white': display === 'description' }"
          @click="display = display === 'description' ? 'target' : 'description'"
        >
          <Icon icon="ph:article" class="text-2xl text-light-purple-5" />
        </div>
        <div
          class="relative flex h-6 w-6 items-center justify-center rounded transition-all"
          :class="{ 'bg-white': display === 'comment' }"
          @click="display = display === 'comment' ? 'target' : 'comment'"
        >
          <Icon icon="ph:chat-centered-text" class="text-2xl text-light-purple-5" />
          <div
            class="absolute right-px top-px h-2 w-2 rounded-full bg-light-purple-5 transition-all"
            :class="[measurement.comment ? 'opacity-100' : 'opacity-0']"
          ></div>
        </div>
        <div>
          <AppToggle
            :name="`toggle_measurement_${measurement.id}`"
            :checked="!isDropped"
            :loading="isDropLoading"
            @change="onDrop"
          />
        </div>
      </div>
      <div class="flex h-full flex-col overflow-y-auto rounded-b bg-white px-4 pt-3">
        <div v-if="!is_collapsed" class="flex flex-col gap-1">
          <div class="text-sm font-semibold text-slate-7">
            {{ measurement.target?.curriculum_name }}
          </div>
          <div class="text-sm font-semibold text-slate-9">{{ measurement.target?.name }}</div>
        </div>
        <div v-if="display === 'target'" class="flex h-full pb-3 transition-all">
          <div
            v-if="is_collapsed"
            class="flex h-full w-8 shrink-0 items-center justify-center rounded-full bg-slate-4"
            @click="emit('toggle-collapsed', false)"
          >
            <Icon icon="ph:caret-double-up" class="text-xl text-slate-7" />
          </div>
          <div v-if="isDropped" class="flex flex-grow flex-col items-center justify-center gap-4">
            <Icon icon="solar:clipboard-remove-bold" class="h-20 w-20 text-tulip-6" />
            <div v-if="!is_collapsed" class="w-72 space-y-2">
              <div class="text-center font-semibold">Entry not recorded</div>
              <div class="text-center text-sm text-slate-8">
                This entry will not be saved when the Session ends. Toggle back to save this entry
                recording.
              </div>
            </div>
          </div>
          <div v-else class="flex h-full flex-grow flex-col justify-between">
            <Duration
              v-if="measurement.type === 'Measurement::Duration'"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
              @toggle-running="emit('toggle-running', measurement.id)"
            />
            <Frequency
              v-if="measurement.type === 'Measurement::Frequency'"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
            />
            <PartialIntervalRecording
              v-if="measurement.type === 'Measurement::Pir'"
              :measurement="measurement"
              :counter="counter"
              :is_collapsed="is_collapsed"
            />
            <Percentage
              v-if="measurement.type === 'Measurement::Percentage'"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
            />
            <Probing
              v-if="measurement.type === 'Measurement::Probing'"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
              @toggle-collapsed="emit('toggle-collapsed', $event)"
            />
            <Prompting
              v-if="measurement.type === 'Measurement::Prompting'"
              :measurement="measurement"
              :is_collapsed="is_collapsed"
            />
          </div>
        </div>
        <div v-if="display === 'description'" class="flex h-full flex-col justify-between pt-3">
          <div class="flex flex-col gap-3">
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
            <div class="space-y-0.5 text-wrap text-sm text-slate-8">
              {{ measurement.target?.description }}
            </div>
            <div
              v-if="measurement.target?.last_phase_line"
              class="space-y-0.5 text-wrap text-sm text-slate-8"
            >
              Data from this session will be added to the
              <span class="font-semibold">{{ measurement.target.last_phase_line?.label }}</span>
              phase.
            </div>
          </div>
          <div class="sticky bottom-0 w-full bg-white py-3">
            <AppButton kind="outline" class="w-full" @click="display = 'target'">Close</AppButton>
          </div>
        </div>
        <div v-if="display === 'comment'" class="flex h-full flex-col justify-between gap-3 pb-3">
          <AppTextInput
            :name="`measurement-comment-${measurement.id}`"
            type="textarea"
            placeholder="Type your comment here..."
            v-model="commentInput"
            borderless
            class="mt-2 h-full"
          />
          <div class="grid grid-cols-2">
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
</template>
