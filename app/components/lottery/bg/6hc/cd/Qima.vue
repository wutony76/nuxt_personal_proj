<script setup lang="ts">
import PlayBoard from '~/components/lottery/bg/6hc/cd/base/PlayBoard.vue'

// 七碼看板：兩個群組各 8 項（單0雙7～單7雙0 / 大0小7～大7小0），4 欄剛好兩列
const GROUP_COLUMNS: Record<string, number> = {
  單雙: 4,
  大小: 4,
}
</script>

<template>
  <PlayBoard board-class="qima" :group-columns="GROUP_COLUMNS" />
</template>
