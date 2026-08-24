<script setup lang="ts">
import { computed } from 'vue'
import { usePl3, type Pl3SelectItem } from '~/composables/usePl3'

/**
 * 當前注項
 *
 * pl3 有 3 種看板型態（比照 usePl3 的 board 狀態）：
 *   單選分頁（定位膽）—— 逐項可改金額，同 eggs 的 CurrItems
 *   複式分頁          —— 展開後的注碼共用同一個投注金額，唯讀列出（比照 eggs 彩池玩法的唯讀列）
 *   輸入分頁（三星直選單式）—— 合法注碼共用同一個投注金額，唯讀列出
 * ⚠️ 複式／輸入模式最多只預覽前 50 注，避免展開到上千注把畫面撐爆（詳細總數看 Controls 的統計）。
 */
const PREVIEW_LIMIT = 50

const {
  state: mxState, board, combo, isInputMode, comboCodes, currentQuota: mxQuota,
  selectedCount, totalAmount, actions: mxActions
} = usePl3()

const previewCodes = computed(() => {
  if (isInputMode.value) return board.input.validCodes
  if (combo.value) return comboCodes.value
  return []
})
const previewRows = computed(() => previewCodes.value.slice(0, PREVIEW_LIMIT).map((code) => ({
  key: code,
  code,
  odds: mxActions.oddsOf(isInputMode.value ? `${combo.value?.prefix ?? ''}${code}` : code),
  coin: Number(mxState.amount) || 0
})))
const previewMore = computed(() => Math.max(0, previewCodes.value.length - PREVIEW_LIMIT))

const click = {
  coinInput: (item: Pl3SelectItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const digits = target.value.replace(/\D/g, '')
    const coin = Math.min(mxQuota.value.item.max, Math.trunc(Number(digits) || 0))
    item.coin = coin
    target.value = digits ? String(coin) : ''
  },
  coinBlur: (item: Pl3SelectItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const quota = mxQuota.value.item
    const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(item.coin) || 0)))
    item.coin = coin
    target.value = String(coin)
  }
}
</script>

<template>
  <section class="block-main pl3-curr">
    <div class="curr-head">
      <span class="curr-title">當前注項</span>
      <span class="curr-count">{{ selectedCount }} 注</span>
    </div>

    <div class="curr-body">
      <table class="curr-table">
        <thead>
          <tr>
            <th class="c-code">投注號碼</th>
            <th class="c-odds">賠率</th>
            <th class="c-coin">金額</th>
          </tr>
        </thead>
        <tbody>
          <!-- 複式／輸入模式：展開後的注碼共用同一個金額，唯讀 -->
          <template v-if="combo || isInputMode">
            <tr v-for="row in previewRows" :key="row.key">
              <td class="c-code">{{ row.code }}</td>
              <td class="c-odds">{{ row.odds || '—' }}</td>
              <td class="c-coin is-fixed">{{ row.coin }}</td>
            </tr>
            <tr v-if="previewMore > 0"><td colspan="3" class="c-empty">…等 {{ previewMore }} 注</td></tr>
            <tr v-if="previewRows.length === 0"><td colspan="3" class="c-empty">尚未選擇注項</td></tr>
          </template>
          <!-- 單選分頁（定位膽）：逐項可改金額 -->
          <template v-else>
            <tr v-for="item in board.items" :key="item.code">
              <td class="c-code">{{ item.code }}</td>
              <td class="c-odds">{{ item.odds }}</td>
              <td class="c-coin">
                <input type="number" min="0" :max="mxQuota.item.max" class="coin-input" :value="item.coin || ''"
                  placeholder="0" @input="click.coinInput(item, $event)" @blur="click.coinBlur(item, $event)" />
              </td>
            </tr>
            <tr v-if="board.items.length === 0"><td colspan="3" class="c-empty">尚未選擇注項</td></tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="curr-total">
      共 <b>{{ selectedCount }}</b> 注 · <b class="is-total">{{ Number(totalAmount).toLocaleString('zh-TW') }}</b>
    </div>
    <button v-if="selectedCount > 0" type="button" class="clear-btn" @click="mxActions.clearBoard()">
      清空
    </button>
  </section>
</template>

<style scoped lang="scss">
.pl3-curr {
  height: 350px;
  display: flex;
  flex-direction: column;
  background: #fff;

  .curr-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;

    .curr-title { font-weight: 700; color: var(--color-red-main); }
    .curr-count { font-size: 12px; font-weight: 700; color: var(--color-red-main); }
  }

  .curr-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--color-red-content);
    border-top: 0;
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

  .curr-table {
    width: 100%;
    border-collapse: collapse;
    border: unset;
    font-size: 13px;

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      border-top: none;
      border-bottom: none;
      box-shadow:
        inset 0 1px 0 0 var(--color-red-content),
        inset 0 -1px 0 0 var(--color-red-content);
      padding: 4px 6px;
      background: #fff5f6;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-desc);
    }

    td {
      border-bottom: 1px dashed #f3d9dc;
      padding: 4px 6px;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .c-code {
      text-align: left;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .c-odds {
      text-align: center;
      font-weight: 700;
      color: #d97706;
    }

    .c-coin.is-fixed {
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }

    .c-coin {
      text-align: right;
      font-weight: 700;

      .coin-input {
        width: 100%;
        min-width: 0;
        height: 24px;
        border: 1px solid #f3b7bf;
        border-radius: 4px;
        background: #fff;
        padding: 0 4px;
        text-align: right;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
        }
      }
    }

    .c-empty {
      text-align: center;
      color: var(--color-red-desc);
    }
  }

  .curr-total {
    flex-shrink: 0;
    margin-top: 8px;
    text-align: right;
    font-size: 12px;
    color: var(--color-red-desc);

    b {
      font-weight: 800;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }

    b.is-total {
      color: #15803d;
    }
  }

  .clear-btn {
    flex-shrink: 0;
    align-self: flex-start;
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
