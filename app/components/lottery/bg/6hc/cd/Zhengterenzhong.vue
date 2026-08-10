<script setup lang="ts">
import ComboBoard from '~/components/lottery/bg/6hc/cd/base/ComboBoard.vue'

// 特平中看板：選 1~5 個號，7 顆球（正碼或特別號皆算）「至少一個」命中即中獎。
// 判定與中一相同，只是選號數範圍不同（1~5 vs 5~10），同樣共用 ComboBoard。
</script>

<template>
  <ComboBoard board-class="zhengterenzhong" />
</template>
