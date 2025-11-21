<script setup lang="ts">
import { ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import { useAppStore } from '@/stores/app.store'
import { useToast } from 'vue-toastification'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

const router = useRouter()
const appStore = useAppStore()
const toast = useToast()

const email = ref<string>('')
const password = ref<string>('')
const error = ref<string>('')
const signinLoading = ref<boolean>(false)
const showForgotPassword = ref<boolean>(false)

watch(email, () => {
  error.value = ''
})
watch(password, () => {
  error.value = ''
})

async function onSignin() {
  signinLoading.value = true
  const input = {
    email: email.value,
    password: password.value,
    device: {
      device_type: 'mobile', // mobile or desktop
      app_type: 'mobile_app' // browser or mobile_app
      // device_id: `${email.value}#${this.deviceId}`,
      // device_details: this.deviceDetails
    }
  }
  const { success, message } = await appStore.signin(input)
  signinLoading.value = false
  if (!success) {
    error.value = message || ''
    toast.error(message)
    return
  }
  router.push({ name: 'home' })
}
</script>

<template>
  <div
    class="fixed left-1/2 z-[9] -translate-x-1/2 transition-all pt-safe"
    :class="{ 'top-5': signinLoading, '-top-10': !signinLoading }"
  >
    <div class="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>
  </div>

  <div class="flex flex-col items-center justify-center w-full h-full gap-6 py-4">
    <div class="flex flex-col w-full max-w-lg gap-10 p-4">
      <div class="text-5xl font-bold text-center font-logo text-light-purple-5">Blüm</div>
      <div class="flex flex-col gap-5">
        <AppTextInput
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          v-model="email"
          :error="error"
        />
        <AppTextInput
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          v-model="password"
          :error="error ? true : false"
        />
        <AppButton :loading="signinLoading" :disabled="!email && !password" @click="onSignin">
          Log in
        </AppButton>
      </div>
    </div>
    <div class="absolute bottom-0 w-screen bg-white px-safe pb-safe">
      <div class="w-full py-1">
        <AppButton kind="plain" class="w-full" @click="showForgotPassword = true">
          Forgot password?
        </AppButton>
      </div>
    </div>
  </div>
  <AppActionSheet :show="showForgotPassword" @close="showForgotPassword = false">
    <div class="flex flex-col items-center gap-4">
      <div class="text-xl font-semibold text-center">Reset password</div>
      <div class="text-sm text-center">
        Password resets aren't available on mobile yet. Please log in to Blüm on a desktop and
        update it from your profile, or contact your admin for assistance.
      </div>
      <AppButton kind="plain" class="w-full" @click="showForgotPassword = false">
        Got it!
      </AppButton>
    </div>
  </AppActionSheet>
</template>

<style></style>
