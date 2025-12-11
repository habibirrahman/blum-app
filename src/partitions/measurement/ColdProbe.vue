<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementResultsParams } from '@/stores/session.store'
import type { Measurement, Target } from '@/lib/types'
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue/dist/iconify.js'
import { useToast } from 'vue-toastification'

const toast = useToast()
const sessionStore = useSessionStore()

interface Props {
  measurement: Measurement
  measurement_results: Measurement['results']
  is_collapsed: boolean
  target: Target
}

interface Emits {
  (e: 'toggle-updated', value: boolean): void
  (e: 'check-completed-cold-probe', value: boolean): void
  (e: 'fetch-session'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const loading = ref<{ yes: boolean; no: boolean }>({ yes: false, no: false })
const loadingMultiple = ref<Record<string, boolean>>({})

const singleVariableResult = ref<{ yes: boolean; no: boolean }>({ yes: false, no: false })
const multipleVariableResult = ref<Record<string, string>>({})
const allResults = ref<Record<string, { target_variable_id: number; score: number }>>({})

const isCompletedColdProbe = computed<boolean>(() => {
  if (props.target.cold_probe_format === 'classic') return true
  const results = Object.keys(allResults.value)
  if (results.length === 0) return true
  if (results.length === props.target.target_variables?.length) return true
  return false
})

onMounted(() => {
  if (props.target.cold_probe_format === 'classic') {
    if (props.measurement_results) {
      singleVariableResult.value = {
        yes: props.measurement_results.score === '100',
        no: props.measurement_results.score === '0'
      }
    }
  } else if (props.target.cold_probe_format === 'custom') {
    if (props.measurement_results && Object.keys(props.measurement_results).length > 0) {
      allResults.value = { ...props.measurement_results }
      for (const id in props.measurement_results) {
        const result = props.measurement_results[id]
        multipleVariableResult.value[id] = result.score === 100 ? 'yes' : 'no'
      }
    }
    emit('check-completed-cold-probe', isCompletedColdProbe.value)
  }
})

const onClickSingleVariable = async (value: 'yes' | 'no') => {
  if (sessionStore.session?.status !== 'ongoing') return
  emit('toggle-updated', true)
  singleVariableResult.value = {
    yes: value === 'yes',
    no: value === 'no'
  }
  loading.value = {
    yes: value === 'yes',
    no: value === 'no'
  }

  try {
    await onSaveColdProbe(value)
  } catch (error) {
    singleVariableResult.value[value] = !singleVariableResult.value[value]
  } finally {
    loading.value = {
      yes: false,
      no: false
    }
  }
}

const onSaveColdProbe = async (value: 'yes' | 'no') => {
  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: {
      results: { score: value === 'yes' ? '100' : '0' }
    },
    data_result: {
      ...props.measurement,
      results: { score: value === 'yes' ? '100' : '0' }
    },
    last_data: { ...props.measurement }
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: value === 'yes' ? `cold_probe_success` : `cold_probe_failed`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: { score: value === 'yes' ? '100' : '0' } } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurementResults(params)

  if (!success) {
    toast.error(message)
    return
  }
}

const onClickMultipleVariable = async (id: number, value: 'yes' | 'no') => {
  if (sessionStore.session?.status !== 'ongoing') return
  emit('toggle-updated', true)
  loadingMultiple.value[id] = true
  multipleVariableResult.value[id] = value

  try {
    await saveMultipleVariableResult(id, value)
    emit('check-completed-cold-probe', isCompletedColdProbe.value)
  } catch (error) {
    console.log('🚀 ~ onClickMultipleVariable ~ error:', error)
  } finally {
    loadingMultiple.value[id] = false
  }
}

const saveMultipleVariableResult = async (id: number, value: 'yes' | 'no') => {
  const score = value === 'yes' ? 100 : 0

  allResults.value[id] = {
    target_variable_id: id,
    score
  }

  const params: UpdateMeasurementResultsParams = {
    id: props.measurement.id,
    measurement: { results: allResults.value },
    data_result: { ...props.measurement, results: allResults.value },
    last_data: { ...props.measurement }
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: value === 'yes' ? `cold_probe_success` : `cold_probe_failed`,
    recordable: 'Measurement',
    recordable_id: props.measurement.id,
    api: `PATCH /api/v1/measurements/${props.measurement.id}`,
    params: { measurement: { results: allResults.value } },
    notes: `Target: ${props.measurement.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurementResults(params)

  if (!success) {
    toast.error(message)
    return
  }
}

// check loading state
const isLoading = computed(() => {
  if (loading.value.yes) return true
  if (loading.value.no) return true

  const arr = Object.values(loadingMultiple.value) || []
  if (arr.includes(true)) {
    return true
  }

  return false
})
</script>

<template>
  <div class="flex flex-col justify-center flex-grow h-full">
    <div v-if="isLoading" class="absolute z-10 bottom-4 right-4">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>

    <div
      class="flex items-center content-center justify-center h-full"
      :class="{ 'gap-y-4': !is_collapsed, 'gap-y-2 ps-3': is_collapsed }"
    >
      <div class="">
        <div class="flex flex-col items-center gap-3" v-if="target.cold_probe_format === 'classic'">
          <div class="text-sm text-slate-7">Probe</div>
          <div
            class="flex gap-2"
            :class="{ 'flex-row-reverse': is_collapsed, 'flex-col': !is_collapsed }"
          >
            <div
              class="relative flex items-center justify-center flex-shrink-0 w-16 h-16 transition-all duration-300 border-2 rounded-full"
              :class="{
                'border-dotted ': !loading.yes,
                'border-lime-5 bg-lime-5': loading.yes || singleVariableResult.yes,
                'cursor-not-allowed': loading.yes && !loading.no,
                'pointer-events-none': sessionStore.session?.status !== 'ongoing',
                'cursor-pointer': !loading.yes && !loading.no
              }"
              @click="!loading.yes && !loading.no && onClickSingleVariable('yes')"
            >
              <div class="text-4xl font-bold">
                <Icon
                  icon="mingcute:check-fill"
                  class="w-20"
                  :class="
                    loading.yes
                      ? 'text-white'
                      : singleVariableResult.yes
                        ? 'text-white'
                        : 'text-slate-5'
                  "
                />
              </div>
            </div>
            <div
              class="relative flex items-center justify-center flex-shrink-0 w-16 h-16 transition-all duration-300 border-2 rounded-full"
              :class="{
                'border-dotted': !loading.no,
                'border-red-cherry bg-red-cherry': loading.no || singleVariableResult.no,
                'cursor-not-allowed': loading.no && !loading.yes,
                'pointer-events-none': sessionStore.session?.status !== 'ongoing',
                'cursor-pointer': !loading.no && !loading.yes
              }"
              @click="!loading.no && !loading.yes && onClickSingleVariable('no')"
            >
              <div class="text-4xl font-bold">
                <Icon
                  icon="mingcute:close-fill"
                  class="w-12"
                  :class="
                    loading.no
                      ? 'text-white'
                      : singleVariableResult.no
                        ? 'text-white'
                        : 'text-slate-5'
                  "
                />
              </div>
            </div>
          </div>
        </div>
        <div
          class="flex items-center justify-center gap-3"
          v-if="target.cold_probe_format === 'custom'"
        >
          <div v-for="(variable, index) in target.target_variables" :key="variable.id">
            <div class="flex flex-col items-center gap-3">
              <div :class="{ 'pl-1 pr-4': !is_collapsed }">
                <div class="text-sm text-slate-7">{{ variable.code }}</div>
              </div>
              <div
                class="flex gap-2"
                :class="{
                  'border-r-2':
                    index !== (target.target_variables ?? []).length - 1 && !is_collapsed,
                  'flex-row': is_collapsed,
                  'flex-col pl-1 pr-4': !is_collapsed
                }"
              >
                <!-- YES BUTTON -->
                <div
                  class="relative flex items-center justify-center flex-shrink-0 w-16 h-16 transition-all duration-300 border-2 rounded-full"
                  :class="{
                    'border-dotted': !loadingMultiple[variable?.id ?? ''],
                    'border-lime-5 bg-lime-5':
                      (loadingMultiple[variable.id ?? ''] &&
                        multipleVariableResult[variable.id ?? ''] === 'yes') ||
                      multipleVariableResult[variable.id ?? ''] === 'yes',
                    'cursor-not-allowed': loadingMultiple[variable.id ?? ''],
                    'pointer-events-none': sessionStore.session?.status !== 'ongoing',
                    'cursor-pointer': !loadingMultiple[variable.id ?? '']
                  }"
                  @click="
                    !loadingMultiple[variable.id ?? ''] &&
                      onClickMultipleVariable(variable.id ?? 0, 'yes')
                  "
                >
                  <div class="text-4xl font-bold">
                    <Icon
                      icon="mingcute:check-fill"
                      class="w-20"
                      :class="
                        loadingMultiple[variable?.id ?? ''] &&
                        multipleVariableResult[variable?.id ?? ''] === 'yes'
                          ? 'text-white'
                          : multipleVariableResult[variable?.id ?? ''] === 'yes'
                            ? 'text-white'
                            : 'text-slate-5'
                      "
                    />
                  </div>
                </div>

                <!-- NO BUTTON -->
                <div
                  class="relative flex items-center justify-center flex-shrink-0 w-16 h-16 transition-all duration-300 border-2 rounded-full"
                  :class="{
                    'border-dotted': !loadingMultiple[variable?.id ?? ''],
                    'border-red-cherry bg-red-cherry':
                      (loadingMultiple[variable?.id ?? ''] &&
                        multipleVariableResult[variable?.id ?? ''] === 'no') ||
                      multipleVariableResult[variable?.id ?? ''] === 'no',
                    'cursor-not-allowed': loadingMultiple[variable?.id ?? ''],
                    'pointer-events-none': sessionStore.session?.status !== 'ongoing',
                    'cursor-pointer': !loadingMultiple[variable?.id ?? '']
                  }"
                  @click="
                    !loadingMultiple[variable.id ?? ''] &&
                      onClickMultipleVariable(variable.id ?? 0, 'no')
                  "
                >
                  <div class="text-4xl font-bold">
                    <Icon
                      icon="mingcute:close-fill"
                      class="w-12"
                      :class="
                        loadingMultiple[variable?.id ?? ''] &&
                        multipleVariableResult[variable?.id ?? ''] === 'no'
                          ? 'text-white'
                          : multipleVariableResult[variable?.id ?? ''] === 'no'
                            ? 'text-white'
                            : 'text-slate-5'
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
