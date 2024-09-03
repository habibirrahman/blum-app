<script setup lang="ts">
import { useAccountStore } from '@/stores/account.store'
import type { Session } from '@/lib/types'
import { displayDate } from '@/lib/func'

interface Props {
  session?: Session
}

const props = withDefaults(defineProps<Props>(), {
  session: undefined
})

const accountStore = useAccountStore()
</script>

<template>
  <div class="flex h-[110px] w-full items-center gap-3 border-b border-slate-3 py-3">
    <div class="w-[46px] shrink-0 rounded-sm" :style="{ boxShadow: '1px 1px 0px 0px #0000000D' }">
      <div
        class="flex h-[14px] shrink-0 items-center justify-center rounded-t-sm text-[8px] uppercase"
        :class="{
          'bg-orange-3 text-orange-7': session?.appointment_id,
          'bg-slate-3': !session?.appointment_id
        }"
      >
        {{ displayDate({ date: session?.appointment?.date, format: 'MMM' }) }}
      </div>
      <div
        class="flex h-[34px] shrink-0 items-center justify-center rounded-b-sm text-xs"
        :class="{
          'text-orange-7': session?.appointment_id
        }"
      >
        {{ displayDate({ date: session?.appointment?.date, format: 'DD' }) }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 truncate">
      <div class="text-xs text-slate-8">Session ID {{ session?.id }}</div>
      <div class="truncate text-sm">
        {{ session?.client?.name }}
      </div>
      <div v-if="!session?.appointment_id" class="text-xs text-slate-7">Unscheduled</div>
      <div v-else class="flex items-center gap-1.5 text-xs">
        <div class="text-slate-7">Scheduled on</div>
        <div class="text-slate-8">{{ displayDate({ date: session.appointment?.date }) }}</div>
        <div class="h-1 w-1 shrink-0 rounded bg-slate-6"></div>
        <div class="text-slate-8">
          {{
            `${session.appointment?.start_time_string} - ${session.appointment?.end_time_string}`
          }}
        </div>
      </div>
      <div class="text-xs text-slate-7">{{ session?.number_of_measurements }} target(s)</div>
    </div>
  </div>
</template>
