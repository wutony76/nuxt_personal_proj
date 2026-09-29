<script setup lang="ts">
import type { EvidenceCard } from '~/types/project'

defineProps<{ items: EvidenceCard[] }>()
</script>

<template>
  <div class="np-proj-card-grid">
    <div v-for="item in items" :key="item.title" class="np-proj-mini-card">
      <div class="np-proj-mini-card-title">{{ item.title }}</div>
      <p class="np-proj-mini-card-body">{{ item.description }}</p>
      <span v-if="item.refLabel" class="np-proj-ref-label">{{ item.refLabel }}</span>
    </div>
  </div>
</template>
