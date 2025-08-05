<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import AppChip from '@/components/AppChip.vue'
import { displayDate, getClientDischargeReason } from '@/lib/func'

const appStore = useAppStore()
const clientStore = useClientStore()

interface ClientTag {
  id: number
  name: string
  color?: string
  background_color?: string
}
const clientTags = computed<ClientTag[]>(() => {
  const branches: ClientTag[] = (clientStore.client?.branches || []).map((i) => ({
    ...i,
    id: i.id || 0,
    name: i.name || 'Branch'
  }))
  const labels: ClientTag[] = (clientStore.client?.tags || []).map((i) => ({
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
  <div class="flex flex-col items-center gap-3 px-4 py-6">
    <div
      class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full"
      :class="{
        'bg-lime-3 text-lime-8': clientStore.client?.status === 'active',
        'bg-rose-4 text-rose-8': clientStore.client?.status === 'archived',
        'bg-orange-4 text-orange-8': clientStore.client?.status === 'at_risk_of_discharge'
      }"
    >
      <div class="text-2xl font-bold uppercase">{{ clientStore.client?.name?.charAt(0) }}</div>
    </div>
    <div class="flex flex-col items-center gap-2">
      <div class="text-lg font-semibold text-center">{{ clientStore.client?.name }}</div>
      <AppChip :chip="clientStore.client?.status" />
    </div>
    <div
      v-if="clientTags.length"
      class="flex flex-wrap items-center content-center justify-center gap-1"
    >
      <div
        v-for="tag in clientTags"
        :key="tag.id"
        class="flex h-5 max-w-[calc((100vw-16px)/2)] items-center justify-center truncate rounded px-2 text-sm font-medium"
        :style="{
          color: tag.color || 'var(--slate-8, #475467)',
          backgroundColor: tag.background_color || 'var(--slate-3, #F2F4F7)'
        }"
      >
        <div class="truncate">{{ tag.name }}</div>
      </div>
    </div>
  </div>

  <div class="px-4">
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Date of birth</div>
      <div class="text-sm">
        {{ displayDate({ date: clientStore.client?.birthday, empty: '-' }) }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Date admitted</div>
      <div class="text-sm">
        {{ displayDate({ date: clientStore.client?.admitted_at, empty: '-' }) }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Date of discharged</div>
      <div class="text-sm">
        {{ displayDate({ date: clientStore.client?.archived_at, empty: '-' }) }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Discharge reason</div>
      <div class="text-sm">
        {{ getClientDischargeReason(clientStore.client?.discharge_reason) || '-' }}
      </div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Gender</div>
      <div class="text-sm">{{ clientStore.client?.gender || '-' }}</div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Email</div>
      <div class="text-sm">{{ clientStore.client?.email || '-' }}</div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Note</div>
      <div class="text-sm">{{ clientStore.client?.note || '-' }}</div>
    </div>
    <div class="flex flex-col gap-1.5 border-b border-slate-3 py-3">
      <div class="text-xs text-slate-8">Assigned therapist</div>
      <div v-if="!clientStore.client?.accesses || !clientStore.client?.accesses?.length">
        <div class="flex items-center h-5 text-sm font-medium text-grass-8">-</div>
      </div>
      <div v-else class="flex flex-wrap items-center gap-1">
        <div
          v-for="access in clientStore.client?.accesses"
          :key="access.id"
          class="flex h-5 max-w-[calc((100vw-16px)/2)] items-center justify-center truncate rounded px-2 text-sm font-medium"
          :class="{
            'bg-cornflower-2 text-cornflower-8': access.user?.role === 'admin',
            'bg-grass-2 text-grass-8': access.user?.role === 'staff' || !access.user?.role
          }"
        >
          <div class="truncate">{{ access.user?.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
