<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  page: number
  per_page?: number
  total_count: number
  disabled?: boolean
}
interface Emits {
  (e: 'change', val: number): void
}

const props = withDefaults(defineProps<Props>(), {
  per_page: 25,
  disabled: false
})
const emit = defineEmits<Emits>()

const pages = computed<(number | null)[]>(() => {
  const count = Math.ceil(props.total_count / props.per_page)
  if (count <= 7) {
    const p = []
    for (let i = 1; i <= count; i++) {
      p.push(i)
    }
    return p
  }
  let before = []
  let after = []

  if (props.page <= 4) {
    before = [1, 2, 3, 4]
    after = [5, null, count]
  } else if (count - props.page < 4) {
    before = [1, null, count - 4]
    after = [count - 3, count - 2, count - 1, count]
  } else {
    for (let i = 1; i <= props.page; i++) {
      before.push(i)
    }
    for (let i = before[before.length - 1] + 1; i <= count; i++) {
      after.push(i)
    }
    if (before.length >= 5) {
      before = [1, null, before[before.length - 2], before[before.length - 1]]
    }
    if (after.length >= 4) {
      after = [after[0], null, after[after.length - 1]]
    }
  }

  return [...before, ...after]
})
</script>

<template>
  <div v-if="total_count > per_page" class="flex items-center justify-center gap-2 px-4 py-4">
    <div
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xl transition-all"
      :class="{
        'bg-white text-slate-8': page > 1,
        'bg-slate-2 text-slate-6': page === 1
      }"
      @click="$emit('change', page - 1)"
    >
      <Icon icon="ph:caret-left" />
    </div>
    <div v-for="(i, idx) in pages" :key="idx">
      <div
        v-if="i"
        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-sm transition-all"
        :class="{ 'bg-light-purple-5 text-white': page === i, 'bg-white text-slate-8': page !== i }"
        @click="$emit('change', i)"
      >
        {{ i }}
      </div>
      <div
        v-else
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white text-sm text-slate-8"
      >
        ...
      </div>
    </div>
    <div
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xl transition-all"
      :class="{
        'bg-white text-slate-8': page < Number(pages[pages.length - 1]),
        'bg-slate-2 text-slate-6': page === Number(pages[pages.length - 1])
      }"
      @click="$emit('change', page + 1)"
    >
      <Icon icon="ph:caret-right" />
    </div>
  </div>
</template>
