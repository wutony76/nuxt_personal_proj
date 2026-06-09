<template>
  <Transition name="bg-panel">
    <div v-if="active" class="bg-auto-panel-warp">
      <div class="bg-auto-panel-inner">
        <OfAuto v-if="lotteryType === '6hc-of'" />
        <CdAuto v-else-if="lotteryType === '6hc-cd'" />
        <OfChat v-if="lotteryType === '6hc-of'" />
        <CdChat v-else-if="lotteryType === '6hc-cd'" />
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
