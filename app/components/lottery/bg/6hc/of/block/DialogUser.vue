<script setup lang="ts">
import { actions } from '~/utils/common'

const props = defineProps<{
  visible: boolean
  data: {
    jackpot: { currentIssueJackpot: number; carryJackpot: number }
    claimableIssues: unknown[]
    isSubmittingClaim: boolean
    isLoading: boolean
    errorMessage: string
    balanceChanges: { id: string | number; createdAt: number; issue: string; type: string; amount: number; after: number }[]
    betHistory: { orderId: string; issue: string; betCode: string[]; coin: number; winStatus: string; winAmount: number }[]
  }
}>()

const emit = defineEmits<{
  close: []
  claim: []
}>()

const activeTab = ref<'balance' | 'bets'>('balance')

const betIssueFilter = ref('')
const betSortField = ref<'default' | 'orderId' | 'winAmount'>('default')
const betSortOrder = ref<'asc' | 'desc'>('desc')

const betIssues = computed(() =>
  [...new Set(props.data.betHistory.map((i) => i.issue))].sort((a, b) => b.localeCompare(a))
)

const selectedIssueOpenCode = computed<string[] | null>(() => {
  if (!betIssueFilter.value) return null
  const found = props.data.betHistory.find((i) => i.issue === betIssueFilter.value)
  if (!found || found.winStatus === 'pending' || !found.openCode?.length) return null
  return found.openCode
})

const balanceSortOrder = ref<'asc' | 'desc'>('desc')
const balanceSortActive = ref(false)

const filteredBalanceChanges = computed(() => {
  const list = props.data.balanceChanges.slice()
  if (!balanceSortActive.value) return list.reverse()
  const dir = balanceSortOrder.value === 'asc' ? 1 : -1
  return list.sort((a, b) => (a.createdAt - b.createdAt) * dir)
})

function toggleBalanceTimeSort() {
  if (!balanceSortActive.value) {
    balanceSortActive.value = true
    balanceSortOrder.value = 'desc'
  } else {
    balanceSortOrder.value = balanceSortOrder.value === 'asc' ? 'desc' : 'asc'
  }
}
const filteredBetHistory = computed(() => {
  let list = props.data.betHistory.slice()
  if (betIssueFilter.value) list = list.filter((i) => i.issue === betIssueFilter.value)

  if (betSortField.value === 'default') {
    list.reverse()
  } else {
    const dir = betSortOrder.value === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (betSortField.value === 'orderId') return a.orderId.localeCompare(b.orderId) * dir
      if (betSortField.value === 'winAmount') return (a.winAmount - b.winAmount) * dir
      return 0
    })
  }
  return list
})

function toggleSort(field: 'orderId' | 'winAmount') {
  if (betSortField.value === field) {
    betSortOrder.value = betSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    betSortField.value = field
    betSortOrder.value = 'desc'
  }
}

function isBallHit(code: string, openCode: string[]): boolean {
  return openCode.some((c) => +c === +code)
}
</script>

