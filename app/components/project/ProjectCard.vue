<script setup lang="ts">
import type { ProjectSummary } from '~/types/project'
import ProjectStatusBadge from '~/components/project/ProjectStatusBadge.vue'
import ProjectTagList from '~/components/project/ProjectTagList.vue'

defineProps<{ project: ProjectSummary }>()
</script>

<template>
  <NuxtLink :to="`/project/${project.slug}`" class="np-card">
    <div class="np-card-head">
      <span class="np-card-index">{{ project.no }}</span>
      <ProjectStatusBadge :status="project.status" />
    </div>
    <h2 class="np-card-name">{{ project.name }}</h2>
    <p class="np-card-tagline">{{ project.tagline }}</p>
    <ProjectTagList :tags="project.techStack" />
    <span class="np-card-year">{{ project.year }}</span>
    <span class="np-card-view">View Project →</span>
  </NuxtLink>
</template>

<style scoped lang="scss">
.np-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid var(--proj-line);
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: var(--proj-accent);
    box-shadow: 0 8px 24px -12px rgba(99, 102, 241, 0.35);
    transform: translateY(-2px);
  }
}

.np-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.np-card-index {
  font-family: var(--proj-font-mono);
  font-size: 12px;
  color: var(--proj-muted-soft);
}

.np-card-name {
  margin-top: 8px;
  font-family: var(--proj-font-heading);
  font-weight: 700;
  font-size: 19px;
  color: var(--proj-ink);
}

.np-card-tagline {
  font-size: 13px;
  line-height: 1.5;
  color: var(--proj-muted);
}

.np-card-year {
  margin-top: 10px;
  font-family: var(--proj-font-mono);
  font-size: 11px;
  color: var(--proj-muted-soft);
}

.np-card-view {
  margin-top: 4px;
  font-family: var(--proj-font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--proj-accent);
}
</style>
