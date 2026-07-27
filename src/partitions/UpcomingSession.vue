<script setup lang="ts">
import { useAppStore } from '@/stores/app.store'
import type { Session } from '@/lib/types'
import { Icon } from '@iconify/vue'

interface Props {
  session: Session
  title: string
}

withDefaults(defineProps<Props>(), {})

const appStore = useAppStore()
</script>

<template>
  <div
    class="p-2 space-y-1.5 w-56 h-20 bg-white rounded shrink-0 snap-start"
    :style="{ boxShadow: '2px 2px 0px 0px #0000001A' }"
  >
    <div class="text-sm font-semibold truncate text-dark-purple-1">
      {{ title }}
    </div>
    <div class="flex gap-1.5 items-center text-xs text-light-purple-4">
      <Icon icon="ph:clock" />
      <div>
        {{ `${session.appointment?.start_time_string} - ${session.appointment?.end_time_string}` }}
      </div>
    </div>
    <div class="flex gap-1.5 items-center text-xs text-light-purple-4">
      <Icon icon="ph:door" />
      <div
        class="truncate max-w-20"
        v-if="appStore.center?.enable_branch && session.appointment?.room?.branch"
      >
        {{ session.appointment?.room?.branch?.name }}
      </div>
      <div
        v-if="appStore.center?.enable_branch && session.appointment?.room?.branch"
        class="w-1 h-1 rounded shrink-0 bg-light-purple-4"
      ></div>
      <div class="truncate max-w-20">
        {{ session.appointment?.room?.name }}
      </div>
    </div>
  </div>
</template>
