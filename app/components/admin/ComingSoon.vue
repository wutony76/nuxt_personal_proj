<script setup lang="ts">
/** 彩運來／遊戲試算／報表分析共用的佔位空狀態，比照參照稿的 pattern */
import { useRouter } from 'vue-router'

const router = useRouter()
const click = {
  backOverview: () => router.push('/admin')
}
</script>

<template>
  <div class="acs-wrap">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75"
      stroke-linecap="round">
      <circle cx="12" cy="12" r="8.5"></circle>
      <path d="M12 8.5V12l2.5 2"></path>
    </svg>
    <div class="admin-en">Coming soon</div>
    <div class="acs-title">即將推出</div>
    <p class="acs-desc">此項目本次僅建立導覽入口，完整規格留待獨立的後續 change。</p>
    <button type="button" class="admin-btn admin-btn-secondary" @click="click.backOverview">回到總覽</button>
  </div>
</template>

<style scoped lang="scss">
.acs-wrap {
  border-top: 1px solid var(--ink);
  padding-top: 56px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}

.acs-title {
  font-size: 22px;
  font-weight: 700;
}

.acs-desc {
  max-width: 52ch;
  font-size: 13.5px;
  line-height: 1.7;
  color: color-mix(in srgb, #1c1c22 72%, #ffffff);
  margin: 0;
}
</style>
