<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  useSessionStore,
  type DeleteSessionCommentParams,
  type UpdateSessionCommentParams
} from '@/stores/session.store'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import AppButton from '@/components/AppButton.vue'
import type { Comment } from '@/lib/types'
import { TransitionRoot } from '@headlessui/vue'
import { displayDate } from '@/lib/func'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { useToast } from 'vue-toastification'

const appStore = useAppStore()
const toast = useToast()
const sessionStore = useSessionStore()

interface Props {
  comment: Comment
  actionable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  actionable: false
})

const showAction = ref<boolean>(false)

const showEdit = ref<boolean>(false)
type CommentType = 'general' | 'assessment'
const typeInput = ref<CommentType>('general')
const bodyInput = ref<string>('')
const antecedentInput = ref<string>('')
const behaviorInput = ref<string>('')
const consequenceInput = ref<string>('')
const imagePreviewOpened = ref<boolean>(false)
const currentImageIndex = ref<number>(0)
watch(showEdit, (val) => {
  if (val) {
    typeInput.value = props.comment.type === 'Assessment::InSession' ? 'assessment' : 'general'
    bodyInput.value = props.comment.body || ''
    antecedentInput.value = props.comment.antecedent || ''
    behaviorInput.value = props.comment.behavior || ''
    consequenceInput.value = props.comment.consequence || ''
  }
})
const updateLoading = ref<boolean>(false)
const isDisabledUpdate = computed<boolean>(() => {
  if (typeInput.value === 'general') {
    if (bodyInput.value === props.comment.body) return true
  }
  if (typeInput.value === 'assessment') {
    if (
      antecedentInput.value === props.comment.antecedent &&
      behaviorInput.value === props.comment.behavior &&
      consequenceInput.value === props.comment.consequence
    )
      return true
  }
  return false
})
const onUpdate = async () => {
  const params: UpdateSessionCommentParams = {
    client_id: sessionStore.session?.client_id,
    comment_id: props.comment.id,
    type: typeInput.value,
    session_comment: {
      user_id: appStore.account?.id,
      body: bodyInput.value
    },
    assessment: {
      session_id: sessionStore.session?.id,
      antecedent: antecedentInput.value,
      behavior: behaviorInput.value,
      consequence: consequenceInput.value,
      type: 'Assessment::InSession'
    },
    data_result: {
      ...props.comment,
      body: bodyInput.value,
      antecedent: antecedentInput.value,
      behavior: behaviorInput.value,
      consequence: consequenceInput.value
    }
  }
  updateLoading.value = true
  const { success } = await sessionStore.updateSessionComment(params)
  updateLoading.value = false
  if (!success) return
  showEdit.value = false
  showAction.value = false
}

const showRemove = ref<boolean>(false)
const deleteLoading = ref<boolean>(false)
const onDelete = async () => {
  const params: DeleteSessionCommentParams = {
    client_id: sessionStore.session?.client_id,
    comment_id: props.comment.id,
    type: props.comment.type === 'Assessment::InSession' ? 'assessment' : 'general'
  }
  deleteLoading.value = true
  const { success } = await sessionStore.deleteSessionComment(params)
  deleteLoading.value = false
  if (!success) return
  toast.success('The comment has been deleted.')
  showRemove.value = false
  showAction.value = false
}
const showImage = (index: number) => {
  currentImageIndex.value = index
  imagePreviewOpened.value = true
}
</script>

