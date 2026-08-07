<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 正碼特看板：各群組每列（欄）數量；未列出的群組用 PlayBoard 預設 5 欄
// 號碼群組名稱隨分頁變動（正一特～正六特），49 顆號碼走預設 5 欄即可
const GROUP_COLUMNS: Record<string, number> = {
  兩面: 4,
  色波: 3,
}
</script>

<template>
  <PlayBoard board-class="zhengmate" :group-columns="GROUP_COLUMNS" />
</template>
