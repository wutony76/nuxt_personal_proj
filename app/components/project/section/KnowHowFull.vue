<script setup lang="ts">
import type { KnowHowGroup } from '~/types/project'

defineProps<{ groups: KnowHowGroup[] }>()
</script>

<template>
  <div class="np-proj-groups">
    <div v-for="g in groups" :key="g.key" :id="g.key" class="np-proj-group">
      <h3 class="np-proj-group-title">{{ g.title }}</h3>
      <ul class="np-proj-list">
        <li v-for="item in g.full" :key="item.title">
          <strong>{{ item.title }}</strong><template v-if="item.synopsis"> — {{ item.synopsis }}</template>
        </li>
      </ul>
    </div>
  </div>
</template>
