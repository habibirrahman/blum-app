<script setup lang="ts">
import { useClientStore } from '@/stores/client.store'
import { useAppStore } from '@/stores/app.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { TransitionChild, TransitionRoot } from '@headlessui/vue'
const clientStore = useClientStore()
const appStore = useAppStore()

const currentJobId = ref<string>('')
const showing = ref<boolean>(false)
const cancelLoading = ref<boolean>(false)

const wasCompletedButHasFailed = computed(() => {
  if (!clientStore.client_target_job) return false
  const status = clientStore.client_target_job.status
  return (
    (status === 'completed' && clientStore.client_target_job.total_errors) || status === 'cancelled'
  )
})

watch(
  () => appStore.network_status.connected,
  (val) => {
    if (val && clientStore.client_target_job) {
      if (
        clientStore.client_target_job.status === 'in_progress' ||
        clientStore.client_target_job.status === 'pending'
      ) {
        clientStore.checkTargetJob({
          data: {
            client_id: clientStore.client?.id as number,
            job_id: clientStore.client_target_job.job_id
          }
        })
      }
    }
  }
)

watch(
  () => clientStore.client_target_job,
  (val) => {
    setup(val)
  }
)

const setupTimeout = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const setup = (val: any) => {
  const clientId = clientStore.client?.id
  if (val && val.client_id === clientId) {
    if (currentJobId.value !== val.job_id) {
      showing.value = true
    }
    if (val.status === 'completed' || val.status === 'cancelled') {
      setupTimeout.value = setTimeout(() => {
        showing.value = false
        currentJobId.value = ''
        clientStore.client_target_job = ''
      }, 5000)

      return () => {
        if (setupTimeout.value) {
          clearTimeout(setupTimeout.value)
          setupTimeout.value = undefined
        }
      }
    }
    currentJobId.value = val.job_id
  } else {
    showing.value = false
  }
}

const onCancelJob = async () => {
  cancelLoading.value = true
  const data = { job_id: clientStore.client_target_job.job_id }
  await clientStore.cancelTargetJob({ data: { job_id: data.job_id } })
  cancelLoading.value = false
}

onMounted(() => {
  setup(clientStore.client_target_job)
})

onUnmounted(() => {
  // Clear timeout to prevent memory leaks
  if (setupTimeout.value) {
    clearTimeout(setupTimeout.value)
    setupTimeout.value = undefined
  }
})
</script>

<template>
  <TransitionRoot :show="showing">
    <TransitionChild
      enter="transition opacity ease-in-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="transition opacity ease-in-out duration-300"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div
        v-if="clientStore.client_target_job"
        class="h-15 flex items-center justify-between gap-2 rounded-b px-2 py-1"
        :class="[wasCompletedButHasFailed ? 'bg-[#FAEFCC]' : 'bg-[#F2FFE3]']"
      >
        <div class="flex items-center gap-2">
          <div
            class="grid h-[24px] w-[24px] flex-shrink-0 place-items-center"
            :style="{
              background: wasCompletedButHasFailed ? '#F7E5AA' : '#D1FAA1',
              borderRadius: '0.25rem'
            }"
          >
            <Icon
              v-if="wasCompletedButHasFailed"
              icon="fluent:warning-28-filled"
              class="text-[18px] text-[#9B7600]"
            />
            <Icon
              v-else-if="clientStore.client_target_job.status === 'completed'"
              icon="icon-park-solid:check-one"
              class="text-[18px] text-[#4b810e]"
            />
            <Icon
              v-else
              icon="radix-icons:update"
              class="animate-spin text-[18px] text-[#4b810e]"
            />
          </div>
          <div class="flex flex-col">
            <div v-if="wasCompletedButHasFailed" class="text-xs text-[#9B7600]">
              Adding targets from the databank is complete. You can now add new targets.
            </div>

            <div
              v-else-if="clientStore.client_target_job.status === 'completed'"
              class="text-xs text-[#4b810e]"
            >
              Adding targets from the databank is complete. You can now add new targets.
            </div>
            <div v-else class="text-xs text-[#4b810e]">
              Targets are being added from the databank. Please wait to add new targets.
            </div>
            <div
              v-if="
                clientStore.client_target_job.status === 'completed' ||
                clientStore.client_target_job.status === 'cancelled'
              "
              class="flex items-center gap-2"
            >
              <span
                class="text-xs font-semibold"
                :class="[wasCompletedButHasFailed ? 'text-[#9B7600]' : 'text-[#4b810e]']"
              >
                Successful targets added: {{ clientStore.client_target_job.total_success }}
              </span>
              <div
                :class="[wasCompletedButHasFailed ? 'bg-[#9B7600]' : 'bg-[#4b810e]']"
                class="h-1 w-1 rounded-full opacity-50"
              />
              <span
                class="text-xs font-semibold"
                :class="[wasCompletedButHasFailed ? 'text-[#9B7600]' : 'text-[#4b810e]']"
              >
                Failed targets: {{ clientStore.client_target_job.remaining_targets }}
              </span>
            </div>
            <span v-else class="text-xs font-semibold text-[#4b810e]">
              Remaining targets: {{ clientStore.client_target_job.remaining_targets }}
            </span>
          </div>
        </div>
        <div
          v-if="
            clientStore.client_target_job.status === 'in_progress' ||
            clientStore.client_target_job.status === 'pending'
          "
        >
          <button
            class="flex h-7 items-center justify-center rounded border border-lime-500 px-2 outline-none"
            :class="
              cancelLoading
                ? 'bg-grey-100 cursor-wait'
                : 'hover:bg-grey-200 cursor-pointer bg-pure-white'
            "
            :disabled="cancelLoading"
            @click.prevent="onCancelJob"
          >
            <label
              class="text-xs font-semibold tracking-wide text-lime-700"
              :class="cancelLoading ? 'cursor-wait' : 'cursor-pointer'"
            >
              Cancel
            </label>
          </button>
        </div>
      </div>
    </TransitionChild>
  </TransitionRoot>
</template>
