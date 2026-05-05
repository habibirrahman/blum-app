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

const targets = ref<number[]>([])

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
const queryTimeout = ref<number | undefined>(undefined)
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
const curriculumQueryTimeout = ref<number | undefined>(undefined)
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
const progressionQueryTimeout = ref<number | undefined>(undefined)
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
  let p = `?page=${page.value}&per_page=25&kind=group,single`
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
    targets.value.includes(target.id as number)
  )
})

// Toggle check all
const toggleCheckAll = () => {
  if (isAllChecked.value) {
    const currentPageIds = appStore.center_targets.map((t: Target) => t.id)
    targets.value = targets.value.filter((id) => !currentPageIds.includes(id))
  } else {
    const currentPageIds = appStore.center_targets.map((t: Target) => t.id)
    const newIds = currentPageIds.filter((id) => !targets.value.includes(id as number))
    targets.value = [...targets.value, ...newIds] as number[]
  }
}

// Toggle individual target
const toggleTarget = (targetId: number) => {
  if (targets.value.includes(targetId)) {
    targets.value = targets.value.filter((id) => id !== targetId)
  } else {
    targets.value = [...targets.value, targetId]
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

const addTargetTimeout = ref<number | undefined>(undefined)
const onAddTarget = async () => {
  submitLoading.value = true
  const data = {
    client_id: clientStore.client?.id as Client['id'],
    target_ids: targets.value.join(',') as string
  }
  const { success, message } = await clientStore.createBulkTarget({ data })
  submitLoading.value = false
  if (!success) {
    toast.error(message)
    return
  }
  toast.success(
    `Success! ${targets.value.length} target(s) has been added from the databank. Please note that it may take some time to complete the process.`
  )

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
    <div class="flex h-14 items-center gap-3 px-4">
      <RouterLink :to="{ name: 'client', params: { id: clientStore.client?.id, tab: 'targets' } }">
        <div
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-2"
        >
          <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
        </div>
      </RouterLink>
      <div class="text-[22px] font-bold text-slate-10">Add from databank</div>
    </div>
    <div class="space-y-3 bg-white pt-3">
      <div class="px-4">
        <AppTextInput
          name="query"
          placeholder="Search target by name"
          v-model="query"
          suffix-icon="ph:magnifying-glass"
        />
      </div>
      <div class="pl-4">
        <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
          <div
            class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-colors"
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
              class="flex h-5 w-5 items-center justify-center rounded bg-light-purple-4 text-sm font-medium text-white"
            >
              {{ curriculums.length }}
            </span>
            <Icon icon="ph:caret-down" class="text-base text-slate-8" />
          </div>
          <div
            class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-colors"
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
              class="flex h-5 w-5 items-center justify-center rounded bg-light-purple-4 text-sm font-medium text-white"
            >
              {{ methods.length }}
            </span>
            <Icon icon="ph:caret-down" class="text-base text-slate-8" />
          </div>
          <div
            class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-colors"
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
              class="flex h-5 w-5 items-center justify-center rounded bg-light-purple-4 text-sm font-medium text-white"
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
      <div class="h-4 w-24 shrink-0 animate-pulse rounded-full bg-slate-3"></div>
    </div>
    <div class="px-4">
      <TargetItemLoader v-for="n in perPage" :key="n" />
    </div>
  </div>
  <div v-else class="mb-24">
    <div class="flex items-center justify-between gap-3 px-4 pt-2 text-xs text-slate-7">
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
        class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
      />
    </div>
    <div>
      <div v-for="target in appStore.center_targets" :key="target.id">
        <div v-if="target.is_group">
          <div
            class="flex h-[154px] cursor-pointer flex-col justify-center gap-1.5 border-l-[6px] border-prim-2 px-4"
          >
            <div class="flex items-center justify-between">
              <div @click="onOpenTarget(target)" class="truncate text-xs text-slate-8">
                {{ target.curriculum_name }}
              </div>
              <input
                type="checkbox"
                :checked="targets.includes(target.id as number)"
                @change="toggleTarget(target.id as number)"
                class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
              />
            </div>
            <div @click="onOpenTarget(target)" class="flex items-center gap-2">
              <Icon icon="ph:copy" class="h-5 w-5 text-slate-6" />
              <div class="text-sm font-semibold text-slate-10">
                {{ target.name }}
              </div>
            </div>
            <div
              @click="onOpenTarget(target)"
              class="line-clamp-3 whitespace-pre-line text-xs text-slate-8"
            >
              {{ target.description }}
            </div>
            <div @click="onOpenTarget(target)" class="text-xs font-medium text-slate-8">
              {{ getTargetType(target.type) }}
            </div>
          </div>
        </div>
        <TargetItem
          v-else
          :target="target"
          show-type
          :show-status="false"
          :is-checked="targets.includes(target.id as number)"
          @toggle-check="toggleTarget(target.id as number)"
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

  <div class="fixed bottom-0 z-20 w-full bg-pure-white px-4 pb-safe">
    <div class="flex h-16 w-full items-center">
      <AppButton
        class="grow"
        :loading="submitLoading"
        @click="onAddTarget"
        :disabled="targets.length === 0"
      >
        Add {{ targets.length }} target(s)
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
      <div class="sticky top-0 z-10 flex w-full items-center justify-between bg-white py-3">
        <div class="text-xl font-semibold">Data Collection Method</div>
        <div class="cursor-pointer" @click="showMethods = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in methodOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
        >
          <label :for="`method_filter_${opt.value}`" class="w-full truncate text-sm">
            {{ opt.label }}
          </label>
          <input
            type="checkbox"
            :name="`method_filter_${opt.value}`"
            :id="`method_filter_${opt.value}`"
            :checked="selectMethods.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheckMethod(opt.value)"
          />
        </div>
      </div>
      <div class="sticky bottom-0 z-10 grid w-full grid-cols-2 gap-2 bg-white py-3">
        <AppButton kind="plain" @click="onResetMethod">Reset</AppButton>
        <AppButton @click="onApplyMethod">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