<template>
  <div
    class="w-full transition duration-300 ease-in-out transform"
    :class="{
      'fixed top-1/3 z-[1000] -translate-x-4 -translate-y-1/2 px-4': showAction
    }"
  >
    <div
      class="w-full px-4 py-3 space-y-2 bg-white border rounded border-prim-4"
      :class="{ 'pointer-events-none': !actionable }"
      :style="{ boxShadow: !showAction ? '4px 4px 0px 0px #D6C7E066' : '' }"
      @click.self="showAction = !showAction"
    >
      <div @click="showAction = !showAction" class="flex items-center justify-between gap-4">
        <div
          v-if="comment.user_name"
          class="flex items-center h-5 p-2 truncate rounded-full bg-lime-4"
        >
          <div class="text-xs font-medium truncate text-lime-9">{{ comment.user_name }}</div>
        </div>
        <div
          v-if="comment.target_name"
          class="flex items-center h-5 p-2 truncate rounded-full bg-slate-3"
        >
          <div class="text-xs font-medium truncate text-slate-8">{{ comment.target_name }}</div>
        </div>
        <div class="text-xs text-slate-8">{{ displayDate({ date: comment.created_at }) }}</div>
      </div>
      <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
      <div v-if="comment.type === 'Assessment::InSession'" class="space-y-2">
        <div @click="showAction = !showAction" class="space-y-2">
          <div class="space-y-1">
            <div class="text-sm text-slate-7">Antecedent</div>
            <div
              class="text-sm whitespace-pre-line text-slate-8"
              :class="{
                'line-clamp-3': showAction && !comment.images,
                'line-clamp-1': showAction && comment.images
              }"
              v-html="comment.antecedent || '-'"
            ></div>
          </div>
          <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
          <div class="space-y-1">
            <div class="text-sm text-slate-7">Behavior</div>
            <div
              class="text-sm whitespace-pre-line text-slate-8"
              :class="{
                'line-clamp-3': showAction && !comment.images,
                'line-clamp-1': showAction && comment.images
              }"
              v-html="comment.behavior || '-'"
            ></div>
          </div>
          <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
          <div class="space-y-1">
            <div class="text-sm text-slate-7">Consequence</div>
            <div
              class="text-sm whitespace-pre-line text-slate-8"
              :class="{
                'line-clamp-3': showAction && !comment.images,
                'line-clamp-1': showAction && comment.images
              }"
              v-html="comment.consequence || '-'"
            ></div>
          </div>
        </div>
        <div v-if="comment.images" class="flex gap-2 mt-2">
          <div v-for="(image, index) in comment.images" :key="image.id">
            <img
              :src="image.file_url"
              :alt="image.file_name"
              @click.stop="showImage(index)"
              class="mb-2 rounded-lg cursor-pointer"
              :class="{
                'h-16 w-16 object-cover': comment.images.length > 0,
                'h-20 w-20 object-cover': comment.images.length === 1 && showAction
              }"
            />
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col">
        <div
          @click="showAction = !showAction"
          class="text-sm whitespace-pre-line text-slate-8"
          :class="{ ' line-clamp-[6]': showAction }"
          v-html="comment.body || ''"
        ></div>
        <div
          v-if="comment.images"
          class="flex gap-2 mt-2"
          :class="{
            'items-center justify-center': comment.images.length === 1 && !showAction
          }"
        >
          <div v-for="(image, index) in comment.images" :key="image.id">
            <img
              :src="image.file_url"
              :alt="image.file_name"
              @click.stop="showImage(index)"
              class="mb-2 rounded-lg cursor-pointer"
              :class="{
                'h-16 w-16 object-cover': comment.images.length > 1,
                'h-76 w-76 object-cover': comment.images.length === 1 && !showAction,
                'h-20 w-20 object-cover': comment.images.length === 1 && showAction
              }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <AppActionSheet :show="showAction" @close="showAction = false">
    <div class="space-y-4">
      <div class="flex justify-end" @click="showAction = false">
        <Icon icon="ph:x" class="text-2xl" />
      </div>
      <div>
        <div class="flex h-[52px] w-full items-center gap-2" @click="showEdit = true">
          <Icon icon="ph:pencil-simple" class="text-xl text-slate-7" />
          <div class="text-sm">Edit</div>
        </div>
        <div class="w-full h-px bg-slate-3"></div>
        <div class="flex h-[52px] w-full items-center gap-2" @click="showRemove = true">
          <Icon icon="ph:trash" class="text-xl text-slate-7" />
          <div class="text-sm">Delete</div>
        </div>
      </div>
    </div>

    <AppActionSheet :show="showRemove" @close="showRemove = false">
      <div class="flex flex-col items-center gap-4">
        <div class="text-xl font-semibold text-center">Delete this comment?</div>
        <div class="text-sm text-center">
          Are you sure you want to delete this comment? This action cannot be undone.
        </div>
        <div class="grid w-full grid-cols-2 gap-2">
          <AppButton kind="plain" @click="showRemove = false">Cancel</AppButton>
          <AppButton :loading="deleteLoading" @click="onDelete">Delete</AppButton>
        </div>
      </div>
    </AppActionSheet>
  </AppActionSheet>

  <TransitionRoot
    :show="showEdit"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-75"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-75"
    class="fixed left-0 top-0 z-[1001] h-screen w-screen bg-white p-safe"
  >
    <div class="fixed top-0 z-[999999] w-screen bg-white pt-safe"></div>
    <div class="fixed bottom-0 z-[999999] w-screen bg-white pb-safe"></div>

    <div class="sticky top-0 z-[10] flex h-[52px] shrink-0 items-center gap-3 bg-white px-4">
      <div
        class="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-slate-2"
        @click="showEdit = false"
      >
        <Icon icon="ph:caret-left" class="text-slate-7" />
      </div>
      <div class="text-2xl text-[22px] font-bold">Edit comments</div>
    </div>
    <div class="h-[calc(100vh-52px-64px)]">
      <AppTextInput
        v-if="typeInput === 'general'"
        name="new-comment-body"
        type="textarea"
        placeholder="Type your comment here..."
        v-model="bodyInput"
        borderless
        class="h-full px-4"
      />
      <div v-if="typeInput === 'assessment'" class="h-full space-y-2">
        <div class="px-4 text-sm font-medium text-slate-7">Antecedent</div>
        <AppTextInput
          name="new-comment-antecedent"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="antecedentInput"
          borderless
          class="h-[20vh] px-4"
        />
        <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
        <div class="px-4 text-sm font-medium text-slate-7">Behavior</div>
        <AppTextInput
          name="new-comment-behavior"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="behaviorInput"
          borderless
          class="h-[20vh] px-4"
        />
        <div class="h-0.5 w-full shrink-0 bg-slate-3"></div>
        <div class="px-4 text-sm font-medium text-slate-7">Consequence</div>
        <AppTextInput
          name="new-comment-consequence"
          type="textarea"
          placeholder="Type your comment here..."
          v-model="consequenceInput"
          borderless
          class="h-[20vh] px-4"
        />
      </div>
    </div>
    <div class="fixed bottom-0 w-screen bg-white px-safe pb-safe">
      <div class="flex items-center h-16 px-4 grow">
        <AppButton
          class="w-full"
          :loading="updateLoading"
          :disabled="isDisabledUpdate"
          @click="onUpdate"
        >
          Update
        </AppButton>
      </div>
    </div>
  </TransitionRoot>
  <TransitionRoot
    :show="imagePreviewOpened && !showAction"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-95"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-95"
    class="fixed -top-4 left-0 z-[1000] h-screen w-screen bg-[#1d2939]"
  >
    <div class="relative w-full h-full">
      <div class="absolute z-20 flex items-center justify-between w-full gap-3 px-3 top-4 pt-safe">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer bg-pure-white backdrop-blur-sm"
            @click="imagePreviewOpened = false"
          >
            <Icon icon="ph:x" class="text-xl text-slate-7" />
          </div>
          <div
            v-if="comment.user_name"
            class="flex items-center h-5 p-2 truncate rounded-full bg-lime-4"
          >
            <div class="text-xs font-medium truncate text-lime-9">{{ comment.user_name }}</div>
          </div>
        </div>
        <div class="text-pure-white">
          {{ displayDate({ date: comment?.images?.[currentImageIndex]?.created_at ?? '' }) }}
        </div>
      </div>

      <!-- Image -->
      <div class="flex items-center justify-center h-full">
        <img
          :src="comment?.images?.[currentImageIndex]?.file_url"
          :alt="comment?.images?.[currentImageIndex]?.file_name"
          class="max-h-[50vh] max-w-[100vw] object-contain"
        />
      </div>

      <!-- Navigation arrows -->
      <div
        v-if="(comment?.images ?? []).length > 1"
        class="absolute inset-y-0 left-0 right-0 flex items-center justify-between"
      >
        <!-- Left arrow -->
        <div
          class="flex items-center justify-center w-12 h-12 ml-4 rounded-full bg-pure-white backdrop-blur-sm"
          :class="{
            'cursor-pointer': currentImageIndex > 0,
            'opacity-50': currentImageIndex === 0
          }"
          @click="currentImageIndex > 0 && currentImageIndex--"
        >
          <Icon icon="ph:caret-left" class="text-2xl text-slate-7" />
        </div>

        <!-- Right arrow -->
        <div
          class="flex items-center justify-center w-12 h-12 mr-4 rounded-full bg-pure-white backdrop-blur-sm"
          :class="{
            'cursor-pointer': currentImageIndex < (comment?.images?.length ?? 0) - 1,
            'opacity-50': currentImageIndex === (comment?.images?.length ?? 0) - 1
          }"
          @click="currentImageIndex < (comment?.images?.length ?? 0) - 1 && currentImageIndex++"
        >
          <Icon icon="ph:caret-right" class="text-2xl text-slate-7" />
        </div>
      </div>
    </div>
  </TransitionRoot>
</template>
