<script setup lang="ts">
import ComboBoard from '~/components/lottery/bg/6hc/cd/base/ComboBoard.vue'

// 連碼看板：選 2~3 個號組成一注（三全中／三中二／二全中／二中特／特串）。
// 是唯一「同一注有多種中法」的組合玩法 —— tiers 有多檔（中三／中二…），
// 開獎後才知道命中哪一檔，故 ComboBoard 的 tier-bar 會列出全部檔次。
</script>

<template>
  <ComboBoard board-class="lianma" />
</template>
