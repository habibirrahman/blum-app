<script setup lang="ts">
import type { Session } from '@/lib/types'
import { displayDate } from '@/lib/func'
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import { Icon } from '@iconify/vue/dist/iconify.js'
import AppActionSheet from '@/components/AppActionSheet.vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from 'vue-toastification'
import AppTextInput from '@/components/AppTextInput.vue'

interface Props {
  session: Session
  title: string
}
interface Emits {
  (e: 'click', event: Event): void
  (e: 'after-commit'): void
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()

const route = useRoute()
const toast = useToast()
const sessionStore = useSessionStore()

const sessionDate = computed<string>(() => {
  if (props.session.status === 'draft') return props.session.appointment?.date || ''
  if (props.session.status === 'ongoing') return props.session.appointment?.date || ''
  if (props.session.status === 'paused') return props.session.appointment?.date || ''
  if (props.session.status === 'completed') return props.session.end_time || ''
  if (props.session.status === 'cancelled') return props.session.appointment?.date || ''
  return ''
})

const showMenu = ref<boolean>(false)

const showEditSessionName = ref<boolean>(false)
const sessionName = ref<string>('')
const editSessionNameLoading = ref<boolean>(false)

const showDelete = ref<boolean>(false)
const deleteLoading = ref<boolean>(false)

const lastRecordedBy = computed<string | null | undefined>(() => {
  const names = (props.session?.recording_timeline || []).map((i) => i.recorded_by_name)
  const userName = props.session?.user?.name
  const recording = [userName, ...names].pop()
  return recording
})

watch(
  () => showEditSessionName.value,
  (show) => {
    if (!show) return
    sessionName.value = props.session.name || ''
  }
)

const onUpdateSessionName = async () => {
  const payload = {
    id: props.session.id,
    session: {
      name: sessionName.value + ''
    }
  }

  editSessionNameLoading.value = true
  const { success, message } = await sessionStore.updateSession(payload)
  editSessionNameLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }

  toast.success('Success! The session name has been updated')
  emit('after-commit')
  showEditSessionName.value = false
  showMenu.value = false
}

const onDeleteSession = async () => {
  deleteLoading.value = true
  const { success, message } = await sessionStore.deleteSession({ id: props.session.id })
  deleteLoading.value = false

  if (!success) {
    toast.error(message)
    return
  }

  toast.success('Success! The session has been deleted')
  emit('after-commit')
  showDelete.value = false
  showMenu.value = false
}
</script>

