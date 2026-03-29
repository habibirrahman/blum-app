<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'
import type { Target, TargetStatus } from '@/lib/types'
import AppTextInput from '@/components/AppTextInput.vue'
import AppButton from '@/components/AppButton.vue'
import { useSessionStore } from '@/stores/session.store'
import TargetItemLoader from '@/components/skeletons/TargetItemLoader.vue'
import TargetItem from '@/partitions/TargetItem.vue'
import AppCheckInput from '@/components/AppCheckInput.vue'
import AppChip from '@/components/AppChip.vue'
import PreviewTargetModal from '@/partitions/target/PreviewTargetModal.vue'
import { useToast } from 'vue-toastification'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const clientStore = useClientStore()
const sessionStore = useSessionStore()

const redirect = ref<string>('')
const afterCommit = ref<string>('')

onMounted(async () => {
  const app = document.getElementById('app')
  if (app) {
    app.scroll({ top: 0, behavior: 'smooth' })
  }

  appStore.getRunningSessions()

  await fetchSession()
  await fetchTargets()
})

const sessionLoading = ref<boolean>(true)
const targetsLoading = ref<boolean>(true)

const checkedTargetIds = ref<Target['id'][]>([])
const addedTargetIds = ref<Target['id'][]>([])
const filteredTargets = ref<Target[]>([])
const filteredTargetsCount = ref<number>(0)

async function fetchSession() {
  const slug = route.params?.slug as string

  sessionLoading.value = true
  const { success, data } = await sessionStore.getSession({ slug })
  sessionLoading.value = false

  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }

  redirect.value = route.query.redirect?.toString() || `/pre-session-record/${data?.slug}`
  afterCommit.value = route.query.after_submit?.toString() || 'pre-session-record'

  addedTargetIds.value = sessionStore.session_measurements.map((i) => i.target_id)
}

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

const selected = ref<boolean>(false)
const onChangeSelected = () => {
  selected.value = !selected.value

  if (selected.value) {
    statuses.value = []
    page.value = 1
    fetchTargets()
  } else {
    const targets = clientStore.targets.filter((i: Target) => !addedTargetIds.value.includes(i.id))
    filteredTargets.value = targets
    filteredTargetsCount.value = targets.length
  }
}

const statuses = ref<TargetStatus[]>(['in_progress'])
const statusOptions: { value: TargetStatus; label: string }[] = [
  { value: 'in_progress', label: 'In acquisition' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Pause' },
  { value: 'discontinued', label: 'Discontinued' }
]
const onSelectStatus = (val: TargetStatus) => {
  if (statuses.value.includes(val)) {
    statuses.value = statuses.value.filter((i) => i !== val)
  } else {
    statuses.value = [...statuses.value, val]
  }

  page.value = 1
  fetchTargets()
}

const params = computed<string>(() => {
  const id = Number(sessionStore.session?.client_id)
  let p = `?client_id=${id}&page=${page.value}&kind=group,single`
  if (query.value) p += `&query=${query.value}`
  if (statuses.value.length) p += `&status=${statuses.value.join(',')}`
  return p
})

async function fetchTargets() {
  targetsLoading.value = true
  const { data, success } = await clientStore.getTargets({ params: params.value })
  targetsLoading.value = false

  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }

  const targets = data.targets.filter((i: Target) => !addedTargetIds.value.includes(i.id))
  if (selected.value) {
    filteredTargets.value = targets.filter((i: Target) => checkedTargetIds.value.includes(i.id))
  } else {
    filteredTargets.value = targets
  }
  filteredTargetsCount.value = filteredTargets.value.length
}

const onCheckAllTargets = () => {
  const checkedCount = checkedTargetIds.value.length
  const targetCount = filteredTargetsCount.value
  if (checkedCount < targetCount) {
    const targets = clientStore.targets.filter((i: Target) => !addedTargetIds.value.includes(i.id))
    checkedTargetIds.value = targets.map((i) => i.id)
  } else {
    checkedTargetIds.value = []
  }
}

const onCheckTarget = async (id: Target['id']) => {
  if (checkedTargetIds.value.includes(id)) {
    checkedTargetIds.value = checkedTargetIds.value.filter((i) => i !== id)
  } else {
    checkedTargetIds.value = [...checkedTargetIds.value, id]
  }
}

const showDetails = ref<boolean>(false)
const targetLoading = ref<boolean>(false)
const targetDetails = ref<Target | null>(null)
const onOpenTarget = async (event: Event, target: Target) => {
  const eventTarget = event.target as HTMLElement
  if (eventTarget.tagName === 'INPUT') {
    return
  }

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

const addLoading = ref<boolean>(false)

const onAddCheckedTargets = async () => {
  if (addLoading.value) return

  const payload = {
    id: sessionStore.session?.id,
    target_ids: checkedTargetIds.value
  }

  addLoading.value = true
  const { data, success, message } = await sessionStore.addMultipleTargetsSession(payload)
  addLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }

  toast.success(`${checkedTargetIds.value.length} target(s) has been successfully added`)

  router.push({
    name: afterCommit.value,
    params: { slug: data.slug }
  })
}
</script>

