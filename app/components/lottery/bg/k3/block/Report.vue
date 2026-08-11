<script setup lang="ts">
import { computed } from 'vue'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import { useK3 } from '~/composables/useK3'

/** 下注紀錄（含結算結果）與可領獎金 */
const { userRecord: mxRecord, isCd, fetch: mxFetch } = useK3()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const claimable = computed(() =>
  Number(mxRecord.claimableIssues.reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2))
)
const statusText = (status: string) => ({ win: '中獎', lose: '未中', tie: '和局', pending: '待開獎' }[status] ?? status)
</script>

<template>
  <section class="block-main k3-report">
    <div class="rp-head">
      <span class="rp-title">下注紀錄</span>
      <span class="rp-claim">
        可領 <b>{{ money(claimable) }}</b>
        <button type="button" class="claim-btn" :disabled="claimable <= 0 || mxRecord.isSubmittingClaim"
          @click="mxFetch.claimOneIssue()">
          {{ mxRecord.isSubmittingClaim ? '領取中…' : '領取' }}
        </button>
      </span>
    </div>

    <div class="rp-body">
      <table class="report-table rp-table">
        <thead>
          <tr>
            <th>期數</th><th>注碼</th><th>金額</th>
            <th v-if="isCd">賠率</th><th v-else>命中</th>
            <th>結果</th><th>派彩</th><th>開獎</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mxRecord.betHistory" :key="row.orderId" :class="`is-${row.winStatus}`">
            <td class="t-issue">{{ row.issue }}</td>
            <td class="t-code">{{ row.betCode.join('、') }}</td>
            <td class="t-num">{{ money(row.coin) }}</td>
            <td v-if="isCd" class="t-num">{{ row.odds ?? '—' }}</td>
            <td v-else class="t-num">{{ row.matchCount }} 顆<em v-if="row.tierName">（{{ row.tierName }}）</em></td>
            <td class="t-status">{{ statusText(row.winStatus) }}</td>
            <td class="t-num t-payout">{{ row.winAmount > 0 ? money(row.winAmount) : '—' }}</td>
            <td class="t-open">
              <span v-if="row.openCode?.length" class="open-dice">
                <Dice v-for="(code, idx) in row.openCode" :key="idx" :num="code" size="sm" />
              </span>
              <em v-else>—</em>
            </td>
          </tr>
          <tr v-if="mxRecord.betHistory.length === 0">
            <td :colspan="7" class="t-empty">{{ mxRecord.isLoading ? '載入中…' : '尚無下注紀錄' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-k3 .block-main 提供；表格沿用全域 .report-table（同 6hc） */
.k3-report {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;

  .rp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;

    .rp-title { font-weight: 700; color: var(--color-red-main); }

    .rp-claim {
      color: var(--color-red-desc);
      b { font-size: 15px; color: #15803d; }

      .claim-btn {
        margin-left: 8px;
        border: 1px solid var(--color-red-main);
        border-radius: 4px;
        background: var(--color-red-main);
        padding: 3px 12px;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        cursor: pointer;

        &:disabled { opacity: 0.45; cursor: not-allowed; }
      }
    }
  }

  .rp-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    /* 捲軸樣式與 6hc 的當期注單一致 */
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar { width: 8px; height: 8px; }
    &::-webkit-scrollbar-track { background: #ffc6c6; border-radius: 999px; }
    &::-webkit-scrollbar-thumb { background: #f54c07; border-radius: 999px; border: 2px solid #ffc6c6; }
    &::-webkit-scrollbar-thumb:hover { background: #de4304; }
  }

  .rp-table {
    th {
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .t-issue { color: var(--color-red-desc); white-space: nowrap; }
    .t-code { font-weight: 700; color: var(--color-red-main); }
    .t-num { text-align: right; white-space: nowrap; em { font-style: normal; color: #d97706; } }
    .t-status { text-align: center; font-weight: 700; }
    .t-payout { font-weight: 700; }
    .t-open .open-dice { display: inline-flex; gap: 3px; }
    .t-empty { text-align: center; padding: 20px; color: var(--color-red-desc); }

    .is-win { background: #f0fdf4; .t-status, .t-payout { color: #15803d; } }
    .is-lose { .t-status { color: var(--color-red-desc); } }
    .is-tie { background: #fffbeb; .t-status { color: #b45309; } }
    .is-pending { .t-status { color: #f59e0b; } }
  }
}
</style>
