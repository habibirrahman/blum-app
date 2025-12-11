<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  label?: string
  name: string
  format?: string // 'hms', 'hm', 'ms', 'h', 'm', 's'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string | boolean
  showIcon?: boolean
}

const model = defineModel<string>({ default: '' })
const props = withDefaults(defineProps<Props>(), {
  format: 'hms',
  placeholder: '--',
  disabled: false,
  required: false,
  error: false,
  showIcon: true
})

const focused = ref<boolean>(false)
const hours = ref<string>('')
const minutes = ref<string>('')
const seconds = ref<string>('')

// Parse model value to hours, minutes, seconds
const parseModelValue = (value: string) => {
  if (!value) {
    hours.value = ''
    minutes.value = ''
    seconds.value = ''
    return
  }

  const parts = value.split(':')
  const format = props.format.toLowerCase()

  if (format.includes('h')) {
    const hIndex = format.indexOf('h')
    hours.value = parts[hIndex] || ''
  }
  if (format.includes('m')) {
    const mIndex = format.indexOf('m')
    minutes.value = parts[mIndex] || ''
  }
  if (format.includes('s')) {
    const sIndex = format.indexOf('s')
    seconds.value = parts[sIndex] || ''
  }
}

// Watch model value changes
watch(() => model.value, (newValue) => {
  parseModelValue(newValue)
}, { immediate: true })

// Format number with padding
const formatNumber = (value: string, max: number): string => {
  let num = parseInt(value)
  if (isNaN(num) || num < 0) return '00'
  if (num > max) num = max
  return num.toString().padStart(2, '0')
}

// Handle input change
const handleChange = () => {
  const format = props.format.toLowerCase()
  const values: string[] = []

  const h = formatNumber(hours.value, 99)
  const m = formatNumber(minutes.value, 59)
  const s = formatNumber(seconds.value, 59)

  hours.value = h
  minutes.value = m
  seconds.value = s

  // Build value based on format
  for (let i = 0; i < format.length; i++) {
    if (format[i] === 'h') values.push(h)
    if (format[i] === 'm') values.push(m)
    if (format[i] === 's') values.push(s)
  }

  if (!props.disabled) {
    model.value = values.join(':')
  }
}

// Check if format includes specific unit
const showHours = computed(() => props.format.toLowerCase().includes('h'))
const showMinutes = computed(() => props.format.toLowerCase().includes('m'))
const showSeconds = computed(() => props.format.toLowerCase().includes('s'))
</script>

<template>
  <label :for="name" class="relative grid w-full">
    <div
      v-if="label"
      class="mb-1 text-sm font-medium"
      :class="[error ? 'text-tomato-7' : 'text-slate-8']"
    >
      <span>{{ label }}</span>
      <span v-if="required" class="ml-1 text-tomato-7">{{ '*' }}</span>
    </div>

    <div class="relative w-full">
      <!-- Icon -->
      <Icon
        v-if="showIcon"
        icon="iconoir:timer-solid"
        class="pointer-events-none absolute bottom-2 left-4 z-10 text-2xl transition-colors"
        :class="[focused && !disabled ? 'text-light-purple-5' : 'text-slate-10']"
      />

      <!-- Input Container -->
      <div
        class="flex h-10 w-full items-center gap-1 rounded border px-4 transition-all"
        :class="{
          'border-light-purple-5 ring-2 ring-light-purple-2': focused && !error && !disabled,
          'border-tomato-7 ring-2 ring-tomato-2 ring-offset-2': focused && error && !disabled,
          'border-slate-4': !focused && !error,
          'border-tomato-7': !focused && error,
          'bg-slate-2 opacity-50': disabled,
          'pl-12': showIcon,
        }"
      >
        <!-- Hours -->
        <input
          v-if="showHours"
          type="number"
          :id="name"
          :placeholder="placeholder"
          :disabled="disabled"
          v-model="hours"
          @focus="focused = true"
          @blur="focused = false"
          @input="handleChange"
          class="h-full w-6 p-0 flex-shrink-0 bg-transparent text-center text-[16px] outline-none border-none ring-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <!-- Divider : -->
        <div v-if="showHours && showMinutes" class="flex h-full items-center justify-center text-sm">
          :
        </div>

        <!-- Minutes -->
        <input
          v-if="showMinutes"
          type="number"
          :placeholder="placeholder"
          :disabled="disabled"
          v-model="minutes"
          @focus="focused = true"
          @blur="focused = false"
          @input="handleChange"
          class="h-full w-6  p-0 flex-shrink-0 bg-transparent text-center text-[16px] outline-none border-none ring-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <!-- Divider : -->
        <div v-if="showMinutes && showSeconds" class="flex h-full items-center justify-center text-sm">
          :
        </div>

        <!-- Seconds -->
        <input
          v-if="showSeconds"
          type="number"
          :placeholder="placeholder"
          :disabled="disabled"
          v-model="seconds"
          @focus="focused = true"
          @blur="focused = false"
          @input="handleChange"
          class="h-full w-6  p-0 flex-shrink-0 bg-transparent text-center text-[16px] outline-none border-none ring-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>

    <div v-if="error" class="mt-1 text-sm text-tomato-7">
      {{ error === true ? '' : error }}
    </div>
  </label>
</template>