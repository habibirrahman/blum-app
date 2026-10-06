<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  id?: string
  label?: string
  name: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea'
  placeholder?: string
  caption?: string
  disabled?: boolean
  required?: boolean
  optional?: boolean
  error?: string | boolean
  suffixIcon?: string
  suffixText?: string
  borderless?: boolean
  rows?: number
  maxLength?: number
}

const model = defineModel<string | number | null>()
const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  rows: 5
})

const slots = useSlots()
/**
 * caption: text under the field
 */

const isShowPassword = ref<boolean>(false)

const minHeightTextarea = computed(() => {
  const padding = props.borderless ? 8 : 16
  return props.rows! * 24 + padding + 'px'
})

const errorState = computed(() => {
  if (props.maxLength && (model.value?.toString() || '').length > props.maxLength) {
    return 'Maximum length reached.'
  }
  return props.error
})
</script>

<template>
  <label :for="name" class="flex relative flex-col">
    <div
      v-if="label"
      class="mb-1 text-sm font-medium"
      :class="[errorState ? 'text-tomato-7' : 'text-slate-8']"
    >
      <span>{{ label }}</span>
      <span v-if="required" class="ml-1 text-tomato-7">{{ '*' }}</span>
      <span v-if="optional" class="ml-1 text-slate-6">{{ '(Optional)' }}</span>
    </div>

    <textarea
      v-if="type === 'textarea'"
      :id="name"
      :name="name"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
      class="field-sizing-content group w-full resize-none rounded text-[16px] outline-none ring-offset-2 transition-colors focus:outline-none"
      :class="{
        'focus:ring-2': !disabled,
        'bg-slate-2': disabled,
        'border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2': !errorState,
        'border-tomato-7 focus:ring-tomato-2': errorState,
        'border px-4 py-2': !borderless,
        '!border-none px-0 py-1 focus:!ring-0': borderless
      }"
      :style="{ minHeight: minHeightTextarea }"
    ></textarea>

    <input
      v-else
      :id="name"
      :name="name"
      :type="type === 'password' ? (isShowPassword ? 'text' : 'password') : type"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="model"
      class="group h-full w-full rounded text-[16px] outline-none ring-offset-2 transition-colors focus:outline-none"
      :class="{
        'focus:ring-2': !disabled,
        'bg-slate-2': disabled,
        'border-slate-4 focus:border-light-purple-5 focus:ring-light-purple-2': !errorState,
        'border-tomato-7 focus:ring-tomato-2': errorState,
        'border py-2': !borderless,
        'border-none px-0 py-1 focus:ring-0': borderless,
        'pr-10': type === 'password' || suffixIcon
      }"
    />

    <!-- Password Toggle Icon -->
    <Icon
      v-if="type === 'password'"
      :icon="isShowPassword ? 'ph:eye-closed' : 'ph:eye'"
      class="absolute right-2 text-2xl cursor-pointer text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-1.5']"
      @click.prevent="isShowPassword = !isShowPassword"
    />

    <!-- Suffix Text -->
    <div
      v-if="suffixText"
      class="absolute right-2 cursor-pointer text-[16px] text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-1.5']"
    >
      {{ suffixText }}
    </div>

    <!-- Suffix Icon -->
    <Icon
      v-if="suffixIcon"
      :icon="suffixIcon"
      class="absolute right-2 text-2xl cursor-pointer text-slate-7"
      :class="[label ? 'top-[30px]' : 'top-1.5']"
    />

    <div v-if="errorState" class="mt-1 text-sm text-tomato-7">
      {{ errorState === true ? '' : error }}
    </div>

    <div v-if="caption || maxLength" class="flex gap-2 justify-between mt-1">
      <div v-if="caption" class="text-xs text-slate-8">{{ caption }}</div>
      <div
        v-if="maxLength"
        class="text-xs"
        :class="[model?.toString().length! >= maxLength ? 'text-tomato-7' : 'text-slate-6']"
      >
        {{ model?.toString().length || 0 }}/{{ maxLength }}
      </div>
    </div>

    <div v-if="slots.caption" class="mt-1 text-sm text-slate-7">
      <slot name="caption"></slot>
    </div>
  </label>
</template>
