<script setup lang="ts">
import { useD539 } from '~/composables/useD539'
import Ball from '~/components/lottery/tw/d539/base/Ball.vue'

/**
 * 熱門選號：本期（currentIssue）目前下注人數最多的前 5 組號碼，由後端 d539.ts
 * `_popularNumbers()` 統計、隨 current API 一起推送；本期完全還沒有人下注時，
 * 後端會改回傳 5 組隨機號碼墊底（見該函式註解），前端這裡不用另外處理空狀態。
 */
const { popularNumbers, actions } = useD539()

const click = {
  /** 「來一注」：把這組號碼套進投注區，跟「近五期開獎」共用同一個 applyNumbers() */
  applyPick: (betCode: number[]) => {
    actions.applyNumbers(betCode)
  }
}
</script>

<template>
  <div class="d539-popular">
    <h3 class="d539-popular-title">熱門選號</h3>
    <ul class="d539-popular-list">
      <li v-for="(pick, idx) in popularNumbers" :key="idx" class="d539-popular-row">
        <span class="d539-popular-rank">{{ idx + 1 }}</span>
        <span class="d539-popular-balls">
          <Ball v-for="(n, ballIdx) in pick.betCode" :key="ballIdx" :num="n" size="xs" />
        </span>
        <button type="button" class="d539-popular-bet-btn" @click="click.applyPick(pick.betCode)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.d539-popular {
  height: 250px;
  width: fit-content;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
}

.d539-popular-title {
  margin: 0 0 1.2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.d539-popular-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.d539-popular-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}

.d539-popular-rank {
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

.d539-popular-balls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.d539-popular-bet-btn {
  flex: none;
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
