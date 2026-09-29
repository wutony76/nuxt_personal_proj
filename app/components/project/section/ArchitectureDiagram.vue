<script setup lang="ts">
import { computed } from 'vue'
import type { ArchitectureContent } from '~/types/project'

const props = defineProps<{ content: ArchitectureContent }>()

const orderedNodes = computed(() => {
  const byId = new Map(props.content.nodes.map((n) => [n.id, n]))
  const nextOf = new Map(props.content.edges.map((e) => [e.from, e.to]))
  const hasIncoming = new Set(props.content.edges.map((e) => e.to))
  const startId = props.content.nodes.find((n) => !hasIncoming.has(n.id))?.id ?? props.content.nodes[0]?.id
  const ordered: typeof props.content.nodes = []
  let cursor = startId
  const guard = new Set<string>()
  while (cursor && byId.has(cursor) && !guard.has(cursor)) {
    guard.add(cursor)
    ordered.push(byId.get(cursor)!)
    cursor = nextOf.get(cursor)
  }
  return ordered
})
</script>

<template>
  <div>
    <div class="np-proj-arch-diagram">
      <template v-for="(node, i) in orderedNodes" :key="node.id">
        <span class="np-proj-arch-node" :title="node.detail">{{ node.label }}</span>
        <span v-if="i < orderedNodes.length - 1" class="np-proj-arch-arrow">→</span>
      </template>
    </div>
    <ul class="np-proj-list" style="margin-top: 14px">
      <li v-for="note in content.notes" :key="note">{{ note }}</li>
    </ul>
  </div>
</template>
