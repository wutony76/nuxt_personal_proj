<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 一肖量看板：押「7 顆球共涵蓋幾個生肖」，注項 2肖 ~ 7肖。
// 一注 = 一個注項（不是組合），賠率直接寫在 config 的注項上，故用 PlayBoard 即可。
// 6 個注項、賠率跨度極大（2肖 890 到 6肖 2.11），群組標題只顯示區間，
// 逐項賠率靠 hover 浮層展開。
const GROUP_COLUMNS: Record<string, number> = {
  一肖量: 3,
}
</script>

<template>
  <PlayBoard board-class="ixiaolian" :group-columns="GROUP_COLUMNS" />
</template>
