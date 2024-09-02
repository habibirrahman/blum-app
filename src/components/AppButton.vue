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
    class="ring-light-purple-2 hover:bg-dark-purple-2 relative flex items-center justify-center rounded bg-light-purple-5 px-4 py-2 text-white ring-offset-2 active:ring-2"
    :class="{
      'bg-dark-purple-2 pointer-events-none cursor-wait ring-2': loading,
      'bg-slate-6': disabled
    }"
    :disabled="disabled"
    @click="$emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>
