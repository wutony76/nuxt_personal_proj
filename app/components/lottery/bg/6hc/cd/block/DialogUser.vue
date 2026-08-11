<script setup lang="ts">
import { computed, reactive } from 'vue'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import { actions } from '~/utils/common'
import type { LotteryClaimableIssue, LotteryUserBalanceChange, LotteryUserBetHistory } from '~/services/api'

type SortOrder = 'asc' | 'desc'
type BetSortField = 'default' | 'orderId' | 'winAmount'

const WIN_STATUS_TEXT: Record<string, string> = {
  pending: '未開獎',
  win: '中獎',
  lose: '未中獎',
  tie: '和局', // 特碼兩面開出 49，退還本金
}
const BALANCE_TYPE_TEXT: Record<string, string> = {
  bet: '下注',
  claim: '領獎',
}

const props = defineProps<{
  visible: boolean
  data: {
    isLoading: boolean
    isSubmittingClaim: boolean
    errorMessage: string
    jackpot: { currentIssueJackpot: number; carryJackpot: number }
    claimableIssues: LotteryClaimableIssue[]
    balanceChanges: LotteryUserBalanceChange[]
    betHistory: LotteryUserBetHistory[]
  }
}>()

const emit = defineEmits<{
  close: []
  claim: []
}>()

const state = reactive({
  activeTab: 'balance' as 'balance' | 'bets',
  balanceSortActive: false,
  balanceSortOrder: 'desc' as SortOrder,
  betIssueFilter: '' as string,
  betSortField: 'default' as BetSortField,
  betSortOrder: 'desc' as SortOrder,
})

// --- HANDLE ---
const _handlers = {
  isNumber: (code: string | number) => /^\d+$/.test(String(code)),
  // 依號碼 / 波色文字推得色系（與 Tema、ReportIssueBets 一致）
  colorOf: (code: string | number) => {
    const s = String(code)
    if (/^\d+$/.test(s)) {
      const n = s.padStart(2, '0')
      if ((LHC_COLORS.red as readonly string[]).includes(n)) return 'red'
      if ((LHC_COLORS.blue as readonly string[]).includes(n)) return 'blue'
      if ((LHC_COLORS.green as readonly string[]).includes(n)) return 'green'
      return 'yellow'
    }
    if (s.includes('紅')) return 'red'
    if (s.includes('藍')) return 'blue'
    if (s.includes('綠')) return 'green'
    return ''
  },
  /** 開獎號碼顯示：維持兩位數（開獎號是官方牌面，與注碼寫法無關） */
  displayCode: (code: string | number) => (/^\d+$/.test(String(code)) ? String(code).padStart(2, '0') : String(code)),
  /** 注碼顯示：不補零（1 ~ 9 就顯示 1 ~ 9），與看板設定、伺端存下的注碼一致 */
  displayBetCode: (code: string | number) => String(code),
  formatTime: (timestamp: number) => (Number(timestamp) > 0 ? new Date(Number(timestamp)).toLocaleString() : '-'),
  betCount: (item: LotteryUserBetHistory) => Number(item.betCount ?? 0) || (Array.isArray(item.betCode) ? item.betCode.length : 1) || 1,
  winStatusText: (status: string) => WIN_STATUS_TEXT[status] ?? status,
  balanceTypeText: (type: string) => BALANCE_TYPE_TEXT[type] ?? type,
  // 該注號是否命中所選期數的開獎號（未開獎則不標記）
  isHit: (code: string | number, openCode: string[]) => openCode.some((item) => Number(item) === Number(code)),
  sortIcon: (active: boolean, order: SortOrder) => (!active ? '⇅' : order === 'asc' ? '↑' : '↓'),
}

// --- COMPUTED ---
const betIssues = computed(() =>
  [...new Set(props.data.betHistory.map((item) => item.issue))].sort((a, b) => b.localeCompare(a))
)
// 篩選期數的開獎號（供命中標記；未開獎回 null）
const selectedIssueOpenCode = computed<string[] | null>(() => {
  if (!state.betIssueFilter) return null
  const found = props.data.betHistory.find((item) => item.issue === state.betIssueFilter)
  if (!found || found.winStatus === 'pending' || !found.openCode?.length) return null
  return found.openCode
})
const filteredBalanceChanges = computed(() => {
  const list = props.data.balanceChanges.slice()
  if (!state.balanceSortActive) return list
  const dir = state.balanceSortOrder === 'asc' ? 1 : -1
  return list.sort((a, b) => (a.createdAt - b.createdAt) * dir)
})
const filteredBetHistory = computed(() => {
  let list = props.data.betHistory.slice()
  if (state.betIssueFilter) list = list.filter((item) => item.issue === state.betIssueFilter)
  if (state.betSortField !== 'default') {
    const dir = state.betSortOrder === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (state.betSortField === 'orderId') return String(a.orderId).localeCompare(String(b.orderId)) * dir
      if (state.betSortField === 'winAmount') return (Number(a.winAmount) - Number(b.winAmount)) * dir
      return 0
    })
  }
  return list
})
const canClaim = computed(() => props.data.claimableIssues.length > 0 && !props.data.isSubmittingClaim)

