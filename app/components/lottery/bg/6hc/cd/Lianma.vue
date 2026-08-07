<script setup lang="ts">
import { cloneDeep } from 'lodash-es'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import { use6hcCredit } from '~/composables/use6hcCredit'

type PoolItem = { playId: string | number; name: string; select?: boolean; coin?: string | number }

/**
 * 連碼看板
 *
 * 與 PlayBoard（特碼／正碼／正碼特／七碼）的差別：那些玩法「一個注項 = 一注」，
 * 每個注項各自有金額輸入框；連碼是「選一組號碼 → 組成 N 注」，
 * 金額只有一個（每注同額），注數由 C(已選, pick) 決定，所以不能共用 PlayBoard。
 *
 * 組合展開與注項同步都在 composable 的 _syncSelectItems 裡，
 * 本元件只負責號碼球的選取與摘要顯示；送單仍走既有的 Controls「投注」鈕。
 */
const NUMBER_COLUMNS = 10

const {
  state: mxState,
  groupList: mxGroupList,
  select: mxSelect,
  actions: mxActions,
  currentQuota: mxQuota,
  currentCombo: mxCombo,
  currentTiers: mxTiers,
  comboMaxBets: mxMaxBets,
} = use6hcCredit()

// --- HANDLE ---
const _handlers = {
  colorOf: (name: string) => {
    const padded = String(Number(name)).padStart(2, '0')
    if ((LHC_COLORS.red as readonly string[]).includes(padded)) return 'red'
    if ((LHC_COLORS.blue as readonly string[]).includes(padded)) return 'blue'
    if ((LHC_COLORS.green as readonly string[]).includes(padded)) return 'green'
    return 'yellow'
  },
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
const numberRows = computed(() => _handlers.toMatrix((layout.value?.tabGroup?.[0]?.groupList ?? []) as PoolItem[], NUMBER_COLUMNS))
const groupName = computed(() => String(layout.value?.tabGroup?.[0]?.groupName ?? ''))

const selectedCount = computed(() => mxSelect.pool.filter((item) => item.select).length)
const selectedCodes = computed(() =>
  mxSelect.pool.filter((item) => item.select).map((item) => String(Number(item.name)).padStart(2, '0'))
)
// 注數 = 已選號碼可組出的組合數（= composable 展開後的當前注項數）
const betCount = computed(() => mxSelect.items.length)
const coinPerBet = computed(() =>
  Math.min(mxQuota.value.item.max, Math.max(mxQuota.value.item.min, Number(mxState.amount) || 0))
)
const totalCoin = computed(() => betCount.value * coinPerBet.value)
const shortfall = computed(() => Math.max(0, (mxCombo.value?.minPick ?? 0) - selectedCount.value))
</script>

<template>
  <div class="main-play-base lianma">
    <!-- 該分頁限額與選號規格（伺端以同一份 settings 驗證） -->
    <div class="quota-bar">
      <span class="quota-item">單注 {{ _handlers.money(mxQuota.item.min) }} — {{ _handlers.money(mxQuota.item.max) }}</span>
      <span v-if="mxQuota.issue.max > 0" class="quota-item">
        單期上限 {{ _handlers.money(mxQuota.issue.max) }}
      </span>
      <span v-if="mxCombo" class="quota-item">
        每注 {{ mxCombo.pick }} 個號 · 最多選 {{ mxCombo.maxPick }} 個（{{ mxMaxBets }} 注）
      </span>
      <span class="quota-note">※ 派彩以下注時鎖定的檔次賠率為準</span>
    </div>

    <!-- 命中檔次與賠率 -->
    <div v-if="mxTiers.length" class="tier-bar">
      <span v-for="tier in mxTiers" :key="String(tier.key)" class="tier-chip">
        {{ tier.name }}<em>{{ tier.odds }}</em>
      </span>
    </div>

    <div class="play-group">
      <div class="group-title">{{ groupName }}</div>
      <table class="play-table">
        <tbody>
          <tr v-for="(row, rowIndex) in numberRows" :key="`lianma-row-${rowIndex}`">
            <td v-for="(item, colIndex) in row" :key="`lianma-cell-${rowIndex}-${colIndex}`" class="td-code"
              :class="{ active: item?.select, clickable: !!item }" @click="item && click.toggle(item)">
              <button v-if="item" type="button" class="option is-ball"
                :class="[`c-${_handlers.colorOf(item.name)}`, { active: item.select }]">
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
        <span class="summary-label">已選號碼</span>
        <span class="summary-codes">
          <template v-if="selectedCodes.length">
            <span v-for="code in selectedCodes" :key="`picked-${code}`" class="code-chip">{{ code }}</span>
          </template>
          <em v-else class="code-empty">尚未選號</em>
        </span>
        <button type="button" class="clear-btn" :disabled="!selectedCount" @click="click.clear()">清空</button>
      </div>
      <div class="summary-row is-total">
        <span class="summary-stat">
          已選 <strong>{{ selectedCount }}</strong> / {{ mxCombo?.maxPick ?? 0 }} 個號
        </span>
        <span class="summary-stat">
          可組 <strong>{{ betCount }}</strong> 注 · 每注 <strong>{{ _handlers.money(coinPerBet) }}</strong>
        </span>
        <span class="summary-total">
          總額 <strong>{{ _handlers.money(totalCoin) }}</strong>
        </span>
      </div>
      <p v-if="shortfall > 0" class="summary-hint">
        還需再選 <strong>{{ shortfall }}</strong> 個號才能組成一注
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-play-base.lianma {
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

  /* 命中檔次賠率 */
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

    /* 號碼球（與 PlayBoard 同一套色系） */
    .option.is-ball {
      box-sizing: border-box;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 0.2rem solid var(--6hcOf-ball-yellow);
      background: #fff;
      font-size: 15px;
      font-weight: 600;
      color: #000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transition: all 0.15s ease;

      &.c-red {
        border-color: var(--6hcOf-ball-red);
      }

      &.c-blue {
        border-color: var(--6hcOf-ball-blue);
      }

      &.c-green {
        border-color: var(--6hcOf-ball-green);
      }

      &.c-yellow {
        border-color: var(--6hcOf-ball-yellow);
      }

      &.active {
        box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.35);
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
          font-variant-numeric: tabular-nums;
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
