<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import type { Target, TargetStatus } from '@/lib/types'
import AppPagination from '@/components/AppPagination.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import TargetItem from '../TargetItem.vue'
import TargetItemLoader from '@/components/skeletons/TargetItemLoader.vue'
import AddTargetFromDatabank from '@/partitions/target/AddTargetFromDatabank.vue'
import PreviewTargetModal from '@/partitions/target/PreviewTargetModal.vue'

const route = useRoute()
const clientStore = useClientStore()

const targetsLoading = ref<boolean>(false)
const addTargetOpen = ref<boolean>(false)

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
    targetsLoading.value = true
    page.value = 1
    fetchTargets()
  }, 1500)
})

const statuses = ref<TargetStatus[]>([])
const selectStatuses = ref<TargetStatus[]>([])
const statusOptions: { value: TargetStatus; label: string }[] = [
  { value: 'in_progress', label: 'In acquisition' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Pause' },
  { value: 'discontinued', label: 'Discontinued' }
]
const showStatus = ref<boolean>(false)
watch(showStatus, () => {
  selectStatuses.value = statuses.value
})
const onCheckStatus = (val: TargetStatus) => {
  if (selectStatuses.value.includes(val)) {
    selectStatuses.value = selectStatuses.value.filter((i) => i !== val)
  } else {
    selectStatuses.value = [...selectStatuses.value, val]
  }
}
const onResetStatus = () => {
  statuses.value = []
  selectStatuses.value = []
  showStatus.value = false
  page.value = 1
  fetchTargets()
}
const onApplyStatus = () => {
  statuses.value = selectStatuses.value
  showStatus.value = false
  page.value = 1
  fetchTargets()
}

type Sort = 'name_asc' | 'name_desc'
const sort = ref<Sort>('name_asc')
const selectSort = ref<Sort>('name_asc')
const sortOptions: { value: Sort; label: string }[] = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' }
]
const showSort = ref<boolean>(false)
watch(showSort, () => {
  selectSort.value = sort.value
})
const onResetSort = () => {
  sort.value = 'name_asc'
  selectSort.value = 'name_asc'
  showSort.value = false
  page.value = 1
  fetchTargets()
}
const onApplySort = () => {
  sort.value = selectSort.value
  showSort.value = false
  page.value = 1
  fetchTargets()
}

const params = computed<string>(() => {
  const id = Number(route.params.id)
  let p = `?client_id=${id}&page=${page.value}&per_page=25`
  if (query.value) p += `&query=${query.value}`
  if (statuses.value.length) p += `&status=${statuses.value.join(',')}`
  p += `&sort=${sort.value}`
  return p
})

async function fetchTargets() {
  targetsLoading.value = true
  const { success } = await clientStore.getTargets({ params: params.value })
  targetsLoading.value = false
  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }
}

onMounted(() => {
  fetchTargets()
})
const showDetails = ref<boolean>(false)
const targetLoading = ref<boolean>(false)
const targetDetails = ref<Target | null>(null)
const onOpenTarget = async (target: Target) => {
  targetLoading.value = true
  showDetails.value = true
  const { success, data } = await clientStore.getTarget({ id: target.id })
  targetLoading.value = false
  if (!success) {
    showDetails.value = false
    return
  }
  targetDetails.value = data
}

const isCloseGroup = ref<Target['id'][]>([])
const onToggleGroup = (id: Target['id']) => {
  if (isCloseGroup.value.includes(id)) {
    isCloseGroup.value = isCloseGroup.value.filter((i) => i !== id)
  } else {
    isCloseGroup.value.push(id)
  }
}
</script>

