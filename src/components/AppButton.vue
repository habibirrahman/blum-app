<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit'
  kind?: 'primary' | 'outline' | 'plain'
  color?: 'purple' | 'lime' | 'teal' | 'grass' | 'tomato' | 'slate'
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
      base: 'border border-slate-8 bg-slate-8 text-white hover:bg-slate-10 active:ring-2 active:ring-offset-2 active:ring-slate-10',
      loading: '!border-slate-2 !bg-slate-2'
    },
    cornflower: {
      base: 'border border-cornflower-8 bg-cornflower-8 text-white hover:bg-cornflower-10 active:ring-2 active:ring-offset-2 active:ring-cornflower-10',
      loading: '!border-cornflower-2 !bg-cornflower-2'
    },
    lime: {
      base: 'border border-lime-8 bg-lime-8 text-white hover:bg-lime-10 active:ring-2 active:ring-offset-2 active:ring-lime-10',
      loading: '!border-lime-2 !bg-lime-2'
    },
    white: {
      base: 'border border-white bg-white text-light-purple-5 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-light-purple-5 !bg-light-purple-5'
    },
    grass: {
      base: 'border border-grass-7 bg-grass-7 text-white hover:bg-grass-9 active:ring-2 active:ring-offset-2 active:ring-grass-2',
      loading: '!border-grass-2 !bg-grass-2'
    },
    tomato: {
      base: 'border border-tomato-7 bg-tomato-7 text-white hover:bg-tomato-9 active:ring-2 active:ring-offset-2 active:ring-tomato-4',
      loading: '!border-tomato-2 !bg-tomato-2'
    },
    orange: {
      base: 'border border-orange-7 bg-orange-7 text-white hover:bg-orange-9 active:ring-2 active:ring-offset-2 active:ring-orange-2',
      loading: '!border-orange-2 !bg-orange-2'
    },
    teal: {
      base: 'border border-teal-7 bg-teal-7 text-white hover:bg-teal-9 active:ring-2 active:ring-offset-2 active:ring-teal-2',
      loading: '!border-teal-2 !bg-teal-2'
    },
    prim: {
      base: 'border border-light-purple-5 bg-light-purple-5 text-white hover:bg-dark-purple-2 active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-prim-2 !bg-prim-2'
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
      base: 'border border-slate-4 bg-white text-slate-8 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-slate-10',
      loading: '!border-slate !text-slate'
    },
    cornflower: {
      base: 'border border-slate-4 bg-white text-cornflower-8 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-cornflower-2',
      loading: '!border-cornflower !text-cornflower'
    },
    lime: {
      base: 'border border-slate-4 bg-white text-lime-8 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-lime-10',
      loading: '!border-lime !text-lime'
    },
    white: {
      base: 'border border-white bg-white text-light-purple-5 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-light-purple-5 !bg-light-purple-5'
    },
    grass: {
      base: 'border border-slate-4 bg-white text-grass-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-grass-2',
      loading: '!border-grass-7 !text-grass-7'
    },
    tomato: {
      base: 'border border-slate-4 bg-white text-tomato-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-tomato-4',
      loading: '!border-tomato-7 !text-tomato-7'
    },
    orange: {
      base: 'border border-slate-4 bg-white text-orange-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-orange-2',
      loading: '!border-orange-7 !text-orange-7'
    },
    teal: {
      base: 'border border-slate-4 bg-white text-teal-7 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-teal-2',
      loading: '!border-teal-7 !text-teal-7'
    },
    prim: {
      base: 'border border-slate-4 bg-white text-light-purple-5 hover:bg-hover-state active:ring-2 active:ring-offset-2 active:ring-light-purple-2',
      loading: '!border-light-purple-5 !text-light-purple-5'
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
      base: 'bg-transparent text-slate-8 hover:bg-hover-state',
      loading: '!text-slate-8'
    },
    cornflower: {
      base: 'bg-transparent text-cornflower hover:bg-hover-state',
      loading: '!text-cornflower-8'
    },
    lime: {
      base: 'bg-transparent text-lime-8 hover:bg-hover-state',
      loading: '!text-lime-8'
    },
    white: {
      base: 'bg-transparent text-white hover:bg-hover-state',
      loading: '!text-white'
    },
    grass: {
      base: 'bg-transparent text-grass-7 hover:bg-hover-state',
      loading: '!text-grass-7'
    },
    tomato: {
      base: 'bg-transparent text-tomato-7 hover:bg-hover-state',
      loading: '!text-tomato-7'
    },
    orange: {
      base: 'bg-transparent text-orange-7 hover:bg-hover-state',
      loading: '!text-orange-7'
    },
    teal: {
      base: 'bg-transparent text-teal-7 hover:bg-hover-state',
      loading: '!text-teal-7'
    },
    prim: {
      base: 'bg-transparent text-light-purple-5 hover:bg-hover-state',
      loading: '!text-light-purple-5'
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
    class="flex relative gap-2 justify-center items-center text-sm font-semibold rounded border"
    :class="[mergedClass]"
    :disabled="disabled || loading"
    @click="emit('click')"
    :type="type"
  >
    <slot />
  </button>
</template>

<style>
/* PRIMARY */
.app-button-primary {
  &.app-button-purple {
    @apply border-light-purple-5 bg-light-purple-5 text-white;
    &.app-button-loading {
      @apply border-dark-purple-3 bg-dark-purple-3;
    }
  }
  &.app-button-lime {
    @apply border-lime-7 bg-lime-7 text-white;
    &.app-button-loading {
      @apply border-lime-10 bg-lime-10;
    }
  }
  &.app-button-teal {
    @apply border-teal-7 bg-teal-7 text-white;
    &.app-button-loading {
      @apply border-teal-10 bg-teal-10;
    }
  }
  &.app-button-grass {
    @apply border-grass-7 bg-grass-7 text-white;
    &.app-button-loading {
      @apply border-grass-10 bg-grass-10;
    }
  }
  &.app-button-tomato {
    @apply border-tomato-7 bg-tomato-7 text-white;
    &.app-button-loading {
      @apply border-tomato-10 bg-tomato-10;
    }
  }
  &.app-button-slate {
    @apply border-slate-7 bg-slate-7 text-white;
    &.app-button-loading {
      @apply border-slate-10 bg-slate-10;
    }
  }
  &.app-button-disabled {
    @apply border-slate-4 bg-slate-4 text-slate-6;
  }
}
/* OUTLINE */
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
  &.app-button-teal {
    @apply text-teal-7;
    &.app-button-loading {
      @apply border-teal-10 text-teal-10;
    }
  }
  &.app-button-grass {
    @apply text-grass-7;
    &.app-button-loading {
      @apply border-grass-10 text-grass-10;
    }
  }
  &.app-button-tomato {
    @apply text-tomato-7;
    &.app-button-loading {
      @apply border-tomato-10 text-tomato-10;
    }
  }
  &.app-button-slate {
    @apply text-slate-7;
    &.app-button-loading {
      @apply border-slate-10 text-slate-10;
    }
  }
  &.app-button-disabled {
    @apply border-slate-4 bg-slate-2 text-slate-6;
  }
}
/* PLAIN */
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
  &.app-button-teal {
    @apply text-teal-7;
    &.app-button-loading {
      @apply text-teal-10;
    }
  }
  &.app-button-grass {
    @apply text-grass-7;
    &.app-button-loading {
      @apply text-grass-10;
    }
  }
  &.app-button-tomato {
    @apply text-tomato-7;
    &.app-button-loading {
      @apply text-tomato-10;
    }
  }
  &.app-button-slate {
    @apply text-slate-7;
    &.app-button-loading {
      @apply text-slate-10;
    }
  }
  &.app-button-disabled {
    @apply text-slate-6;
  }
}
</style>
