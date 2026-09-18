<script setup lang="ts">
import { useBingo } from '~/composables/useBingo'
import Ball from '~/components/lottery/tw/bingo/base/Ball.vue'

/**
 * 熱門選號：本期（currentIssue）目前下注人數最多的前 5 組「基本玩法・3 星」注碼，由後端 bingo.ts
 * `_popularNumbers()` 統計、隨 current API 一起推送；本期完全還沒有人下注時，後端會改回傳
 * 5 組隨機 3 星注碼墊底，前端這裡不用另外處理空狀態。
 * ⚠️ 固定只統計「基本玩法・3 星」（使用者指定）：其他星數／超級獎號／猜大小／猜單雙皆不列入。
 */
const { popularNumbers, actions } = useBingo()

const click = {
  /** 「來一注」：把這組星數＋號碼直接加入投注區的 slots（切到基本玩法分頁） */
  applyPick: (star: number, numbers: number[]) => {
    actions.applyStarPick(star, numbers)
  }
}
</script>

<template>
  <div class="bingo-popular taiwan-lottery-scrollbar">
    <h3 class="bingo-popular-title">熱門選號（3 星）</h3>
    <ul class="bingo-popular-list">
      <li v-for="(pick, idx) in popularNumbers" :key="idx" class="bingo-popular-row">
        <span class="bingo-popular-rank">{{ idx + 1 }}</span>
        <span class="bingo-popular-balls">
          <Ball v-for="(n, ballIdx) in pick.numbers" :key="ballIdx" :num="n" size="xs" />
        </span>
        <button type="button" class="bingo-popular-bet-btn" @click="click.applyPick(pick.star, pick.numbers)">來一注</button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.bingo-popular {
  height: 250px;
  width: 300px;
  flex: none;
  box-sizing: border-box;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;
  overflow-y: auto;
}

.bingo-popular-title {
  margin: 0 0 0.8rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-heading);
  color: var(--color-accent-700, #8c491a);
}

.bingo-popular-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.bingo-popular-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 12px;
}

.bingo-popular-rank {
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

.bingo-popular-balls {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-wrap: wrap;
  min-height: 1.35rem;
}

.bingo-popular-bet-btn {
  flex: none;
  margin-left: auto;
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
