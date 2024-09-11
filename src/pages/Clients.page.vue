<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import type { Branch, ClientStatus } from '@/lib/types'
import { Icon } from '@iconify/vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppPagination from '@/components/AppPagination.vue'
import ClientItem from '@/partitions/ClientItem.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const clientStore = useClientStore()

const clientsLoading = ref<boolean>(false)

const page = ref<number>(1)
const perPage = ref<number>(25)
watch(page, (val, old) => {
  if (val !== old) {
    fetchClients()
  }
})

const query = ref<string>('')
const queryTimeout = ref<any>(null)
watch(query, () => {
  clearTimeout(queryTimeout.value)
  queryTimeout.value = setTimeout(() => {
    clientsLoading.value = true
    page.value = 1
    fetchClients()
  }, 1500)
})

const branches = ref<Branch['id'][]>([])
const selectBranches = ref<Branch['id'][]>([])
const branchOptions = computed<{ value: Branch['id']; label: Branch['name'] }[]>(() =>
  appStore.branches.map((i) => ({ value: i.id, label: i.name }))
)
const showBranch = ref<boolean>(false)
watch(showBranch, () => {
  selectBranches.value = branches.value
})
const onCheckBranch = (val: Branch['id']) => {
  if (selectBranches.value.includes(val)) {
    selectBranches.value = selectBranches.value.filter((i) => i !== val)
  } else {
    selectBranches.value = [...selectBranches.value, val]
  }
}
const onResetBranch = () => {
  branches.value = []
  selectBranches.value = []
  showBranch.value = false
  page.value = 1
  fetchClients()
}
const onApplyBranch = () => {
  branches.value = selectBranches.value
  showBranch.value = false
  page.value = 1
  fetchClients()
}

const statuses = ref<ClientStatus[]>([])
const selectStatuses = ref<ClientStatus[]>([])
const statusOptions: { value: ClientStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Discharged' },
  { value: 'at_risk_of_discharge', label: 'At risk of discharge' }
]
const showStatus = ref<boolean>(false)
watch(showStatus, () => {
  selectStatuses.value = statuses.value
})
const onCheckStatus = (val: ClientStatus) => {
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
  fetchClients()
}
const onApplyStatus = () => {
  statuses.value = selectStatuses.value
  showStatus.value = false
  page.value = 1
  fetchClients()
}

type Sort = 'alphabetical' | 'alphabetical_desc' | ''
const sort = ref<Sort>('')
const selectSort = ref<Sort>('')
const sortOptions: { value: Sort; label: string }[] = [
  { value: '', label: 'Most Recent' },
  { value: 'alphabetical', label: 'Name (A-Z)' },
  { value: 'alphabetical_desc', label: 'Name (Z-A)' }
]
const showSort = ref<boolean>(false)
watch(showSort, () => {
  selectSort.value = sort.value
})
const onResetSort = () => {
  sort.value = ''
  selectSort.value = ''
  showSort.value = false
  page.value = 1
  fetchClients()
}
const onApplySort = () => {
  sort.value = selectSort.value
  showSort.value = false
  page.value = 1
  fetchClients()
}

const params = computed<string>(() => {
  let p = `?page=${page.value}&per_page=25`
  if (query.value) p += `&query=${query.value}`
  if (branches.value.length) p += `&branch_ids=${branches.value.join(',')}`
  if (statuses.value.length) p += `&status=${statuses.value.join(',')}`
  if (sort.value) p += `&sort=${sort.value}`
  return p
})

async function fetchClients() {
  clientsLoading.value = true
  const { success } = await clientStore.getClients({ params: params.value })
  clientsLoading.value = false
  if (!success) return
  document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  clientsLoading.value = true
  /** generate client.store from storage */
  await clientStore.generateClientStore()
  await appStore.getBranches()
  fetchClients()
})
</script>

