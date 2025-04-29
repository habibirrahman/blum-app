<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit'
  kind?: 'primary' | 'outline' | 'plain'
  color?: 'purple' | 'lime' | 'teal' | 'grass' | 'tomato' | 'prim' | 'tomato-7'
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

const isLoading = computed<boolean>(() => !props.disabled && props.loading)
const isDisabled = computed<boolean>(() => props.disabled && !props.loading)

const currentClass = computed<string>(() => {
  let name = `app-button-${props.kind} app-button-${props.color}`
  if (isDisabled.value) name += ` app-button-disabled`
  if (isLoading.value) name += ` app-button-loading`
  return name
})
</script>

<template>
  <button
    class="relative flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 border rounded"
    :class="[
      size === 'sm' ? 'px-1.5 py-1' : size === 'lg' ? 'px-3 py-3' : 'px-2 py-2',
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
    @apply border-grass-2 bg-grass-2 text-grass-7;
    &.app-button-loading {
      @apply border-grass-10 bg-grass-10;
    }
  }
  &.app-button-tomato {
    @apply border-tomato-2 bg-tomato-2 text-tomato-7;
    &.app-button-loading {
      @apply border-tomato-10 bg-tomato-10;
    }
  }
  &.app-button-tomato-7 {
    @apply border-tomato-7 bg-tomato-7 text-pure-white;
    &.app-button-loading {
      @apply border-pure-white bg-pure-white;
    }
  }
  &.app-button-prim {
    @apply border-prim-2 bg-prim-2 text-light-purple-5;
    &.app-button-loading {
      @apply border-light-purple-5 bg-light-purple-5;
    }
  }
  &.app-button-disabled {
    @apply border-slate-4 bg-slate-4 text-slate-6;
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
  &.app-button-teal {
    @apply text-teal-7;
    &.app-button-loading {
      @apply border-teal-10 text-teal-10;
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
  &.app-button-teal {
    @apply text-teal-7;
    &.app-button-loading {
      @apply text-teal-10;
    }
  }
  &.app-button-disabled {
    @apply text-slate-6;
  }
}
</style>
