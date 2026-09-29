<script setup lang="ts">
import type { ArchitectureContent } from '~/types/project'

defineProps<{ content: ArchitectureContent }>()
</script>

<template>
  <div>
    <div class="np-proj-arch">
      <template v-for="(layer, i) in content.layers" :key="layer.label">
        <div class="np-proj-arch-layer">
          <span class="np-proj-arch-layer-label">{{ layer.label }}</span>
          <div class="np-proj-arch-row">
            <span v-for="node in layer.nodes" :key="node.id" class="np-proj-arch-node" :title="node.detail">
              {{ node.label }}
            </span>
          </div>
        </div>
        <span v-if="i < content.layers.length - 1" class="np-proj-arch-down">↓</span>
      </template>
    </div>
    <ul class="np-proj-list" style="margin-top: 14px">
      <li v-for="note in content.notes" :key="note">{{ note }}</li>
    </ul>
  </div>
</template>
