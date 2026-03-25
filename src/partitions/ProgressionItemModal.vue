<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { Icon } from '@iconify/vue'

interface Props {
  show: boolean
  options: { value: number; label: string; color: string }[]
  selected: number[]
  useMultipleSelect?: boolean
  resetAble?: boolean
}

interface Emits {
  (e: 'set-query', value: string): void
  (e: 'close'): void
  (e: 'apply', value: number[]): void
  (e: 'reset'): void
}

const props = withDefaults(defineProps<Props>(), {
  useMultipleSelect: true,
  resetAble: true
})

const emit = defineEmits<Emits>()

const queryState = ref<string>('')
const selectedState = ref<number[]>([...props.selected])

// Computed untuk filter progression berdasarkan query
const filteredOptions = computed(() => {
  if (!queryState.value.trim()) {
    return props.options
  }

  const query = queryState.value.toLowerCase().trim()
  return props.options.filter((opt) => opt.label.toLowerCase().includes(query))
})

// Watch untuk sync dengan props
watch(
  () => props.selected,
  (newVal) => {
    selectedState.value = [...newVal]
  }
)

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      selectedState.value = [...props.selected]
      queryState.value = ''
    }
  }
)

watch(queryState, (val) => {
  emit('set-query', val)
})

const onCheck = (val: number) => {
  if (props.useMultipleSelect) {
    // Multiple select (checkbox)
    if (selectedState.value.includes(val)) {
      selectedState.value = selectedState.value.filter((i) => i !== val)
    } else {
      selectedState.value = [...selectedState.value, val]
    }
  } else {
    // Single select (radio)
    selectedState.value = [val]
  }
}

const onReset = () => {
  selectedState.value = []
  emit('reset')
}

const onApply = () => {
  emit('apply', selectedState.value)
}
</script>

<template>
  <AppActionSheet :show="show" @close="emit('close')">
    <div>
      <div class="sticky top-0 z-10 w-full space-y-3 bg-white py-3">
        <div class="flex w-full items-center justify-between">
          <div class="text-xl font-semibold">Progression</div>
          <div class="cursor-pointer" @click="emit('close')">
            <Icon icon="ph:x" class="text-2xl" />
          </div>
        </div>
        <AppTextInput
          name="query"
          placeholder="Search progression"
          v-model="queryState"
          suffix-icon="ph:magnifying-glass"
        />
      </div>

      <div>
        <!-- Tampilkan pesan jika tidak ada hasil -->
        <div
          v-if="filteredOptions.length === 0"
          class="flex h-full items-center justify-center text-slate-5"
        >
          <div class="text-center">
            <Icon icon="ph:magnifying-glass" class="mx-auto mb-2 text-4xl" />
            <p>No progression found</p>
          </div>
        </div>

        <div
          v-for="opt in filteredOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
        >
          <label :for="`progression_filter_${opt.value}`" class="grow truncate text-sm">
            {{ opt.label }}
          </label>

          <!-- Checkbox untuk multiple select -->
          <input
            v-if="useMultipleSelect"
            type="checkbox"
            :name="`progression_filter_${opt.value}`"
            :id="`progression_filter_${opt.value}`"
            :checked="selectedState.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheck(opt.value)"
          />

          <!-- Radio untuk single select -->
          <input
            v-else
            type="radio"
            name="progression_filter"
            :id="`progression_filter_${opt.value}`"
            :checked="selectedState.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheck(opt.value)"
          />
        </div>
      </div>

      <div class="sticky bottom-0 z-10 flex w-full items-center justify-center gap-2 bg-white py-3">
        <AppButton class="w-full" v-if="resetAble" kind="plain" @click="onReset"> Reset </AppButton>
        <AppButton class="w-full" @click="onApply">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>
