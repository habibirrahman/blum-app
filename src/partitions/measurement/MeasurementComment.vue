<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementParams } from '@/stores/session.store'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { type Measurement } from '@/lib/types'
import { useToast } from 'vue-toastification'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@iconify/vue/dist/iconify.js'

interface Props {
  measurementId: Measurement['id']
  disabled?: boolean
}
interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<Emits>()

const toast = useToast()
const appStore = useAppStore()
const sessionStore = useSessionStore()

/** === DATA === */

const measurement = ref<Measurement | null>(null)

const fetchLoading = ref(false)
const saveLoading = ref(false)
const isCommentConflicted = ref(false)

const commentOrigin = ref('') // comment get from server after open comment section
const commentInput = ref('') // comment input by user
const commentIncomingChange = ref('') // comment get from server before save
const commentCurrentChange = ref('') // comment from user

const acceptType = ref<'current' | 'incoming' | 'both'>('current')

/** === COMPUTEDS === */

const isOnline = computed<boolean>(() => appStore.network_status.connected)
const originalMeasurement = computed<Measurement | null>(
  () => sessionStore.session_measurements.find((i) => i.id === props.measurementId) || null
)

// const isDisabledSaveComment = computed<boolean>(
//   () => commentInput.value === (props.measurement.comment || '')
// )

/** === WATCHERS === */

watch(
  () => acceptType.value,
  (val) => {
    // 'current' | 'incoming' | 'both'

    switch (val) {
      case 'current':
        commentInput.value = commentCurrentChange.value
        break
      case 'incoming':
        commentInput.value = commentIncomingChange.value
        break
      case 'both':
        commentInput.value = `${commentCurrentChange.value}\n\n${commentIncomingChange.value}`
        break
    }
  }
)

/** === METHODS === */

const fetchComment = async () => {
  fetchLoading.value = true
  const { success, data: res } = await sessionStore.getMeasurementComment({
    measurement_id: props.measurementId
  })
  fetchLoading.value = false

  let data = res
  if (!isOnline.value) {
    data = originalMeasurement.value
  }

  if (!success && isOnline.value) return

  measurement.value = data
  commentOrigin.value = data.comment || ''
  commentInput.value = data.comment || ''
}

const checkIsServerVsClientDifference = async () => {
  const payload = {
    url: `/api/v1/measurements/${props.measurementId}`
  }

  const { success, data: res } = await appStore.actionGet(payload)

  let data = res
  if (!isOnline.value) {
    data = originalMeasurement.value
  }

  if (!success && isOnline.value) return

  measurement.value = data
  commentIncomingChange.value = data.comment || ''
  if (commentIncomingChange.value !== commentOrigin.value) {
    commentOrigin.value = data.comment || ''
    return true
  }

  commentOrigin.value = data.comment || ''
  return false
}

const onSaveComment = async () => {
  if (saveLoading.value) return
  if (props.disabled) return

  saveLoading.value = true

  isCommentConflicted.value = false
  if (await checkIsServerVsClientDifference()) {
    // If true, means there is a difference, and the user needs to resolve it.
    commentCurrentChange.value = commentInput.value || ''
    acceptType.value = 'current'
    isCommentConflicted.value = true
    saveLoading.value = false
    return
  }

  const payload: UpdateMeasurementParams = {
    id: props.measurementId,
    params: { measurement: { comment: commentInput.value } },
    dataResult: { ...measurement.value, comment: commentInput.value },
    isComment: true
  }

  // record session activities
  await sessionStore.addSessionActivity({
    action_label: `comment_save`,
    recordable: 'Measurement',
    recordable_id: props.measurementId,
    api: `PATCH /api/v1/measurements/${props.measurementId}`,
    params: payload.params,
    notes: `Target: ${measurement.value?.target?.name}`,
    timestamp: new Date().toISOString()
  })

  const { success, message } = await sessionStore.updateMeasurement(payload)
  saveLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }

  toast.success('The comment has been saved.')
  resetField()

  emit('close')
}

