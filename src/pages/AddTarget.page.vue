<script setup lang="ts">
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import TargetItemLoader from '@/components/skeletons/TargetItemLoader.vue'
import type { Client, Progression, Target, TargetType } from '@/lib/types'
import TargetItem from '@/partitions/TargetItem.vue'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import PreviewTargetModal from '@/partitions/target/PreviewTargetModal.vue'
import { getTargetType } from '@/lib/func'
import { useClientStore } from '@/stores/client.store'
import { useToast } from 'vue-toastification'
import CurriculumItemModal from '@/partitions/CurriculumItemModal.vue'
import { useRouter } from 'vue-router'
import ProgressionItemModal from '@/partitions/ProgressionItemModal.vue'
import AppCheckInput from '@/components/AppCheckInput.vue'

interface Curriculum {
  id: number
  name: string
  color: string
}

const toast = useToast()

const router = useRouter()

const appStore = useAppStore()
const clientStore = useClientStore()

const submitLoading = ref<boolean>(false)
const targetLoading = ref<boolean>(false)
const curriculumLoading = ref<boolean>(false)
const progressionLoading = ref<boolean>(false)
const showCurriculums = ref<boolean>(false)
const showProgressions = ref<boolean>(false)
const showMethods = ref<boolean>(false)
const showDetails = ref<boolean>(false)

const targetDetails = ref<Target | null>(null)

const isOpenSubmitConfirmation = ref<boolean>(false)

const addedTargets = ref<Target[]>([])

const methods = ref<TargetType[]>([])
const selectMethods = ref<TargetType[]>([])
const methodOptions: { value: TargetType; label: string }[] = [
  { value: 'Target::ColdProbe', label: 'Cold Probe' },
  { value: 'Target::Duration', label: 'Duration' },
  { value: 'Target::Frequency', label: 'Frequency' },
  { value: 'Target::Latency', label: 'Latency' },
  { value: 'Target::Pir', label: 'Partial Interval Recording' },
  { value: 'Target::Percentage', label: 'Percentage' },
  { value: 'Target::Prompting', label: 'Prompting' },
  { value: 'Target::Sbt', label: 'Skill-based Treatment (SBT)' },
  { value: 'Target::TrialByTrial', label: 'Trial-by-Trial' }
]

const curriculums = ref<number[]>([])
const selectCurriculums = ref<number[]>([])
const curriculumOptions = ref<{ value: number; label: string; color: string }[]>([])

const progressions = ref<number[]>([])
const selectProgressions = ref<number[]>([])
const progressionOptions = ref<{ value: number; label: string; color: string }[]>([])

const loading = ref<boolean>(false)
const page = ref<number>(1)
const perPage = ref<number>(25)
watch(page, (val, old) => {
  if (val !== old) {
    fetchTargets()
  }
})

const query = ref<string>('')
const queryTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
watch(query, () => {
  if (queryTimeout.value) {
    clearTimeout(queryTimeout.value)
    queryTimeout.value = undefined
  }

  queryTimeout.value = setTimeout(() => {
    loading.value = true
    page.value = 1
    fetchTargets()
  }, 1500)

  return () => {
    if (queryTimeout.value) {
      clearTimeout(queryTimeout.value)
      queryTimeout.value = undefined
    }
  }
})

const curriculumQuery = ref<string>('')
const curriculumQueryTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
watch(curriculumQuery, () => {
  if (curriculumQueryTimeout.value) {
    clearTimeout(curriculumQueryTimeout.value)
    curriculumQueryTimeout.value = undefined
  }

  curriculumQueryTimeout.value = setTimeout(() => {
    fetchCurriculums()
  }, 1500)

  return () => {
    if (curriculumQueryTimeout.value) {
      clearTimeout(curriculumQueryTimeout.value)
      curriculumQueryTimeout.value = undefined
    }
  }
})

