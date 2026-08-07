<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 半波看板：12 個注項（紅／綠／藍 × 大小單雙），以特別號結算。
// PlayBoard 以「項目｜金額｜號碼」清單式排版顯示（由 config 的 nums 提供號碼球清單），
// 一列並排 2 組（一行兩列）。
const GROUP_COLUMNS: Record<string, number> = {
  半波: 2,
}
</script>

<template>
  <PlayBoard board-class="banbo" :group-columns="GROUP_COLUMNS" />
</template>
