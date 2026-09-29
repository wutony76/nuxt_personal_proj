<script setup lang="ts">
import type { MetricCard } from '~/types/project'

defineProps<{ metrics: MetricCard[] }>()
</script>

<template>
  <div class="np-proj-card-grid">
    <div v-for="m in metrics" :key="m.label" class="np-proj-mini-card">
      <div class="np-proj-metric-label">{{ m.label }}</div>
      <div class="np-proj-metric-value">{{ m.value }}</div>
      <div class="np-proj-metric-caption">{{ m.caption }}</div>
    </div>
  </div>
</template>
