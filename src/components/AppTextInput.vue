<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

export interface Props {
  label?: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
}

const model = defineModel({ type: String || Number })
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
  error: ''
})

const openPassword = ref<boolean>(false)
</script>

<template>
  <label :for="name" class="relative grid">
    <div v-if="label" className="mb-1 text-sm text-slate-10 font-medium">
      {{ label }}
      <span v-if="required" className="ml-1 text-red-700">{{ '*' }}</span>
    </div>
    <input
      class="group w-full rounded border px-4 py-2 text-sm ring-offset-2 focus:outline-none"
      :class="[
        disabled ? 'bg-slate-5 opacity-50' : 'focus:ring-2',
        error ? 'border-red-700 ring-red-200' : 'border-slate-4 ring-light-purple-2'
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
    <div v-if="error" class="mt-1 text-sm text-red-700">{{ error }}</div>
  </label>
</template>
