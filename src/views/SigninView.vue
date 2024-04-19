<script setup lang="ts">
import { ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { setAccount } from '@/plugins/preferences'
import router from '@/router'

const email = ref<string>('')
const password = ref<string>('')
const loading = ref<boolean>(false)

async function onSubmit() {
  loading.value = true
  setTimeout(async () => {
    console.log(email.value)
    console.log(password.value)
    const { succces } = await setAccount({ access: 'signin', email: email.value })
    loading.value = false
    if (succces) {
      router.push({ name: 'home' })
    }
  }, 2000)
}
</script>

<template>
  <div
    class="auth-background flex h-screen w-screen flex-col items-center justify-center gap-6 px-4 py-6"
  >
    <div
      class="border-light-purple-1 z-10 flex max-w-lg flex-col gap-6 rounded-3xl border bg-pure-white p-6"
    >
      <div class="flex flex-col gap-1 text-center">
        <div class="font-logo text-4xl font-bold text-light-purple">Blüm</div>
        <div class="text-slate-7 text-sm leading-relaxed">
          Streamline your ABA therapy data collection process and make your sessions more effective.
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <AppTextInput
          label="Email"
          name="email"
          type="email"
          placeholder="Type your email"
          v-model="email"
        />
        <AppTextInput
          label="Password"
          name="password"
          type="password"
          placeholder="Type your password"
          v-model="password"
        />
        <AppButton @click="onSubmit" :loading="loading" :disabled="!email && !password">
          Sign in
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style></style>