<template>
  <div
    class="relative flex h-[110px] w-full items-center gap-3 truncate border-b border-slate-3 py-3"
    @click="emit('click', $event)"
  >
    <div class="w-[46px] shrink-0 rounded-sm" :style="{ boxShadow: '1px 1px 0px 0px #0000000D' }">
      <div
        class="flex h-[14px] shrink-0 items-center justify-center rounded-t-sm text-[8px] uppercase"
        :class="{
          'bg-orange-3 text-orange-7': session.appointment_id && session.status === 'draft',
          'bg-slate-3': !session.appointment_id && session.status === 'draft',
          'bg-cornflower-2 text-cornflower-7': session.status === 'ongoing',
          'bg-light-purple-1 text-light-purple-5': session.status === 'paused',
          'bg-lime-2 text-lime-7': session.status === 'completed',
          'bg-rose-2 text-rose-7': session.status === 'cancelled'
        }"
      >
        <span v-if="sessionDate"> {{ displayDate({ date: sessionDate, format: 'MMM' }) }} </span>
        <span v-else class="text-[6px] capitalize">
          <span v-if="session.status === 'draft'">Draft</span>
          <span v-if="session.status === 'ongoing'">In progress</span>
          <span v-if="session.status === 'paused'">Paused</span>
        </span>
      </div>
      <div
        class="flex h-[34px] shrink-0 items-center justify-center rounded-b-sm text-xs"
        :class="{
          'text-orange-7': session.appointment_id && session.status === 'draft',
          'text-cornflower-7': session.status === 'ongoing',
          ' text-light-purple-5': session.status === 'paused',
          'text-lime-7': session.status === 'completed',
          'text-rose-7': session.status === 'cancelled'
        }"
      >
        {{ displayDate({ date: sessionDate, format: 'DD' }) }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 truncate">
      <div class="text-xs text-slate-8">
        <span v-if="!session.name">Session ID </span>
        <span>{{ session.id }}</span>
        <span v-if="session.name"> - {{ session.name }}</span>
      </div>
      <div class="text-sm font-semibold truncate">{{ title }}</div>
      <div
        v-if="!session.appointment_id && session.status === 'draft'"
        class="text-xs text-slate-7"
      >
        Unscheduled
      </div>
      <div
        v-else-if="session.appointment_id && session.status === 'draft'"
        class="flex gap-1.5 items-center text-xs truncate"
      >
        <div class="text-slate-7">Scheduled on</div>
        <div class="font-bold text-slate-8">
          {{ displayDate({ date: session.appointment?.date }) }}
        </div>
        <div class="w-1 h-1 rounded shrink-0 bg-slate-6"></div>
        <div class="font-medium text-slate-8">
          {{
            `${session.appointment?.start_time_string} - ${session.appointment?.end_time_string}`
          }}
        </div>
      </div>
      <div v-else-if="session.status === 'ongoing'" class="flex gap-1.5 items-center text-xs">
        <div class="font-medium truncate text-slate-8">
          <span>In progress</span>
          <span v-if="session.user?.name">
            with <b>{{ session.user?.name }}</b>
          </span>
        </div>
      </div>
      <div v-else-if="session.status === 'paused'" class="flex gap-1.5 items-center text-xs">
        <div class="font-medium truncate text-slate-8">
          <span>Paused</span>
          <span v-if="session.user?.name">
            with <b>{{ lastRecordedBy }}</b>
          </span>
        </div>
      </div>
      <div
        v-else-if="session.status === 'completed'"
        class="flex gap-1.5 items-center text-xs truncate"
      >
        <div class="text-slate-7">Completed on</div>
        <div class="font-medium text-slate-8">
          {{ displayDate({ date: session.end_time }) }}
        </div>
        <div class="w-1 h-1 rounded shrink-0 bg-slate-6"></div>
        <div class="font-medium text-slate-8">
          {{ displayDate({ date: session.end_time, format: 'HH:mm' }) }}
        </div>
      </div>
      <div v-else-if="session.status === 'cancelled'" class="text-xs text-slate-7">Cancelled</div>
      <div
        v-if="
          session.status === 'draft' || session.status === 'ongoing' || session.status === 'paused'
        "
        class="text-xs text-slate-7"
      >
        {{ session.number_of_measurements }} target(s)
      </div>
    </div>

    <div v-if="session.status === 'draft'" id="action-button" class="absolute right-0 top-2 z-10">
      <AppButton kind="plain" @click="showMenu = true">
        <Icon icon="ph:dots-three-outline-vertical-fill" />
      </AppButton>
    </div>
  </div>

  <AppActionSheet :show="showMenu" @close="showMenu = false">
    <div class="py-3 space-y-4">
      <div class="flex justify-between items-center w-full">
        <div class="text-xl font-semibold text-center">
          <span v-if="!session.name">Session ID </span>
          <span>{{ session.id }}</span>
          <span v-if="session.name"> - {{ session.name }}</span>
        </div>
        <div class="cursor-pointer" @click="showMenu = false">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <div>
        <RouterLink
          :to="{
            name: 'pre-session-record',
            params: { slug: session?.slug },
            query: { redirect: `/clients/${route.params.id}/${route.params.tab}` }
          }"
          class="flex gap-3 items-center w-full h-14 border-b border-slate-3"
        >
          <icon icon="ph:eye" />
          <div class="text-sm text-slate-8">Preview</div>
        </RouterLink>
        <div
          class="flex gap-3 items-center w-full h-14 border-b border-slate-3"
          @click="showEditSessionName = true"
        >
          <icon icon="ph:pencil-simple" />
          <div class="text-sm text-slate-8">Edit session name</div>
        </div>
        <RouterLink
          :to="{
            name: 'session-draft',
            params: { slug: session?.slug },
            query: { redirect: `/pre-session-record/${session?.slug}` }
          }"
          class="flex gap-3 items-center w-full h-14 border-b border-slate-3"
        >
          <icon icon="ph:pencil-simple" />
          <div class="text-sm text-slate-8">Edit session target(s)</div>
        </RouterLink>
        <div
          v-if="!session.appointment_id"
          class="flex gap-3 items-center w-full h-14 border-b border-slate-3"
          @click="showDelete = true"
        >
          <icon icon="ph:trash" />
          <div class="text-sm text-slate-8">Delete</div>
        </div>
      </div>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showEditSessionName" @close="showEditSessionName = false">
    <div class="flex flex-col gap-4 py-3">
      <div class="text-xl font-semibold">Edit session name</div>

      <AppTextInput name="session_name" placeholder="Session Name" v-model="sessionName" />

      <div class="grid grid-cols-2 gap-2 w-full">
        <AppButton kind="plain" @click="showEditSessionName = false">Cancel</AppButton>
        <AppButton :loading="editSessionNameLoading" @click="onUpdateSessionName">Update</AppButton>
      </div>
    </div>
  </AppActionSheet>

  <AppActionSheet :show="showDelete" @close="showDelete = false">
    <div class="flex flex-col gap-4 items-center py-3">
      <div class="text-xl font-semibold text-center">Delete the draft</div>
      <div class="text-sm text-center">
        You are about to delete the session draft. Are you sure you want to proceed? This action is
        irreversible.
      </div>
      <div class="grid grid-cols-2 gap-2 w-full">
        <AppButton kind="plain" @click="showDelete = false">Cancel</AppButton>
        <AppButton :loading="deleteLoading" @click="onDeleteSession">Delete</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