<template>
  <div class="sticky top-0 z-10 bg-white">
    <div class="flex gap-4 justify-between items-center px-4 h-14">
      <div class="flex gap-3 items-center truncate">
        <RouterLink :to="redirect" class="flex justify-center items-center w-8 h-8 shrink-0">
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </RouterLink>
        <div class="truncate text-[22px] text-xl font-bold">Select targets</div>
      </div>
    </div>
  </div>

  <div>
    <div class="sticky top-14 z-10 pt-3 space-y-3 bg-white">
      <div class="flex gap-4 items-center px-4">
        <AppTextInput
          name="query"
          placeholder="Search target by name"
          v-model="query"
          suffix-icon="ph:magnifying-glass"
          class="flex-grow"
        />
      </div>
      <div class="pl-4">
        <div class="flex overflow-x-auto gap-2 pr-4 pb-3 snap-x snap-mandatory scroll-smooth">
          <div
            class="flex items-center px-3 h-8 text-xs font-medium rounded-full border transition-all cursor-pointer shrink-0 snap-start"
            :class="[
              selected
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="onChangeSelected"
          >
            All selected
          </div>

          <div
            v-for="opt in statusOptions"
            :key="opt.value"
            class="flex items-center px-3 h-8 text-xs font-medium rounded-full border transition-all cursor-pointer shrink-0 snap-start"
            :class="[
              statuses.includes(opt.value)
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="onSelectStatus(opt.value)"
          >
            {{ opt.label }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="targetsLoading">
      <div class="px-4 pt-2">
        <div class="w-24 h-4 rounded-full animate-pulse shrink-0 bg-slate-3"></div>
      </div>
      <div class="px-4">
        <TargetItemLoader v-for="n in perPage" :key="n" />
      </div>
    </div>
    <div
      v-else-if="!filteredTargetsCount"
      class="flex justify-center items-center px-4 w-full h-64"
    >
      <div v-if="statuses.length" class="text-sm text-center text-slate-8">
        Oops! No targets fit your filter criteria. Try changing the filter to find more results!
      </div>
      <div v-else-if="query" class="text-sm text-center text-slate-8">
        Sorry, no targets match your search. Try searching with a different name.
      </div>
      <div v-else-if="selected" class="text-sm text-center text-slate-8">
        No target has been added yet.
      </div>
      <div v-else class="text-sm text-center text-slate-8">
        Looks like there are no targets for this client. Create them and they'll show up here.
      </div>
    </div>
    <div v-else class="mb-24">
      <div class="flex justify-between items-center px-4 pt-2 text-xs text-slate-7">
        <div v-if="selected" class="h-5">
          <span>Showing </span>
          <span> {{ checkedTargetIds.length }} </span>
          <span> target(s) selected </span>
        </div>
        <div v-else class="h-5">
          <span>Showing </span>
          <span> {{ filteredTargetsCount }} </span>
          <span> target(s) </span>
        </div>

        <AppCheckInput
          name="select-all-targets"
          :indeterminate="
            checkedTargetIds.length > 0 && checkedTargetIds.length !== filteredTargetsCount
          "
          :checked="checkedTargetIds.length > 0 && checkedTargetIds.length === filteredTargetsCount"
          @change="onCheckAllTargets"
        />
      </div>

      <div>
        <div v-for="target in filteredTargets" :key="target.id">
          <div v-if="target.is_group">
            <div
              class="flex h-[102px] flex-col justify-center gap-1.5 border-l-[6px] border-prim-2 px-4"
              @click="onOpenTarget($event, target)"
            >
              <div class="flex">
                <AppChip
                  :label="`${target.members?.length} target(s)`"
                  class="bg-light-purple-1 text-light-purple-4"
                />
              </div>

              <div class="flex justify-between items-center">
                <div class="flex gap-2 items-center">
                  <Icon icon="ph:copy" class="w-5 h-5 text-slate-6" />
                  <div class="text-sm font-semibold text-slate-10">
                    {{ target.name }}
                  </div>
                </div>

                <AppCheckInput
                  :name="`check-${target.id}`"
                  :checked="checkedTargetIds.includes(target.id)"
                  @change.stop="onCheckTarget(target.id)"
                />
              </div>
            </div>
          </div>
          <TargetItem
            v-else
            :target="target"
            use-action
            show-badge
            :is-checked="checkedTargetIds.includes(target.id)"
            @toggle-check="onCheckTarget(target.id)"
            @click="onOpenTarget($event, target)"
          />
        </div>
      </div>

      <!-- <AppPagination
        :page="page"
        :per-page="perPage"
        :total-count="clientStore.targets_count"
        @change="page = $event"
      /> -->
    </div>
  </div>

  <div class="fixed bottom-0 z-20 px-4 w-full bg-pure-white pb-safe">
    <div class="flex items-center w-full h-16">
      <AppButton
        class="grow"
        :loading="addLoading"
        :disabled="!checkedTargetIds.length"
        @click="onAddCheckedTargets"
      >
        Add {{ checkedTargetIds.length }} target(s)
      </AppButton>
    </div>
  </div>

  <PreviewTargetModal
    :show-details="showDetails"
    @close="showDetails = false"
    :target="targetDetails"
    :loading="targetLoading"
  />
</template>
