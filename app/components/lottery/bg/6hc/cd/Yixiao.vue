<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 一肖看板：12 個生肖，以特別號所屬生肖結算。
// 分為「一肖中」（特別號屬該生肖即中）與「一肖不中」（不屬該生肖才中）兩個分頁。
//
// 號碼與賠率都逐年變動：
//   號碼 — c_yixiao.ts 用 shengxiaoNumsOf() 動態產生，PlayBoard 以「項目｜金額｜號碼」清單式排版顯示
//   賠率 — config 不寫死，PlayBoard 讀不到 odds 時會用 creditTabOddsOf 依當年號碼數與命中方向推算
// 每個生肖只有 4~5 個號（比半波的 7~10 個少），一列並排 3 組。
const GROUP_COLUMNS: Record<string, number> = {
  一肖中: 3,
  一肖不中: 3,
}
</script>

<template>
  <PlayBoard board-class="yixiao" :group-columns="GROUP_COLUMNS" />
</template>