const progressionQuery = ref<string>('')
const progressionQueryTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
watch(progressionQuery, () => {
  if (progressionQueryTimeout.value) {
    clearTimeout(progressionQueryTimeout.value)
    progressionQueryTimeout.value = undefined
  }

  progressionQueryTimeout.value = setTimeout(() => {
    fetchProgression()
  }, 1500)

  return () => {
    if (progressionQueryTimeout.value) {
      clearTimeout(progressionQueryTimeout.value)
      progressionQueryTimeout.value = undefined
    }
  }
})

const params = computed<string>(() => {
  const clientId = clientStore.client?.id as Client['id']

  let p = `?page=${page.value}&per_page=25&kind=group,single&for_client_id=${clientId}`
  if (query.value) p += `&query=${query.value}`
  if (methods.value.length) p += `&type=${methods.value.join(',')}`
  if (curriculums.value.length) p += `&curriculum_ids=${curriculums.value.join(',')}`
  if (progressions.value.length) p += `&progression_ids=${progressions.value.join(',')}`
  return p
})

const curriculumParams = computed<string>(() => {
  let p = `?sort=name_asc`
  if (curriculumQuery.value) p += `&query=${curriculumQuery.value}`
  return p
})

const progressionParams = computed<string>(() => {
  let p = `?sort=name_asc`
  if (progressionQuery.value) p += `&query=${progressionQuery.value}`
  return p
})

// Computed untuk check all
const isAllChecked = computed(() => {
  if (!appStore.center_targets || appStore.center_targets.length === 0) return false
  return appStore.center_targets.every((target: Target) =>
    addedTargets.value.some((at: Target) => at.id === target.id)
  )
})

const previouslyAddedTargets = computed(() => {
  return addedTargets.value.filter((t) => t.previously_added)
})

const hasPreviouslyAddedTargets = computed(() => {
  return previouslyAddedTargets.value.length > 0
})

// Toggle check all
const toggleCheckAll = () => {
  if (isAllChecked.value) {
    const currentPageTargets = appStore.center_targets
    addedTargets.value = addedTargets.value.filter(
      (at: Target) => !currentPageTargets.some((t: Target) => t.id === at.id)
    )
  } else {
    const currentPageTargets = appStore.center_targets
    const newTargets = currentPageTargets.filter(
      (t: Target) => !addedTargets.value.some((at: Target) => at.id === t.id)
    )
    addedTargets.value = [...addedTargets.value, ...newTargets]
  }
}

// Toggle individual target
const toggleTarget = (target: Target) => {
  if (addedTargets.value.some((t: Target) => t.id === target.id)) {
    addedTargets.value = addedTargets.value.filter((t: Target) => t.id !== target.id)
  } else {
    addedTargets.value = [...addedTargets.value, target]
  }
}

async function fetchTargets() {
  loading.value = true
  const { success } = await appStore.getTargets({ params: params.value })
  loading.value = false
  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }
}

async function fetchCurriculums() {
  curriculumLoading.value = true
  const { success, data } = await appStore.getCurriculums({ params: curriculumParams.value })
  curriculumLoading.value = false
  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }
  curriculumOptions.value = data.map((c: Curriculum) => ({
    value: c.id,
    label: c.name,
    color: c.color
  }))
}
async function fetchProgression() {
  if (!clientStore.client?.center_id) return

  const payload = {
    url: `api/v1/centers/${clientStore.client?.center_id}/progressions${progressionParams.value}`
  }

  progressionLoading.value = true
  const { success, data } = await appStore.actionGet(payload)
  progressionLoading.value = false
  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }
  progressionOptions.value = data.data.map((p: Progression) => ({
    value: p.id,
    label: p.name
  }))
}

onMounted(() => {
  fetchTargets()
  fetchCurriculums()
  fetchProgression()
})

onUnmounted(() => {
  // Clear timeout to prevent memory leaks
  if (queryTimeout.value) {
    clearTimeout(queryTimeout.value)
    queryTimeout.value = undefined
  }
  if (curriculumQueryTimeout.value) {
    clearTimeout(curriculumQueryTimeout.value)
    curriculumQueryTimeout.value = undefined
  }
  if (progressionQueryTimeout.value) {
    clearTimeout(progressionQueryTimeout.value)
    progressionQueryTimeout.value = undefined
  }
  if (addTargetTimeout.value) {
    clearTimeout(addTargetTimeout.value)
    addTargetTimeout.value = undefined
  }
})

