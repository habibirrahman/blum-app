<script setup lang="ts">
import { useAppStore } from '@/stores/app.store'
import type { Session } from '@/lib/types'
import { Icon } from '@iconify/vue'

interface Props {
  session: Session
  title: string
}

const props = withDefaults(defineProps<Props>(), {})

const appStore = useAppStore()
</script>

<template>
  <div
    class="h-20 w-56 shrink-0 snap-start space-y-1.5 rounded bg-white p-2"
    :style="{ boxShadow: '2px 2px 0px 0px #0000001A' }"
  >
    <div class="truncate text-sm font-semibold text-dark-purple-1">
      {{ title }}
    </div>
    <div class="flex items-center gap-1.5 text-xs text-light-purple-4">
      <Icon icon="ph:clock" />
      <div>
        {{ `${session.appointment?.start_time_string} - ${session.appointment?.end_time_string}` }}
      </div>
    </div>
    <div class="flex items-center gap-1.5 text-xs text-light-purple-4">
      <Icon icon="ph:door" />
      <div
        class="max-w-20 truncate"
        v-if="appStore.account?.center_enable_branch && session.appointment?.room?.branch"
      >
        {{ session.appointment?.room?.branch?.name }}
      </div>
      <div
        v-if="appStore.account?.center_enable_branch && session.appointment?.room?.branch"
        class="h-1 w-1 shrink-0 rounded bg-light-purple-4"
      ></div>
      <div class="max-w-20 truncate">
        {{ session.appointment?.room?.name }}
      </div>
    </div>
  </div>
</template>