<template>
  <div class="space-y-3 pt-3 transition-all">
    <div class="flex items-center gap-3 px-4">
      <div class="text-2xl text-[22px] font-bold text-dark-purple-1">Targets</div>
      <div v-if="targetsLoading" class="h-6 w-6 shrink-0 animate-pulse rounded bg-slate-3"></div>
      <div
        v-else
        class="flex h-6 min-w-6 items-center justify-center rounded bg-light-purple-5 px-1 text-xs font-semibold text-white"
      >
        {{ clientStore.targets_count }}
      </div>
    </div>
  </div>

  <div class="space-y-3 bg-white pt-3">
    <div class="px-4 flex items-center gap-3">
      <AppTextInput
        class="grow"
        name="query"
        placeholder="Search target by name"
        v-model="query"
        suffix_icon="ph:magnifying-glass"
      />
      <AppButton class="flex-shrink-0" @click="addTargetOpen = true"><Icon icon="ph:plus-bold" /></AppButton>
    </div>
    <div class="pl-4">
      <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
        <div
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium transition-all"
          :class="[
            statuses.length
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="showStatus = true"
        >
          <span
            v-if="statuses.length > 1"
            class="flex h-5 w-5 items-center justify-center rounded bg-light-purple-4 text-sm font-medium text-white"
          >
            {{ statuses.length }}
          </span>
          <span v-else-if="statuses.length === 1" class="truncate">
            {{ statusOptions.find((i) => i.value === statuses[0])?.label || 'Status' }}
          </span>
          <span v-else>All statuses</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
        <div
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border border-slate-4 bg-white px-4 text-xs font-medium transition-all"
          @click="showSort = true"
        >
          <Icon icon="ph:arrows-down-up" class="text-base text-slate-8" />
          <span>{{ sortOptions.find((i) => i.value === sort)?.label }}</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
      </div>
    </div>
  </div>

  <div v-if="targetsLoading">
    <div class="px-4 pt-2">
      <div class="h-4 w-24 shrink-0 animate-pulse rounded-full bg-slate-3"></div>
    </div>
    <div class="px-4">
      <TargetItemLoader v-for="n in perPage" :key="n" />
    </div>
  </div>
  <div
    v-else-if="!clientStore.targets_count"
    class="flex h-64 w-full items-center justify-center px-4"
  >
    <div v-if="statuses.length" class="text-center text-sm text-slate-8">
      Oops! No targets fit your filter criteria. Try changing the filter to find more results!
    </div>
    <div v-else-if="query" class="text-center text-sm text-slate-8">
      Sorry, no targets match your search. Try searching with a different name.
    </div>
    <div v-else class="text-center text-sm text-slate-8">
      Looks like there are no targets for this client. Create them on the desktop, and they'll show
      up here.
    </div>
  </div>
  <div v-else>
    <div class="px-4 pt-2 text-xs text-slate-7">
      <div class="h-5">
        <span>Showing </span>
        <span>
          {{ (page - 1) * perPage + 1 }}-{{
            page * perPage > clientStore.targets_count ? clientStore.targets_count : page * perPage
          }}
        </span>
        <span> of {{ clientStore.targets_count }}</span>
      </div>
    </div>
    <div>
      <div v-for="target in clientStore.targets" :key="target.id">
        <div v-if="target.is_group">
          <div
            class="flex h-[52px] items-center justify-between border-l-[6px] border-prim-2 px-3"
            @click="onToggleGroup(target.id)"
          >
            <div class="flex items-center gap-2">
              <Icon icon="ph:copy" class="h-5 w-5 text-slate-6" />
              <div class="text-sm font-semibold text-slate-10">
                {{ target.name }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-sm text-slate-8">{{ target.members?.length }} targets</div>
              <div :class="[!isCloseGroup.includes(target.id) ? '' : 'rotate-180']">
                <Icon icon="ph:caret-up-bold" class="h-5 w-5 text-slate-7" />
              </div>
            </div>
          </div>
          <div v-if="!isCloseGroup.includes(target.id)">
            <TargetItem
              v-for="member in target.members"
              :key="member.id"
              :target="member"
              @click="onOpenTarget(member)"
            />
          </div>
          <div class="h-4 w-full bg-slate-4"></div>
        </div>
        <TargetItem v-else :target="target" @click="onOpenTarget(target)" />
      </div>
    </div>
    <AppPagination :page="page" :total_count="clientStore.targets_count" @change="page = $event" />
  </div>

  <AppActionSheet :show="showStatus" @close="showStatus = false">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Statuses</div>
        <div class="cursor-pointer" @click="showStatus = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in statusOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
        >
          <label :for="`status_filter_${opt.value}`" class="w-full truncate text-sm">
            {{ opt.label }}
          </label>
          <input
            type="checkbox"
            :name="`status_filter_${opt.value}`"
            :id="`status_filter_${opt.value}`"
            :checked="selectStatuses.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheckStatus(opt.value)"
          />
        </div>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="onResetStatus">Reset</AppButton>
        <AppButton @click="onApplyStatus">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showSort" @close="showSort = false">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Sort by</div>
        <div class="cursor-pointer" @click="showSort = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in sortOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between border-b border-slate-3"
        >
          <label :for="`sort_by_${opt.value}`" class="w-full text-sm">{{ opt.label }}</label>
          <input
            type="radio"
            name="sort_by"
            :id="`sort_by_${opt.value}`"
            :checked="selectSort === opt.value"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="selectSort = opt.value"
          />
        </div>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="onResetSort">Reset</AppButton>
        <AppButton @click="onApplySort">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <PreviewTargetModal :show-details="showDetails" @close="showDetails = false" :target="targetDetails" :loading="targetLoading"/>
  <AddTargetFromDatabank v-if="addTargetOpen" @close="addTargetOpen = false"/>
</template>
