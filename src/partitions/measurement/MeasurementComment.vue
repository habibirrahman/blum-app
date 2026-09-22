<script setup lang="ts">
import { useSessionStore, type UpdateMeasurementParams } from '@/stores/session.store'
import { onMounted, onUnmounted, ref, watch } from 'vue'
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
  const { success, data } = await sessionStore.getMeasurementComment({
    measurement_id: props.measurementId
  })
  fetchLoading.value = false

  if (!success) return

  measurement.value = data
  commentOrigin.value = data.comment || ''
  commentInput.value = data.comment || ''
}

const checkIsServerVsClientDifference = async () => {
  const payload = {
    url: `/api/v1/measurements/${props.measurementId}`
  }

  const { success, data } = await appStore.actionGet(payload)

  if (!success) return true

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
    <div v-if="fetchLoading" class="flex min-h-40 w-full grow items-center justify-center">
      <Icon icon="mingcute:loading-fill" class="text-light-purple animate-spin text-6xl" />
    </div>

    <!-- Content -->
    <div v-else class="flex w-full grow flex-col gap-2">
      <template v-if="isCommentConflicted">
        <div class="text-sm text-slate-8">
          We have detected conflicts for this comment. Please resolve it before saving.
        </div>

        <div class="mt-2 flex items-center justify-between border-slate-4">
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

        <div class="grid w-full grow grid-cols-2 gap-2">
          <div class="flex w-full grow flex-col gap-1">
            <div class="text-xs text-slate-8">Your comment:</div>
            <div
              class="w-full grow whitespace-pre-line rounded border p-3 text-sm"
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

          <div class="flex w-full grow flex-col gap-1">
            <div class="text-xs text-slate-8">Others comment:</div>
            <div
              class="w-full grow whitespace-pre-line rounded border p-3 text-sm"
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

    <!-- Button -->
    <div class="mt-3 grid grid-cols-2 gap-3">
      <AppButton kind="plain" size="sm" @click="emit('close')">Cancel</AppButton>
      <AppButton
        kind="primary"
        size="sm"
        :loading="saveLoading"
        :disabled="disabled || fetchLoading"
        @click="onSaveComment"
      >
        <template v-if="!isCommentConflicted">Save</template>
        <template v-else>Resolve & Save</template>
      </AppButton>
    </div>
  </div>
</template>
