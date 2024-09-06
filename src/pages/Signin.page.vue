<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from '@/components/Button.vue'
import TextInput from '@/components/TextInput.vue'
import ActionSheet from '@/components/ActionSheet.vue'
import router from '@/router'
import { useAppStore } from '@/stores/app.store'

const appStore = useAppStore()
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
  const { success, message } = await appStore.signin(input)
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
        <TextInput
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          v-model="email"
          :error="error"
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          placeholder="Enter your password"
          v-model="password"
        />
        <Button :loading="loading" :disabled="!email && !password" @click="onSignin">
          Log in
        </Button>
      </div>
    </div>
    <div class="absolute bottom-0 w-screen py-1">
      <Button kind="plain" class="w-full" @click="showForgotPassword = true">
        Forgot password?
      </Button>
    </div>
  </div>
  <ActionSheet :show="showForgotPassword" @close="showForgotPassword = false">
    <div class="flex flex-col items-center gap-4">
      <div class="text-center text-xl font-semibold">Reset password</div>
      <div class="text-center text-sm">
        Password resets aren't available on mobile yet. Please log in to Blüm on a desktop and
        update it from your profile, or contact your admin for assistance.
      </div>
      <Button kind="plain" class="w-full" @click="showForgotPassword = false"> Got it! </Button>
    </div>
  </ActionSheet>
</template>

<style></style>
