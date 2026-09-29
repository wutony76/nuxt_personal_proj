<script setup lang="ts">
defineProps<{ no: string; title: string }>()
</script>

<template>
  <section class="np-proj-num-section">
    <div class="np-proj-num-head">
      <h2 class="np-proj-num-title">
        <span class="np-proj-num">{{ no }}</span>{{ title }}
      </h2>
      <div class="np-proj-num-body">
        <slot />
      </div>
    </div>
  </section>
</template>
