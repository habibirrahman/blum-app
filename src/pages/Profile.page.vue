<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUserRole } from '@/lib/func'
import { useAppStore } from '@/stores/app.store'
import { Icon } from '@iconify/vue'
import { useToast } from 'vue-toastification'

const router = useRouter()
const toast = useToast()
const appStore = useAppStore()
const signoutLoading = ref<boolean>(false)

async function onSignout() {
  signoutLoading.value = true
  const { success } = await appStore.signout()
  signoutLoading.value = false
  if (success) {
    toast.success("You're logged out. Have a great day!")
    router.push({ name: 'signin' })
  }
}

onMounted(() => {
  appStore.getRunningSessions()
})
</script>

<template>
  <div
    class="fixed left-1/2 z-[9] flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow transition-all"
    :class="{ 'top-5': signoutLoading, '-top-10': !signoutLoading }"
  >
    <Icon icon="mingcute:loading-fill" class="animate-spin text-2xl text-light-purple-5" />
  </div>

  <div class="flex h-screen w-screen flex-col justify-center gap-3 px-6">
    <div
      class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full"
      :class="{
        'bg-cornflower-2 text-cornflower-8': appStore.account?.role === 'admin',
        'bg-grass-2 text-grass-8': appStore.account?.role === 'staff'
      }"
    >
      <div class="text-2xl font-bold">{{ appStore.account?.name?.charAt(0) }}</div>
    </div>
    <div class="flex flex-col gap-2">
      <div class="">
        <div
          class="text-2xl font-bold"
          :class="{
            'app-account-name-admin': appStore.account?.role === 'admin',
            'app-account-name-staff': appStore.account?.role === 'staff'
          }"
        >
          {{ appStore.account?.name }}
        </div>
      </div>
      <div class="flex">
        <div
          class="flex h-5 max-w-[calc((100vw-16px)/2)] items-center justify-center truncate rounded px-2 text-sm font-medium"
          :class="{
            'bg-cornflower-2 text-cornflower-8': appStore.account?.role === 'admin',
            'bg-grass-2 text-grass-8': appStore.account?.role === 'staff'
          }"
        >
          <div class="truncate">{{ getUserRole(appStore.account?.role) }}</div>
        </div>
      </div>
      <div class="text-sm text-slate-7">{{ appStore.account?.email }}</div>
    </div>
    <div
      class="flex h-[52px] w-full items-center gap-2"
      :class="{ 'pointer-events-none': signoutLoading }"
      @click="onSignout"
    >
      <Icon icon="ph:sign-out" class="text-xl text-slate-7" />
      <div class="text-sm">Log out</div>
    </div>
  </div>
</template>
