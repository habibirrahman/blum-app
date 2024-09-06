<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit'
  kind?: 'primary' | 'outline' | 'plain'
  color?: 'purple' | 'lime'
  size?: 'base' | 'lg'
  disabled?: boolean
  loading?: boolean
}
interface Emits {
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  kind: 'primary',
  color: 'purple',
  size: 'base',
  disabled: false,
  loading: false
})
const emit = defineEmits<Emits>()

const isLoading = computed<boolean>(() => !props.disabled && props.loading)
const isDisabled = computed<boolean>(() => props.disabled && !props.loading)

const isPrimary = computed<boolean>(
  () => !props.disabled && !props.loading && props.kind === 'primary'
)
const isPrimaryLoading = computed<boolean>(() => isLoading.value && props.kind === 'primary')
const isPrimaryDisabled = computed<boolean>(() => isDisabled.value && props.kind === 'primary')

const isOutline = computed<boolean>(
  () => !props.disabled && !props.loading && props.kind === 'outline'
)
const isOutlineLoading = computed<boolean>(() => isLoading.value && props.kind === 'outline')
const isOutlineDisabled = computed<boolean>(() => isDisabled.value && props.kind === 'outline')

const isPlain = computed<boolean>(() => !props.disabled && !props.loading && props.kind === 'plain')
const isPlainLoading = computed<boolean>(() => isLoading.value && props.kind === 'plain')
const isPlainDisabled = computed<boolean>(() => isDisabled.value && props.kind === 'plain')

const currentClass = computed<string>(() => {
  let name = `app-button-${props.kind} app-button-${props.color}`
  if (isDisabled.value) name += ` app-button-disabled`
  if (isLoading.value) name += ` app-button-loading`
  return name
})
</script>

<template>
  <button
    class="relative flex items-center justify-center rounded border text-sm font-semibold transition-all duration-300"
    :class="[
      size === 'lg' ? 'px-3 py-3' : 'px-2 py-2',
      isDisabled || isLoading ? 'pointer-events-none' : '',
      currentClass
    ]"
    :disabled="disabled"
    @click="emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>

<style>
.app-button-primary {
  @apply text-white;
  &.app-button-purple {
    @apply border-light-purple-5 bg-light-purple-5;
    &.app-button-loading {
      @apply border-dark-purple-3 bg-dark-purple-3;
    }
  }
  &.app-button-lime {
    @apply border-lime-7 bg-lime-7;
    &.app-button-loading {
      @apply border-lime-10 bg-lime-10;
    }
  }
  &.app-button-disabled {
    @apply border-slate-4 bg-slate-4;
  }
}
/*  */
.app-button-outline {
  @apply border-slate-5 bg-white;
  &.app-button-purple {
    @apply text-light-purple-5;
    &.app-button-loading {
      @apply border-dark-purple-3 text-dark-purple-3;
    }
  }
  &.app-button-lime {
    @apply text-lime-7;
    &.app-button-loading {
      @apply border-lime-10 text-lime-10;
    }
  }
  &.app-button-disabled {
    @apply border-slate-4 bg-slate-2 text-slate-6;
  }
}
/*  */
.app-button-plain {
  @apply border-transparent bg-transparent;
  &.app-button-purple {
    @apply text-light-purple-5;
    &.app-button-loading {
      @apply text-dark-purple-3;
    }
  }
  &.app-button-lime {
    @apply text-lime-7;
    &.app-button-loading {
      @apply text-lime-10;
    }
  }
  &.app-button-disabled {
    @apply text-slate-6;
  }
}
</style>