<template>
  <div
    v-if="clientsLoading"
    class="fixed z-[99] grid h-screen w-screen place-content-center bg-slate-10/30"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-1" />
  </div>

  <div class="space-y-3 pt-3 transition-all">
    <div class="flex items-center gap-3 px-4">
      <div class="text-2xl text-[22px] font-bold text-dark-purple-1">Clients</div>
      <div
        v-if="!clientsLoading"
        class="flex h-6 min-w-6 items-center justify-center rounded bg-light-purple-5 px-1 text-xs font-semibold text-white"
      >
        {{ clientStore.clients_count }}
      </div>
    </div>
  </div>

  <div class="sticky top-0 space-y-3 bg-white pt-3">
    <div class="px-4">
      <AppTextInput
        name="query"
        placeholder="Search draft by client name or ID"
        v-model="query"
        suffix_icon="ph:magnifying-glass"
      />
    </div>
    <div class="pl-4">
      <div class="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-3 pr-4">
        <div
          v-if="appStore.account?.center_enable_branch"
          class="flex h-8 max-w-32 shrink-0 cursor-pointer snap-start items-center gap-1 truncate rounded-full border px-4 text-xs font-medium capitalize transition-all"
          :class="[
            branches.length
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="showBranch = true"
        >
          <span
            v-if="branches.length > 1"
            class="flex h-5 w-5 items-center justify-center rounded bg-light-purple-4 text-sm font-medium text-white"
          >
            {{ branches.length }}
          </span>
          <span v-else-if="branches.length === 1" class="truncate">
            {{ branchOptions.find((i) => i.value === branches[0])?.label || 'Branch' }}
          </span>
          <span v-else>All branches</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
        <div
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border px-4 text-xs font-medium capitalize transition-all"
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
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center gap-1 rounded-full border border-slate-4 bg-white px-4 text-xs font-medium capitalize transition-all"
          @click="showSort = true"
        >
          <Icon icon="ph:arrows-down-up" class="text-base text-slate-8" />
          <span>{{ sortOptions.find((i) => i.value === sort)?.label }}</span>
          <Icon icon="ph:caret-down" class="text-base text-slate-8" />
        </div>
      </div>
    </div>
  </div>

  <div v-if="!clientStore.clients_count" class="flex h-64 w-full items-center justify-center px-4">
    <div v-if="query" class="text-center text-sm text-slate-8">
      Sorry, no clients match your search. Try using a different client name.
    </div>
    <div v-else-if="branches.length || statuses.length" class="text-center text-sm text-slate-8">
      Oops! No clients fit your filter criteria. Try changing the filter to find more results!
    </div>
    <div v-else class="text-center text-sm text-slate-8">
      It looks like you don't have any clients yet. They'll be added here when you're assigned to
      them.
    </div>
  </div>
  <div v-else>
    <div class="px-4 pt-2 text-xs text-slate-7">
      <span>Showing </span>
      <span>
        {{ (page - 1) * perPage + 1 }}-{{
          page * perPage > clientStore.clients_count ? clientStore.clients_count : page * perPage
        }}
      </span>
      <span> of {{ clientStore.clients_count }}</span>
    </div>
    <div class="px-4">
      <RouterLink
        v-for="client in clientStore.clients"
        :key="client.id"
        :to="{ name: 'client', params: { id: client.id, tab: 'draft-sessions' } }"
      >
        <ClientItem :client="client" />
      </RouterLink>
    </div>
    <AppPagination :page="page" :total_count="clientStore.clients_count" @change="page = $event" />
  </div>

  <AppActionSheet :show="showBranch" @close="showBranch = false">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Branches</div>
        <div class="cursor-pointer" @click="showBranch = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <div
          v-for="opt in branchOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
        >
          <label :for="`branch_filter_${opt.value}`" class="w-full truncate text-sm">
            {{ opt.label }}
          </label>
          <input
            type="checkbox"
            :name="`branch_filter_${opt.value}`"
            :id="`branch_filter_${opt.value}`"
            :checked="selectBranches.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheckBranch(opt.value)"
          />
        </div>
      </div>
      <div class="grid w-full grid-cols-2 gap-2">
        <AppButton kind="plain" @click="onResetBranch">Reset</AppButton>
        <AppButton @click="onApplyBranch">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>

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
          class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
        >
          <label :for="`sort_by_${opt.value}`" class="w-full truncate text-sm">
            {{ opt.label }}
          </label>
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
</template>