const resetField = () => {
  measurement.value = null
  commentOrigin.value = ''
  commentInput.value = ''
  commentIncomingChange.value = ''
  commentCurrentChange.value = ''
  isCommentConflicted.value = false
  acceptType.value = 'current'
}

onMounted(async () => {
  resetField()
  await fetchComment()
})

onUnmounted(() => {
  resetField()
})
</script>

<template>
  <div class="flex h-[calc(100%-44px)] flex-col justify-between gap-3">
    <!-- Loading -->
    <div v-if="fetchLoading" class="flex justify-center items-center w-full min-h-40 grow">
      <Icon icon="mingcute:loading-fill" class="text-6xl animate-spin text-light-purple" />
    </div>

    <!-- Content -->
    <div v-else class="flex flex-col gap-2 w-full grow">
      <template v-if="isCommentConflicted">
        <div class="text-sm text-slate-8">
          We have detected conflicts for this comment. Please resolve it before saving.
        </div>

        <div class="flex justify-between items-center mt-2 border-slate-4">
          <div class="text-sm text-slate-10">Accept:</div>
          <div class="flex shrink-0">
            <AppButton
              :kind="acceptType === 'current' ? 'primary' : 'outline'"
              size="sm"
              class="rounded-r-none"
              @click="acceptType = 'current'"
            >
              Current
            </AppButton>
            <AppButton
              :kind="acceptType === 'incoming' ? 'primary' : 'outline'"
              size="sm"
              class="rounded-none"
              @click="acceptType = 'incoming'"
            >
              Incoming
            </AppButton>
            <AppButton
              :kind="acceptType === 'both' ? 'primary' : 'outline'"
              size="sm"
              class="rounded-l-none"
              @click="acceptType = 'both'"
            >
              Both
            </AppButton>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 w-full grow">
          <div class="flex flex-col gap-1 w-full grow">
            <div class="text-xs text-slate-8">Your comment:</div>
            <div
              class="p-3 w-full text-sm whitespace-pre-line rounded border grow"
              :class="[
                acceptType === 'current' || acceptType === 'both'
                  ? 'border-light-purple-5'
                  : 'border-slate-4',
                !commentCurrentChange ? 'italic text-slate-6' : 'text-slate-8'
              ]"
            >
              {{ commentCurrentChange || 'No comment' }}
            </div>
          </div>

          <div class="flex flex-col gap-1 w-full grow">
            <div class="text-xs text-slate-8">Others comment:</div>
            <div
              class="p-3 w-full text-sm whitespace-pre-line rounded border grow"
              :class="[
                acceptType === 'incoming' || acceptType === 'both'
                  ? 'border-light-purple-5'
                  : 'border-slate-4',
                !commentIncomingChange ? 'italic text-slate-6' : 'text-slate-8'
              ]"
            >
              {{ commentIncomingChange || 'No comment' }}
            </div>
          </div>
        </div>

        <div class="mt-2 text-sm text-slate-10">Resolve:</div>
      </template>

      <AppTextInput
        :name="`measurement-comment-${measurementId}`"
        type="textarea"
        placeholder="Type your comment here..."
        v-model="commentInput"
        :disabled="disabled"
        class="h-full"
      />
    </div>

    <div v-if="!isOnline" class="p-2 rounded bg-tomato-7">
      <div class="text-xs text-white">
        You are currently offline. You can't save this comment until your connection is back.
      </div>
    </div>

    <!-- Button -->
    <div class="grid grid-cols-2 gap-3 mt-3">
      <AppButton kind="plain" size="sm" @click="emit('close')">Cancel</AppButton>
      <AppButton
        kind="primary"
        size="sm"
        :loading="saveLoading"
        :disabled="disabled || fetchLoading || !isOnline"
        @click="onSaveComment"
      >
        <template v-if="!isCommentConflicted">Save</template>
        <template v-else>Resolve & Save</template>
      </AppButton>
    </div>
  </div>
</template>
