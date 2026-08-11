<script setup lang="ts">
import { computed } from 'vue'
import { useK3 } from '~/composables/useK3'

/** 當前注項：信用盤列已選注項，官方盤列選好的 3 個點數 */
const { select: mxSelect, state: mxState, isCd, ofPicks, ofPicked, totalAmount, selectedCount, actions: mxActions } = useK3()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const ofLabel = computed(() => ofPicks.list.filter((n) => n > 0).join('、'))
</script>

<template>
  <section class="block-main k3-curr">
    <div class="curr-head">
      <span class="curr-title">當前注項</span>
      <span class="curr-count">
        {{ isCd ? `${selectedCount} 注` : (ofPicked ? '1 注' : '未選滿') }}
        · 共 {{ money(isCd ? totalAmount : (ofPicked ? Number(mxState.amount) : 0)) }}
      </span>
    </div>

    <table class="curr-table">
      <thead>
        <tr><th>投注號碼</th><th v-if="isCd">賠率</th><th>金額</th></tr>
      </thead>
      <tbody>
        <!-- 信用盤 -->
        <template v-if="isCd">
          <tr v-for="item in mxSelect.items" :key="String(item.playId)">
            <td class="c-code">{{ item.name }}</td>
            <td class="c-odds">{{ item.odds }}</td>
            <td class="c-coin">{{ money(Number(item.coin ?? 0)) }}</td>
          </tr>
          <tr v-if="mxSelect.items.length === 0"><td colspan="3" class="c-empty">尚未選擇注項</td></tr>
        </template>
        <!-- 官方盤 -->
        <template v-else>
          <tr v-if="ofPicked">
            <td class="c-code">{{ ofLabel }}</td>
            <td class="c-coin">{{ money(Number(mxState.amount)) }}</td>
          </tr>
          <tr v-else><td colspan="2" class="c-empty">請選滿 3 個點數</td></tr>
        </template>
      </tbody>
    </table>

    <button v-if="isCd && mxSelect.items.length > 0" type="button" class="clear-btn"
      @click="mxActions.clearSelect()">清空</button>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-k3 .block-main 提供（同 6hc），這裡只寫內容樣式 */
.k3-curr {
  background: #fff;

  .curr-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;

    .curr-title { font-weight: 700; color: var(--color-red-main); }
    .curr-count { font-weight: 700; color: #15803d; }
  }

  .curr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th {
      border-bottom: 1px solid var(--color-red-content);
      padding: 4px 6px;
      background: #fff5f6;
      font-size: 12px;
      color: var(--color-red-desc);
    }

    td { border-bottom: 1px dashed #f3d9dc; padding: 4px 6px; }
    .c-code { font-weight: 700; color: var(--color-red-main); }
    .c-odds { text-align: center; font-weight: 700; color: #d97706; }
    .c-coin { text-align: right; font-weight: 700; }
    .c-empty { text-align: center; color: var(--color-red-desc); }
  }

  .clear-btn {
    margin-top: 8px;
    border: 1px solid var(--color-red-content);
    border-radius: 4px;
    background: #fff;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &:hover { background: #fff1f2; }
  }
}
</style>
