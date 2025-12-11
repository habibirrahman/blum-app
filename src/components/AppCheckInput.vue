<script setup lang="ts">
import { onMounted, ref, useSlots, watch } from 'vue'

interface Props {
  name: string
  checked?: boolean
  disabled?: boolean
  required?: boolean
  error?: string | boolean
}
interface Emits {
  (e: 'change', event: InputEvent): void
}
// v-model -- for checked
const model = defineModel<boolean>()
// v-model:indeterminate -- for indeterminate
const indeterminate = defineModel<boolean>('indeterminate')

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  required: false,
  error: false
})
const emit = defineEmits<Emits>()

const slots = useSlots()

const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.checked,
  (val) => {
    model.value = val
  },
  { immediate: true }
)

watch(indeterminate, (val) => {
  if (inputEl.value) {
    inputEl.value.indeterminate = val ?? false
  }
})

onMounted(() => {
  if (inputEl.value) {
    inputEl.value.indeterminate = indeterminate.value ?? false
  }
})
</script>

<template>
  <div>
    <label :for="name" class="flex items-center gap-3 cursor-pointer">
      <input
        :id="name"
        ref="inputEl"
        type="checkbox"
        :checked="checked"
        v-model="model"
        v-bind="$attrs"
        :disabled="disabled"
        :required="required"
        class="w-5 h-5 rounded cursor-pointer accent-light-purple shrink-0 border-slate-6 text-light-purple-5 ring-offset-2 focus:ring-light-purple-3"
        :class="{
          'focus:ring-2': !disabled,
          'focus:ring-light-purple-2': !error,
          'focus:ring-tomato-2': error
        }"
        @change="emit('change', $event as InputEvent)"
      />
      <div v-if="slots.default" class="text-sm text-slate-8">
        <slot></slot>
      </div>
    </label>
    <div v-if="error && error !== true" class="mt-1 text-sm text-tomato-7">{{ error }}</div>
  </div>
</template>
