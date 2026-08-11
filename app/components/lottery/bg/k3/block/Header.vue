<script setup lang="ts">
import { computed } from 'vue'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import { STATUS_TIME } from '~/config/constants'
import { useK3 } from '~/composables/useK3'

const { current: mxCurrent, pool: mxPool, time: mxTime, wallet: mxWallet, isCd, actions: mxActions } = useK3()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const status = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const statusClass = computed(() => {
  switch (status.value) {
    case STATUS_TIME.OPEN: return 'is-open'
    case STATUS_TIME.OPENED: return 'is-opened'
    default: return 'is-wait'
  }
})
/** 已開獎的那一期骰子（未開獎的當期不提前顯示） */
const openCode = computed(() => (Array.isArray(mxCurrent.runtime?.openCode) ? mxCurrent.runtime!.openCode : []))
const sum = computed(() => mxActions.sumOf(openCode.value))
const isBig = computed(() => sum.value >= 11)
const isOdd = computed(() => sum.value % 2 === 1)
const isTriple = computed(() => openCode.value.length === 3 && new Set(openCode.value).size === 1)
</script>

<template>
  <header class="block-main k3-header">
    <div class="hd-left">
      <h1 class="title">快 3</h1>
      <p class="sub">{{ isCd ? '信用玩法' : '官方玩法' }}</p>
      <p class="issue">第 {{ mxCurrent.runtime?.issueCurrent || '—' }} 期</p>
      <div class="status" :class="statusClass">
        <span class="dot" />{{ status }}
        <b class="countdown">{{ mxTime.statusRemainLabel }}</b>
      </div>
    </div>

    <div class="hd-open">
      <p class="open-label">第 {{ mxCurrent.runtime?.issueLatest || '—' }} 期開獎</p>
      <div class="dice-row">
        <Dice v-for="(code, idx) in (openCode.length ? openCode : [0, 0, 0])" :key="idx" :num="code" size="lg"
          :pending="!openCode.length" />
      </div>
      <div v-if="openCode.length" class="open-meta">
        <span class="meta-sum">和值 {{ sum }}</span>
        <span class="meta-tag">{{ isBig ? '大' : '小' }}</span>
        <span class="meta-tag">{{ isOdd ? '單' : '雙' }}</span>
        <span v-if="isTriple" class="meta-tag is-triple">圍骰</span>
      </div>
    </div>

    <div class="hd-right">
      <div class="row"><span class="label">共用彩池</span><span class="val">{{ money(mxPool.distributable) }}</span></div>
      <div class="row"><span class="label">累積滾存</span><span class="val">{{ money(mxPool.carry) }}</span></div>
      <div class="row"><span class="label">餘額</span><span class="val val-coin">{{ money(mxWallet.coin) }}</span></div>
      <p class="pool-note">※ 彩池由信用盤與官方盤共同累積</p>
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 外框由全域 .lottery-k3 .block-main 提供（同 6hc） */
.k3-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  background: var(--color-red-sub);
  animation: k3-sec-in 0.55s ease both;
  animation-delay: 0.1s;

  .hd-left {
    .title { margin: 0; font-size: 26px; font-weight: 900; color: var(--color-red-main); letter-spacing: 0.1em; }
    .sub { margin: 2px 0 0; font-size: 12px; color: var(--color-red-desc); }
    .issue { margin: 6px 0 4px; font-size: 13px; font-weight: 700; color: var(--color-red-main); }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;

      .dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; }
      .countdown { font-family: monospace; font-size: 15px; }

      &.is-open { color: #16a34a; .dot { background: #16a34a; animation: k3-pulse 1.2s ease-in-out infinite; } }
      &.is-opened { color: var(--color-red-main); .dot { background: var(--color-red-main); } }
      &.is-wait { color: #f59e0b; .dot { background: #f59e0b; } }
    }
  }

  .hd-open {
    text-align: center;

    .open-label { margin: 0 0 6px; font-size: 12px; color: var(--color-red-desc); }
    .dice-row { display: flex; gap: 10px; justify-content: center; }

    .open-meta {
      margin-top: 8px;
      display: flex;
      gap: 6px;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;

      .meta-sum { border-radius: 4px; background: var(--color-red-main); padding: 2px 10px; color: #fff; }
      .meta-tag { border: 1px solid var(--color-red-main); border-radius: 4px; padding: 2px 8px; color: var(--color-red-main); }
      .meta-tag.is-triple { border-color: #d97706; background: #fef3c7; color: #b45309; }
    }
  }

  .hd-right {
    min-width: 190px;

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;

      .label { color: var(--color-red-desc); }
      .val { font-weight: 700; color: var(--color-red-main); }
      .val-coin { color: #15803d; }
    }

    .pool-note { margin: 6px 0 0; font-size: 11px; color: var(--color-red-desc); }
  }
}

@keyframes k3-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
