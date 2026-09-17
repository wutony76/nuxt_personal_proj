<script setup lang="ts">
import { useP3 } from '~/composables/useP3'
import Digit from '~/components/lottery/tw/p3/base/Digit.vue'
import { P3_BET_TYPES } from '#shared/config/p3'
import type { P3BetType } from '#shared/config/p3'

/**
 * 熱門選號：本期（currentIssue）目前下注人數最多的前 5 組「下注方式＋數字」組合，由後端 p3.ts
 * `_popularNumbers()` 統計、隨 current API 一起推送；本期完全還沒有人下注時，後端會改回傳
 * 5 組隨機組合（組彩會避開豹子）墊底，前端這裡不用另外處理空狀態。
 */
const { popularNumbers, actions } = useP3()

const BET_TYPE_LABEL: Record<string, string> = Object.fromEntries(P3_BET_TYPES.map((t) => [t.key, t.label]))

const click = {
  /** 「來一注」：把這組下注方式＋數字套進投注區 */
  applyPick: (betType: string, digits: number[]) => {
    actions.applyPick(betType as P3BetType, digits)
  }
}
</script>

<template>
  <div class="p3-popular">
    <h3 class="p3-popular-title">熱門選號</h3>
    <ul class="p3-popular-list">
      <li v-for="(pick, idx) in popularNumbers" :key="idx" class="p3-popular-row">
        <span class="p3-popular-rank">{{ idx + 1 }}</span>
        <span class="p3-popular-mode">{{ BET_TYPE_LABEL[pick.betType] ?? pick.betType }}</span>
        <span class="p3-popular-balls">
          <Digit v-for="(n, digitIdx) in pick.digits" :key="digitIdx" :num="n" size="xs" />
        </span>
        <button type="button" class="p3-popular-bet-btn" @click="click.applyPick(pick.betType, pick.digits)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.p3-popular {
  height: 250px;
  width: fit-content;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.p3-popular-title {
  margin: 0 0 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.p3-popular-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.p3-popular-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 12px;
}

.p3-popular-rank {
  flex: none;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--color-accent-2-200, #e1eecc);
  border: 1px solid var(--color-accent-2-400, #aebf92);
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 11px;
  color: var(--color-accent-2-800, #3d472b);
}

.p3-popular-mode {
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--color-accent-2-200, #e1eecc);
  border: 1px solid var(--color-accent-2-400, #aebf92);
  font-size: 10px;
  font-weight: 700;
  color: var(--color-accent-2-800, #3d472b);
  white-space: nowrap;
}

.p3-popular-balls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  min-height: 1.35rem;
}

.p3-popular-bet-btn {
  flex: none;
  margin-left: 0.5rem;
  border: 1px solid var(--color-accent-700, #8c491a);
  border-radius: 999px;
  background: var(--color-neutral-100, #f9f4ed);
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: var(--color-accent-700, #8c491a);
    color: #fff;
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
}
</style>
