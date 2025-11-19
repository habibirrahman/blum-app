<script setup lang="ts">
import { useClientStore } from '@/stores/client.store'
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
const clientStore = useClientStore()

const currentJobId = ref<string>('')
const showing = ref<boolean>(false)
const cancelLoading = ref<boolean>(false)

const wasCompletedButHasFailed = computed(() => {
  if (!clientStore.client_target_job) return false
  const status = clientStore.client_target_job.status
  return (
    (status === 'completed' && clientStore.client_target_job.total_errors) || status === 'canceled'
  )
})

watch(
  () => clientStore.client_target_job,
  (val) => {
    setup(val)
  }
)

onMounted(() => {
  setup(clientStore.client_target_job)
})

const setup = (val: any) => {
  const clientId = clientStore.client?.id
  if (val && val.client_id === clientId) {
    if (currentJobId.value !== val.job_id) {
      showing.value = true
    }
    if (val.status === 'completed' || val.status === 'canceled') {
      setTimeout(() => {
        showing.value = false
      }, 5000)
    }
    currentJobId.value = val.job_id
  }
}

const onCancelJob = async () => {
  cancelLoading.value = true
  const data = { job_id: clientStore.client_target_job.job_id }
  await clientStore.cancelTargetJob({ data: { job_id: data.job_id } })
  cancelLoading.value = false
}
</script>

<template>
  <div
    class="overflow-hidden transition-all duration-300"
    :class="[showing ? 'h-15' : 'h-0']"
    :style="{ width: 'calc(100vw - 0.5rem)' }"
  >
    <div
      v-if="clientStore.client_target_job"
      class="h-15 flex items-center justify-between gap-2 rounded-b px-6"
      :class="[wasCompletedButHasFailed ? 'bg-[#FAEFCC]' : 'bg-[#F2FFE3]']"
    >
      <div class="flex items-center gap-2">
        <div
          class="grid h-10 w-10 flex-shrink-0 place-items-center"
          :style="{
            background: wasCompletedButHasFailed ? '#F7E5AA' : '#D1FAA1',
            borderRadius: '0.25rem'
          }"
        >
          <Icon
            v-if="wasCompletedButHasFailed"
            icon="fluent:warning-28-filled"
            class="text-[24px] text-[#e8b100]"
          />
          <Icon
            v-else-if="clientStore.client_target_job.status === 'completed'"
            icon="icon-park-solid:check-one"
            class="text-[24px] text-[#4b810e]"
          />
          <Icon v-else icon="radix-icons:update" class="animate-spin text-[24px] text-[#4b810e]" />
        </div>
        <div class="flex flex-col">
          <div v-if="wasCompletedButHasFailed" class="text-sm text-[#9B7600]">
            Some targets were not successfully added. Please review and retry for the unsuccessful
            targets.
          </div>

          <div
            v-else-if="clientStore.client_target_job.status === 'completed'"
            class="text-sm text-[#4b810e]"
          >
            The process of adding targets to the client from the databank is complete. You can now
            resume adding new targets.
          </div>
          <div v-else class="text-sm text-[#4b810e]">
            Targets are currently being added to the client from the databank. Please wait until the
            process is complete to add new targets.
          </div>
          <div
            v-if="
              clientStore.client_target_job.status === 'completed' ||
              clientStore.client_target_job.status === 'canceled'
            "
            class="flex items-center gap-2"
          >
            <span
              class="text-sm font-semibold"
              :class="[wasCompletedButHasFailed ? 'text-[#9B7600]' : 'text-[#4b810e]']"
            >
              Successful targets added: {{ clientStore.client_target_job.total_success }}
            </span>
            <div
              :class="[wasCompletedButHasFailed ? 'bg-[#9B7600]' : 'bg-[#4b810e]']"
              class="h-1 w-1 rounded-full opacity-50"
            />
            <span
              class="text-sm font-semibold"
              :class="[wasCompletedButHasFailed ? 'text-[#9B7600]' : 'text-[#4b810e]']"
            >
              Failed targets: {{ clientStore.client_target_job.total_errors }}
            </span>
          </div>
          <span v-else class="text-sm font-semibold text-[#4b810e]">
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
          class="flex h-8 items-center justify-center rounded border border-lime-500 px-4 outline-none"
          :class="
            cancelLoading
              ? 'bg-grey-100 cursor-wait'
              : 'hover:bg-grey-200 cursor-pointer bg-pure-white'
          "
          :disabled="cancelLoading"
          @click.prevent="onCancelJob"
        >
          <label
            class="text-sm font-semibold tracking-wide text-lime-700"
            :class="cancelLoading ? 'cursor-wait' : 'cursor-pointer'"
          >
            Cancel import
          </label>
        </button>
      </div>
    </div>
  </div>
</template>
