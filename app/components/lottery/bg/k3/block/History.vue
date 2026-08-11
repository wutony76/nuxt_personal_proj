<script setup lang="ts">
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import { useK3 } from '~/composables/useK3'

/** 開獎歷史：橫向排列近期開獎（版位對應 6hc-cd 的路珠 Road） */
const { openCodeHistory: mxHistory, actions: mxActions } = useK3()

const isBig = (sum: number) => sum >= 11
const isTriple = (codes: string[]) => codes.length === 3 && new Set(codes).size === 1
</script>

<template>
  <div class="block-main k3-history">
    <div class="hist-head">
      <span class="hist-title">開獎歷史</span>
      <span class="hist-note">※ 與官方玩法為同一份開獎號</span>
    </div>
    <div class="hist-body">
      <div v-for="item in mxHistory.list.slice(0, 24)" :key="item.issue" class="hist-col">
        <span class="hist-issue">{{ String(item.issue).slice(-3) }}</span>
        <span class="hist-dice">
          <Dice v-for="(code, idx) in item.openCode" :key="idx" :num="code" size="sm" />
        </span>
        <span class="hist-meta">
          <b>{{ mxActions.sumOf(item.openCode) }}</b>
          <em :class="isBig(mxActions.sumOf(item.openCode)) ? 'is-big' : 'is-small'">
            {{ isBig(mxActions.sumOf(item.openCode)) ? '大' : '小' }}
          </em>
          <em v-if="isTriple(item.openCode)" class="is-triple">圍</em>
        </span>
      </div>
      <div v-if="mxHistory.list.length === 0" class="hist-empty">
        {{ mxHistory.isLoading ? '載入中…' : '尚無開獎紀錄' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.k3-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;

  .hist-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .hist-title { font-size: 14px; font-weight: 700; color: var(--color-red-main); }
    .hist-note { font-size: 11px; color: var(--color-red-desc); }
  }

  .hist-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    /* 捲軸與 6hc 當期注單一致 */
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar { width: 8px; height: 8px; }
    &::-webkit-scrollbar-track { background: #ffc6c6; border-radius: 999px; }
    &::-webkit-scrollbar-thumb { background: #f54c07; border-radius: 999px; border: 2px solid #ffc6c6; }
    &::-webkit-scrollbar-thumb:hover { background: #de4304; }
  }

  .hist-col {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    background: #fffafa;
    padding: 6px 8px;

    .hist-issue { font-size: 10px; color: var(--color-red-desc); }
    .hist-dice { display: flex; gap: 3px; }

    .hist-meta {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;

      b { font-weight: 700; color: var(--color-red-main); }

      em {
        font-style: normal;
        font-weight: 700;
        border-radius: 3px;
        padding: 0 4px;

        &.is-big { background: #fee2e2; color: #b91c1c; }
        &.is-small { background: #dbeafe; color: #1d4ed8; }
        &.is-triple { background: #fef3c7; color: #b45309; }
      }
    }
  }

  .hist-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--color-red-desc);
  }
}
</style>
