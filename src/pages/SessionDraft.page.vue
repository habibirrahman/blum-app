<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import AppButton from '@/components/AppButton.vue'
import MeasurementRecord from '@/partitions/MeasurementRecord.vue'
import type { Measurement } from '@/lib/types'
import { useToast } from 'vue-toastification'
import AppCheckInput from '@/components/AppCheckInput.vue'

const route = useRoute()
const toast = useToast()
const sessionStore = useSessionStore()

const sessionLoading = ref<boolean>(true)
const updateLoading = ref<boolean>(false)
const redirect = ref<string>('')

const isLoading = computed(() => {
  return sessionLoading.value || updateLoading.value
})

async function fetchSession() {
  const slug = route.params?.slug as string
  sessionLoading.value = true
  updateLoading.value = true
  const { success, data } = await sessionStore.getSession({ slug })
  sessionLoading.value = false
  updateLoading.value = false
  if (!success) return

  redirect.value = route.query.redirect?.toString() || `/pre-session-record/${data?.slug}`
}

async function fetchMeasurements() {
  const id = sessionStore.session?.id
  updateLoading.value = true
  const { success } = await sessionStore.getSessionMeasurements({ id })
  updateLoading.value = false
  if (!success) return
}

const showReviewMode = ref<boolean>(false)
const containerHeight = ref<string>('100%')

const updateCollapseTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const updateHeightTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)

watch(showReviewMode, (val) => {
  document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })

  updateCollapseTimeout.value = setTimeout(() => {
    isMeasurementCollapsed.value = true
  }, 200)

  updateHeightTimeout.value = setTimeout(() => {
    const el = document.getElementById('container-record-measurement')
    let realHeight = el?.clientHeight || 0
    if (val) realHeight = realHeight / 2
    else realHeight = realHeight + 64
    containerHeight.value = `${realHeight + 44}px`
  }, 1000)

  return () => {
    if (updateCollapseTimeout.value) {
      clearTimeout(updateCollapseTimeout.value)
      updateCollapseTimeout.value = undefined
    }
    if (updateHeightTimeout.value) {
      clearTimeout(updateHeightTimeout.value)
      updateHeightTimeout.value = undefined
    }
  }
})

const normalMeasurements = computed<Measurement[]>(() => {
  if (showReviewMode.value) return sessionStore.session_measurements
  return sessionStore.session_measurements.filter((i) => !i.is_fixed)
})
const fixedMeasurement = computed<Measurement | undefined>(() =>
  sessionStore.session_measurements.find((i) => i.is_fixed)
)
const isMeasurementCollapsed = ref<boolean>(true)
watch(isMeasurementCollapsed, () => {
  document.getElementById('fixed-measurement')?.scrollTo({ top: 0, behavior: 'smooth' })
})

const onChangeLockedCard = async (measurement: Measurement, fixed: boolean) => {
  if (updateLoading.value) return

  const payload = {
    id: measurement.id,
    measurement: { is_fixed: fixed } as any,
    data_result: measurement
  }

  if (fixed) {
    payload.measurement = { is_fixed: fixed, position: 1 }
  }

  updateLoading.value = true
  const { success, message } = await sessionStore.updateMeasurement(payload)

  isMeasurementCollapsed.value = true
  await fetchMeasurements()

  if (!success) {
    toast.error(message)
  }

  updateLoading.value = false
}

const checkedMeasurementIds = ref<Measurement['id'][]>([])
const onCheckAllMeasurements = () => {
  const checkedCount = checkedMeasurementIds.value.length
  const measurementCount = sessionStore.session_measurements.length
  if (checkedCount < measurementCount) {
    checkedMeasurementIds.value = sessionStore.session_measurements.map((i) => i.id)
  } else {
    checkedMeasurementIds.value = []
  }
}

const onCheckMeasurement = async (id: Measurement['id']) => {
  if (checkedMeasurementIds.value.includes(id)) {
    checkedMeasurementIds.value = checkedMeasurementIds.value.filter((i) => i !== id)
  } else {
    checkedMeasurementIds.value = [...checkedMeasurementIds.value, id]
  }
}

