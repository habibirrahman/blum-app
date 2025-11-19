<script setup lang="ts">
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppPagination from '@/components/AppPagination.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import TargetItemLoader from '@/components/skeletons/TargetItemLoader.vue'
import type { Client, Target, TargetType } from '@/lib/types'
import TargetItem from '@/partitions/TargetItem.vue'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import PreviewTargetModal from './PreviewTargetModal.vue'
import { getTargetType } from '@/lib/func'
import { useClientStore } from '@/stores/client.store'
import { useToast } from 'vue-toastification'

interface Emits {
  (e: 'close'): void
}

interface Curriculum {
  id: number
  name: string
  color: string
}
const emit = defineEmits<Emits>()

const toast = useToast()

const appStore = useAppStore()
const clientStore = useClientStore()

const submitLoading = ref<boolean>(false)
const targetLoading = ref<boolean>(false)
const CurriculumLoading = ref<boolean>(false)
const showCurriculums = ref<boolean>(false)
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

const loading = ref<boolean>(false)
const page = ref<number>(1)
const perPage = ref<number>(25)
watch(page, (val, old) => {
  if (val !== old) {
    fetchTargets()
  }
})

const query = ref<string>('')
const queryTimeout = ref<any>(null)
watch(query, () => {
  clearTimeout(queryTimeout.value)
  queryTimeout.value = setTimeout(() => {
    loading.value = true
    page.value = 1
    fetchTargets()
  }, 1500)
})

const curriculumQuery = ref<string>('')
const curriculumQueryTimeout = ref<any>(null)
watch(curriculumQuery, () => {
  clearTimeout(curriculumQueryTimeout.value)
  curriculumQueryTimeout.value = setTimeout(() => {
    loading.value = true
    page.value = 1
    fetchCurriculums()
  }, 1500)
})

const params = computed<string>(() => {
  let p = `?page=${page.value}&per_page=25&kind=group,single`
  if (query.value) p += `&query=${query.value}`
  if (methods.value.length) p += `&type=${methods.value.join(',')}`
  if (curriculums.value.length) p += `&curriculum_ids=${curriculums.value.join(',')}`
  return p
})

const curriculumParams = computed<string>(() => {
  let p = `?sort=name_asc`
  if (curriculumQuery.value) p += `&query=${curriculumQuery.value}`
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
  CurriculumLoading.value = true
  const { success, data } = await appStore.getCurriculums({ params: curriculumParams.value })
  CurriculumLoading.value = false
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

onMounted(() => {
  fetchTargets()
  fetchCurriculums()
})

const onCheckCurriculum = (val: number) => {
  if (selectCurriculums.value.includes(val)) {
    selectCurriculums.value = selectCurriculums.value.filter((i) => i !== val)
  } else {
    selectCurriculums.value = [...selectCurriculums.value, val]
  }
}
const onResetCurriculum = () => {
  curriculums.value = []
  selectCurriculums.value = []
  showCurriculums.value = false
  page.value = 1
  fetchTargets()
}
const onApplyCurriculum = () => {
  curriculums.value = selectCurriculums.value
  showCurriculums.value = false
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
  toast.success(`Success! ${targets.value.length} targets has been added`)
  emit('close')
}
</script>

<template>
  <div class="fixed left-0 top-0 z-[9999] h-full w-full overflow-y-scroll bg-white pt-3">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3 px-4">
        <div
          @click="emit('close')"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-2"
        >
          <Icon icon="tabler:chevron-left" class="text-2xl text-slate-7" />
        </div>
        <div class="text-[22px] font-bold text-slate-10">Add from databank</div>
      </div>
      <div class="space-y-3 bg-white pt-3">
        <div class="px-4">
          <AppTextInput
            name="query"
            placeholder="Search target by name"
            v-model="query"
            suffix_icon="ph:magnifying-glass"
          />
        </div>
        <div class="pl-4">
          <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
            <div
              class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-all"
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
              class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-all"
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
      <div v-else>
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
              <div class="flex h-[154px] flex-col justify-center gap-1.5 border-l-[6px] border-prim-2 px-3">
                <div class="flex items-center justify-between">
                  <div class="truncate text-xs text-slate-8">
                    {{ target.curriculum_name }}
                  </div>
                  <input
                    type="checkbox"
                    :checked="targets.includes(target.id as number)"
                    @change="toggleTarget(target.id as number)"
                    class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <Icon icon="ph:copy" class="h-5 w-5 text-slate-6" />
                  <div class="text-sm font-semibold text-slate-10">
                    {{ target.name }}
                  </div>
                </div>
                <div class="line-clamp-3 whitespace-pre-line text-xs text-slate-8">
                  {{ target.description }}
                </div>
                <div class="text-xs font-medium text-slate-8">
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
              @click="onOpenTarget(target)"
            />
          </div>
        </div>
        <AppPagination
          :page="page"
          :total_count="appStore.total_center_targets"
          @change="page = $event"
        />
      </div>
      <div class="sticky bottom-0 w-full bg-white p-4">
        <AppButton :loading="submitLoading" class="w-full" @click="onAddTarget" :disabled="targets.length === 0"
          >Add {{ targets.length }} target(s)</AppButton
        >
      </div>
    </div>

    <PreviewTargetModal
      :show-details="showDetails"
      @close="showDetails = false"
      :target="targetDetails"
      :loading="targetLoading"
    />

    <AppActionSheet :show="showCurriculums" @close="showCurriculums = false">
      <div class="space-y-4">
        <div class="flex w-full items-center justify-between">
          <div class="text-xl font-semibold">Curriculum</div>
          <div class="cursor-pointer" @click="showCurriculums = false">
            <Icon icon="ph:x" class="text-2xl" />
          </div>
        </div>
        <AppTextInput
          name="query"
          placeholder="Search curriculum"
          v-model="curriculumQuery"
          suffix_icon="ph:magnifying-glass"
        />
        <div>
          <div
            v-for="opt in curriculumOptions"
            :key="opt.value"
            class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
          >
            <div
              class="h-6 w-6 flex-shrink-0 rounded-full"
              :style="{
                backgroundColor: opt.color
              }"
            ></div>
            <label :for="`curriculum_filter_${opt.value}`" class="grow truncate text-sm">
              {{ opt.label }}
            </label>
            <input
              type="checkbox"
              :name="`curriculum_filter_${opt.value}`"
              :id="`curriculum_filter_${opt.value}`"
              :checked="selectCurriculums.includes(opt.value)"
              :value="opt.value"
              class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
              @click="onCheckCurriculum(opt.value)"
            />
          </div>
        </div>
        <div class="grid w-full grid-cols-2 gap-2">
          <AppButton kind="plain" @click="onResetCurriculum">Reset</AppButton>
          <AppButton @click="onApplyCurriculum">Apply</AppButton>
        </div>
      </div>
    </AppActionSheet>
    <AppActionSheet :show="showMethods" @close="showMethods = false">
      <div class="space-y-4">
        <div class="flex w-full items-center justify-between">
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
        <div class="grid w-full grid-cols-2 gap-2">
          <AppButton kind="plain" @click="onResetMethod">Reset</AppButton>
          <AppButton @click="onApplyMethod">Apply</AppButton>
        </div>
      </div>
    </AppActionSheet>
  </div>
</template>
