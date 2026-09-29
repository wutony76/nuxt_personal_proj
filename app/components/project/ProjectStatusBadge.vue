<script setup lang="ts">
import type { ProjectStatus } from '~/types/project'

defineProps<{ status: ProjectStatus }>()

const STATUS_LABEL: Record<ProjectStatus, string> = {
  live: 'LIVE',
  building: 'BUILDING',
  archived: 'ARCHIVED'
}
</script>

<template>
  <span class="np-proj-status" :class="`is-${status}`">{{ STATUS_LABEL[status] }}</span>
</template>
