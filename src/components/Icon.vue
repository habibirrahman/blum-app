<script setup lang="ts">
defineOptions({
  name: 'AppIcon'
})

/**
 * tambahkan file package sesuai yg dibutuhkan
 *
 * contoh menambahkan ph
 * bun i -D @iconify-json/ph
 */

// silakan menambahkan berurutan berdasarkan alphabet
export type IconSet =
  | 'ph:file'
  | 'ph:file-fill'
  | 'ph:user-circle'
  | 'ph:user-circle-fill'
  | 'ph:user-square'
  | 'ph:user-square-fill'

interface Props {
  icon?: IconSet
  class?: string
}

const props = withDefaults(defineProps<Props>(), {})
</script>

<template>
  <i-ph-file v-if="icon === 'ph:file'" :class="props.class" />
  <i-ph-file-fill v-if="icon === 'ph:file-fill'" :class="props.class" />
  <i-ph-user-circle v-if="icon === 'ph:user-circle'" :class="props.class" />
  <i-ph-user-circle-fill v-if="icon === 'ph:user-circle-fill'" :class="props.class" />
  <i-ph-user-square v-if="icon === 'ph:user-square'" :class="props.class" />
  <i-ph-user-square-fill v-if="icon === 'ph:user-square-fill'" :class="props.class" />
</template>
