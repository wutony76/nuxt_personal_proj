<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 特碼看板：各群組每列（欄）數量；未列出的群組用 PlayBoard 預設 5 欄
const GROUP_COLUMNS: Record<string, number> = {
  特碼: 5,
  兩面: 4,
  色波: 3,
}
</script>

<template>
  <PlayBoard board-class="tema" :group-columns="GROUP_COLUMNS" />
</template>
