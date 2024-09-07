<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import Button from '@/components/Button.vue'
import TextInput from '@/components/TextInput.vue'
import type { Measurement } from '@/lib/types'
import Toggle from '@/components/Toggle.vue'
import { getTargetType } from '@/lib/func'
import Prompting from './measurement/Prompting.vue'
import Frequency from './measurement/Frequency.vue'
import PartialIntervalRecording from './measurement/PartialIntervalRecording.vue'
import Duration from './measurement/Duration.vue'
import Percentage from './measurement/Percentage.vue'
import Probing from './measurement/Probing.vue'

const route = useRoute()
const appStore = useAppStore()
const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  counter: number
}
interface Emits {
  (e: 'toggle-running', id: Measurement['id']): void
}
const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const display = ref<'target' | 'description' | 'comment'>('target')

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

const comment = ref<string>('')
const commentLoading = ref<boolean>(false)
watch(display, (val) => {
  if (val === 'comment') comment.value = props.measurement.comment || ''
})
const isDisabledSaveComment = computed<boolean>(
  () => comment.value === (props.measurement.comment || '')
)
const onSaveComment = async () => {
  const measurement: Measurement = {
    comment: comment.value
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
  <div class="relative w-full rounded">
    <div
      class="h-[6px] w-full shrink-0 rounded-t"
      :style="{ backgroundColor: measurement.target?.curriculum_color }"
    ></div>
    <div class="flex h-9 w-full shrink-0 items-center justify-between bg-prim-2 px-4">
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
        <Toggle
          :name="`toggle_measurement_${measurement.id}`"
          :checked="!isDropped"
          :loading="isDropLoading"
          @change="onDrop"
        />
      </div>
    </div>
    <div class="rounded-b bg-white px-4 py-3">
      <div class="text-sm font-semibold text-slate-7">
        {{ measurement.target?.curriculum_name }}
      </div>
      <div class="mt-1 text-sm font-semibold text-slate-9">{{ measurement.target?.name }}</div>
      <div v-if="display === 'target'" class="min-h-[400px]">
        <div v-if="isDropped" class="flex h-[400px] flex-col items-center justify-center gap-4">
          <Icon icon="solar:clipboard-remove-bold" class="h-20 w-20 text-tulip-6" />
          <div class="w-72 space-y-2">
            <div class="text-center font-semibold">Entry not recorded</div>
            <div class="text-center text-sm text-slate-8">
              This entry will not be saved when the Session ends. Toggle back to save this entry
              recording.
            </div>
          </div>
        </div>
        <div v-else class="flex h-[400px] flex-grow flex-col justify-between">
          <PartialIntervalRecording
            v-if="measurement.type === 'Measurement::Pir'"
            :measurement="measurement"
            :counter="counter"
          />
          <Duration
            v-if="measurement.type === 'Measurement::Duration'"
            :measurement="measurement"
            @toggle-running="emit('toggle-running', measurement.id)"
          />
          <Percentage
            v-if="measurement.type === 'Measurement::Percentage'"
            :measurement="measurement"
          />
          <Probing v-if="measurement.type === 'Measurement::Probing'" :measurement="measurement" />
          <Frequency
            v-if="measurement.type === 'Measurement::Frequency'"
            :measurement="measurement"
          />
          <Prompting
            v-if="measurement.type === 'Measurement::Prompting'"
            :measurement="measurement"
          />
        </div>
      </div>
      <div
        v-if="display === 'description'"
        class="flex min-h-[400px] flex-col justify-between gap-3"
      >
        <div class="mt-3 space-y-3">
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
        <Button kind="outline" class="w-full" @click="display = 'target'">Close</Button>
      </div>
      <div v-if="display === 'comment'" class="flex h-[400px] flex-col justify-between gap-3">
        <TextInput
          :name="`measurement-comment-${measurement.id}`"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="comment"
          borderless
          class="mt-2 h-full"
        />
        <div class="grid grid-cols-2">
          <Button kind="plain" class="w-full" @click="display = 'target'">Cancel</Button>
          <Button
            class="w-full"
            :disabled="isDisabledSaveComment"
            :loading="commentLoading"
            @click="onSaveComment"
            >Save</Button
          >
        </div>
      </div>
    </div>
  </div>
</template>