const onDeleteMeasurements = async () => {
  if (updateLoading.value) return

  try {
    updateLoading.value = true

    for (const id of checkedMeasurementIds.value) {
      const payload = { id, params: '' }

      const measurement = sessionStore.session_measurements.find((i) => i.id === id)

      if (measurement?.type?.includes('Probing')) {
        payload.params = '?delete_card_probing=true'
      }

      const { success, message } = await sessionStore.deleteMeasurement(payload)

      if (!success) {
        toast.error(message)
      }
    }
  } catch (error) {
    console.log('[onDelete]', error)
  } finally {
    checkedMeasurementIds.value = []
    await fetchMeasurements()
    updateLoading.value = false
  }
}

onMounted(async () => {
  const app = document.getElementById('app')
  if (app) {
    app.style.backgroundColor = 'rgb(235 228 240 / var(--tw-bg-opacity))' /* #ebe4f0 */
    app.scroll({ top: 0, behavior: 'smooth' })
  }

  await fetchSession()
})

onUnmounted(() => {
  const app = document.getElementById('app')
  if (app) {
    app.style.backgroundColor = 'rgb(255 255 255 / var(--tw-bg-opacity))' /* #ffffff */
  }

  // Clear timeout to prevent memory leaks
  if (updateCollapseTimeout.value) {
    clearTimeout(updateCollapseTimeout.value)
    updateCollapseTimeout.value = undefined
  }
  if (updateHeightTimeout.value) {
    clearTimeout(updateHeightTimeout.value)
    updateHeightTimeout.value = undefined
  }
})
</script>

