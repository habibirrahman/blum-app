<script setup lang="ts">
import { useAppStore } from '@/stores/app.store'
import type { Client } from '@/lib/types'
import { computed } from 'vue'

const appStore = useAppStore()

interface Props {
  client: Client
}

const props = withDefaults(defineProps<Props>(), {})

interface ClientTag {
  id: number
  name: string
  color?: string
  background_color?: string
}
const clientTags = computed<ClientTag[]>(() => {
  const branches: ClientTag[] = (props.client.branches || []).map((i) => ({
    ...i,
    id: i.id || 0,
    name: i.name || 'Branch'
  }))
  const labels: ClientTag[] = (props.client.tags || []).map((i) => ({
    ...i,
    id: i.id || 0,
    name: i.name || 'Tag'
  }))
  if (appStore.account?.center_enable_branch) {
    return [...branches, ...labels]
  } else {
    return labels
  }
})
</script>

<template>
  <div
    class="flex h-14 shrink-0 items-center justify-between gap-4 truncate border-b border-slate-3"
  >
    <div class="flex items-center gap-3 truncate" :class="{ 'max-w-[50%]': clientTags.length > 2 }">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full uppercase"
        :class="{
          'bg-lime-3 text-lime-8': client.status === 'active',
          'bg-rose-4 text-rose-8': client.status === 'archived',
          'bg-orange-4 text-orange-8': client.status === 'at_risk_of_discharge'
        }"
      >
        {{ client.name?.charAt(0) }}
      </div>
      <div class="truncate text-sm font-medium">{{ client.name }}</div>
    </div>
    <div class="flex items-center gap-1 truncate">
      <div
        v-for="tag in clientTags.slice(0, 2)"
        :key="tag.id"
        class="flex h-5 max-w-16 items-center justify-center truncate rounded px-2 text-sm font-medium"
        :style="{
          color: tag.color || 'var(--slate-8, #475467)',
          backgroundColor: tag.background_color || 'var(--slate-3, #F2F4F7)'
        }"
      >
        <div class="truncate">{{ tag.name }}</div>
      </div>
      <div v-if="clientTags.slice(2).length">
        <div
          class="flex h-5 min-w-5 items-center justify-center rounded bg-slate-3 px-1 text-xs font-medium text-slate-8"
        >
          +{{ clientTags.slice(2).length }}
        </div>
      </div>
    </div>
  </div>
</template>
