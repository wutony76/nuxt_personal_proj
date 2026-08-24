<template>
  <Transition name="bg-panel">
    <div v-if="active" class="bg-auto-panel-warp" :class="lotteryType ? `is-${lotteryType}` : ''">
      <div class="bg-auto-panel-inner">
        <OfAuto v-if="lotteryType === '6hc-of'" />
        <CdAuto v-else-if="lotteryType === '6hc-cd'" />
        <K3CdAuto v-else-if="lotteryType === 'k3-cd'" />
        <K3OfAuto v-else-if="lotteryType === 'k3-of'" />
        <Pk10CdAuto v-else-if="lotteryType === 'pk10-cd'" />
        <Pk10OfAuto v-else-if="lotteryType === 'pk10-of'" />
        <SscCdAuto v-else-if="lotteryType === 'ssc-cd'" />
        <SscOfAuto v-else-if="lotteryType === 'ssc-of'" />
        <X5CdAuto v-else-if="lotteryType === 'x5-cd'" />
        <X5OfAuto v-else-if="lotteryType === 'x5-of'" />
        <EggsAuto v-else-if="lotteryType === 'eggs'" />
        <Kl10Auto v-else-if="lotteryType === 'kl10'" />
        <Kl8Auto v-else-if="lotteryType === 'kl8'" />
        <Fc3dAuto v-else-if="lotteryType === 'fc3d'" />
        <Pl3Auto v-else-if="lotteryType === 'pl3'" />
        <OfChat v-if="lotteryType === '6hc-of'" />
        <CdChat v-else-if="lotteryType === '6hc-cd'" />
        <K3Chat v-else-if="lotteryType === 'k3-cd' || lotteryType === 'k3-of'" />
        <Pk10Chat v-else-if="lotteryType === 'pk10-cd' || lotteryType === 'pk10-of'" />
        <SscChat v-else-if="lotteryType === 'ssc-cd' || lotteryType === 'ssc-of'" />
        <X5Chat v-else-if="lotteryType === 'x5-cd' || lotteryType === 'x5-of'" />
        <EggsChat v-else-if="lotteryType === 'eggs'" />
        <Kl10Chat v-else-if="lotteryType === 'kl10'" />
        <Kl8Chat v-else-if="lotteryType === 'kl8'" />
        <Fc3dChat v-else-if="lotteryType === 'fc3d'" />
        <Pl3Chat v-else-if="lotteryType === 'pl3'" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useBgAutoActive } from '~/composables/useBgAutoActive'

const { active, lotteryType } = useBgAutoActive()

const OfAuto = defineAsyncComponent(() => import('~/components/lottery/bg/6hc/of/block/footer/Auto.vue'))
const OfChat = defineAsyncComponent(() => import('~/components/lottery/bg/6hc/of/block/footer/Chat.vue'))

const CdAuto = defineAsyncComponent(() => import('~/components/lottery/bg/6hc/cd/block/footer/Auto.vue'))
const CdChat = defineAsyncComponent(() => import('~/components/lottery/bg/6hc/cd/block/footer/Chat.vue'))

// ⚠️ 兩個盤口各自一個元件：同一個元件放在 v-if 鏈裡，Vue 會就地 patch 保留 instance，
//    切換盤口時自動下注的開關會殘留（6hc 也是各自一個元件）
const K3CdAuto = defineAsyncComponent(() => import('~/components/lottery/bg/k3/cd/block/footer/Auto.vue'))
const K3OfAuto = defineAsyncComponent(() => import('~/components/lottery/bg/k3/of/block/footer/Auto.vue'))
const K3Chat = defineAsyncComponent(() => import('~/components/lottery/bg/k3/block/footer/Chat.vue'))

// PK10 同理：兩個盤口各自一個 Auto，共用一個 Chat
const Pk10CdAuto = defineAsyncComponent(() => import('~/components/lottery/bg/pk10/cd/block/footer/Auto.vue'))
const Pk10OfAuto = defineAsyncComponent(() => import('~/components/lottery/bg/pk10/of/block/footer/Auto.vue'))
const Pk10Chat = defineAsyncComponent(() => import('~/components/lottery/bg/pk10/block/footer/Chat.vue'))

// SSC 同理：兩個盤口各自一個 Auto，共用一個 Chat
const SscCdAuto = defineAsyncComponent(() => import('~/components/lottery/bg/ssc/cd/block/footer/Auto.vue'))
const SscOfAuto = defineAsyncComponent(() => import('~/components/lottery/bg/ssc/of/block/footer/Auto.vue'))
const SscChat = defineAsyncComponent(() => import('~/components/lottery/bg/ssc/block/footer/Chat.vue'))

// 11選5 同理：兩個盤口各自一個 Auto，共用一個 Chat
const X5CdAuto = defineAsyncComponent(() => import('~/components/lottery/bg/11x5/cd/block/footer/Auto.vue'))
const X5OfAuto = defineAsyncComponent(() => import('~/components/lottery/bg/11x5/of/block/footer/Auto.vue'))
const X5Chat = defineAsyncComponent(() => import('~/components/lottery/bg/11x5/block/footer/Chat.vue'))

// PC蛋蛋只有信用盤，Auto／Chat 各一支
const EggsAuto = defineAsyncComponent(() => import('~/components/lottery/bg/eggs/block/footer/Auto.vue'))
const EggsChat = defineAsyncComponent(() => import('~/components/lottery/bg/eggs/block/footer/Chat.vue'))
const Kl10Auto = defineAsyncComponent(() => import('~/components/lottery/bg/kl10/block/footer/Auto.vue'))
const Kl10Chat = defineAsyncComponent(() => import('~/components/lottery/bg/kl10/block/footer/Chat.vue'))
// 快樂8只有信用盤，Auto／Chat 各一支
const Kl8Auto = defineAsyncComponent(() => import('~/components/lottery/bg/kl8/block/footer/Auto.vue'))
const Kl8Chat = defineAsyncComponent(() => import('~/components/lottery/bg/kl8/block/footer/Chat.vue'))
// 福彩3D只有官方盤，Auto／Chat 各一支
const Fc3dAuto = defineAsyncComponent(() => import('~/components/lottery/bg/fc3d/block/footer/Auto.vue'))
const Fc3dChat = defineAsyncComponent(() => import('~/components/lottery/bg/fc3d/block/footer/Chat.vue'))
// 排列3同福彩3D：只有官方盤，Auto／Chat 各一支
const Pl3Auto = defineAsyncComponent(() => import('~/components/lottery/bg/pl3/block/footer/Auto.vue'))
const Pl3Chat = defineAsyncComponent(() => import('~/components/lottery/bg/pl3/block/footer/Chat.vue'))
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

  /* 6hc-cd：頁面內容已自帶下方留白，這裡不再加上邊距 */
  &.is-6hc-cd {
    margin-top: unset;
  }
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
