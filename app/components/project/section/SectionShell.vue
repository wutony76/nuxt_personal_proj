<script setup lang="ts">
defineProps<{ no: string; title: string }>()
</script>

<template>
  <section class="np-proj-num-section">
    <div class="np-proj-num-head">
      <span class="np-proj-num">{{ no }}</span>
      <h2 class="np-proj-num-title">{{ title }}</h2>
    </div>
    <div class="np-proj-num-body">
      <slot />
    </div>
  </section>
</template>
