<script setup lang="ts">
import { useDlt } from '~/composables/useDlt'
import Ball from '~/components/lottery/tw/dlt/base/Ball.vue'

/**
 * 熱門選號：本期（currentIssue）目前下注人數最多的前 5 組號碼，由後端 dlt.ts
 * `_popularNumbers()` 統計、隨 current API 一起推送；本期完全還沒有人下注時，
 * 後端會改回傳 5 組隨機號碼墊底（見該函式註解），前端這裡不用另外處理空狀態。
 */
const { popularNumbers, actions } = useDlt()

const click = {
  /** 「來一注」：把這組號碼套進投注區，跟「近五期開獎」共用同一個 applyNumbers() */
  applyPick: (betCode: number[]) => {
    actions.applyNumbers(betCode)
  }
}
</script>

<template>
  <div class="dlt-popular">
    <h3 class="dlt-popular-title">熱門選號</h3>
    <ul class="dlt-popular-list">
      <li v-for="(pick, idx) in popularNumbers" :key="idx" class="dlt-popular-row">
        <span class="dlt-popular-rank">{{ idx + 1 }}</span>
        <span class="dlt-popular-balls">
          <Ball v-for="(n, ballIdx) in pick.betCode" :key="ballIdx" :num="n" size="xs" />
        </span>
        <button type="button" class="dlt-popular-bet-btn" @click="click.applyPick(pick.betCode)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.dlt-popular {
  height: 250px;
  width: fit-content;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.dlt-popular-title {
  margin: 0 0 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.dlt-popular-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.dlt-popular-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}

.dlt-popular-rank {
  flex: 0 0 16px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
}

.dlt-popular-balls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.dlt-popular-bet-btn {
  flex: none;
  border: 1px solid var(--color-accent-700, #8c491a);
  border-radius: 999px;
  background: var(--color-neutral-100, #f9f4ed);
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
  cursor: pointer;

  &:hover {
    background: var(--color-accent-700, #8c491a);
    color: #fff;
  }
}
</style>
