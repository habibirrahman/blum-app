<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit'
  kind?: 'primary' | 'outline' | 'plain'
  color?:
    | 'purple'
    | 'error'
    | 'slate'
    | 'cornflower'
    | 'lime'
    | 'white'
    | 'grass'
    | 'tomato'
    | 'orange'
    | 'teal'
  size?: 'sm' | 'base' | 'lg'
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
// set default 'click' to () => {}

const isLoading = computed<boolean>(() => !props.disabled && props.loading)
const isDisabled = computed<boolean>(() => props.disabled && !props.loading)

const buttonClass: Record<string, Record<string, { base: string; loading: string }>> = {
  primary: {
    purple: {
      base: 'border border-light-purple-5 bg-light-purple-5 text-white hover:bg-dark-purple-2 active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-dark-purple-2 !bg-dark-purple-2'
    },
    error: {
      base: 'border border-error-4 bg-error-4 text-white hover:bg-error active:ring-2 active:ring-offset-2 active:ring-error-2',
      loading: '!border-error !bg-error'
    },
    slate: {
      base: 'border border-slate-7 bg-slate-7 text-white hover:bg-slate-9 active:ring-2 active:ring-offset-2 active:ring-slate-9',
      loading: '!border-slate-4 !bg-slate-4'
    },
    cornflower: {
      base: 'border border-cornflower-7 bg-cornflower-7 text-white hover:bg-cornflower-9 active:ring-2 active:ring-offset-2 active:ring-cornflower-9',
      loading: '!border-cornflower-4 !bg-cornflower-4'
    },
    lime: {
      base: 'border border-lime-7 bg-lime-7 text-white hover:bg-lime-9 active:ring-2 active:ring-offset-2 active:ring-lime-9',
      loading: '!border-lime-4 !bg-lime-4'
    },
    white: {
      base: 'border border-white bg-white text-light-purple-5 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-light-purple-5 !bg-light-purple-5'
    },
    grass: {
      base: 'border border-grass-7 bg-grass-7 text-white hover:bg-grass-9 active:ring-2 active:ring-offset-2 active:ring-grass-2',
      loading: '!border-grass-4 !bg-grass-4'
    },
    tomato: {
      base: 'border border-tomato-7 bg-tomato-7 text-white hover:bg-tomato-9 active:ring-2 active:ring-offset-2 active:ring-tomato-4',
      loading: '!border-tomato-4 !bg-tomato-4'
    },
    orange: {
      base: 'border border-orange-7 bg-orange-7 text-white hover:bg-orange-9 active:ring-2 active:ring-offset-2 active:ring-orange-2',
      loading: '!border-orange-4 !bg-orange-4'
    },
    teal: {
      base: 'border border-teal-7 bg-teal-7 text-white hover:bg-teal-9 active:ring-2 active:ring-offset-2 active:ring-teal-2',
      loading: '!border-teal-4 !bg-teal-4'
    }
  },
  outline: {
    purple: {
      base: 'border border-slate-4 bg-white text-light-purple-5 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-dark-purple-2 !text-dark-purple-2'
    },
    error: {
      base: 'border border-slate-4 bg-white text-error-4 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-error-2',
      loading: '!border-error !text-error'
    },
    slate: {
      base: 'border border-slate-4 bg-white text-slate-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-slate-9',
      loading: '!border-slate !text-slate'
    },
    cornflower: {
      base: 'border border-slate-4 bg-white text-cornflower-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-cornflower-9',
      loading: '!border-cornflower-4 !text-cornflower-4'
    },
    lime: {
      base: 'border border-slate-4 bg-white text-lime-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-lime-9',
      loading: '!border-lime-4 !text-lime-4'
    },
    white: {
      base: 'border border-white bg-white text-light-purple-5 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-light-purple-5 !bg-light-purple-5'
    },
    grass: {
      base: 'border border-slate-4 bg-white text-grass-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-grass-9',
      loading: '!border-grass-4 !text-grass-4'
    },
    tomato: {
      base: 'border border-slate-4 bg-white text-tomato-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-tomato-9',
      loading: '!border-tomato-4 !text-tomato-4'
    },
    orange: {
      base: 'border border-slate-4 bg-white text-orange-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-orange-9',
      loading: '!border-orange-4 !text-orange-4'
    },
    teal: {
      base: 'border border-slate-4 bg-white text-teal-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-teal-9',
      loading: '!border-teal-4 !text-teal-4'
    }
  },
  plain: {
    purple: {
      base: 'bg-transparent text-light-purple-5 hover:bg-hover-state',
      loading: '!text-light-purple-5'
    },
    error: {
      base: 'bg-transparent text-error-4 hover:bg-hover-state',
      loading: '!text-error-4'
    },
    slate: {
      base: 'bg-transparent text-slate-11 hover:bg-hover-state',
      loading: '!text-slate-7'
    },
    cornflower: {
      base: 'bg-transparent text-cornflower-11 hover:bg-hover-state',
      loading: '!text-cornflower-7'
    },
    lime: {
      base: 'bg-transparent text-lime-11 hover:bg-hover-state',
      loading: '!text-lime-7'
    },
    white: {
      base: 'bg-transparent text-white hover:bg-hover-state',
      loading: '!text-white'
    },
    grass: {
      base: 'bg-transparent text-grass-11 hover:bg-hover-state',
      loading: '!text-grass-7'
    },
    tomato: {
      base: 'bg-transparent text-tomato-11 hover:bg-hover-state',
      loading: '!text-tomato-7'
    },
    orange: {
      base: 'bg-transparent text-orange-11 hover:bg-hover-state',
      loading: '!text-orange-7'
    },
    teal: {
      base: 'bg-transparent text-teal-11 hover:bg-hover-state',
      loading: '!text-teal-7'
    }
  }
}

const dimentionClass: Record<string, string> = {
  sm: 'px-1.5 py-1',
  base: 'px-2 py-2',
  lg: 'px-3 py-3'
}

const mergedClass = computed<string>(() => {
  const kindEntry = buttonClass[props.kind] || buttonClass.primary
  const colorEntry = kindEntry[props.color] || kindEntry.purple

  const loadingEntry = isLoading.value ? `${colorEntry.loading} cursor-wait` : ''
  const disabledEntry = isDisabled.value ? 'pointer-events-none opacity-50' : ''

  return `${dimentionClass[props.size]} ini-color ${colorEntry.base} ini-loading ${loadingEntry} ${disabledEntry}`
})
</script>

<template>
  <button
    class="relative flex items-center justify-center gap-2 rounded border text-sm font-semibold"
    :class="[mergedClass]"
    :disabled="disabled || loading"
    @click="emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>
