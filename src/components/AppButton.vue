<script setup lang="ts">
export interface Props {
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}
export interface Emits {
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  disabled: false,
  loading: false
})
const emit = defineEmits<Emits>()
</script>

<template>
  <button
    class="relative flex items-center justify-center rounded bg-light-purple px-4 py-2 text-white ring-light-purple-200 ring-offset-2 hover:bg-dark-purple-200 active:ring-2"
    :class="{
      'pointer-events-none cursor-wait bg-dark-purple-200 ring-2': loading,
      'bg-slate-600': disabled
    }"
    :disabled="disabled"
    @click="$emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>
