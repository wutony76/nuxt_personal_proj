<script setup lang="ts">
import { computed } from 'vue'
import { usePk10, type Pk10SelectItem } from '~/composables/usePk10'

/**
 * 當前注項
 *   信用盤 → 列已選注項（金額可逐項改）
 *   官方盤單選分頁（前一／定位膽）→ 同上
 *   官方盤複式分頁（前二／前三）  → 列展開後的每一注，共用同一個投注金額
 *
 * ⚠️ 前三直選是彩池分層，沒有固定賠率 —— 賠率欄整欄不渲染，改在看板顯示分層規則。
 */
const {
  select: mxSelect, state: mxState, isCd,
  selectedCount, currentQuota: mxQuota, actions: mxActions,
  og: mxOg, ogCombo, ogComboBets, ogIsPool, ogSelectedCount, ogQuota
} = usePk10()

/** 有沒有賠率欄：彩池分頁沒有 */
const hasOddsColumn = computed(() => isCd.value || !ogIsPool.value)
/** 右上角的注數標籤 */
const currCountLabel = computed(() => `${isCd.value ? selectedCount.value : ogSelectedCount.value} 注`)

/**
 * 官方盤的注項列
 *   單選分頁 → 逐項（注碼／賠率／各自金額）
 *   複式分頁 → 展開後的每一注，金額共用 state.amount
 * ⚠️ 複式展開可能上百注（前三全選 720 注），這裡只列前 50 列，
 *    否則 DOM 會爆掉；總注數與總額仍以 ogSelectedCount / ogTotalAmount 為準。
 */
const OG_ROW_LIMIT = 50
const ogRows = computed(() => {
  if (ogCombo.value) {
    const coin = Number(mxState.amount) || 0
    return ogComboBets.value.slice(0, OG_ROW_LIMIT).map((cars) => {
      const label = mxActions.comboLabelOf(cars)
      return {
        key: label,
        label,
        // 彩池分頁（前三）沒有賠率；前二直選的注碼是「前二」+ 顯示字串
        odds: ogIsPool.value ? 0 : mxActions.ogOddsOf(`${ogCombo.value!.prefix}${label}`),
        coin,
        shared: true
      }
    })
  }
  return mxOg.items
    .filter((item) => Number(item.coin) > 0)
    .slice(0, OG_ROW_LIMIT)
    .map((item) => ({ key: item.code, label: item.code, odds: item.odds, coin: item.coin, shared: false }))
})
const ogHiddenCount = computed(() => Math.max(0, ogSelectedCount.value - ogRows.value.length))

const ogCoinHandlers = {
  /**
   * 官方盤的金額輸入
   *
   * 單選分頁 —— 每一注各自有金額，逐項改。
   * 複式分頁 —— 每一注都用同一個「投注金額」，所以改任一列等於改 mxState.amount，
   *             畫面上其他列會一起變（它們本來就是同一個值）。
   */
  input: (row: { label: string; shared: boolean }, event: Event) => {
    const target = event.target as HTMLInputElement
    const coin = Math.min(ogQuota.value.item.max, Math.max(0, Math.trunc(Number(target.value) || 0)))
    if (row.shared) mxState.amount = coin
    else mxActions.setOgItemCoin(row.label, coin)
    target.value = coin > 0 ? String(coin) : ''
  },
  /** 離開欄位夾回 [min, max]，不讓它留在 0（0 會被伺端拒單） */
  blur: (row: { label: string; shared: boolean }, event: Event) => {
    const target = event.target as HTMLInputElement
    const quota = ogQuota.value.item
    const raw = row.shared
      ? Number(mxState.amount)
      : Number(mxOg.items.find((item) => item.code === row.label)?.coin ?? 0)
    const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(raw || 0)))
    if (row.shared) mxState.amount = coin
    else mxActions.setOgItemCoin(row.label, coin)
    target.value = String(coin)
  }
}

const click = {
  /**
   * 逐項改金額（信用盤）
   *
   * 輸入中不動 item.select —— 一旦改成 false，_syncSelectItems 會把這列從清單移除，
   * 使用者正在打的欄位就消失了。改成離開欄位（blur）時才夾回單注限額。
   */
  coinInput: (item: Pk10SelectItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const digits = target.value.replace(/\D/g, '')
    const coin = Math.min(mxQuota.value.item.max, Math.trunc(Number(digits) || 0))
    item.coin = coin
    target.value = digits ? String(coin) : ''
    mxActions.syncSelectItems()
  },
  /** 離開欄位：夾回 [min, max]，不讓它留在 0（0 會讓整筆被伺端拒單） */
  coinBlur: (item: Pk10SelectItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const quota = mxQuota.value.item
    const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(item.coin) || 0)))
    item.coin = coin
    target.value = String(coin)
    mxActions.syncSelectItems()
  }
}
</script>

