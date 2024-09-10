<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app.store'
import { useClientStore } from '@/stores/client.store'
import { Icon } from '@iconify/vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const clientStore = useClientStore()

const clientLoading = ref<boolean>(false)

async function fetchClient() {
  clientLoading.value = true
  const id = Number(route.params.id)
  const { success } = await clientStore.getClient({ id })
  clientLoading.value = false
  if (!success) {
    document.getElementById('app')?.scroll({ top: 0, behavior: 'smooth' })
    return
  }
}

onMounted(() => {
  fetchClient()
})
</script>

<template>
  <div
    v-if="clientLoading"
    class="fixed z-[99] grid h-screen w-screen place-content-center bg-slate-10/30"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-5xl text-light-purple-1" />
  </div>

  <div class="p-4 text-xs">
    <pre>{{ clientStore.client }}</pre>
  </div>
</template>
