<template>
  <Transition name="bg-panel">
    <div v-if="active" class="bg-auto-panel-warp" :class="lotteryType ? `is-${lotteryType}` : ''">
      <div class="bg-auto-panel-inner">
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
.bg-auto-panel-warp {
  display: flex;
  align-items: stretch;
  justify-content: center;
  margin-top: 1.2rem;
  min-height: 300px;
  background: #e1d4d4;
  border-top: 1px solid #dcb4b4;
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
  padding: 1rem 0;
  animation: sec-in 0.55s ease both;
  animation-delay: 0.48s;
}

.bg-auto-panel-inner {
  width: 100%;
  max-width: var(--base-width);
  margin: 0 auto;
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
}

.bg-panel-enter-active {
  animation: sec-in 0.55s ease both;
}

.bg-panel-leave-active {
  animation: sec-out 0.3s ease forwards;
}

@keyframes sec-out {
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}
</style>
