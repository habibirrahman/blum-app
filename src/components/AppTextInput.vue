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
}

const model = defineModel({ type: String || Number })
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false
})

const openPassword = ref<boolean>(false)
</script>

<template>
  <label :for="name" class="relative grid">
    <div v-if="label" className="mb-1 text-sm text-slate-10">
      {{ label }}
      <span v-if="required" className="ml-1 text-red-7">{{ '*' }}</span>
    </div>
    <input
      class="group w-full rounded border px-4 py-2 text-sm ring-light-purple-200 ring-offset-2 focus:outline-none"
      :class="[disabled ? 'bg-grey-5 opacity-50' : 'focus:border-light-tosca focus:ring-2']"
      :id="name"
      :type="type === 'password' ? (openPassword ? 'text' : 'password') : type"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
    />
    <Icon
      v-if="type === 'password'"
      :icon="openPassword ? 'ph:eye-closed' : 'ph:eye'"
      class="text-slate-7 absolute right-2 cursor-pointer text-2xl"
      :class="[label ? 'top-8' : 'bottom-2']"
      @click.prevent="openPassword = !openPassword"
    />
  </label>
</template>
