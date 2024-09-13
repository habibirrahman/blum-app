<script setup lang="ts">
import {
  useSessionStore,
  type CreateSessionCommentParams,
  type SessionCommentFilter
} from '@/stores/session.store'
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useAppStore } from '@/stores/app.store'
import AppButton from '@/components/AppButton.vue'
import { TransitionRoot } from '@headlessui/vue'
import CommentItem from './CommentItem.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { getRandomString } from '@/lib/func'
import moment from 'moment'

const appStore = useAppStore()
const sessionStore = useSessionStore()

interface Props {
  show?: boolean
}
interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  show: false
})
const emit = defineEmits<Emits>()

const commentsLoading = ref<boolean>(false)

const filter = ref<SessionCommentFilter>('')
const filterOptions: { value: SessionCommentFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'assessment', label: 'ABC data' },
  { value: 'target', label: 'From targets' },
  { value: 'mine', label: 'Added by you' }
]

async function fetchComments() {
  commentsLoading.value = true
  const id = sessionStore.session?.id
  const { success } = await sessionStore.getSessionComments({ id, filter: filter.value })
  commentsLoading.value = false
  if (!success) return
  document.getElementById('session-comments')?.scroll({ top: 0, behavior: 'smooth' })
}

watch(
  () => props.show,
  (val) => {
    if (val) fetchComments()
  }
)
watch(filter, () => {
  fetchComments()
})

const showNew = ref<boolean>(false)
type CommentType = 'general' | 'assessment'
const typeInput = ref<CommentType>('general')
const typeInputOptions: { value: CommentType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'assessment', label: 'ABC data' }
]
const bodyInput = ref<string>('')
const antecedentInput = ref<string>('')
const behaviorInput = ref<string>('')
const consequenceInput = ref<string>('')
watch(showNew, (val) => {
  if (val) {
    if (filter.value === 'assessment') typeInput.value = 'assessment'
    else typeInput.value = 'general'
    bodyInput.value = ''
    antecedentInput.value = ''
    behaviorInput.value = ''
    consequenceInput.value = ''
  }
})
const createLoading = ref<boolean>(false)
const isDisabledCreate = computed<boolean>(() => {
  if (typeInput.value === 'general') {
    if (!bodyInput.value) return true
  }
  if (typeInput.value === 'assessment') {
    if (!antecedentInput.value && !behaviorInput.value && !consequenceInput.value) return true
  }
  return false
})
const onCreate = async () => {
  const params: CreateSessionCommentParams = {
    client_id: sessionStore.session?.client_id,
    session_id: sessionStore.session?.id,
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
      id: getRandomString(),
      body: bodyInput.value,
      is_edited: false,
      user_id: appStore.account?.id,
      user_name: appStore.account?.name,
      antecedent: antecedentInput.value,
      behavior: behaviorInput.value,
      consequence: consequenceInput.value,
      type: typeInput.value === 'assessment' ? 'Assessment::InSession' : undefined,
      client_id: sessionStore.session?.client_id,
      session_id: sessionStore.session?.id,
      created_at: moment().format(),
      updated_at: moment().format()
    }
  }
  createLoading.value = true
  const { success } = await sessionStore.createSessionComment(params)
  createLoading.value = false
  if (!success) return
  showNew.value = false
}
</script>

<template>
  <TransitionRoot
    :show="show"
    enter="transition ease-in-out duration-300 transform"
    enter-from="-translate-x-full"
    enter-to="translate-x-0"
    leave="transition ease-in-out duration-300 transform"
    leave-from="translate-x-0"
    leave-to="-translate-x-full"
    id="session-comments"
    class="fixed left-0 top-0 z-[20] h-screen w-screen overflow-y-auto bg-prim-3"
  >
    <div
      v-if="commentsLoading"
      class="fixed z-[99] grid h-screen w-screen place-content-center bg-slate-10/30"
    >
      <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-1" />
    </div>
    <div class="sticky top-0 z-[10] shrink-0">
      <div class="flex h-[52px] items-center gap-3 bg-white px-4">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-2"
          @click="emit('close')"
        >
          <Icon icon="ph:caret-left" class="text-slate-7" />
        </div>
        <div class="text-2xl text-[22px] font-bold">Comments</div>
      </div>
      <div class="bg-prim-3 pl-4">
        <div
          class="flex h-12 snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth pr-4"
        >
          <div
            v-for="opt in filterOptions"
            :key="opt.value"
            class="flex h-8 shrink-0 cursor-pointer snap-start items-center rounded-full border px-3 text-xs font-medium transition-all"
            :class="[
              filter === opt.value
                ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
                : 'border-slate-4 bg-white'
            ]"
            @click="filter = filter === opt.value ? '' : opt.value"
          >
            {{ opt.label }}
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="!sessionStore.session_comments.length"
      class="flex h-64 w-full items-center justify-center px-4 py-4 text-center text-sm text-light-purple-5"
    >
      Be the first to add a comment to this session.
    </div>
    <div v-else class="space-y-4 px-4 pb-24 pt-4">
      <CommentItem
        v-for="comment in sessionStore.session_comments"
        :key="comment.id"
        :comment="comment"
        :actionable="
          comment.user_id === appStore.account?.id &&
          !comment.measurement_id &&
          sessionStore.session?.status === 'ongoing'
        "
      />
    </div>
    <div
      v-if="sessionStore.session?.status === 'ongoing'"
      class="fixed bottom-0 flex h-20 w-full items-center justify-center transition-all"
      :class="{ 'opacity-0': filter === 'target' }"
    >
      <div
        class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-light-purple-5"
        :style="{ boxShadow: '2px 2px 0px 0px #D6C7E066' }"
        @click="showNew = true"
      >
        <Icon icon="ph:plus" class="text-3xl text-white" />
      </div>
    </div>
  </TransitionRoot>

  <TransitionRoot
    :show="showNew"
    enter="transition-all duration-300 ease-out"
    enter-from="opacity-0 scale-75"
    enter-to="opacity-100 scale-100"
    leave="transition-all duration-200 ease-in"
    leave-from="opacity-100 scale-100"
    leave-to="opacity-0 scale-75"
    class="fixed left-0 top-0 z-[21] min-h-screen w-screen bg-white"
  >
    <div class="sticky top-0 z-[10] flex h-[52px] shrink-0 items-center gap-3 bg-white px-4">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-2"
        @click="showNew = false"
      >
        <Icon icon="ph:caret-left" class="text-slate-7" />
      </div>
      <div class="text-2xl text-[22px] font-bold">Add new comments</div>
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
    <div class="fixed bottom-0 flex h-16 w-full items-center justify-between bg-white px-4">
      <div class="flex items-center gap-2">
        <div
          v-for="opt in typeInputOptions"
          :key="opt.value"
          class="flex h-8 shrink-0 cursor-pointer snap-start items-center rounded-full border px-3 text-xs font-medium transition-all"
          :class="[
            typeInput === opt.value
              ? 'border-light-purple-2 bg-prim-1 text-dark-purple-1'
              : 'border-slate-4 bg-white'
          ]"
          @click="typeInput = opt.value"
        >
          {{ opt.label }}
        </div>
      </div>
      <AppButton :loading="createLoading" :disabled="isDisabledCreate" @click="onCreate">
        <div>Add</div>
        <Icon icon="ph:plus-bold" />
      </AppButton>
    </div>
  </TransitionRoot>
</template>
