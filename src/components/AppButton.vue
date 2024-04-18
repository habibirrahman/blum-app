<script setup lang="ts">
export interface Props {
  disabled?: boolean
  type?: 'button' | 'submit'
}
export interface Emits {
  (e: 'click'): void
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  type: 'button'
})
defineEmits<Emits>()
</script>

<template>
  <button
    class="ring-light-purple-200 bg-light-purple hover:bg-dark-purple-200 relative flex items-center justify-center rounded px-4 py-2 text-white ring-offset-2 active:ring-2"
    :disabled="disabled"
    @click="$emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>
