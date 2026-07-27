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
  if (appStore.center?.enable_branch) {
    return [...branches, ...labels]
  } else {
    return labels
  }
})
</script>

<template>
  <div
    class="flex gap-4 justify-between items-center h-14 truncate border-b shrink-0 border-slate-3"
  >
    <div
      class="flex flex-grow flex-shrink-0 gap-3 items-center truncate"
      :class="{ 'max-w-[50%]': clientTags.length > 2 }"
    >
      <div
        class="flex justify-center items-center w-8 h-8 rounded-full shrink-0"
        :class="{
          'bg-lime-3 text-lime-8': client.status === 'active',
          'bg-rose-4 text-rose-8': client.status === 'archived',
          'bg-orange-4 text-orange-8': client.status === 'at_risk_of_discharge'
        }"
      >
        <div class="uppercase">{{ client.name?.charAt(0) }}</div>
      </div>
      <div class="flex flex-grow text-sm font-medium truncate">{{ client.name }}</div>
    </div>
    <div class="flex gap-1 items-center truncate" :class="{ 'max-w-[50%]': clientTags.length > 2 }">
      <div
        v-for="tag in clientTags.slice(0, 2)"
        :key="tag.id"
        class="flex justify-center items-center px-2 h-5 text-sm font-medium truncate rounded"
        :style="{
          color: tag.color || 'var(--slate-8, #475467)',
          backgroundColor: tag.background_color || 'var(--slate-3, #F2F4F7)'
        }"
      >
        <div class="truncate">{{ tag.name }}</div>
      </div>
      <div v-if="clientTags.slice(2).length">
        <div
          class="flex justify-center items-center px-1 h-5 text-xs font-medium rounded min-w-5 bg-slate-3 text-slate-8"
        >
          +{{ clientTags.slice(2).length }}
        </div>
      </div>
    </div>
  </div>
</template>
