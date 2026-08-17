<script setup lang="ts">
import { computed } from 'vue'
import Car from '~/components/lottery/bg/pk10/base/Car.vue'
import { PK10_SUM_BIG_LINE } from '#shared/config/pk10'
import { usePk10 } from '~/composables/usePk10'

/**
 * 開獎歷史：一期一列，直向排列（版位對應 k3 的 History）
 *
 * 一列的資訊順序＝期號 → 完整 10 個名次的車號球 → 冠亞和與兩面：
 *   150  ⑧⑨⑦③④①⑤⑥⑩②  和17 大 單
 * 球的順序就是名次（第 1 顆＝冠軍），前三名後面留一個較寬的間隔，
 * 讓「前三直選」要看的那三顆一眼就分得出來。
 *
 * ⚠️ 十顆球比三顆寬得多，所以卡片寬度取 .info-main 的 42%（不是 k3 的 33%）——
 *    右邊的路珠最少要 16 欄 × 34px = 544px，42% 之後仍留得下。
 *    真的擠不下時 .hist-cars 會折行，名次順序仍是由左至右、由上至下。
 */
const { openCodeHistory: mxHistory, isCd, actions: mxActions } = usePk10()

/** 要顯示幾期（列數） */
const HIST_ROWS = 5

/**
 * 一期一列的顯示資料
 * 大小分界讀 PK10_SUM_BIG_LINE 而不是寫死 12；冠亞和在 template 會用到三次，
 * 這裡先算好避免每次 render 重複呼叫 sumOf。
 */
const rows = computed(() => mxHistory.list.slice(0, HIST_ROWS).map((item) => {
  const sum = mxActions.sumOf(item.openCode)
  return {
    issue: String(item.issue),
    // 完整名次（第 i 顆＝第 i 名的車號），不再截斷
    openCode: Array.isArray(item.openCode) ? item.openCode : [],
    sum,
    isBig: sum >= PK10_SUM_BIG_LINE,
    isOdd: sum % 2 === 1
  }
}))
</script>

<template>
  <div class="block-main pk10-history">
    <div class="hist-head">
      <span class="hist-title">近五期開獎</span>
      <!-- 兩個盤口共用同一份開獎號，說明要指向「對面那個盤口」 -->
      <span class="hist-note">※ 與 [{{ isCd ? '官方' : '信用' }}] 同開獎號</span>
    </div>
    <div class="hist-body">
      <div v-for="row in rows" :key="row.issue" class="hist-row">
        <span class="hist-issue">{{ row.issue.slice(-3) }}</span>
        <span class="hist-cars">
          <Car v-for="(code, idx) in row.openCode" :key="idx" :car="code" size="xs" />
        </span>
        <span class="hist-meta">
          <b>和{{ row.sum }}</b>
          <em :class="row.isBig ? 'is-red' : 'is-blue'">{{ row.isBig ? '大' : '小' }}</em>
          <em :class="row.isOdd ? 'is-red' : 'is-blue'">{{ row.isOdd ? '單' : '雙' }}</em>
        </span>
      </div>
      <div v-if="rows.length === 0" class="hist-empty">
        {{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pk10-history {
  /* 一列要放完整 10 顆車號球，寬度取 .info-main 的 46%（k3 只放 3 顆骰子，那邊 33% 就夠）。
     ⚠️ 42% 時球列會差幾 px 而折行，且折不折行取決於「和N」是一位還是兩位數，
        同一張卡片會出現有的列一行、有的列兩行 —— 所以寬度要一次給足。
     路珠本來就會橫向捲動（一天 205 期，欄數遠超過 MIN_COLS），這裡不需要為它保留寬度。 */
  flex: 0 0 46%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;

  .hist-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .hist-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .hist-note {
      font-size: 11px;
      color: var(--color-red-desc);
    }
  }

  .hist-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 6px;
    overflow-x: hidden;
    overflow-y: auto;
    padding-right: 4px;
    /* 捲軸與 6hc 當期注單一致 */
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #ffc6c6;
      border-radius: 999px;
    }

    &::-webkit-scrollbar-thumb {
      background: #f54c07;
      border-radius: 999px;
      border: 2px solid #ffc6c6;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #de4304;
    }
  }

  .hist-row {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--color-red-content);
    border-radius: 6px;
    background: #fffafa;
    padding: 4px 8px;

    .hist-issue {
      /* 固定寬度，期號位數不同也不會讓後面的球跳動 */
      flex: 0 0 26px;
      font-size: 11px;
      color: var(--color-red-desc);
    }

    .hist-cars {
      /* 吃掉中間剩餘寬度；窄螢幕真的擠不下才折行（順序仍是名次序，由左至右、由上至下） */
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1px;

      /* 前三名（冠／亞／季）後面留一個較寬的間隔 ——
         「前三直選」看的就是這三顆，分開之後不用數就找得到 */
      :deep(.pk10-car):nth-child(3) {
        margin-right: 5px;
      }
    }

    .hist-meta {
      /* 固定寬度而不是 auto：讓「和9」與「和16」佔一樣寬，
         每一列的球列起點才會對齊、也不會因為多一位數就折行 */
      flex: 0 0 84px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      font-size: 11px;

      b {
        font-weight: 700;
        color: var(--color-red-main);
      }

      em {
        font-style: normal;
        font-weight: 700;
        border-radius: 3px;
        padding: 0 4px;

        /* 大／單走紅、小／雙走藍，與 Header 的開獎標籤同一套配色 */
        &.is-red {
          background: #fee2e2;
          color: #b91c1c;
        }

        &.is-blue {
          background: #dbeafe;
          color: #1d4ed8;
        }
      }
    }
  }

  /* 沒有資料時整塊反灰（灰字 + 淡灰底），與有資料時的紅色系明顯區隔 */
  .hist-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: #f7f7f7;
    font-size: 12px;
    color: var(--text-gray);
  }
}
</style>
