<script setup lang="ts">
import { computed, ref } from 'vue'
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
  suffix_text?: string
  borderless?: boolean
  rows?: number
}

const model = defineModel({ type: String || Number })
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
  error: false,
  suffix_icon: '',
  suffix_text: '',
  borderless: false,
  rows: 4
})

const openPassword = ref<boolean>(false)
const minHeight = computed(() => {
  if (props.type === 'textarea') {
    const padding = props.borderless ? 8 : 16
    return props.rows! * 24 + padding + 'px'
  }
  return 'auto'
})

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
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
      class="field-sizing-content group w-full resize-none rounded text-[16px] outline-none ring-offset-2 transition-all focus:outline-none"
      :class="{
        'focus:ring-2': !disabled,
        'bg-slate-2': disabled,
        'border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2': !error,
        'border-tomato-7 focus:ring-tomato-2': error,
        'border px-4 py-2': !borderless,
        '!border-none px-0 py-1 focus:!ring-0': borderless
      }"
      :style="{ minHeight }"
    ></textarea>
    <input
      v-else
      :id="name"
      :name="name"
      :type="type === 'password' ? (openPassword ? 'text' : 'password') : type"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
      class="group h-full w-full rounded text-[16px] outline-none ring-offset-2 transition-all focus:outline-none"
      :class="{
        'focus:ring-2': !disabled,
        'bg-slate-2': disabled,
        'border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2': !error,
        'border-tomato-7 focus:ring-tomato-2': error,
        'border py-2': !borderless,
        'border-none px-0 py-1 focus:ring-0': borderless,
        'pr-10': type === 'password' || suffix_icon
      }"
    />

    <Icon
      v-if="type === 'password'"
      :icon="openPassword ? 'ph:eye-closed' : 'ph:eye'"
      class="absolute text-2xl cursor-pointer right-2 text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-1.5']"
      @click.prevent="openPassword = !openPassword"
    />
    <div
      v-if="suffix_text"
      class="absolute right-2 cursor-pointer text-[16px] text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-1.5']"
    >
      {{ suffix_text }}
    </div>
    <Icon
      v-if="suffix_icon"
      :icon="suffix_icon"
      class="absolute text-2xl cursor-pointer right-2 text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-1.5']"
    />
    <div v-if="error" class="mt-1 text-sm text-tomato-7">{{ error === true ? '' : error }}</div>
  </label>
</template>
