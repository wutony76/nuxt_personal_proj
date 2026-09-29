<script setup lang="ts">
import type { KnowHowGroup } from '~/types/project'

defineProps<{ groups: KnowHowGroup[]; overflowPath: string }>()
</script>

<template>
  <div>
    <div class="np-proj-highlight-grid">
      <div v-for="g in groups" :key="g.key">
        <div class="np-proj-group-title">{{ g.title }}</div>
        <div class="np-proj-groups" style="gap: 12px; margin-top: 8px">
          <div v-for="item in g.highlights" :key="item.title" class="np-proj-highlight-item">
            <span class="np-proj-highlight-title">{{ item.title }}</span>
            <span v-if="item.synopsis" class="np-proj-highlight-synopsis">{{ item.synopsis }}</span>
            <NuxtLink :to="`${overflowPath}#${g.key}`" class="np-proj-view-link">→ View {{ g.title }}</NuxtLink>
          </div>
        </div>
      </div>
    </div>
    <NuxtLink :to="overflowPath" class="np-proj-view-all">View all engineering notes →</NuxtLink>
  </div>
</template>
