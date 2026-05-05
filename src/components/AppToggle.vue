<script setup lang="ts">
interface Props {
  name: string
  color?: 'primary' | 'lime'
  checked?: boolean
  disabled?: boolean
  loading?: boolean
}
interface Emits {
  (e: 'change', checked: boolean): void
}

withDefaults(defineProps<Props>(), {
  color: 'primary',
  checked: false,
  disabled: false,
  loading: false
})
const emit = defineEmits<Emits>()
</script>

<template>
  <label
    :for="name"
    class="relative flex h-4 w-8 shrink-0 items-center rounded-full border transition-colors"
    :class="[
      checked
        ? `border-transparent ${color === 'lime' ? ' bg-lime-7' : 'bg-light-purple-5'} `
        : 'border-slate-5 bg-slate-4',
      disabled || loading ? 'pointer-events-none' : 'cursor-pointer',
      disabled ? 'opacity-50 !grayscale' : ''
    ]"
  >
    <input
      :id="name"
      type="checkbox"
      class="opacity-0"
      :class="{ 'pointer-events-none': disabled || loading }"
      @click="emit('change', !checked)"
    />
    <div
      class="absolute h-3 w-3 rounded-full bg-white"
      :style="{ left: checked ? '17px' : '1px' }"
    ></div>
  </label>
</template>
