<script setup lang="ts">
import { TransitionRoot, TransitionChild } from '@headlessui/vue'

interface Props {
  show: boolean
}
interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {})
const emit = defineEmits<Emits>()
</script>

<template>
  <!-- The `show` prop controls all nested `TransitionChild` components. -->
  <TransitionRoot :show="show" class="fixed z-[999]">
    <!-- Background overlay -->
    <TransitionChild
      enter="transition-opacity ease-linear duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="transition-opacity ease-linear duration-300"
      leave-from="opacity-100"
      leave-to="opacity-0"
      @click="emit('close')"
    >
      <div class="fixed inset-0 bg-[#151021]/50" aria-hidden="true" />
    </TransitionChild>

    <!-- Sliding -->
    <TransitionChild
      enter="transition ease-in-out duration-300 transform"
      enter-from="translate-y-full"
      enter-to="-translate-y-0"
      leave="transition ease-in-out duration-300 transform"
      leave-from="-translate-y-0"
      leave-to="translate-y-full"
      class="fixed bottom-0 left-0 w-screen px-safe pb-safe"
    >
      <div class="rounded-t-2xl bg-white py-4">
        <div class="max-h-[calc(100vh-72px)] overflow-y-auto px-4">
          <slot />
        </div>
      </div>
    </TransitionChild>
  </TransitionRoot>
</template>
