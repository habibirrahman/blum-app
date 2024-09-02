<script setup lang="ts">
import { computed } from 'vue'

export interface Props {
  type?: 'button' | 'submit'
  kind?: 'primary' | 'outline' | 'plain'
  size?: 'base' | 'sm'
  disabled?: boolean
  loading?: boolean
}
export interface Emits {
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  kind: 'primary',
  size: 'base',
  disabled: false,
  loading: false
})
const emit = defineEmits<Emits>()

const isLoading = computed(() => !props.disabled && props.loading)
const isDisabled = computed(() => props.disabled && !props.loading)

const isPrimary = computed(() => !props.disabled && !props.loading && props.kind === 'primary')
const isPrimaryLoading = computed(() => isLoading.value && props.kind === 'primary')
const isPrimaryDisabled = computed(() => isDisabled.value && props.kind === 'primary')

const isOutline = computed(() => !props.disabled && !props.loading && props.kind === 'outline')
const isOutlineLoading = computed(() => isLoading.value && props.kind === 'outline')
const isOutlineDisabled = computed(() => isDisabled.value && props.kind === 'outline')

const isPlain = computed(() => !props.disabled && !props.loading && props.kind === 'plain')
const isPlainLoading = computed(() => isLoading.value && props.kind === 'plain')
</script>

<template>
  <button
    class="relative flex items-center justify-center rounded text-sm font-semibold transition-all"
    :class="{
      'px-3 py-3': size === 'base',
      'px-2 py-2': size === 'sm',
      'bg-light-purple-5 text-white hover:bg-dark-purple-1': isPrimary,
      'text-light-purple-5 border border-slate-5 bg-white hover:border-dark-purple-1 hover:text-dark-purple-1':
        isOutline,
      'text-light-purple-5 hover:border-dark-purple-1 hover:text-dark-purple-1': isPlain,
      'pointer-events-none text-slate-6': isDisabled,
      'bg-slate-4': isPrimaryDisabled,
      'border border-slate-4 bg-slate-2': isOutlineDisabled,
      'pointer-events-none cursor-wait': isLoading,
      'bg-dark-purple-3 text-white': isPrimaryLoading,
      'border border-dark-purple-3 text-dark-purple-3': isOutlineLoading,
      'text-dark-purple-3': isPlainLoading
    }"
    :disabled="disabled"
    @click="$emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>
