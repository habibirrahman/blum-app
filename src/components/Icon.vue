<script setup lang="ts">
defineOptions({
  name: 'AppIcon'
})

/**
 * add file package
 * e.g.
 * - bun i -D @iconify-json/mingcute
 * - bun i -D @iconify-json/ph
 */

// add iconset alphabetically
export type IconSet =
  | 'mingcute:loading-fill'
  //
  | 'ph:arrow-counter-clockwise-bold'
  | 'ph:arrow-right-bold'
  | 'ph:file'
  | 'ph:file-fill'
  | 'ph:pencil-simple'
  | 'ph:plus-bold'
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
  <i-mingcute-loading-fill v-if="icon === 'mingcute:loading-fill'" :class="props.class" />
  <!--  -->
  <i-ph-arrow-counter-clockwise-bold
    v-if="icon === 'ph:arrow-counter-clockwise-bold'"
    :class="props.class"
  />
  <i-ph-arrow-right-bold v-if="icon === 'ph:arrow-right-bold'" :class="props.class" />
  <i-ph-file v-if="icon === 'ph:file'" :class="props.class" />
  <i-ph-file-fill v-if="icon === 'ph:file-fill'" :class="props.class" />
  <i-ph-pencil-simple v-if="icon === 'ph:pencil-simple'" :class="props.class" />
  <i-ph-plus-bold v-if="icon === 'ph:plus-bold'" :class="props.class" />
  <i-ph-user-circle v-if="icon === 'ph:user-circle'" :class="props.class" />
  <i-ph-user-circle-fill v-if="icon === 'ph:user-circle-fill'" :class="props.class" />
  <i-ph-user-square v-if="icon === 'ph:user-square'" :class="props.class" />
  <i-ph-user-square-fill v-if="icon === 'ph:user-square-fill'" :class="props.class" />
</template>
