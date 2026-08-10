<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 尾數量看板：押「7 顆球共涵蓋幾個尾數」，注項 2尾 ~ 7尾。
// 結構同一肖量（一注 = 一個注項、賠率寫在 config 上），用 PlayBoard 即可。
const GROUP_COLUMNS: Record<string, number> = {
  尾數量: 3,
}
</script>

<template>
  <PlayBoard board-class="weishulian" :group-columns="GROUP_COLUMNS" />
</template>