<template>
  <div v-if="visible" class="user-dialog-mask" @click.self="emit('close')">
    <section class="user-dialog">
      <header class="user-dialog-header">
        <h3>會員資產 / 下注紀錄</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <div class="user-dialog-summary">
        <div>當期累積獎金：{{ actions.thousands(data.jackpot.currentIssueJackpot) }}</div>
        <div>累積滾存獎金：{{ actions.thousands(data.jackpot.carryJackpot) }}</div>
        <div>可領獎期數：{{ data.claimableIssues.length }}</div>
        <button type="button" class="claim-btn" :disabled="data.claimableIssues.length === 0 || data.isSubmittingClaim"
          @click="emit('claim')">
          {{ data.isSubmittingClaim ? '領獎中...' : '領取中獎獎金' }}
        </button>
      </div>

      <div v-if="data.isLoading" class="user-dialog-loading">載入中...</div>
      <div v-else-if="data.errorMessage" class="user-dialog-error">{{ data.errorMessage }}</div>
      <div v-else class="user-dialog-body">
        <div class="dialog-tabs">
          <button type="button" class="dialog-tab" :class="{ active: activeTab === 'balance' }"
            @click="activeTab = 'balance'">
            餘額變動表
          </button>
          <button type="button" class="dialog-tab" :class="{ active: activeTab === 'bets' }"
            @click="activeTab = 'bets'">
            下注紀錄
          </button>
        </div>

        <div class="dialog-tab-content">
          <!-- 餘額變動表 -->
          <section v-if="activeTab === 'balance'" class="dialog-block">
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table">
                <thead>
                  <tr>
                    <th class="sortable-th" @click="toggleBalanceTimeSort">
                      時間
                      <span class="sort-icon">{{ !balanceSortActive ? '⇅' : balanceSortOrder === 'asc' ? '↑' : '↓'
                      }}</span>
                    </th>
                    <th>期數</th>
                    <th>類型</th>
                    <th>變動</th>
                    <th>餘額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredBalanceChanges" :key="item.id">
                    <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
                    <td>{{ item.issue }}</td>
                    <td>{{ item.type }}</td>
                    <td :class="item.amount < 0 ? 'amount-negative' : 'amount-positive'">{{
                      actions.thousands(item.amount) }}</td>
                    <td>{{ actions.thousands(item.after) }}</td>
                  </tr>
                  <tr v-if="data.balanceChanges.length === 0">
                    <td colspan="5" class="no-records">暫無資料</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- 下注紀錄 -->
          <section v-if="activeTab === 'bets'" class="dialog-block">
            <div class="table-filter">
              <div v-if="betIssueFilter" class="issue-open-code-label"> 開獎</div>
              <div v-if="betIssueFilter" class="issue-open-code">
                <template v-if="selectedIssueOpenCode">
                  <LotteryBg6hcOfBaseBall v-for="code in selectedIssueOpenCode" :key="code"
                    :data="{ label: String(+code).padStart(2, '0'), num: +code, selected: true }" :isClick="false" />
                </template>
                <span v-else class="issue-open-code-pending">未開獎</span>
              </div>

              <select v-model="betIssueFilter" class="issue-select">
                <option value="">全部期數</option>
                <option v-for="issue in betIssues" :key="issue" :value="issue">{{ issue }}</option>
              </select>
            </div>
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table bets-table">
                <colgroup>
                  <col style="width: 22%" />
                  <col style="width: 12%" />
                  <col style="width: 30%" />
                  <col style="width: 12%" />
                  <col style="width: 10%" />
                  <col style="width: 14%" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="sortable-th" @click="toggleSort('orderId')">
                      注單序號
                      <span class="sort-icon">{{ betSortField === 'orderId' ? (betSortOrder === 'asc' ? '↑' : '↓') : '⇅'
                        }}</span>
                    </th>
                    <th>投注期數</th>
                    <th>投注號碼</th>
                    <th>投注金額</th>
                    <th>注單狀態</th>
                    <th class="sortable-th" @click="toggleSort('winAmount')">
                      中獎金額
                      <span class="sort-icon">{{ betSortField === 'winAmount' ? (betSortOrder === 'asc' ? '↑' : '↓') :
                        '⇅' }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredBetHistory" :key="item.orderId"
                    :class="{ 'row-dimmed': item.winStatus === 'lose', 'row-win': item.winStatus === 'win' }">
                    <td style="white-space: nowrap">{{ item.orderId }}</td>
                    <td>{{ item.issue }}</td>
                    <td>
                      <div class="bet-balls">
                        <LotteryBg6hcOfBaseBall v-for="code in item.betCode" :key="code"
                          :data="{ label: String(+code).padStart(2, '0'), num: +code, selected: item.winStatus !== 'win' || !selectedIssueOpenCode || isBallHit(code, selectedIssueOpenCode) }"
                          :isClick="false" />
                      </div>
                    </td>
                    <td>{{ actions.thousands(item.coin) }}</td>
                    <td :class="item.winStatus === 'win' ? 'win-status' : ''">{{ item.winStatus }}</td>
                    <td :class="item.winAmount > 0 ? 'win-amount' : ''">{{ actions.thousands(item.winAmount) }}</td>
                  </tr>
                  <tr v-if="data.betHistory.length === 0">
                    <td colspan="6" class="no-records">暫無資料</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.user-dialog {
  .user-dialog-header {
    position: relative;

    .close-btn {
      font-size: 25px;
      font-weight: 700;
      position: absolute;
      top: -3px;
      right: 5px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-red-desc);
      line-height: 1;

      &:hover {
        color: var(--color-red-main);
      }
    }
  }

  .user-dialog-body {
    .dialog-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .dialog-tab {
      border: 1px solid #f3b7bf;
      border-radius: 0.25rem;
      background: #fff5f6;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;

      &.active {
        background: var(--color-red-main);
        border-color: var(--color-red-main);
        color: #fff;
      }
    }

    .dialog-tab-content {
      overflow: hidden;

      .table-filter {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 6px;
        margin-bottom: 6px;

        .issue-open-code-label {
          color: var(--color-red-700);
        }

        .issue-open-code {
          display: flex;
          align-items: center;
          gap: 3px;

          :deep(.ball-wrapper) .ball {
            width: 1.6rem;
            height: 1.6rem;
            font-size: 0.7rem;

            &.selected {
              border-width: 0.24rem;
            }
          }
        }

      }

    }
  }

  .dialog-report-table {
    thead tr:first-child th {
      position: sticky;
      top: 0;
      z-index: 1;
      box-shadow:
        inset 0 1px 0 0 var(--color-red-content),
        inset 0 -1px 0 0 var(--color-red-content);
    }
  }



  .claim-btn {
    padding: 6px 16px;
    border-radius: 0.25rem;
    border: 1px solid var(--color-red-main);
    background: var(--color-red-main);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      background: #f2f2f2;
      border-color: #cac7c7;
      color: #bfb5b5;
      cursor: not-allowed;
    }
  }

  .amount-positive {
    color: #16a34a;
    font-weight: bold;
  }

  .amount-negative {
    color: #dc2626;
    font-weight: bold;
  }

  .win-status {
    color: #16a34a;
    font-weight: 600;
  }

  .win-amount {
    color: #ff8d00;
    font-weight: 600;
  }

  .row-dimmed {
    opacity: 0.4;
  }

  .row-win {
    outline: 1px solid #ff8d00;
    outline-offset: -2px;
    background: #fff8ed;

    td:first-child {
      border-left: 3px solid #ff8d00;
    }
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





  .issue-open-code-pending {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
  }

  .issue-select {
    font-size: 12px;
    margin-left: 25px;
    padding: 3px 8px;
    border: 1px solid var(--color-red-main);
    border-radius: 0.25rem;
    color: var(--color-red-main);
    font-weight: 600;
    cursor: pointer;
    outline: none;

    &:focus {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-red-main) 20%, transparent);
    }
  }

  .bets-table {
    table-layout: fixed;
    width: 100%;
  }

  .bet-balls {
    display: flex;
    flex-wrap: nowrap;
    gap: 3px;
    align-items: center;
    justify-content: center;

    :deep(.ball-wrapper) {
      .ball {
        width: 1.6rem;
        height: 1.6rem;
        font-size: 0.7rem;

        &.selected {
          border-width: 0.24rem;
        }
      }
    }
  }

}
</style>
