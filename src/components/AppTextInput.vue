<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  label?: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
  suffix_icon?: string
}

const model = defineModel({ type: String || Number })
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
  error: '',
  suffix_icon: ''
})

const openPassword = ref<boolean>(false)
</script>

<template>
  <label :for="name" class="relative grid">
    <div
      v-if="label"
      class="mb-1 text-sm font-medium"
      :class="[error ? 'text-tomato-7' : 'text-slate-8']"
    >
      <span>{{ label }}</span>
      <span v-if="required" class="ml-1 text-tomato-7">{{ '*' }}</span>
    </div>
    <input
      class="group w-full rounded border px-4 py-2 text-sm ring-offset-2 focus:outline-none"
      :class="[
        disabled ? 'bg-slate-2' : 'focus:ring-2',
        error ? 'border-tomato-7 ring-tomato-2' : 'border-slate-4 ring-light-purple-2'
      ]"
      :id="name"
      :type="type === 'password' ? (openPassword ? 'text' : 'password') : type"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
    />
    <Icon
      v-if="type === 'password'"
      :icon="openPassword ? 'ph:eye-closed' : 'ph:eye'"
      class="absolute right-2 cursor-pointer text-2xl text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-2']"
      @click.prevent="openPassword = !openPassword"
    />
    <Icon
      v-if="suffix_icon"
      :icon="suffix_icon"
      class="absolute right-2 cursor-pointer text-2xl text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-2']"
    />
    <div v-if="error" class="mt-1 text-sm text-tomato-7">{{ error }}</div>
  </label>
</template>
