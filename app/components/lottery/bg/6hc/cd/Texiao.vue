<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 特肖看板：12 個生肖，只看特別號（第 7 顆球）判定所屬生肖即中，只有一個分頁（無中/不中之分）。
// 賠率公式與一肖中完全相同（rtp × 49 / 該生肖號碼數），config 不寫死，
// PlayBoard 讀不到 odds 時會用 creditTabOddsOf 依當年號碼數推算。
// 號碼與一肖同源（shengxiaoNumsOf 動態產生），一列並排 3 組。
const GROUP_COLUMNS: Record<string, number> = {
  特肖: 3,
}
</script>

<template>
  <PlayBoard board-class="texiao" :group-columns="GROUP_COLUMNS" />
</template>
