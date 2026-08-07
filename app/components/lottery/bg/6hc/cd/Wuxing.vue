<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 五行看板：5 個注項（金木水火土），以特別號結算。
// 號碼與賠率都逐年變動（納音輪轉，各行 8~12 個號）：
//   號碼 — c_wuxing.ts 用 wuxingNumsOf() 動態產生，PlayBoard 以「項目｜金額｜號碼」清單式排版顯示
//   賠率 — config 不寫死，PlayBoard 讀不到 odds 時會用 creditTabOddsOf 依當年號碼數推算
// 一列並排 2 組（一行兩列），號碼欄以號碼球排列。
const GROUP_COLUMNS: Record<string, number> = {
  五行: 2,
}
</script>

<template>
  <PlayBoard board-class="wuxing" :group-columns="GROUP_COLUMNS" />
</template>
