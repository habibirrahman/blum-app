<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'

defineOptions({
  name: 'AppPopover'
})

interface Props {
  drop?: 'down' | 'up' | 'left' | 'right' | 'left-up'
  direction?: 'left' | 'right'
  popoverClass?: string
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  drop: 'down',
  direction: 'right'
})
const model = defineModel<boolean>({
  default: true
})

const dropClass: Record<string, string> = {
  down: 'top-full mt-2.5',
  up: 'bottom-full mb-2.5',
  left: 'top-full mt-2.5 right-0 left-auto md:right-full md:mr-4 md:top-0 md:bottom-auto md:right-auto',
  right:
    'top-full mt-2.5 left-0 right-auto md:left-full md:ml-4 md:top-0 md:bottom-auto md:left-auto',
  'left-up':
    'bottom-full mb-2.5 right-0 left-auto md:right-full md:mr-4 md:bottom-0 md:top-auto md:right-auto'
}
</script>

<template>
  <Popover v-slot="{ open }" v-model="model" class="relative">
    <!-- Mirror state popover to parent -->
    <span v-if="open !== model" class="hidden">
      {{ (model = open) }}
    </span>

    <PopoverButton
      as="div"
      :disabled="disabled"
      class="transition-all focus:ring-2"
      :class="[disabled ? 'cursor-not-allowed' : 'cursor-pointer']"
    >
      <!-- :class="[open ? 'brightness-90' : 'brightness-100']" -->
      <slot name="button" :open="open"></slot>
    </PopoverButton>

    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <PopoverPanel
        v-slot="{ close }"
        class="absolute z-50 w-auto rounded shadow-xl transform grow"
        :class="[
          popoverClass,
          dropClass[drop],
          {
            'right-0': direction === 'left' && !['left', 'right', 'left-up'].includes(drop),
            'left-0': direction === 'right' && !['left', 'right', 'left-up'].includes(drop)
          }
        ]"
      >
        <!-- extra space for scroll boundary -->
        <!-- <div v-if="drop === 'up'" class="flex h-8 grow" @click="close"></div> -->

        <slot name="popover" :close="close"></slot>

        <!-- extra space for scroll boundary -->
        <!-- <div v-if="drop === 'down'" class="flex h-8 grow" @click="close"></div> -->
      </PopoverPanel>
    </transition>
  </Popover>
</template>
