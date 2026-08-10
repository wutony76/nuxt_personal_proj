<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 尾數看板：0 ~ 9 尾，以特別號尾數（個位數）結算。
// 分為「尾數中」（特別號尾數屬該尾即中）與「尾數不中」（不屬才中）兩個分頁。
// 號碼與一肖／特肖同類，差別是尾數分布固定不隨年份輪轉：
//   號碼 — c_weishu.ts 用 numsOfWei()（讀 weishuAll）動態產生，PlayBoard 以「項目｜金額｜號碼」清單式排版顯示
//   賠率 — config 不寫死，PlayBoard 讀不到 odds 時會用 creditTabOddsOf 依中獎面號碼數與命中方向推算
// 每尾 4~5 個號（0尾 4 個、其餘 9 尾各 5 個），一列並排 2 組。
const GROUP_COLUMNS: Record<string, number> = {
  尾數中: 2,
  尾數不中: 2,
}
</script>

<template>
  <PlayBoard board-class="weishu" :group-columns="GROUP_COLUMNS" />
</template>
