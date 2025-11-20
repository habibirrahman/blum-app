<script lang="ts" setup>
import { ref, watch } from 'vue'
import AppActionSheet from '@/components/AppActionSheet.vue'
import AppButton from '@/components/AppButton.vue'
import AppTextInput from '@/components/AppTextInput.vue'
import { Icon } from '@iconify/vue'

interface Props {
  show: boolean
  curriculumOptions: { value: number; label: string; color: string }[]
  selectedCurriculum: number[]
  useMultipleSelect?: boolean
  resetAble?: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'apply', value: number[]): void
  (e: 'reset'): void
  (e: 'update:curriculumQuery', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  useMultipleSelect: true,
  resetAble: true
})

const emit = defineEmits<Emits>()

const curriculumQuery = ref<string>('')
const selectCurriculums = ref<number[]>([...props.selectedCurriculum])

// Watch untuk sync dengan props
watch(() => props.selectedCurriculum, (newVal) => {
  selectCurriculums.value = [...newVal]
})

watch(() => props.show, (newVal) => {
  if (newVal) {
    selectCurriculums.value = [...props.selectedCurriculum]
    curriculumQuery.value = ''
  }
})

watch(curriculumQuery, (val) => {
  emit('update:curriculumQuery', val)
})

const onCheckCurriculum = (val: number) => {
  if (props.useMultipleSelect) {
    // Multiple select (checkbox)
    if (selectCurriculums.value.includes(val)) {
      selectCurriculums.value = selectCurriculums.value.filter((i) => i !== val)
    } else {
      selectCurriculums.value = [...selectCurriculums.value, val]
    }
  } else {
    // Single select (radio)
    selectCurriculums.value = [val]
  }
}

const onResetCurriculum = () => {
  selectCurriculums.value = []
  emit('reset')
}

const onApplyCurriculum = () => {
  emit('apply', selectCurriculums.value)
}
</script>

<template>
  <AppActionSheet :show="show" @close="emit('close')">
    <div class="space-y-4">
      <div class="flex w-full items-center justify-between">
        <div class="text-xl font-semibold">Curriculum</div>
        <div class="cursor-pointer" @click="emit('close')">
          <Icon icon="ph:x" class="text-2xl" />
        </div>
      </div>
      <AppTextInput
        name="query"
        placeholder="Search curriculum"
        v-model="curriculumQuery"
        suffix_icon="ph:magnifying-glass"
      />
      <div>
        <div
          v-for="opt in curriculumOptions"
          :key="opt.value"
          class="flex h-14 w-full items-center justify-between gap-4 border-b border-slate-3"
        >
          <div
            class="h-6 w-6 flex-shrink-0 rounded-full"
            :style="{
              backgroundColor: opt.color
            }"
          ></div>
          <label :for="`curriculum_filter_${opt.value}`" class="grow truncate text-sm">
            {{ opt.label }}
          </label>
          
          <!-- Checkbox untuk multiple select -->
          <input
            v-if="useMultipleSelect"
            type="checkbox"
            :name="`curriculum_filter_${opt.value}`"
            :id="`curriculum_filter_${opt.value}`"
            :checked="selectCurriculums.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheckCurriculum(opt.value)"
          />
          
          <!-- Radio untuk single select -->
          <input
            v-else
            type="radio"
            name="curriculum_filter"
            :id="`curriculum_filter_${opt.value}`"
            :checked="selectCurriculums.includes(opt.value)"
            :value="opt.value"
            class="shrink-0 rounded-full border-slate-5 text-light-purple-5 focus:ring-light-purple-3 disabled:pointer-events-none disabled:opacity-50"
            @click="onCheckCurriculum(opt.value)"
          />
        </div>
      </div>
      <div class="flex w-full items-center gap-2">
        <AppButton class="w-full" v-if="resetAble" kind="plain" @click="onResetCurriculum">Reset</AppButton>
        <AppButton class="w-full" @click="onApplyCurriculum">Apply</AppButton>
      </div>
    </div>
  </AppActionSheet>
</template>