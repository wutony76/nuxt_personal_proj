<script setup lang="ts">
defineProps<{ tags: string[] }>()
</script>

<template>
  <div class="np-proj-tags">
    <span v-for="tag in tags" :key="tag" class="np-proj-tag">{{ tag }}</span>
  </div>
</template>
