<script lang="ts" setup>
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppChip from '@/components/AppChip.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import type { Curriculum, TargetStatus, TargetType } from '@/lib/types'
import CurriculumItemModal from '@/partitions/CurriculumItemModal.vue'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'

// ========== CONSTANTS ==========
const STATUS_OPTIONS: { value: TargetStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In acquisition' }
]

const METHOD_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'Target::ColdProbe', label: 'Cold probe' },
  { value: 'Target::Duration', label: 'Duration' },
  { value: 'Target::Frequency', label: 'Frequency' },
  { value: 'Target::Latency', label: 'Latency' },
  { value: 'Target::Pir', label: 'Partial Interval Recording' },
  { value: 'Target::Percentage', label: 'Percentage' },
  { value: 'Target::TrialByTrial', label: 'Trial-by-Trial' },
  { value: 'Target::Prompting', label: 'Prompting' }
]

// ========== COMPOSABLES ==========
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const clientStore = useClientStore()
const toast = useToast()

// ========== UI STATE ==========
const loading = ref(false)
const submitLoading = ref(false)
const isCloseTargetDetails = ref(false)

// Sheets
const showMethod = ref(false)
const showCurriculum = ref(false)
const showStatus = ref(false)

// ========== FORM STATE ==========
const name = ref('')
const description = ref('')
const simplifiedDescription = ref('')
const status = ref<TargetStatus>('pending')
const selectStatus = ref<TargetStatus>('pending')
const selectedMethod = ref<TargetType | ''>('')
const selectMethodTemp = ref<TargetType | ''>('')

// Curriculum
const curriculumQuery = ref('')
const curriculumOptions = ref<{ value: number; label: string; color: string }[]>([])
const selectedCurriculum = ref<{ value: number; label: string; color: string } | null>(null)

// ========== COMPUTED ==========
const clientId = computed(() => Number(route.params.id))

const curriculumParams = computed(() => {
  const params = new URLSearchParams({ sort: 'name_asc' })
  if (curriculumQuery.value) {
    params.append('query', curriculumQuery.value)
  }
  return `?${params.toString()}`
})

const selectedMethodLabel = computed(() => {
  return METHOD_OPTIONS.find((m) => m.value === selectedMethod.value)?.label || ''
})

const isDisabledSubmit = computed(() => {
  if (!name.value || !selectedMethod.value || !selectedCurriculum.value) return true
  return false
})

// ========== METHODS ==========
async function fetchCurriculums() {
  loading.value = true
  const { success, data } = await appStore.getCurriculums({ params: curriculumParams.value })
  loading.value = false
  if (!success) return
  curriculumOptions.value = data.map((c: Curriculum) => ({
    value: c.id as number,
    label: c.name as string,
    color: c.color as string
  }))
}

function onApplyMethod() {
  selectedMethod.value = selectMethodTemp.value
  showMethod.value = false
}

function onApplyCurriculum(values: number[]) {
  if (values.length > 0) {
    selectedCurriculum.value =
      curriculumOptions.value.find((c) => c.value === values[0]) || null
  }
  showCurriculum.value = false
}

function onApplyStatus(val: TargetStatus) {
  status.value = val
  showStatus.value = false
}

watch(showStatus, () => {
  selectStatus.value = status.value
})

watch(showMethod, () => {
  selectMethodTemp.value = selectedMethod.value
})

const submitTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
async function onSubmit() {
  submitLoading.value = true

  const data = {
    target: {
      name: name.value,
      type: selectedMethod.value,
      curriculum_id: selectedCurriculum.value?.value,
      description: description.value,
      simplified_description: simplifiedDescription.value,
      status: status.value,
      client_id: clientId.value
    }
  }

  const { success, message } = await clientStore.createTarget({ data })
  submitLoading.value = false

  if (!success) {
    toast.error(message || 'Failed to create the target. Please try again.')
    return
  }

  toast.success('Success! New target has been created successfully.')

  submitTimeout.value = setTimeout(() => {
    router.push({ name: 'client', params: { id: clientId.value, tab: 'targets' } })
  }, 1000)
}

// ========== LIFECYCLE ==========
onMounted(() => {
  fetchCurriculums()
})
</script>

