<script setup lang="ts">
import { cloneDeep } from 'lodash-es'
import { creditTabOddsOf } from '#shared/config/cd/helpers'
import { use6hcCredit } from '~/composables/use6hcCredit'

type PoolItem = { playId: string | number; name: string; select?: boolean; coin?: string | number }
type ComboItem = { playId: string | number; name: string; codes?: string[]; coin?: string | number }

/**
 * 連尾看板
 *
 * 結構與連碼／合肖／連肖同類：注項池由玩家自選（0 ~ 9 尾選 n 個），選取後展開成 C(已選, pick) 組合，
 * 每個組合才是一注 —— 與 PlayBoard（特碼／正碼…）「一個注項 = 一注」不同，故不能共用。
 *
 * 與連肖的差別：選的是「尾數」而非「生肖」，且尾數分布固定不隨年份輪轉。
 * 賠率同樣不是固定檔次表，取決於「所選的那幾個尾數」（見 creditLianweiOddsOf，是否含 0 尾影響賠率），
 * 故不顯示 tier-bar，改即時依目前已展開的注項算出賠率區間。
 */
const NAME_COLUMNS = 5

const {
  state: mxState,
  groupList: mxGroupList,
  select: mxSelect,
  actions: mxActions,
  currentQuota: mxQuota,
  currentCombo: mxCombo,
  comboMaxBets: mxMaxBets,
} = use6hcCredit()

// --- HANDLE ---
const _handlers = {
  money: (value: number) => Number(value).toLocaleString('zh-TW'),
  // 直向（column-major）排成 rows × columns，與 PlayBoard 的號碼排列一致
  toMatrix: (list: PoolItem[], columns: number) => {
    const rows = Math.ceil(list.length / columns)
    return Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, colIndex) => list[rowIndex + colIndex * rows] ?? null)
    )
  },
}

const click = {
  toggle: (item: PoolItem) => {
    const combo = mxCombo.value
    if (!combo) return
    // 取消選取一律放行；新增選取則不得超過該分頁的複式上限
    if (!item.select && selectedCount.value >= combo.maxPick) return
    item.select = !item.select
    mxState.selectedCodes = mxSelect.pool.filter((row) => row.select).map((row) => String(row.playId))
    mxActions.syncSelectItems()
  },
  clear: () => {
    mxActions.clearSelect()
  },
}

// --- COMPUTED ---
const layout = computed(() => {
  void mxSelect.resetToken // 下注成功後清空選取
  const found = mxGroupList.value.find((item) => item.tabId === mxState.selectTabId)
  if (!found?.tabGroup?.length) {
    if (import.meta.client) mxActions.registerSelectPool([])
    return null
  }
  const cloned = reactive(cloneDeep(found))
  const pool: PoolItem[] = []
  cloned.tabGroup.forEach((group) => {
    group.groupList.forEach((item: PoolItem) => {
      item.select = false
      item.coin = 0
      pool.push(item)
    })
  })
  // 僅在 client 登記：select 是 module 級 singleton，SSR 寫入會跨請求殘留
  if (import.meta.client) mxActions.registerSelectPool(pool)
  return cloned
})
const nameRows = computed(() => _handlers.toMatrix((layout.value?.tabGroup?.[0]?.groupList ?? []) as PoolItem[], NAME_COLUMNS))
const groupName = computed(() => String(layout.value?.tabGroup?.[0]?.groupName ?? ''))

const selectedCount = computed(() => mxSelect.pool.filter((item) => item.select).length)
const selectedNames = computed(() => mxSelect.pool.filter((item) => item.select).map((item) => String(item.name)))

// 注數 = 已選尾數可組出的組合數（= composable 展開後的當前注項數）
const betCount = computed(() => mxSelect.items.length)
const coinPerBet = computed(() =>
  Math.min(mxQuota.value.item.max, Math.max(mxQuota.value.item.min, Number(mxState.amount) || 0))
)
const totalCoin = computed(() => betCount.value * coinPerBet.value)
const shortfall = computed(() => Math.max(0, (mxCombo.value?.minPick ?? 0) - selectedCount.value))

// 賠率取決於「所選的那幾個尾數」，非固定檔次表 —— 依目前展開的每個組合即時推算，
// 只選滿 1 組（= pick 個）時顯示單一賠率，選更多（複式展開多注）時顯示區間
const oddsRange = computed(() => {
  const values = (mxSelect.items as ComboItem[])
    .map((item) => creditTabOddsOf(mxState.select, mxState.selectTabId, item.codes?.[0], undefined, item.codes))
    .filter((odds) => odds > 0)
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  return { min, max }
})
</script>

