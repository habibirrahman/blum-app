<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import { useAppStore } from '@/stores/app.store'
import { useToast } from 'vue-toastification'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import type { ActiveDevice, DeviceDetailsInput, User } from '@/lib/types'
import { displayDate } from '@/lib/func'

const router = useRouter()
const appStore = useAppStore()
const toast = useToast()

const signinLoading = ref<boolean>(false)
const hasAnotherDeviceSignedIn = ref<boolean>(false)

const user = ref<User>()
const activeDevices = ref<ActiveDevice[]>([])

const APP_TYPE = 'mobile_app'
const deviceType = ref<string>('')
const deviceId = ref<string>('')
const deviceDetails = ref<DeviceDetailsInput>({
  device_name: '',
  os_name: '',
  os_version: 0,
  browser_name: '',
  browser_version: 0
})

const email = ref<string>('')
const password = ref<string>('')
const error = ref<string>('')
const showForgotPassword = ref<boolean>(false)

watch(
  () => email.value,
  () => {
    error.value = ''
  }
)
watch(
  () => password.value,
  () => {
    error.value = ''
  }
)

async function onSignin() {
  signinLoading.value = true
  const input = {
    email: email.value,
    password: password.value,
    device: {
      app_type: APP_TYPE, // browser or mobile_app
      device_type: deviceType.value, // mobile or desktop
      device_id: `${email.value}#${deviceId.value}`,
      device_details: deviceDetails.value
    }
  }
  const { success, message, data } = await appStore.signin(input)
  signinLoading.value = false
  if (!success) {
    if (data?.active_devices) {
      user.value = data?.user
      activeDevices.value = data?.active_devices
      hasAnotherDeviceSignedIn.value = true
      return
    }

    error.value = message || ''
    toast.error(message)
    return
  }
  router.push({ name: 'home' })
}

const onSignoutDevice = async (device: ActiveDevice) => {
  try {
    const { data } = await appStore.signoutByDevice({ deviceId: device.id })

    const idx = activeDevices.value.findIndex((i) => i?.id === device?.id)
    const arr = [...activeDevices.value]
    arr[idx] = data
    activeDevices.value = arr

    // const title = 'Device signed out'
    let message = 'Success! You have signed out from'
    if (device.device_details.os_name) {
      message += ` ${device.device_details.os_name}`
    }
    if (device.device_details.os_version) {
      message += ` ${device.device_details.os_version}`
    }
    if (device.device_details.device_name && device.device_details.device_name !== 'Unknown') {
      message += ` ${device.device_details.device_name}`
    }
    if (device.device_details.browser_name && device.device_details.browser_name !== 'Unknown') {
      message += ` ${device.device_details.browser_name}`
    }
    toast.success(message)
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  // generated deviceId and deviceDetails
})
</script>

<template>
  <div
    class="fixed left-1/2 z-[9] -translate-x-1/2 pt-safe"
    :class="{ 'top-5': signinLoading, '-top-10': !signinLoading }"
  >
    <div class="flex justify-center items-center w-10 h-10 bg-white rounded-full shadow">
      <Icon icon="mingcute:loading-fill" class="text-2xl animate-spin text-light-purple-5" />
    </div>
  </div>

  <!-- sign in form -->
  <div
    v-if="!hasAnotherDeviceSignedIn"
    class="flex flex-col gap-6 justify-center items-center py-4 w-full h-full"
  >
    <div class="flex flex-col gap-10 p-4 w-full max-w-lg">
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
      <div class="py-1 w-full">
        <AppButton kind="plain" class="w-full" @click="showForgotPassword = true">
          Forgot password?
        </AppButton>
      </div>
    </div>
  </div>
  <!-- end signin form -->

  <!-- handle case when the account is signed in on another device -->
  <div v-if="hasAnotherDeviceSignedIn" class="flex flex-col gap-6 items-center py-4 w-full h-full">
    <div class="flex flex-col gap-10 p-4 w-full max-w-lg">
      <div class="text-5xl font-bold text-center font-logo text-light-purple-5">Blüm</div>
      <div class="flex flex-col gap-5">
        <div class="space-y-3">
          <div class="text-2xl font-bold text-light-purple-5">
            Sign out from another device to access Blüm
          </div>
          <div class="text-sm text-slate-8">
            You've reached the maximum number of devices allowed for
            <b>{{ user?.email }}</b>
            To sign in here, please choose a device to log out from. Once signed out, you'll be able
            to continue on this device.
          </div>
        </div>

        <div>
          <div
            v-for="(device, idx) in activeDevices"
            :key="device?.id + device?.updated_at + idx"
            class="flex gap-3 justify-between items-center py-3 border-b border-slate-3"
          >
            <div class="flex gap-3 items-center">
              <Icon
                icon="ph:check-circle-fill"
                class="w-6 h-6"
                :class="[device?.status === 'active' ? 'text-grass-6' : 'text-slate-6']"
              />

              <div class="space-y-1">
                <div class="text-sm font-bold text-slate-8">
                  {{ device?.device_details?.os_name }}
                  {{ device?.device_details?.os_version }}
                  <span v-if="device?.device_details?.device_name !== 'Unknown'">
                    {{ device?.device_details?.device_name }}
                  </span>
                  <span v-if="device?.device_details?.browser_name !== 'Unknown'">
                    {{ device?.device_details?.browser_name }}
                  </span>
                </div>

                <div class="text-xs text-slate-8">
                  Signed in as
                  <span class="font-semibold">
                    {{ device?.app_type === 'browser' ? 'Web App' : 'Mobile App' }}
                  </span>
                  <template v-if="device?.app_type === 'browser'">
                    on
                    <span class="font-semibold">
                      {{ device?.device_type === 'desktop' ? 'Desktop' : 'Mobile' }}
                    </span>
                  </template>
                </div>
                <div class="text-xs text-slate-8">
                  Last accessed:
                  {{
                    displayDate({ date: device?.last_accessed_at, format: 'DD MMM YYYY HH:mm:ss' })
                  }}
                </div>
              </div>
            </div>

            <AppButton
              v-if="device?.status === 'active'"
              kind="outline"
              size="sm"
              @click="onSignoutDevice(device)"
            >
              <div class="shrink-0">Sign out</div>
            </AppButton>
            <AppButton v-if="device?.status === 'inactive'" kind="outline" size="sm" disabled>
              <div class="shrink-0">Signed out</div>
            </AppButton>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <AppButton kind="outline" @click="hasAnotherDeviceSignedIn = false">
            Back to sign-in
          </AppButton>
          <AppButton
            :loading="signinLoading"
            :disabled="activeDevices.filter((i) => i?.status === 'active').length > 1"
            @click="onSignin"
          >
            Continue using this device
          </AppButton>
        </div>
      </div>
    </div>
  </div>
  <!-- end handle case when the account is signed in on another device -->

  <AppActionSheet :show="showForgotPassword" @close="showForgotPassword = false">
    <div class="flex flex-col gap-4 items-center py-3">
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
