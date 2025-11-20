<script lang="ts" setup>
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import AppInputTime from '@/components/AppInputTime.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppToggle from '@/components/AppToggle.vue'
import { type Curriculum, type TargetStatus } from '@/lib/types'
import CurriculumItemModal from '@/partitions/CurriculumItemModal.vue'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const clientStore = useClientStore()
const appStore = useAppStore()

const loading = ref<boolean>(false)
const submitLoading = ref<boolean>(false)
const isCloseTargetDetails = ref<boolean>(false)
const isCloseActionRecomenmdation = ref<boolean>(true)

const showStatus = ref<boolean>(false)
const status = ref<TargetStatus | ''>('')
const selectStatus = ref<TargetStatus | ''>('')
const statusOptions: { value: TargetStatus; label: string }[] = [
  { value: 'in_progress', label: 'In acquisition' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Pause' },
  { value: 'discontinued', label: 'Discontinued' }
]

const description = ref<string>('')

const curriculumQuery = ref<string>('')
const showCurriculum = ref<boolean>(false)
const curriculumOptions = ref<{ value: number; label: string; color: string; name: string }[]>([])
const selectedCurriculum = ref<{
  value: number
  label: string
  color: string
  name: string
} | null>(null)

const curriculumParams = computed<string>(() => {
  let p = `?sort=name_asc`
  if (curriculumQuery.value) p += `&query=${curriculumQuery.value}`
  return p
})

const name = ref<string>('')

const totalSuccessChecked = ref<boolean>(false)
const consecutiveSuccessChecked = ref<boolean>(false)
const totalSuccessInput = ref<number>(0)
const consecutiveSuccessInput = ref<number>(0)

const timeInput = ref<string>('00:00:00')

const successMetric = ref<string>('')

const duration = ref<string>('')
const goal = ref<string>('')

const isDisabledSubmit = computed(() => {
  if (!name.value) return true
  return false
})

const useActionRecommendations = computed(() => {
  if (!clientStore.target?.type?.includes('Sbt') && !clientStore.target?.is_group) return true
  return false
})
const useSuccessMetric = computed(() => {
  if (
    !clientStore.target?.type?.includes('Sbt') &&
    !clientStore.target?.is_group &&
    !clientStore.target?.type?.includes('ColdProbe')
  )
    return true
  return false
})

onMounted(async () => {
  loading.value = true
  await clientStore.getTarget({ id: Number(route.params.target_id) })
  const { data } = await appStore.getCurriculums({ params: curriculumParams.value })
  loading.value = false
  initData(data)
})

const initData = (curriculums: Curriculum[]) => {
  name.value = clientStore.target?.name as string
  curriculumOptions.value = curriculums.map((c: Curriculum) => ({
    value: c.id as number,
    label: c.name as string,
    color: c.color as string,
    name: c.name as string
  }))
  selectedCurriculum.value = curriculumOptions.value.find(
    (c) => c.value === clientStore.target?.curriculum_id
  ) as { value: number; label: string; color: string; name: string }
  status.value = clientStore.target?.status as TargetStatus
  selectStatus.value = clientStore.target?.status as TargetStatus
  description.value = clientStore.target?.description as string

  if (useActionRecommendations.value) {
    const actionRecommendation = clientStore.target?.action_recommendations?.[0]
    if (actionRecommendation) {
      if (actionRecommendation.total_success !== null) {
        totalSuccessChecked.value = true
        totalSuccessInput.value = actionRecommendation.total_success as number
      }

      if (actionRecommendation.consecutive_success !== null) {
        consecutiveSuccessChecked.value = true
        consecutiveSuccessInput.value = actionRecommendation.consecutive_success as number
      }
    }
  }

  if (useSuccessMetric.value) {
    successMetric.value = clientStore.target?.success_metric as string
  }

  duration.value = clientStore.target?.duration?.toString() as string
  goal.value = clientStore.target?.goal?.toString() as string
}

const onApplyCurriculum = (val: number) => {
  selectedCurriculum.value = curriculumOptions.value.find((c) => c.value === val) as {
    value: number
    label: string
    color: string
    name: string
  }
  showCurriculum.value = false
}

const onApplyStatus = (val: TargetStatus) => {
  status.value = val
  showStatus.value = false
}

const onChangeToggle = (val: {
  totalSuccessChecked: boolean
  consecutiveSuccessChecked: boolean
}) => {
  totalSuccessChecked.value = val.totalSuccessChecked
  consecutiveSuccessChecked.value = val.consecutiveSuccessChecked
}

const onSubmit = async () => {}
</script>

<template>
  <div class="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 pb-3 pt-3">
    <RouterLink
      :to="{
        name: 'client',
        params: { id: route.params.id, tab: 'targets' }
      }"
    >
      <div class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-2">
        <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
      </div>
    </RouterLink>
    <div class="text-[22px] font-bold text-slate-10">Edit details</div>
  </div>
  <div class="h-full w-full space-y-5 bg-prim-3 p-4">
    <div class="space-y-4 rounded bg-white p-4">
      <div
        @click="isCloseTargetDetails = !isCloseTargetDetails"
        class="flex items-center justify-between"
        :class="{
          'border-b border-slate-3 pb-2': !isCloseTargetDetails
        }"
      >
        <div class="text-sm font-semibold text-slate-10">Target details</div>
        <div
          :class="{
            'rotate-180': isCloseTargetDetails
          }"
        >
          <Icon icon="ph:caret-up-bold" class="h-5 w-5 text-slate-10" />
        </div>
      </div>
      <div v-if="!isCloseTargetDetails" class="space-y-4">
        <AppTextInput name="title" label="Title" required v-model="name" />
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Curriculum</span>
            <span class="ml-1 text-tomato-7">{{ '*' }}</span>
          </div>
          <div
            @click="showCurriculum = true"
            class="flex items-center justify-between rounded border border-slate-4 bg-white px-4 py-2"
          >
            <div class="flex items-center gap-2 truncate">
              <div
                class="h-6 w-6 flex-shrink-0 rounded-full"
                :style="{
                  backgroundColor: selectedCurriculum?.color
                }"
              ></div>
              <div class="truncate text-[16px] text-slate-10">
                {{ selectedCurriculum?.name }}
              </div>
            </div>
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Status</span>
            <span class="ml-1 text-tomato-7">{{ '*' }}</span>
          </div>
          <div
            @click="showStatus = true"
            class="flex items-center justify-between rounded border border-slate-4 bg-white px-4 py-2"
          >
            <AppChip :chip="status as TargetStatus" />
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>
        <AppTextInput
          name="description"
          label="Description"
          type="textarea"
          v-model="description"
        />

        <AppInputTime
          v-if="
            clientStore.target?.type?.includes('Duration') ||
            clientStore.target?.type?.includes('Latency')
          "
          v-model="timeInput"
          name="duration"
          label="Goal time (hours/minutes/seconds)"
          format="hms"
          :required="true"
        />
        <div v-if="clientStore.target?.type?.includes('Pir')">
          <div class="mb-1 text-sm font-medium">Interval</div>
          <div class="text-sm text-slate-10">{{ clientStore.target?.interval }} Minutes</div>
        </div>
        <AppTextInput
          v-if="clientStore.target?.type?.includes('Pir')"
          name="duration"
          label="Duration"
          required
          placeholder="Minimum 5 minutes"
          suffix_text="Minutes"
          v-model="duration"
          type="number"
        />
        <AppTextInput
          v-if="clientStore.target?.type?.includes('Pir')"
          name="goal"
          label="Goal"
          required
          placeholder="1-100"
          suffix_text="percent (%)"
          v-model="goal"
          type="number"
        />
        <AppTextInput
          v-if="clientStore.target?.type?.includes('Frequency')"
          name="goal"
          label="Goal"
          required
          placeholder="Target goal"
          suffix_text="attempt(s) per seesion"
          v-model="goal"
          type="number"
        />
        <div v-if="useSuccessMetric">
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Success metric</span>
            <span class="ml-1 text-tomato-7">{{ '*' }}</span>
          </div>
          <div v-if="!clientStore.target?.type?.includes('Latency')" class="mb-3 flex items-center gap-2">
            <input
              type="radio"
              name="success_metric"
              :checked="successMetric === 'equal to or greater than goal'"
              value="equal to or greater than goal"
              class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
              @click="successMetric = 'equal to or greater than goal'"
            />
            <label for="success_metric" class="w-full text-sm">
              Equal to or greater than goal
            </label>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="radio"
              name="success_metric"
              :checked="successMetric === 'less than goal'"
              value="less than goal"
              class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
              @click="successMetric = 'less than goal'"
            />
            <label for="success_metric" class="w-full text-sm"> Less than goal </label>
          </div>
        </div>
      </div>
    </div>
    <div v-if="useActionRecommendations" class="space-y-3 rounded bg-white p-4">
      <div
        @click="isCloseActionRecomenmdation = !isCloseActionRecomenmdation"
        class="flex items-center justify-between"
        :class="{
          'border-b border-slate-3 pb-2': !isCloseActionRecomenmdation
        }"
      >
        <div class="flex items-center gap-2">
          <div class="bg-orange-3 p-1" :style="{ borderRadius: '4px' }">
            <Icon icon="mynaui:info-waves-solid" class="rotate-180 text-[20px] text-[#FD853A]" />
          </div>
          <div class="text-sm font-semibold text-slate-10">Action recommendations</div>
        </div>
        <div :class="{ 'rotate-180': isCloseActionRecomenmdation }">
          <Icon icon="ph:caret-up-bold" class="h-5 w-5 text-slate-10" />
        </div>
      </div>
      <div v-if="!isCloseActionRecomenmdation" class="space-y-2">
        <div class="text-sm font-semibold text-slate-10">Passing success metric</div>
        <div class="text-xs text-slate-8">Updating the current target's status from</div>
        <div class="flex items-center gap-2">
          <AppChip chip="in_progress" />
          <div class="text-sm text-slate-8">to</div>
          <AppChip chip="mastered" />
        </div>
        <div class="flex items-center gap-2 pt-2">
          <AppToggle
            name="total_success"
            :checked="totalSuccessChecked"
            @change="
              onChangeToggle({
                totalSuccessChecked: !totalSuccessChecked,
                consecutiveSuccessChecked
              })
            "
          />
          <div class="text-xs font-semibold text-slate-9">Total success</div>
        </div>
        <div class="text-xs font-medium text-slate-8">
          Receive a recommendation after completing at least
        </div>
        <div class="flex items-center gap-2 pt-2">
          <input
            type="number"
            min="1"
            v-model="totalSuccessInput"
            :disabled="!totalSuccessChecked"
            :class="{
              'opacity-50': !totalSuccessChecked
            }"
            class="text-grey h-8 w-10 rounded border border-slate-4 px-2 text-center outline-none focus:border-light-purple-5 focus:ring-light-purple-2"
          />
          <div class="text-xs text-slate-8">successful session(s).</div>
        </div>
        <div class="flex items-center gap-2 pt-2">
          <AppToggle
            name="consecutive_success"
            :checked="consecutiveSuccessChecked"
            @change="
              onChangeToggle({
                consecutiveSuccessChecked: !consecutiveSuccessChecked,
                totalSuccessChecked
              })
            "
          />
          <div class="text-xs font-semibold text-slate-9">Consecutive success</div>
        </div>
        <div class="text-xs font-medium text-slate-8">
          Receive a recommendation only if the session is successful for
        </div>
        <div class="flex items-center gap-2 pt-2">
          <input
            type="number"
            v-model="consecutiveSuccessInput"
            min="1"
            :class="{
              'opacity-50': !consecutiveSuccessChecked
            }"
            :disabled="!consecutiveSuccessChecked"
            class="h-8 w-10 rounded border border-slate-4 px-2 text-center outline-none focus:border-light-purple-5 focus:ring-light-purple-2"
          />
          <div class="text-xs text-slate-8">consecutive session(s).</div>
        </div>
      </div>
    </div>
  </div>
  <div class="sticky bottom-0 bg-white px-4 py-3">
    <AppButton
      class="w-full"
      @click="onSubmit"
      :disabled="isDisabledSubmit"
      :loading="submitLoading"
      >Update</AppButton
    >
  </div>

  <CurriculumItemModal
    :show="showCurriculum"
    :reset-able="false"
    :curriculum-options="curriculumOptions"
    :selected-curriculum="[selectedCurriculum?.value as number]"
    :use-multiple-select="false"
    @close="showCurriculum = false"
    @apply="onApplyCurriculum($event[0])"
  />

  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Status</div>
        <div class="cursor-pointer" @click="showStatus = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in statusOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between border-b border-slate-3"
        >
          <label :for="`sort_by_${opt.value}`" class="w-full text-sm">
            <div class="w-fit">
              <AppChip :chip="opt.value as TargetStatus" />
            </div>
          </label>
          <input
            type="radio"
            name="sort_by"
            :id="`sort_by_${opt.value}`"
            :checked="selectStatus === opt.value"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="selectStatus = opt.value"
          />
        </div>
      </div>
      <AppButton class="w-full" @click="onApplyStatus(selectStatus as TargetStatus)"
        >Apply</AppButton
      >
    </div>
  </AppActionSheet>
</template>