<template>
  <!-- Header -->
  <div class="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 pb-3 pt-3">
    <RouterLink :to="{ name: 'client', params: { id: clientId, tab: 'targets' } }">
      <div class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-2">
        <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
      </div>
    </RouterLink>
    <div class="text-[22px] font-bold text-slate-10">New target</div>
  </div>

  <!-- Main Content -->
  <div class="h-full min-h-svh w-full space-y-5 bg-prim-3 p-4">
    <!-- Target Details Section -->
    <div class="space-y-4 rounded bg-white p-4">
      <!-- Section Header -->
      <div
        @click="isCloseTargetDetails = !isCloseTargetDetails"
        class="flex cursor-pointer items-center justify-between"
        :class="{ 'border-b border-slate-4 pb-2': !isCloseTargetDetails }"
      >
        <div class="text-sm font-semibold text-slate-10">Target details</div>
        <Icon
          icon="ph:caret-up-bold"
          class="h-5 w-5 text-slate-10 transition-transform"
          :class="{ 'rotate-180': isCloseTargetDetails }"
        />
      </div>

      <!-- Form Fields -->
      <div v-if="!isCloseTargetDetails" class="space-y-4">
        <!-- Title -->
        <AppTextInput name="title" label="Title" required placeholder="Type title" v-model="name" />

        <!-- Data collection method -->
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Data collection method</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showMethod = true"
            class="flex cursor-pointer items-center justify-between rounded border border-slate-4 bg-white px-4 py-2"
          >
            <div class="truncate text-[16px]" :class="selectedMethodLabel ? 'text-slate-10' : 'text-slate-5'">
              {{ selectedMethodLabel || 'Select type' }}
            </div>
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Curriculum -->
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Curriculum</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showCurriculum = true"
            class="flex cursor-pointer items-center justify-between rounded border border-slate-4 bg-white px-4 py-2"
          >
            <div v-if="selectedCurriculum" class="flex items-center gap-2 truncate">
              <div
                class="h-6 w-6 flex-shrink-0 rounded-full"
                :style="{ backgroundColor: selectedCurriculum.color }"
              />
              <div class="truncate text-[16px] text-slate-10">
                {{ selectedCurriculum.label }}
              </div>
            </div>
            <div v-else class="text-[16px] text-slate-5">Select curriculum</div>
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Status -->
        <div>
          <div class="mb-1 text-sm font-medium text-slate-8">
            <span>Status</span>
            <span class="ml-1 text-tomato-7">*</span>
          </div>
          <div
            @click="showStatus = true"
            class="flex cursor-pointer items-center justify-between rounded border border-slate-4 bg-white px-4 py-2"
          >
            <AppChip :chip="status as TargetStatus" />
            <Icon icon="ph:caret-down" class="text-2xl text-slate-8" />
          </div>
        </div>

        <!-- Clinical description -->
        <AppTextInput
          name="clinical_description"
          label="Clinical description"
          type="textarea"
          :rows="4"
          placeholder="Provide a detailed explanation of the target for therapists and supervisors, such as its procedures and modifications."
          v-model="description"
        />

        <!-- Simplified description -->
        <AppTextInput
          name="simplified_description"
          label="Simplified description"
          type="textarea"
          :rows="4"
          placeholder="Describe the target in simplified language that's easy for non-clinical readers to understand (e.g., parents). This description can also be included in reports."
          v-model="simplifiedDescription"
        />
      </div>
    </div>
  </div>

  <!-- Bottom Submit Button -->
  <div class="fixed bottom-0 z-20 w-full bg-pure-white px-4 pb-safe">
    <div class="flex h-16 w-full items-center">
      <AppButton
        class="grow"
        kind="outline"
        :loading="submitLoading"
        :disabled="isDisabledSubmit"
        @click="onSubmit"
      >
        Create Target
      </AppButton>
    </div>
  </div>

  <!-- Data Collection Method Sheet -->
  <AppActionSheet :show="showMethod" @close="showMethod = false">
    <div>
      <div class="sticky top-0 z-10 flex w-full items-center justify-between bg-white py-3">
        <div class="text-xl font-semibold">Data collection method</div>
        <div class="cursor-pointer" @click="showMethod = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in METHOD_OPTIONS"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between border-b border-slate-3"
        >
          <label :for="`method_${opt.value}`" class="w-full text-sm">{{ opt.label }}</label>
          <input
            type="radio"
            name="data_collection_method"
            :id="`method_${opt.value}`"
            :checked="selectMethodTemp === opt.value"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="selectMethodTemp = opt.value"
          />
        </div>
      </div>

      <div class="sticky bottom-0 z-10 flex w-full items-center justify-center bg-white py-3">
        <AppButton class="w-full" @click="onApplyMethod">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <!-- Curriculum Sheet -->
  <CurriculumItemModal
    :show="showCurriculum"
    :options="curriculumOptions"
    :selected="selectedCurriculum ? [selectedCurriculum.value] : []"
    :use-multiple-select="false"
    :reset-able="false"
    @set-query="curriculumQuery = $event"
    @close="showCurriculum = false"
    @apply="onApplyCurriculum($event)"
  />

  <!-- Status Sheet -->
  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div>
      <div class="sticky top-0 z-10 flex w-full items-center justify-between bg-white py-3">
        <div class="text-xl font-semibold">Status</div>
        <div class="cursor-pointer" @click="showStatus = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>

      <div>
        <div
          v-for="opt in STATUS_OPTIONS"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between border-b border-slate-3"
        >
          <label :for="`status_${opt.value}`" class="w-full text-sm">
            <AppChip :chip="opt.value" />
          </label>
          <input
            type="radio"
            name="target_status"
            :id="`status_${opt.value}`"
            :checked="selectStatus === opt.value"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
            @click="selectStatus = opt.value"
          />
        </div>
      </div>

      <div class="sticky bottom-0 z-10 flex w-full items-center justify-center bg-white py-3">
        <AppButton class="w-full" @click="onApplyStatus(selectStatus)">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