const onResetCurriculum = () => {
  curriculums.value = []
  selectCurriculums.value = []
  showCurriculums.value = false
  page.value = 1
  fetchTargets()
}
const onApplyCurriculum = (values: number[]) => {
  curriculums.value = values
  showCurriculums.value = false
  page.value = 1
  fetchTargets()
}

const onResetProgression = () => {
  progressions.value = []
  selectProgressions.value = []
  showProgressions.value = false
  page.value = 1
  fetchTargets()
}
const onApplyProgression = (values: number[]) => {
  progressions.value = values
  showProgressions.value = false
  page.value = 1
  fetchTargets()
}

const onCheckMethod = (val: TargetType) => {
  if (selectMethods.value.includes(val)) {
    selectMethods.value = selectMethods.value.filter((i) => i !== val)
  } else {
    selectMethods.value = [...selectMethods.value, val]
  }
}

const onResetMethod = () => {
  methods.value = []
  selectMethods.value = []
  showMethods.value = false
  page.value = 1
  fetchTargets()
}
const onApplyMethod = () => {
  methods.value = selectMethods.value
  showMethods.value = false
  page.value = 1
  fetchTargets()
}

const onOpenTarget = async (target: Target) => {
  targetLoading.value = true
  showDetails.value = true
  const { success, data } = await appStore.getTarget({ id: target.id })
  targetLoading.value = false
  if (!success) {
    showDetails.value = false
    return
  }
  targetDetails.value = data
}

const addTargetTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const onAddTarget = async () => {
  // if hasPreviouslyAddedTargets, open modal
  if (!isOpenSubmitConfirmation.value && hasPreviouslyAddedTargets.value) {
    isOpenSubmitConfirmation.value = true
    return
  }

  // if not hasPreviouslyAddedTargets, just submit
  submitLoading.value = true
  const data = {
    client_id: clientStore.client?.id as Client['id'],
    target_ids: addedTargets.value.map((t: Target) => t.id).join(',') as string
  }
  const { success, message } = await clientStore.createBulkTarget({ data })
  submitLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }

  toast.success(
    `Success! ${addedTargets.value.length} target(s) has been added from the databank. Please note that it may take some time to complete the process.`
  )

  isOpenSubmitConfirmation.value = false

  addTargetTimeout.value = setTimeout(() => {
    router.push({ name: 'client', params: { id: clientStore.client?.id, tab: 'targets' } })
  }, 1000)

  return () => {
    clearTimeout(addTargetTimeout.value)
  }
}
</script>

