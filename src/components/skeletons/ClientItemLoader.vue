<template>
  <div class="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-3">
    <div class="flex items-center gap-3">
      <div class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-3"></div>
      <div class="h-4 w-24 shrink-0 animate-pulse rounded-full bg-slate-3"></div>
    </div>
    <div class="flex items-center gap-1">
      <div v-for="n in 2" :key="n" class="h-5 w-12 animate-pulse rounded bg-slate-3"></div>
    </div>
  </div>
</template>
