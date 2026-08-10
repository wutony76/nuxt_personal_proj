<script setup lang="ts">
import ComboBoard from '~/components/lottery/bg/6hc/cd/base/ComboBoard.vue'

// 全不中看板：選 5~10 個號，7 顆球「一個都沒有」命中才中獎。
// 與連碼共用 ComboBoard（號碼池 + 複式 + tiers），差別只在：
//   - tiers 只有一檔（單一中法），tier-bar 只會顯示一個賠率
//   - 命中方向是 miss，判定由 settings.match 決定，看板不需要知道
</script>

<template>
  <ComboBoard board-class="zixuanbuzhong" />
</template>
