<template>
  <Transition name="tw-panel">
    <div v-if="active" class="tw-auto-panel-warp" :class="lotteryType ? `is-${lotteryType}` : ''">
      <div class="tw-auto-panel-inner">
        <DltAuto v-if="lotteryType === 'dlt'" />
        <SuperlottoAuto v-if="lotteryType === 'superlotto'" />
        <D539Auto v-if="lotteryType === 'd539'" />
        <M649Auto v-if="lotteryType === 'm649'" />
        <M539Auto v-if="lotteryType === 'm539'" />
        <!-- Chat.vue 皆為薄 wrapper（<ChatPanel />），tw 系列玩法共用同一份 wrapper（沿用 DltChat），
             只要有啟用中的 tw 玩法就顯示同一個聊天室，不逐一玩法各自複製一份（見 design.md Decision 7）。 -->
        <DltChat v-if="lotteryType" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useTwAutoActive } from '~/composables/useTwAutoActive'

/**
 * 複製自 BgAutoPanel.vue——bg／tw 兩個分類的自動下注面板刻意不共用同一份檔案
 * （見 openspec/changes/add-dlt/design.md Decision 0）。目前服務大樂透（dlt）與今彩539（d539），
 * 未來若有更多 tw 系列玩法，直接在這裡的 v-if 鏈加分支。
 * ⚠️ Auto.vue 各玩法各自一份（含跨玩法狀態，不可共用同一 instance，見各 Auto.vue 檔頭）；
 *    Chat.vue 只是 ChatPanel 薄 wrapper，tw 系列共用同一份 DltChat（見 design.md Decision 7）。
 */
const { active, lotteryType } = useTwAutoActive()

const DltAuto = defineAsyncComponent(() => import('~/components/lottery/tw/dlt/block/footer/Auto.vue'))
const SuperlottoAuto = defineAsyncComponent(() => import('~/components/lottery/tw/superlotto/block/footer/Auto.vue'))
const D539Auto = defineAsyncComponent(() => import('~/components/lottery/tw/d539/block/footer/Auto.vue'))
const M649Auto = defineAsyncComponent(() => import('~/components/lottery/tw/m649/block/footer/Auto.vue'))
const M539Auto = defineAsyncComponent(() => import('~/components/lottery/tw/m539/block/footer/Auto.vue'))
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
  animation: dlt-sec-in 0.55s ease both;
  animation-delay: 0.48s;

  &.is-dlt,
  &.is-superlotto,
  &.is-d539,
  &.is-m649,
  &.is-m539 {
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

/* 同一支 ChatPanel.vue 的整體配色（背景／文字／輸入框／送出鈕）也改成柑仔店暖色系，
   一樣只在 .tw-auto-panel-warp.is-dlt／.is-d539 這個 DOM 範圍內覆寫，不動元件本體。
   dlt／d539／m649／m539 同屬柑仔店主題、配色完全一致，用分組選擇器共用同一份規則
   （不改動既有效果，只是再多帶一個 .is-m539 選擇器）。 */
.tw-auto-panel-warp.is-dlt .chat-panel,
.tw-auto-panel-warp.is-superlotto .chat-panel,
.tw-auto-panel-warp.is-d539 .chat-panel,
.tw-auto-panel-warp.is-m649 .chat-panel,
.tw-auto-panel-warp.is-m539 .chat-panel {
  background: #f5ead8;
  border-color: #dcd3c4;
}

.tw-auto-panel-warp.is-dlt .chat-head,
.tw-auto-panel-warp.is-superlotto .chat-head,
.tw-auto-panel-warp.is-d539 .chat-head,
.tw-auto-panel-warp.is-m649 .chat-head,
.tw-auto-panel-warp.is-m539 .chat-head {
  border-bottom-color: #dcd3c4;
  color: #645c50;
}

.tw-auto-panel-warp.is-dlt .chat-empty,
.tw-auto-panel-warp.is-superlotto .chat-empty,
.tw-auto-panel-warp.is-d539 .chat-empty,
.tw-auto-panel-warp.is-m649 .chat-empty,
.tw-auto-panel-warp.is-m539 .chat-empty {
  color: #82796a;
}

.tw-auto-panel-warp.is-dlt .chat-row,
.tw-auto-panel-warp.is-superlotto .chat-row,
.tw-auto-panel-warp.is-d539 .chat-row,
.tw-auto-panel-warp.is-m649 .chat-row,
.tw-auto-panel-warp.is-m539 .chat-row {
  .user {
    color: #8c491a;
  }

  &.is-admin .user {
    background: #8c491a;
  }

  .text {
    color: #474238;
  }

  .time {
    color: #82796a;
  }
}

.tw-auto-panel-warp.is-dlt .chat-input,
.tw-auto-panel-warp.is-superlotto .chat-input,
.tw-auto-panel-warp.is-d539 .chat-input,
.tw-auto-panel-warp.is-m649 .chat-input,
.tw-auto-panel-warp.is-m539 .chat-input {
  border-top-color: #dcd3c4;

  input {
    background: #fffbf4;
    border-color: #dcd3c4;
    color: #474238;
  }

  button {
    background: #8c491a;

    &:disabled {
      background: #dcd3c4;
    }

    &:hover:not(:disabled) {
      background: #643312;
    }
  }
}

.tw-auto-panel-warp.is-dlt .tw-auto-panel-inner,
.tw-auto-panel-warp.is-superlotto .tw-auto-panel-inner,
.tw-auto-panel-warp.is-d539 .tw-auto-panel-inner,
.tw-auto-panel-warp.is-m649 .tw-auto-panel-inner,
.tw-auto-panel-warp.is-m539 .tw-auto-panel-inner {
  /* 對齊 lottery-dlt／lottery-superlotto／lottery-d539／lottery-m649／lottery-m539 頁面 .main 的寬度，而非全站預設的 --base-width */
  width: min(1360px, 97%);
  max-width: none;
}

.tw-panel-enter-active {
  animation: dlt-sec-in 0.55s ease both;
}

.tw-panel-leave-active {
  animation: tw-sec-out 0.3s ease forwards;
}

@keyframes dlt-sec-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

@keyframes tw-sec-out {
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}
</style>