const click = {
  toggleBalanceTimeSort: () => {
    if (!state.balanceSortActive) {
      state.balanceSortActive = true
      state.balanceSortOrder = 'desc'
      return
    }
    state.balanceSortOrder = state.balanceSortOrder === 'asc' ? 'desc' : 'asc'
  },
  toggleBetSort: (field: 'orderId' | 'winAmount') => {
    if (state.betSortField === field) {
      state.betSortOrder = state.betSortOrder === 'asc' ? 'desc' : 'asc'
      return
    }
    state.betSortField = field
    state.betSortOrder = 'desc'
  },
}
</script>

<template>
  <div v-if="visible" class="cd-dialog-mask" @click.self="emit('close')">
    <section class="cd-dialog">
      <header class="cd-dialog-header">
        <h3>下注紀錄</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <div class="cd-dialog-summary">
        <div>當期累積獎池金額：{{ actions.money(data.jackpot.currentIssueJackpot) }}</div>
        <div>累積滾存獎池金額：{{ actions.money(data.jackpot.carryJackpot) }}</div>
        <div>可領獎期數：{{ data.claimableIssues.length }}</div>
        <button type="button" class="claim-btn" :disabled="!canClaim" @click="emit('claim')">
          {{ data.isSubmittingClaim ? '領獎中...' : '領取中獎獎金' }}
        </button>
      </div>

      <div v-if="data.isLoading" class="cd-dialog-state">載入中...</div>
      <div v-else-if="data.errorMessage" class="cd-dialog-state is-error">{{ data.errorMessage }}</div>
      <div v-else class="cd-dialog-body">
        <div class="dialog-tabs">
          <button type="button" class="dialog-tab" :class="{ active: state.activeTab === 'balance' }"
            @click="state.activeTab = 'balance'">
            餘額變動表
          </button>
          <button type="button" class="dialog-tab" :class="{ active: state.activeTab === 'bets' }"
            @click="state.activeTab = 'bets'">
            下注紀錄
          </button>
        </div>

        <!-- 餘額變動表 -->
        <section v-if="state.activeTab === 'balance'" class="dialog-block">
          <div class="dialog-table-wrap">
            <table class="report-table dialog-report-table">
              <thead>
                <tr>
                  <th class="sortable-th" @click="click.toggleBalanceTimeSort">
                    時間
                    <span class="sort-icon">{{ _handlers.sortIcon(state.balanceSortActive, state.balanceSortOrder)
                      }}</span>
                  </th>
                  <th>期數</th>
                  <th>類型</th>
                  <th>備註</th>
                  <th>變動</th>
                  <th>餘額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredBalanceChanges" :key="item.id">
                  <td>{{ _handlers.formatTime(item.createdAt) }}</td>
                  <td>{{ item.issue }}</td>
                  <td>{{ _handlers.balanceTypeText(item.type) }}</td>
                  <td class="note-cell">{{ item.note || '-' }}</td>
                  <td :class="item.amount < 0 ? 'amount-negative' : 'amount-positive'">
                    {{ actions.money(item.amount) }}
                  </td>
                  <td>{{ actions.money(item.after) }}</td>
                </tr>
                <tr v-if="filteredBalanceChanges.length === 0" class="tr-no-records">
                  <td colspan="6" class="no-records">暫無資料</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 下注紀錄 -->
        <section v-if="state.activeTab === 'bets'" class="dialog-block">
          <div class="table-filter">
            <template v-if="state.betIssueFilter">
              <span class="issue-open-code-label">開獎</span>
              <div class="issue-open-code">
                <template v-if="selectedIssueOpenCode">
                  <span v-for="code in selectedIssueOpenCode" :key="`open-${code}`" class="option is-ball" :class="[
                    _handlers.colorOf(code) ? `c-${_handlers.colorOf(code)}` : '',
                  ]">
                    {{ _handlers.displayCode(code) }}
                  </span>
                </template>
                <span v-else class="issue-open-code-pending">未開獎</span>
              </div>
            </template>
            <select v-model="state.betIssueFilter" class="issue-select">
              <option value="">全部期數</option>
              <option v-for="issue in betIssues" :key="issue" :value="issue">{{ issue }}</option>
            </select>
          </div>
          <div class="dialog-table-wrap">
            <table class="report-table dialog-report-table bets-table">
              <colgroup>
                <col style="width: 24%" />
                <col style="width: 13%" />
                <col style="width: 19%" />
                <col style="width: 13%" />
                <col style="width: 9%" />
                <col style="width: 10%" />
                <col style="width: 12%" />
              </colgroup>
              <thead>
                <tr>
                  <th class="sortable-th" @click="click.toggleBetSort('orderId')">
                    注單序號
                    <span class="sort-icon">{{ _handlers.sortIcon(state.betSortField === 'orderId', state.betSortOrder)
                      }}</span>
                  </th>
                  <th>投注期數</th>
                  <th>投注號碼</th>
                  <th>注數 / 金額</th>
                  <th>賠率</th>
                  <th>注單狀態</th>
                  <th class="sortable-th" @click="click.toggleBetSort('winAmount')">
                    中獎金額
                    <span class="sort-icon">{{ _handlers.sortIcon(state.betSortField === 'winAmount',
                      state.betSortOrder) }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredBetHistory" :key="item.orderId" :class="{
                  'row-dimmed': item.winStatus === 'lose',
                  'row-win': item.winStatus === 'win',
                  'row-tie': item.winStatus === 'tie',
                }">
                  <td class="order-id">{{ item.orderId }}</td>
                  <td>{{ item.issue }}</td>
                  <td>
                    <div class="bet-codes">
                      <span v-for="(code, idx) in item.betCode" :key="`${item.orderId}-${idx}`" class="option" :class="[
                        _handlers.isNumber(code) ? 'is-ball' : 'is-pill',
                        _handlers.colorOf(code) ? `c-${_handlers.colorOf(code)}` : '',
                        { 'is-miss': selectedIssueOpenCode && _handlers.isNumber(code) && !_handlers.isHit(code, selectedIssueOpenCode) },
                      ]">
                        {{ _handlers.displayBetCode(code) }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="coin-cell">
                      <span class="count">{{ _handlers.betCount(item) }} 注</span>
                      <span class="amount">{{ actions.money(item.coin) }}</span>
                    </div>
                  </td>
                  <td class="odds-cell">{{ item.odds ? item.odds.toFixed(2) : '-' }}</td>
                  <td :class="{ 'win-status': item.winStatus === 'win', 'tie-status': item.winStatus === 'tie' }">
                    {{ _handlers.winStatusText(item.winStatus) }}
                  </td>
                  <td :class="item.winAmount > 0 ? 'win-amount' : ''">
                    {{ actions.money(item.winAmount) }}
                    <span v-if="item.jackpotAmount" class="jackpot-amount">
                      ＋加碼 {{ actions.money(item.jackpotAmount) }}
                    </span>
                  </td>
                </tr>
                <tr v-if="filteredBetHistory.length === 0" class="tr-no-records">
                  <td colspan="7" class="no-records">{{ state.betIssueFilter ? '該期無注單' : '暫無資料' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 樣式自帶（scoped）：避免與 6hc-of 頁的全域 .user-dialog-* 互相覆蓋 */
.cd-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.cd-dialog {
  width: min(1100px, 96vw);
  max-height: 88vh;
  overflow: auto;
  border: 4px solid #7f1d1d;
  border-radius: 8px;
  background: #fff;
  padding: 0.75rem;

  .cd-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-red-main);

    h3 {
      margin: 0;
    }

    .close-btn {
      position: absolute;
      top: -3px;
      right: 5px;
      border: none;
      background: none;
      font-size: 25px;
      font-weight: 700;
      line-height: 1;
      color: var(--color-red-desc);
      cursor: pointer;

      &:hover {
        color: var(--color-red-main);
      }
    }
  }

  .cd-dialog-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-red-desc);

    .claim-btn {
      border: 1px solid var(--color-red-main);
      border-radius: 0.25rem;
      background: var(--color-red-main);
      padding: 0.25rem 0.75rem;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      transition: filter 0.15s ease;

      &:hover:not(:disabled) {
        filter: brightness(1.08);
      }

      &:disabled {
        border-color: #cac7c7;
        background: #f2f2f2;
        color: #bfb5b5;
        cursor: not-allowed;
      }
    }
  }

  .cd-dialog-state {
    padding: 0.75rem;
    font-weight: 700;
    color: var(--color-red-desc);

    &.is-error {
      color: #b91c1c;
    }
  }

  .cd-dialog-body {
    display: grid;
    gap: 10px;

    .dialog-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .dialog-tab {
        border: 1px solid #f3b7bf;
        border-radius: 0.25rem;
        background: #fff5f6;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--color-red-main);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(.active) {
          background: #fbe3e6;
        }

        &.active {
          border-color: var(--color-red-main);
          background: var(--color-red-main);
          color: #fff;
        }
      }
    }

    .dialog-block {
      border: 1px solid var(--color-red-700);
      border-radius: 6px;
      padding: 0.6rem;

      .table-filter {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 12px;

        .issue-open-code-label {
          font-weight: 700;
          color: var(--color-red-700);
        }

        .issue-open-code {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .issue-open-code-pending {
          font-weight: 600;
          color: #9ca3af;
        }

        .issue-select {
          margin-left: 15px;
          border: 1px solid var(--color-red-main);
          border-radius: 0.25rem;
          padding: 3px 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-red-main);
          outline: none;
          cursor: pointer;

          &:focus {
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-red-main) 20%, transparent);
          }
        }
      }

      .dialog-table-wrap {
        max-height: 320px;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--color-red-desc) #e8e6e6;
      }

      .dialog-report-table {
        width: 100%;
        table-layout: fixed;

        thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          box-shadow:
            inset 0 1px 0 0 var(--color-red-content),
            inset 0 -1px 0 0 var(--color-red-content);
        }

        .no-records {
          height: 150px;
          color: var(--color-red-desc);
        }

        .order-id,
        .note-cell {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sortable-th {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;

          &:hover {
            color: var(--color-red-main);
          }

          .sort-icon {
            margin-left: 3px;
            font-size: 11px;
            opacity: 0.7;
          }
        }

        .amount-positive {
          font-weight: 700;
          color: #16a34a;
        }

        .amount-negative {
          font-weight: 700;
          color: #dc2626;
        }

        .win-status {
          font-weight: 600;
          color: #16a34a;
        }

        /* 和局（退還本金） */
        .tie-status {
          font-weight: 600;
          color: #2563eb;
        }

        .odds-cell {
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .win-amount {
          font-weight: 600;
          color: #ff8d00;
        }

        /* 爆池加碼 */
        .jackpot-amount {
          display: block;
          margin-top: 1px;
          font-size: 10px;
          font-weight: 700;
          color: #7c3aed;
        }

        .row-dimmed {
          opacity: 0.45;
        }

        .row-win {
          outline: 1px solid #ff8d00;
          outline-offset: -2px;
          background: #fff8ed;

          td:first-child {
            border-left: 3px solid #ff8d00;
          }
        }

        .row-tie {
          background: #f4f8ff;

          td:first-child {
            border-left: 3px solid #93c5fd;
          }
        }

        .coin-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;

          .count {
            font-size: 10px;
            font-weight: 600;
            color: var(--color-red-desc);
          }

          .amount {
            font-size: 12px;
            font-weight: 700;
            color: var(--color-red-main);
          }
        }

        .bet-codes {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 3px;
        }
      }
    }
  }

  /* 號碼球 / 膠囊（與 Tema、ReportIssueBets 同一套樣式） */
  .option {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    font-weight: 600;
    color: var(--color-red-desc);

    &.is-ball {
      width: 26px;
      height: 26px;
      border: 0.16rem solid var(--6hcOf-ball-yellow);
      border-radius: 50%;
      font-size: 12px;
      color: #000;
    }

    &.is-pill {
      min-width: 42px;
      height: 22px;
      border: 1px solid var(--color-red-700);
      border-radius: 6px;
      padding: 0 8px;
      font-size: 12px;
      color: var(--color-red-main);
    }

    /* 已開獎期數中未命中的號碼 */
    &.is-miss {
      opacity: 0.4;
    }

    &.c-red {
      border-color: var(--6hcOf-ball-red);

      &.is-pill {
        color: var(--6hcOf-ball-red);
      }
    }

    &.c-blue {
      border-color: var(--6hcOf-ball-blue);

      &.is-pill {
        color: var(--6hcOf-ball-blue);
      }
    }

    &.c-green {
      border-color: var(--6hcOf-ball-green);

      &.is-pill {
        color: var(--6hcOf-ball-green);
      }
    }

    &.c-yellow {
      border-color: var(--6hcOf-ball-yellow);

      &.is-pill {
        color: var(--6hcOf-ball-yellow);
      }
    }
  }
}
</style>
