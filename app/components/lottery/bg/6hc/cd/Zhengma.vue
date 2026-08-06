<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 正碼看板：各群組每列（欄）數量；未列出的群組用 PlayBoard 預設 5 欄
// 兩面只有「總和大／小／單／雙」4 項，排一列剛好
const GROUP_COLUMNS: Record<string, number> = {
  正碼: 5,
  兩面: 4,
}
</script>

<template>
  <PlayBoard board-class="zhengma" :group-columns="GROUP_COLUMNS" />
</template>
