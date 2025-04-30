<script setup lang="ts">
interface Props {
  name: string
  checked?: boolean
  disabled?: boolean
  loading?: boolean
}
interface Emits {
  (e: 'change', checked: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  checked: false,
  disabled: false,
  loading: false
})
const emit = defineEmits<Emits>()

</script>

<template>
  <label
    :for="name"
    class="relative flex items-center w-8 h-4 transition-all border rounded-full cursor-pointer shrink-0"
    :class="{
      'border-transparent bg-light-purple-3': checked,
      'border-slate-5 bg-slate-4': !checked,
      'pointer-events-none': disabled || loading
    }"
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
