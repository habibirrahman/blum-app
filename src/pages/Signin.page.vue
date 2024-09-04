<script setup lang="ts">
import { ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import router from '@/router'
import { useAccountStore } from '@/stores/account.store'

const store = useAccountStore()
const email = ref<string>('')
const password = ref<string>('')
const error = ref<string>('')
const loading = ref<boolean>(false)

const showForgotPassword = ref<boolean>(false)

watch(email, () => {
  error.value = ''
})

async function onSignin() {
  loading.value = true
  const input = {
    email: email.value,
    password: password.value
  }
  const { success, message } = await store.signin(input)
  loading.value = false
  if (!success) {
    error.value = message
    return
  }
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="flex h-screen w-screen flex-col items-center justify-center gap-6 py-4">
    <div class="flex w-full flex-col gap-10 p-4">
      <div class="text-center font-logo text-5xl font-bold text-light-purple-5">Blüm</div>
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
        />
        <AppButton @click="onSignin" :loading="loading" :disabled="!email && !password" size="sm">
          Log in
        </AppButton>
      </div>
    </div>
    <div class="absolute bottom-0 w-screen py-1">
      <AppButton kind="plain" class="w-full" @click="showForgotPassword = true">
        Forgot password?
      </AppButton>
    </div>
  </div>
  <AppActionSheet :show="showForgotPassword" @close="showForgotPassword = false">
    <div class="flex flex-col items-center gap-4">
      <div class="text-center text-xl font-semibold">Reset password</div>
      <div class="text-center text-sm">
        Password resets aren't available on mobile yet. Please log in to Blüm on a desktop and
        update it from your profile, or contact your admin for assistance.
      </div>
      <AppButton kind="plain" size="sm" class="w-full" @click="showForgotPassword = false">
        Got it!
      </AppButton>
    </div>
  </AppActionSheet>
</template>

<style></style>
