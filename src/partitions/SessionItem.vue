<script setup lang="ts">
import type { Session } from '@/lib/types'
import { displayDate } from '@/lib/func'
import { computed } from 'vue'

interface Props {
  session: Session
  title: string
}

const props = withDefaults(defineProps<Props>(), {})

const sessionDate = computed<string>(() => {
  if (props.session.status === 'draft') return props.session.appointment?.date || ''
  if (props.session.status === 'ongoing') return props.session.appointment?.date || ''
  if (props.session.status === 'completed') return props.session.end_time || ''
  if (props.session.status === 'cancelled') return props.session.appointment?.date || ''
  return ''
})
</script>

<template>
  <div class="flex h-[110px] w-full items-center gap-3 truncate border-b border-slate-3 py-3">
    <div class="w-[46px] shrink-0 rounded-sm" :style="{ boxShadow: '1px 1px 0px 0px #0000000D' }">
      <div
        class="flex h-[14px] shrink-0 items-center justify-center rounded-t-sm text-[8px] uppercase"
        :class="{
          'bg-orange-3 text-orange-7': session.appointment_id && session.status === 'draft',
          'bg-slate-3': !session.appointment_id && session.status === 'draft',
          'bg-cornflower-2 text-cornflower-7': session.status === 'ongoing',
          'bg-lime-2 text-lime-7': session.status === 'completed',
          'bg-rose-2 text-rose-7': session.status === 'cancelled'
        }"
      >
        {{ displayDate({ date: sessionDate, format: 'MMM' }) }}
      </div>
      <div
        class="flex h-[34px] shrink-0 items-center justify-center rounded-b-sm text-xs"
        :class="{
          'text-orange-7': session.appointment_id && session.status === 'draft',
          'text-cornflower-7': session.status === 'ongoing',
          'text-lime-7': session.status === 'completed',
          'text-rose-7': session.status === 'cancelled'
        }"
      >
        {{ displayDate({ date: sessionDate, format: 'DD' }) }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 truncate">
      <div class="text-xs text-slate-8">Session ID {{ session.id }}</div>
      <div class="truncate text-sm font-semibold">{{ title }}</div>
      <div
        v-if="!session.appointment_id && session.status === 'draft'"
        class="text-xs text-slate-7"
      >
        Unscheduled
      </div>
      <div
        v-else-if="session.appointment_id && session.status === 'draft'"
        class="flex items-center gap-1.5 truncate text-xs"
      >
        <div class="text-slate-7">Scheduled on</div>
        <div class="font-medium text-slate-8">
          {{ displayDate({ date: session.appointment?.date }) }}
        </div>
        <div class="h-1 w-1 shrink-0 rounded bg-slate-6"></div>
        <div class="font-medium text-slate-8">
          {{
            `${session.appointment?.start_time_string} - ${session.appointment?.end_time_string}`
          }}
        </div>
      </div>
      <div v-else-if="session.status === 'ongoing'" class="flex items-center gap-1.5 text-xs">
        <div class="truncate font-medium text-slate-8">
          <span>In progress</span>
          <span v-if="session.user?.name"> with {{ session.user?.name }}</span>
        </div>
      </div>

      <div
        v-else-if="session.status === 'completed'"
        class="flex items-center gap-1.5 truncate text-xs"
      >
        <div class="text-slate-7">Completed on</div>
        <div class="font-medium text-slate-8">
          {{ displayDate({ date: session.end_time }) }}
        </div>
        <div class="h-1 w-1 shrink-0 rounded bg-slate-6"></div>
        <div class="font-medium text-slate-8">
          {{ displayDate({ date: session.end_time, format: 'HH:mm' }) }}
        </div>
      </div>
      <div v-else-if="session.status === 'cancelled'" class="text-xs text-slate-7">Unscheduled</div>
      <div
        v-if="session.status === 'draft' || session.status === 'ongoing'"
        class="text-xs text-slate-7"
      >
        {{ session.number_of_measurements }} target(s)
      </div>
    </div>
  </div>
</template>