<template>
  <section class="block-main pk10-curr">
    <div class="curr-head">
      <span class="curr-title">當前注項</span>
      <!-- 只顯示注數；金額改在投注金額卡的「總下注額度」呈現 -->
      <span class="curr-count">{{ currCountLabel }}</span>
    </div>

    <div class="curr-body">
      <table class="curr-table">
        <thead>
          <!-- th 的 class 與對應 td 共用同一組對齊規則，標題才會與內容對齊 -->
          <tr>
            <th class="c-code">投注號碼</th>
            <th v-if="hasOddsColumn" class="c-odds">賠率</th>
            <th class="c-coin">金額</th>
          </tr>
        </thead>
        <tbody>
          <!-- 信用盤 -->
          <template v-if="isCd">
            <tr v-for="item in mxSelect.items" :key="String(item.playId)">
              <td class="c-code">{{ mxActions.labelOf(item.name) }}</td>
              <td class="c-odds">{{ item.odds }}</td>
              <td class="c-coin">
                <input type="number" min="0" :max="mxQuota.item.max" class="coin-input" :value="item.coin || ''"
                  placeholder="0" @input="click.coinInput(item, $event)" @blur="click.coinBlur(item, $event)" />
              </td>
            </tr>
            <tr v-if="mxSelect.items.length === 0">
              <td colspan="3" class="c-empty">尚未選擇注項</td>
            </tr>
          </template>
          <!-- 官方盤（單選與複式共用同一組列，差別只在金額是否共用） -->
          <template v-else>
            <tr v-for="row in ogRows" :key="row.key">
              <td class="c-code">{{ row.label }}</td>
              <td v-if="hasOddsColumn" class="c-odds">{{ row.odds || '—' }}</td>
              <td class="c-coin">
                <input type="number" min="0" :max="ogQuota.item.max" class="coin-input" :value="row.coin || ''"
                  placeholder="0" @input="ogCoinHandlers.input(row, $event)"
                  @blur="ogCoinHandlers.blur(row, $event)" />
              </td>
            </tr>
            <!-- 複式展開太多時只列前 50 注，剩下的用一列說明（總額仍是全部注數算的） -->
            <tr v-if="ogHiddenCount > 0">
              <td :colspan="hasOddsColumn ? 3 : 2" class="c-empty">…另有 {{ ogHiddenCount }} 注（金額相同）</td>
            </tr>
            <tr v-if="ogRows.length === 0">
              <td :colspan="hasOddsColumn ? 3 : 2" class="c-empty">
                {{ ogCombo ? `請為每個名次都選一個車號（共 ${ogCombo.positions} 個名次）` : '尚未選擇注項' }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <button v-if="isCd && mxSelect.items.length > 0" type="button" class="clear-btn"
      @click="mxActions.clearSelect()">清空</button>
    <button v-else-if="!isCd && ogSelectedCount > 0" type="button" class="clear-btn"
      @click="mxActions.clearOg()">清空</button>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-pk10 .block-main 提供（同 k3 / 6hc），這裡只寫內容樣式 */
.pk10-curr {
  /* 固定高度，注項多了由內部捲動（標題列與清空鈕不跟著捲） */
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

    .curr-title {
      font-weight: 700;
      color: var(--color-red-main);
    }

    .curr-count {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
    }
  }

  .curr-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    /* 外框改掛在捲動區：表格自身的框會隨內容捲走，
       上緣留給 sticky 表頭用 inset 畫 */
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
      /* 表頭釘住，捲動時仍看得到欄位名稱。
         ⚠️ border-collapse: collapse 的框線屬於表格而不是格子，不會跟著 sticky 的
            表頭移動 —— 捲動後上框就消失了。改用 inset box-shadow 畫上下框。 */
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

    /* 最後一列不畫下框，免得與 .curr-body 的外框底邊疊線 */
    tbody tr:last-child td {
      border-bottom: none;
    }

    /* 以下三組同時套用在 th 與 td 上 —— 標題與內容共用對齊方式 */
    .c-code {
      text-align: left;
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;
    }

    .c-odds {
      text-align: center;
      font-weight: 700;
      color: #d97706;
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

    /* 表頭沿用 .curr-table th 的字色，不吃上面三組的內容色 */
    th.c-code,
    th.c-odds,
    th.c-coin {
      color: var(--color-red-desc);
    }

    .c-empty {
      text-align: center;
      color: var(--color-red-desc);
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

    &:hover {
      background: #fff1f2;
    }
  }
}
</style>
