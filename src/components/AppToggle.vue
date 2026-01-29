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
    class="relative flex items-center w-8 h-4 transition-all border rounded-full shrink-0"
    :class="[
      checked
        ? `border-transparent ${color === 'lime' ? ' bg-lime-7' : 'bg-light-purple-5'} `
        : 'border-slate-5 bg-slate-4',
      disabled || loading ? 'pointer-events-none' : 'cursor-pointer',
      disabled ? '!grayscale opacity-50' : ''
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
      class="absolute w-3 h-3 transition-all bg-white rounded-full"
      :style="{ left: checked ? '17px' : '1px' }"
    ></div>
  </label>
</template>
