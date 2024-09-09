<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  label?: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string | boolean
  suffix_icon?: string
  borderless?: boolean
}

const model = defineModel({ type: String || Number })
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
  error: false,
  suffix_icon: '',
  borderless: false
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
    <textarea
      v-if="type === 'textarea'"
      :id="name"
      :name="name"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
      class="group h-full w-full rounded text-sm outline-none ring-offset-2 transition-all focus:outline-none"
      :class="{
        'focus:ring-2': !disabled,
        'bg-slate-2': disabled,
        'border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2': !error,
        'border-tomato-7 focus:ring-tomato-2': error,
        'border px-4 py-2': !borderless,
        'border-none px-0 py-1 focus:ring-0': borderless
      }"
    ></textarea>
    <input
      v-else
      :id="name"
      :name="name"
      :type="type === 'password' ? (openPassword ? 'text' : 'password') : type"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
      class="group h-full w-full rounded text-sm outline-none ring-offset-2 transition-all focus:outline-none"
      :class="{
        'focus:ring-2': !disabled,
        'bg-slate-2': disabled,
        'border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2': !error,
        'border-tomato-7 focus:ring-tomato-2': error,
        'border px-4 py-2': !borderless,
        'border-none px-0 py-1 focus:ring-0': borderless
      }"
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
    <div v-if="error" class="mt-1 text-sm text-tomato-7">{{ error === true ? '' : error }}</div>
  </label>
</template>