<template>
  <div class="sticky top-0 z-10 bg-white">
    <div class="flex gap-3 items-center px-4 h-14">
      <RouterLink :to="{ name: 'client', params: { id: clientStore.client?.id, tab: 'targets' } }">
        <div
          class="flex justify-center items-center w-8 h-8 rounded-full cursor-pointer bg-slate-2"
        >
          <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
        </div>
      </RouterLink>
      <div class="text-[22px] font-bold text-slate-10">Add from databank</div>
    </div>
    <div class="pt-3 space-y-3 bg-white">
      <div class="px-4">
        <AppTextInput
          name="query"
          placeholder="Search target by name"
          v-model="query"
          suffix-icon="ph:magnifying-glass"
        />
      </div>
      <div class="pl-4">
        <div class="flex overflow-x-auto gap-2 pr-4 pb-3 snap-x snap-mandatory scroll-smooth">
          <div
            class="flex gap-1 items-center px-4 h-8 text-xs font-medium rounded-full border transition-colors cursor-pointer shrink-0 snap-start"
            :class="[
              curriculums.length
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="showCurriculums = true"
          >
            <span>Curriculum</span>
            <span
              v-if="curriculums.length > 0"
              class="flex justify-center items-center w-5 h-5 text-sm font-medium text-white rounded bg-light-purple-4"
            >
              {{ curriculums.length }}
            </span>
            <Icon icon="ph:caret-down" class="text-base text-slate-8" />
          </div>
          <div
            class="flex gap-1 items-center px-4 h-8 text-xs font-medium rounded-full border transition-colors cursor-pointer shrink-0 snap-start"
            :class="[
              methods.length
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="showMethods = true"
          >
            <span>Method</span>
            <span
              v-if="methods.length > 0"
              class="flex justify-center items-center w-5 h-5 text-sm font-medium text-white rounded bg-light-purple-4"
            >
              {{ methods.length }}
            </span>
            <Icon icon="ph:caret-down" class="text-base text-slate-8" />
          </div>
          <div
            class="flex gap-1 items-center px-4 h-8 text-xs font-medium rounded-full border transition-colors cursor-pointer shrink-0 snap-start"
            :class="[
              progressions.length
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="showProgressions = true"
          >
            <span>Progression</span>
            <span
              v-if="progressions.length > 0"
              class="flex justify-center items-center w-5 h-5 text-sm font-medium text-white rounded bg-light-purple-4"
            >
              {{ progressions.length }}
            </span>
            <Icon icon="ph:caret-down" class="text-base text-slate-8" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="loading">
    <div class="px-4 pt-2">
      <div class="w-24 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
    </div>
    <div class="px-4">
      <TargetItemLoader v-for="n in perPage" :key="n" />
    </div>
  </div>

  <div v-else class="mb-24">
    <div class="flex gap-3 justify-between items-center px-4 pt-2 text-xs text-slate-7">
      <div class="h-5">
        <span>Showing </span>
        <span>
          {{ (page - 1) * perPage + 1 }}-{{
            page * perPage > appStore.total_center_targets
              ? appStore.total_center_targets
              : page * perPage
          }}
        </span>
        <span> of {{ appStore.total_center_targets }}</span>
      </div>
      <input
        type="checkbox"
        :checked="isAllChecked"
        @change="toggleCheckAll"
        class="w-6 h-6 rounded shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
      />
    </div>
    <div>
      <div v-for="target in appStore.center_targets" :key="target.id">
        <div v-if="target.is_group">
          <div
            class="flex h-[154px] cursor-pointer flex-col justify-center gap-1.5 border-l-[6px] border-prim-2 px-4"
          >
            <div class="flex justify-between items-center">
              <div @click="onOpenTarget(target)" class="text-xs truncate text-slate-8">
                {{ target.curriculum_name }}
              </div>
              <AppCheckInput
                :name="`check-${target.id}`"
                :checked="addedTargets.some((t: Target) => t.id === target.id)"
                @change.stop="toggleTarget(target)"
              />
            </div>
            <div @click="onOpenTarget(target)" class="flex gap-2 items-center">
              <Icon icon="ph:copy" class="w-5 h-5 text-slate-6" />
              <div class="text-sm font-semibold text-slate-10">
                {{ target.name }}
              </div>
            </div>
            <div
              @click="onOpenTarget(target)"
              class="text-xs whitespace-pre-line line-clamp-3 text-slate-8"
            >
              {{ target.description }}
            </div>
            <div @click="onOpenTarget(target)" class="text-xs font-medium text-slate-8">
              {{ getTargetType(target.type) }}
            </div>

            <!-- added to client indicator -->
            <div v-if="target.previously_added" class="flex gap-1 items-center">
              <div class="flex justify-center items-center w-5 h-5 rounded-md shrink-0 bg-tulip-2">
                <Icon icon="tabler:copy-check" class="text-sm text-tulip-8" />
              </div>
              <div class="text-xs text-slate-7">Previously added</div>
            </div>
            <!-- end added to client indicator -->
          </div>
        </div>
        <TargetItem
          v-else
          :target="target"
          show-type
          :show-status="false"
          :is-checked="addedTargets.some((t: Target) => t.id === target.id)"
          @toggle-check="toggleTarget(target)"
          :use-action="true"
          @open="onOpenTarget(target)"
        />
      </div>
    </div>
    <AppPagination
      :page="page"
      :total-count="appStore.total_center_targets"
      @change="page = $event"
    />
  </div>

  <div class="fixed bottom-0 z-20 px-4 w-full bg-pure-white pb-safe">
    <div class="flex items-center w-full h-16">
      <AppButton
        class="grow"
        :loading="submitLoading"
        @click="onAddTarget"
        :disabled="addedTargets.length === 0"
      >
        Add {{ addedTargets.length }} target(s)
      </AppButton>
    </div>
  </div>

  <PreviewTargetModal
    :show-details="showDetails"
    @close="showDetails = false"
    :target="targetDetails"
    :loading="targetLoading"
  />

  <CurriculumItemModal
    :show="showCurriculums"
    :options="curriculumOptions"
    :selected="curriculums"
    :use-multiple-select="true"
    @set-query="curriculumQuery = $event"
    @close="showCurriculums = false"
    @apply="onApplyCurriculum($event)"
    @reset="onResetCurriculum"
  />

  <ProgressionItemModal
    :show="showProgressions"
    :options="progressionOptions"
    :selected="progressions"
    :use-multiple-select="true"
    @set-query="progressionQuery = $event"
    @close="showProgressions = false"
    @apply="onApplyProgression($event)"
    @reset="onResetProgression"
  />

  <AppActionSheet :show="showMethods" @close="showMethods = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="text-xl font-semibold">Data Collection Method</div>
        <div class="cursor-pointer" @click="showMethods = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in methodOptions"
          :key="opt.value"
          class="flex gap-4 justify-between items-center w-full h-14 border-b border-slate-3"
        >
          <label :for="`method_filter_${opt.value}`" class="w-full text-sm truncate">
            {{ opt.label }}
          </label>
          <input
            type="checkbox"
            :name="`method_filter_${opt.value}`"
            :id="`method_filter_${opt.value}`"
            :checked="selectMethods.includes(opt.value)"
            :value="opt.value"
            class="rounded shrink-0 border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheckMethod(opt.value)"
          />
        </div>
      </div>
      <div class="grid sticky bottom-0 z-10 grid-cols-2 gap-2 py-3 w-full bg-white">
        <AppButton kind="plain" @click="onResetMethod">Reset</AppButton>
        <AppButton @click="onApplyMethod">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="isOpenSubmitConfirmation" @close="isOpenSubmitConfirmation = false">
    <div>
      <div class="flex sticky top-0 z-10 justify-between items-center py-3 w-full bg-white">
        <div class="flex gap-1 items-center">
          <Icon icon="ph:warning-fill" class="text-2xl text-tulip-6" />
          <div class="text-xl font-semibold">Confirm and add target(s)</div>
        </div>
        <div class="cursor-pointer" @click="isOpenSubmitConfirmation = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div class="text-sm text-slate-8">
          The following targets have already been added from the databank:
        </div>
        <div class="flex flex-col py-1 pl-2">
          <div
            v-for="target in previouslyAddedTargets"
            :key="target.id"
            class="flex gap-2 items-center"
          >
            <div class="w-0.5 h-0.5 rounded-full shrink-0 bg-slate-8"></div>
            <div class="text-sm text-slate-8">
              <span translate="no" class="notranslate">{{ target.name }}</span>
            </div>
          </div>
        </div>
        <div class="text-sm text-slate-8">Are you sure you want to proceed?</div>
      </div>

      <div class="grid sticky bottom-0 z-10 grid-cols-2 gap-2 py-3 w-full bg-white">
        <AppButton kind="plain" @click="isOpenSubmitConfirmation = false">Close</AppButton>
        <AppButton
          :loading="submitLoading"
          @click="onAddTarget"
          :disabled="addedTargets.length === 0"
        >
          Continue
        </AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
