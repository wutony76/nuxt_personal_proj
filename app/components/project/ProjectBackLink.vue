<script setup lang="ts">
withDefaults(defineProps<{ to?: string; label?: string }>(), {
  to: '/project',
  label: '← 返回專案列表'
})
</script>

<template>
  <NuxtLink :to="to" class="np-proj-back">{{ label }}</NuxtLink>
</template>
