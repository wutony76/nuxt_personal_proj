<template>
  <Transition name="tw-panel">
    <div v-if="active" class="tw-auto-panel-warp" :class="lotteryType ? `is-${lotteryType}` : ''">
      <div class="tw-auto-panel-inner">
        <DltAuto v-if="lotteryType === 'dlt'" />
        <DltChat v-if="lotteryType === 'dlt'" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useTwAutoActive } from '~/composables/useTwAutoActive'

/**
 * 複製自 BgAutoPanel.vue——bg／tw 兩個分類的自動下注面板刻意不共用同一份檔案
 * （見 openspec/changes/add-dlt/design.md Decision 0）。目前只服務大樂透一種玩法，
 * 未來若有更多 tw 系列玩法，直接在這裡的 v-if 鏈加分支。
 */
const { active, lotteryType } = useTwAutoActive()

const DltAuto = defineAsyncComponent(() => import('~/components/lottery/tw/dlt/block/footer/Auto.vue'))
const DltChat = defineAsyncComponent(() => import('~/components/lottery/tw/dlt/block/footer/Chat.vue'))
</script>

<style lang="scss">
/*
 * ⚠️ 這幾個 class 名稱刻意不跟 BgAutoPanel.vue 共用（雖然版面結構是複製過去的）——
 * 兩邊的 <style> 都沒有 scoped，若沿用同一組 class 名稱（bg-auto-panel-warp 等），
 * 兩份規則會在全域樣式表裡打架，最後只剩其中一份生效，兩邊視覺就會互相污染
 * （曾經發生：這裡改成柑仔店暖色系後，bg 系列的自動下注面板顏色也被連帶改掉）。
 */
.tw-auto-panel-warp {
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 300px;
  background: #f5ead8;
  border-top: 1px solid #dcd3c4;
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
  padding: 1rem 0;
  animation: sec-in 0.55s ease both;
  animation-delay: 0.48s;

  &.is-dlt {
    background: #dcd3c4;
  }
}

.tw-auto-panel-inner {
  width: 100%;
  max-width: var(--base-width);
  margin: 0 auto;
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
}

/*
 * DltChat 內部用的是 social/ChatPanel.vue（全站共用元件），本身掛的是 BG 紅色系
 * .lottery-scrollbar；不能直接改 ChatPanel.vue（會連帶影響其他頁面的聊天室），
 * 改成只在 .tw-auto-panel-warp 這個 DOM 範圍內用高特異度覆寫成柑仔店配色。
 */
.tw-auto-panel-warp .chat-list {
  scrollbar-color: #c0b6a5 #eee7db;

  &::-webkit-scrollbar-track {
    background: #eee7db;
  }

  &::-webkit-scrollbar-thumb {
    background: #c0b6a5;
    border: none;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #92725b;
  }
}

.tw-auto-panel-warp.is-dlt .tw-auto-panel-inner {
  /* 對齊 lottery-dlt 頁面 .main 的寬度（app/pages/lottery/tw/dlt.vue），而非全站預設的 --base-width */
  width: min(1360px, 97%);
  max-width: none;
}

.tw-panel-enter-active {
  animation: sec-in 0.55s ease both;
}

.tw-panel-leave-active {
  animation: tw-sec-out 0.3s ease forwards;
}

@keyframes tw-sec-out {
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}
</style>
