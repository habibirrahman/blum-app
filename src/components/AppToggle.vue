<script setup lang="ts">
import { getRandomString } from '@/lib/func'
import { computed } from 'vue'

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

const inputId = computed<string>(() => getRandomString())
</script>

<template>
  <label
    :for="name"
    class="relative flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border transition-all"
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
      class="absolute h-3 w-3 rounded-full bg-white transition-all"
      :style="{ left: checked ? '17px' : '1px' }"
    ></div>
  </label>
</template>
