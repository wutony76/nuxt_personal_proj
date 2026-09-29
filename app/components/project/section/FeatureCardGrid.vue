<script setup lang="ts">
import type { FeatureCard } from '~/types/project'

defineProps<{ features: FeatureCard[] }>()
</script>

<template>
  <div class="np-proj-card-grid">
    <div v-for="f in features" :key="f.title" class="np-proj-mini-card">
      <div class="np-proj-mini-card-title">{{ f.title }}</div>
      <p class="np-proj-mini-card-body">{{ f.description }}</p>
    </div>
  </div>
</template>