<template>
  <div class="main-play-base lianwei">
    <!-- 該分頁限額與選號規格（伺端以同一份 settings 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ _handlers.money(mxQuota.item.min) }} — {{ _handlers.money(mxQuota.item.max) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">
        單期上限 {{ _handlers.money(mxQuota.issue.max) }}
      </span>
      <span v-if="mxCombo" class="quota-item">
        每注 {{ mxCombo.pick }} 個尾數 · 最多選 {{ mxCombo.maxPick }} 個（{{ mxMaxBets }} 注）
      </span>
      <span class="quota-note">※ 賠率依所選尾數即時計算，派彩以下注時鎖定的賠率為準</span>
    </div>

    <!-- 目前賠率（取決於所選的那幾個尾數，非固定值） -->
    <div v-if="oddsRange" class="tier-bar">
      <span class="tier-chip">
        目前賠率
        <em v-if="oddsRange.min === oddsRange.max">{{ oddsRange.min }}</em>
        <em v-else>{{ oddsRange.min }} — {{ oddsRange.max }}</em>
      </span>
    </div>

    <div class="play-group">
      <div class="group-title">{{ groupName }}</div>
      <table class="play-table">
        <tbody>
          <tr v-for="(row, rowIndex) in nameRows" :key="`lianwei-row-${rowIndex}`">
            <td v-for="(item, colIndex) in row" :key="`lianwei-cell-${rowIndex}-${colIndex}`" class="td-code"
              :class="{ active: item?.select, clickable: !!item }" @click="item && click.toggle(item)">
              <button v-if="item" type="button" class="option is-pill" :class="{ active: item.select }">
                {{ item.name }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 選號摘要：注數與總額（送單仍走下方 Controls 的投注鈕） -->
    <div class="combo-summary">
      <div class="summary-row">
        <span class="summary-label">已選尾數</span>
        <span class="summary-codes">
          <template v-if="selectedNames.length">
            <span v-for="name in selectedNames" :key="`picked-${name}`" class="code-chip">{{ name }}</span>
          </template>
          <em v-else class="code-empty">尚未選尾數</em>
        </span>
        <button type="button" class="clear-btn" :disabled="!selectedCount" @click="click.clear()">清空</button>
      </div>
      <div class="summary-row is-total">
        <span class="summary-stat">
          已選 <strong>{{ selectedCount }}</strong> / {{ mxCombo?.maxPick ?? 0 }} 個尾數
        </span>
        <span class="summary-stat">
          可組 <strong>{{ betCount }}</strong> 注 · 每注 <strong>{{ _handlers.money(coinPerBet) }}</strong>
        </span>
        <span class="summary-total">
          總額 <strong>{{ _handlers.money(totalCoin) }}</strong>
        </span>
      </div>
      <p v-if="shortfall > 0" class="summary-hint">
        還需再選 <strong>{{ shortfall }}</strong> 個尾數才能組成一注
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-play-base.lianwei {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0 0.75rem 0.75rem;

  /* 分頁限額提示列（與 PlayBoard 同一套視覺） */
  .quota-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid #fee2e2;
    border-radius: 0.25rem;
    background: #fff5f6;
    font-size: 12px;

    .quota-item {
      font-weight: 700;
      color: var(--color-red-main);
      font-variant-numeric: tabular-nums;

      &+.quota-item::before {
        content: '·';
        margin-right: 8px;
        color: var(--color-red-desc);
      }
    }

    .quota-note {
      margin-left: auto;
      color: var(--color-red-desc);
    }
  }

  /* 目前賠率（依所選尾數即時計算） */
  .tier-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .tier-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--color-gold);
      border-radius: 999px;
      background: #fffbeb;
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);

      em {
        font-style: normal;
        font-size: 13px;
        font-weight: 800;
        color: #b45309;
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .play-group {
    display: flex;
    flex-direction: column;

    .group-title {
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-red-main);
      padding: 0.5rem 0;
    }

    .play-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;

      td {
        border: 1px solid #fee2e2;
        text-align: center;
        vertical-align: middle;
        padding: 6px 4px;
      }

      .td-code.clickable {
        cursor: pointer;

        &:hover {
          background: #fbe3e6;
        }
      }

      .td-code.active {
        background: var(--color-yellow-text);
      }
    }

    /* 尾數膠囊（與 PlayBoard 的文字注項一致） */
    .option.is-pill {
      box-sizing: border-box;
      min-width: 52px;
      height: 32px;
      padding: 0 12px;
      border-radius: 6px;
      border: 1px solid var(--color-red-700);
      background: #fff;
      font-size: 15px;
      font-weight: 600;
      color: var(--color-red-main);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transition: all 0.15s ease;

      &.active {
        border-color: var(--color-red-main);
        background: var(--color-red-main);
        color: #fff;
      }
    }
  }

  /* 選號摘要 */
  .combo-summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid #f3b7bf;
    border-radius: 6px;
    background: #fff5f6;
    padding: 10px 12px;

    .summary-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .summary-label {
        flex-shrink: 0;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-desc);
      }

      .summary-codes {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;

        .code-chip {
          min-width: 28px;
          border: 1px solid var(--color-red-700);
          border-radius: 4px;
          background: #fff;
          padding: 1px 6px;
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          color: var(--color-red-main);
        }

        .code-empty {
          font-size: 12px;
          font-style: normal;
          color: var(--color-red-desc);
        }
      }

      .clear-btn {
        flex-shrink: 0;
        border: 1px solid #f3b7bf;
        border-radius: 0.25rem;
        background: #fff;
        padding: 3px 12px;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-desc);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
          background: #fff5f6;
          color: var(--color-red-main);
        }

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      }

      &.is-total {
        border-top: 1px dashed #f3b7bf;
        padding-top: 8px;

        .summary-stat {
          font-size: 12px;
          color: var(--color-red-desc);

          strong {
            font-size: 14px;
            font-weight: 800;
            color: var(--color-red-main);
            font-variant-numeric: tabular-nums;
          }
        }

        .summary-total {
          margin-left: auto;
          font-size: 12px;
          color: var(--color-red-desc);

          strong {
            font-size: 16px;
            font-weight: 800;
            color: #b45309;
            font-variant-numeric: tabular-nums;
          }
        }
      }
    }

    .summary-hint {
      margin: 0;
      font-size: 12px;
      color: var(--color-red-desc);

      strong {
        color: var(--color-red-main);
      }
    }
  }
}
</style>