<template>
  <div class="sticky top-0 z-10 bg-white">
    <div class="flex gap-4 justify-between items-center px-4 h-14">
      <div class="flex gap-3 items-center truncate">
        <RouterLink :to="redirect" class="flex justify-center items-center w-8 h-8 shrink-0">
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </RouterLink>
        <div class="space-y-1">
          <div class="font-bold truncate">
            {{ sessionStore.session?.client?.name }}
          </div>
          <div class="flex gap-1 items-center">
            <div class="text-xs shrink-0 text-slate-8">
              <span v-if="!sessionStore.session?.name">Session ID </span>
              <span>{{ sessionStore.session?.id }}</span>
              <span v-if="sessionStore.session?.name"> - {{ sessionStore.session?.name }}</span>
            </div>
            <div
              class="flex h-5 w-5 items-center justify-center rounded-full bg-[#F2FFE3]"
              :class="[isLoading ? 'animate-spin' : '']"
            >
              <Icon icon="ph:arrows-clockwise" class="rotate-90 text-[#4B810E]" />
            </div>
          </div>
        </div>
      </div>
      <div class="flex gap-4 items-center">
        <AppButton kind="plain" @click="showReviewMode = !showReviewMode"> Preview </AppButton>
        <AppCheckInput
          name="select-all-measurements"
          :indeterminate="
            checkedMeasurementIds.length > 0 &&
            checkedMeasurementIds.length !== sessionStore.session_measurements.length
          "
          :checked="
            checkedMeasurementIds.length > 0 &&
            checkedMeasurementIds.length === sessionStore.session_measurements.length
          "
          @change="onCheckAllMeasurements"
        />
      </div>
    </div>
  </div>

  <div
    class="fixed left-1/2 z-[9] -translate-x-1/2 pt-safe"
    :class="{ 'top-[60px]': isLoading, '-top-[60px]': !isLoading }"
  >
    <div class="flex justify-center items-center w-10 h-10 bg-white rounded-full shadow">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>
  </div>

  <div
    class="flex flex-col items-center pt-4 w-full min-h-screen bg-prim-3"
    :style="{ height: containerHeight }"
  >
    <div
      id="container-record-measurement"
      class="flex flex-wrap gap-4 justify-center px-4 py-4 w-full transition-all duration-500"
      :class="{
        'origin-top scale-50 object-top': showReviewMode,
        'min-w-[calc((320px*2)+(16px*3))]': showReviewMode,
        'sm:min-w-[calc((320px*3)+(16px*4))]': showReviewMode,
        'md:min-w-[calc((320px*4)+(16px*5))]': showReviewMode,
        'lg:min-w-[calc((320px*6)+(16px*7))]': showReviewMode,
        'xl:min-w-[calc((320px*7)+(16px*8))]': showReviewMode,
        '2xl:min-w-[calc((320px*9)+(16px*10))]': showReviewMode
      }"
    >
      <div v-if="sessionLoading" class="flex flex-wrap gap-4 justify-center w-full">
        <div
          v-for="n in 8"
          :key="n"
          class="h-[540px] w-[320px] shrink-0 animate-pulse rounded bg-prim-1"
        ></div>
      </div>
      <div
        v-else-if="!sessionStore.session_measurements.length"
        class="flex h-[calc(50vh)] flex-col items-center justify-center px-4 text-center text-dark-purple-1"
      >
        <div>Whoops, no targets here!</div>
        <div>Add targets before kick off your session.</div>
      </div>
      <div v-else class="flex w-full flex-wrap justify-center gap-4 pb-[50vh]">
        <MeasurementRecord
          v-for="measurement in normalMeasurements"
          :key="measurement.id"
          :id="`measurement-record-${measurement.id}`"
          :measurement="measurement"
          :review-mode="showReviewMode"
          is-disabled-action
          :use-lock="!fixedMeasurement"
          :is-checked="checkedMeasurementIds.includes(measurement.id)"
          @toggle-lock="onChangeLockedCard(measurement, true)"
          @toggle-check="onCheckMeasurement(measurement.id)"
          @after-commit="fetchMeasurements"
        />
      </div>
    </div>
  </div>

  <div
    v-if="!sessionLoading && fixedMeasurement"
    id="fixed-measurement"
    class="fixed z-[9] flex w-screen bg-prim-3 transition-all duration-500 px-safe pb-safe"
    :class="[showReviewMode ? '-bottom-52' : isMeasurementCollapsed ? 'bottom-16' : 'bottom-0']"
  >
    <div
      class="flex grow"
      :class="{
        'max-h-[160px] justify-center': isMeasurementCollapsed,
        'no-scrollbar h-[calc(100vh-56px)] flex-col items-center gap-4 overflow-y-auto py-32':
          !isMeasurementCollapsed
      }"
    >
      <div v-if="!isMeasurementCollapsed" class="flex flex-col gap-1 items-center">
        <AppButton
          kind="outline"
          size="lg"
          class="rounded-full"
          @click="onChangeLockedCard(fixedMeasurement, false)"
        >
          <Icon icon="ph:lock-fill" class="text-4xl" />
        </AppButton>
      </div>
      <MeasurementRecord
        :measurement="fixedMeasurement"
        :is-collapsed="isMeasurementCollapsed"
        is-disabled-action
        :is-checked="checkedMeasurementIds.includes(fixedMeasurement.id)"
        @toggle-collapsed="isMeasurementCollapsed = $event"
        @toggle-check="onCheckMeasurement(fixedMeasurement.id)"
        @after-commit="fetchMeasurements"
      />
      <div
        v-if="!isMeasurementCollapsed"
        class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-prim-1"
        @click="isMeasurementCollapsed = true"
      >
        <Icon icon="ph:x" class="text-[32px] text-light-purple-5" />
      </div>
    </div>
  </div>

  <div
    v-if="!sessionLoading"
    class="fixed z-[9] w-screen bg-prim-3 transition-all duration-500 px-safe pb-safe"
    :class="[!isMeasurementCollapsed ? '-bottom-36' : 'bottom-0']"
  >
    <div class="flex gap-6 items-center px-4 w-full h-16">
      <div class="relative" @click="showReviewMode = !showReviewMode">
        <div
          class="flex justify-center items-center w-8 h-10 text-xs font-semibold bg-white rounded text-dark-purple-1"
        >
          {{ sessionStore.session_measurements.length }}
        </div>
        <div
          class="absolute top-0 -z-[1] h-10 w-8 rounded bg-prim-4 transition-all duration-500"
          :class="{ 'left-2 rotate-[15deg]': !showReviewMode, 'left-0 rotate-0': showReviewMode }"
        ></div>
      </div>

      <AppButton
        v-if="checkedMeasurementIds.length"
        class="w-full"
        :loading="updateLoading"
        @click="onDeleteMeasurements"
      >
        <span>Remove {{ checkedMeasurementIds.length }} target(s)</span>
      </AppButton>
      <RouterLink
        v-else
        class="w-full"
        :to="{
          name: 'session-select-target',
          params: { slug: sessionStore.session?.slug },
          query: {
            redirect: `/sessions/${sessionStore.session?.slug}`,
            after_submit: `session-draft`
          }
        }"
      >
        <AppButton class="w-full">
          <Icon icon="ph:plus" />
          <span>Add target</span>
        </AppButton>
      </RouterLink>
    </div>
  </div>
</template>
