<script setup lang="ts">
import { computed, ref } from 'vue'
import DialogShell from '~/components/lottery/tw/dlt/block/DialogShell.vue'
import Ball from '~/components/lottery/tw/dlt/base/Ball.vue'
import { useDlt } from '~/composables/useDlt'

/**
 * 對齊 6hc-of 的 DialogUser.vue（分頁籤／排序／期數篩選／開獎球命中標記），
 * 但拿掉 DLT 用不到的部分：danCode/tuoCode（DLT 是單式 6+1，非膽拖）、
 * 彩池/獎池摘要（DLT 無彩池，見 openspec/changes/add-dlt/design.md Decision 2）。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { userRecord, fetch } = useDlt()

/**
 * 官方期別格式：民國年 3 碼＋該年度序號 6 碼（見 align-dlt-issue-with-official-period）。
 * admin 測試工具（dlt-test-settle）用登入帳號本人的 betHistory／claimableIssues 寫測試假
 * 注單／假中獎金額，期別是合成的 "TEST-<timestamp>"，格式對不上，用來把假資料濾掉——
 * 不影響 balanceChanges（那個本來就是刻意跨遊戲合併的整體錢包紀錄，見 user-record.get.ts）。
 */
const REAL_ISSUE_PATTERN = /^\d{3}\d{6}$/
const realBetHistory = computed(() => userRecord.betHistory.filter((row) => REAL_ISSUE_PATTERN.test(row.issue)))
const realClaimableIssues = computed(() =>
  userRecord.claimableIssues.filter((row) => REAL_ISSUE_PATTERN.test(String(row.issue)))
)

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const claimable = computed(() => realClaimableIssues.value.filter((item) => Number(item.amount) > 0))
const totalClaimable = computed(() => claimable.value.reduce((sum, item) => sum + Number(item.amount ?? 0), 0))

const click = {
  claim: () => fetch.claimOneIssue()
}

const activeTab = ref<'balance' | 'bets'>('balance')

// ── 餘額變動表：時間排序 ─────────────────────────────────────────
const balanceSortOrder = ref<'asc' | 'desc'>('desc')
const balanceSortActive = ref(false)

const filteredBalanceChanges = computed(() => {
  const list = userRecord.balanceChanges.slice()
  if (!balanceSortActive.value) return list
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

// ── 下注紀錄：期數篩選 + 排序 ─────────────────────────────────────
const betIssueFilter = ref('')
const betSortField = ref<'default' | 'orderId' | 'winAmount'>('default')
const betSortOrder = ref<'asc' | 'desc'>('desc')

const betIssues = computed(() =>
  [...new Set(realBetHistory.value.map((i) => i.issue))].sort((a, b) => b.localeCompare(a))
)

const selectedIssueOpenCode = computed<string[] | null>(() => {
  if (!betIssueFilter.value) return null
  const found = realBetHistory.value.find((i) => i.issue === betIssueFilter.value)
  if (!found || found.winStatus === 'pending' || !found.openCode?.length) return null
  return found.openCode
})

const filteredBetHistory = computed(() => {
  let list = realBetHistory.value.slice()
  if (betIssueFilter.value) list = list.filter((i) => i.issue === betIssueFilter.value)

  if (betSortField.value !== 'default') {
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

/** betCode 是「1 個元素、內容逗號分隔」的陣列（例如 ["02,04,06,08,10,12"]），這裡拆成 6 個號碼字串 */
function betNumbers(betCode: string[]): string[] {
  return (betCode[0] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}
</script>

<template>
  <DialogShell :visible="props.visible" title="下注紀錄" @close="emit('close')">
    <div class="user-dialog-summary">
      <div>可領獎期數：{{ claimable.length }}</div>
      <div>可領獎金合計：{{ money(totalClaimable) }}</div>
      <button type="button" class="claim-btn" :disabled="claimable.length === 0 || userRecord.isSubmittingClaim"
        @click="click.claim">
        {{ userRecord.isSubmittingClaim ? '領取中…' : '領取中獎獎金' }}
      </button>
    </div>

    <div v-if="userRecord.isLoading" class="user-dialog-loading">載入中...</div>
    <div v-else-if="userRecord.errorMessage" class="user-dialog-error">{{ userRecord.errorMessage }}</div>
    <div v-else class="user-dialog-body">
      <div class="dialog-tabs">
        <button type="button" class="dialog-tab" :class="{ active: activeTab === 'balance' }"
          @click="activeTab = 'balance'">
          餘額變動表
        </button>
        <button type="button" class="dialog-tab" :class="{ active: activeTab === 'bets' }" @click="activeTab = 'bets'">
          下注紀錄
        </button>
      </div>

      <div class="dialog-tab-content">
        <!-- 餘額變動表 -->
        <section v-if="activeTab === 'balance'" class="dialog-block">
          <div class="dialog-table-wrap taiwan-lottery-scrollbar">
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
                  <td>{{ item.type === 'bet' ? '下注' : '領獎' }}</td>
                  <td :class="item.amount < 0 ? 'amount-negative' : 'amount-positive'">{{ money(item.amount) }}</td>
                  <td>{{ money(item.after) }}</td>
                </tr>
                <tr v-if="userRecord.balanceChanges.length === 0">
                  <td colspan="5" class="no-records">暫無資料</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 下注紀錄 -->
        <section v-if="activeTab === 'bets'" class="dialog-block">
          <div class="table-filter">
            <div v-if="betIssueFilter" class="issue-open-code-label">開獎</div>
            <div v-if="betIssueFilter" class="issue-open-code">
              <template v-if="selectedIssueOpenCode">
                <Ball v-for="(code, idx) in selectedIssueOpenCode.slice(0, 6)" :key="`o-${idx}`" :num="code"
                  size="sm" />
                <span>+</span>
                <Ball :num="selectedIssueOpenCode[6]" size="sm" special />
              </template>
              <span v-else class="issue-open-code-pending">未開獎</span>
            </div>
            <select v-model="betIssueFilter" class="issue-select">
              <option value="">全部期數</option>
              <option v-for="issue in betIssues" :key="issue" :value="issue">{{ issue }}</option>
            </select>
          </div>
          <div class="dialog-table-wrap taiwan-lottery-scrollbar">
            <table class="report-table dialog-report-table bets-table">
              <colgroup>
                <col style="width: 20%" />
                <col style="width: 12%" />
                <col style="width: 32%" />
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
                  <th>金額</th>
                  <th>狀態</th>
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
                      <Ball v-for="code in betNumbers(item.betCode)" :key="code" :num="code"
                        :hit="item.winStatus === 'win' && !!selectedIssueOpenCode && isBallHit(code, selectedIssueOpenCode)"
                        size="sm" />
                    </div>
                  </td>
                  <td>{{ money(item.coin) }}</td>
                  <td :class="item.winStatus === 'win' ? 'win-status' : ''">
                    {{ item.winStatus === 'pending' ? '待開獎' : item.winStatus === 'win' ? `中獎（${item.tierLabel}）` : '未中'
                    }}
                  </td>
                  <td :class="item.winAmount > 0 ? 'win-amount' : ''">{{ item.winAmount > 0 ? money(item.winAmount) :
                    '—' }}</td>
                </tr>
                <tr v-if="realBetHistory.length === 0">
                  <td colspan="6" class="no-records">暫無資料</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </DialogShell>
</template>

<style scoped lang="scss">
.user-dialog-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 0.75rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-neutral-700, #645c50);
}

.claim-btn {
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-accent-700, #8c491a);
  background: var(--color-accent-700, #8c491a);
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

.user-dialog-loading,
.user-dialog-error {
  padding: 1rem 0;
  font-size: 13px;
  color: var(--color-neutral-700, #645c50);
  text-align: center;
}

.user-dialog-error {
  color: var(--color-accent-700, #8c491a);
}

.dialog-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dialog-tab {
  border: 1px solid var(--color-accent-400, #f6a06b);
  border-radius: 0.25rem;
  background: var(--color-accent-100, #fff2eb);
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent-700, #8c491a);
  cursor: pointer;

  &.active {
    background: var(--color-accent-700, #8c491a);
    border-color: var(--color-accent-700, #8c491a);
    color: #fff;
  }
}

.dialog-tab-content {
  margin-top: 10px;
  overflow: hidden;

  .table-filter {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
    margin-bottom: 6px;

    .issue-open-code-label {
      color: var(--color-accent-400, #f6a06b);
    }

    .issue-open-code {
      display: flex;
      align-items: center;
      gap: 3px;
    }
  }
}

/*
 * .report-table 是 6hc-of／k3 等玩法共用的全域 class（見 app/assets/style/lhc_of.scss，
 * scoped 在各自的 .lottery-xxx 頁面根層級）；DLT 沒有對應的 lhc_dlt.scss，
 * 所以直接把同一套基礎樣式（邊框/列高/表頭底色）搬進這裡的 scoped style，
 * 數值與色票 token（--color-neutral-300／--color-accent-700／--color-neutral-700，柑仔店暖色系）完全對齊。
 *
 * 捲動＋sticky 表頭的完整寫法比照 pl3/eggs 的 Report.vue（bg 系列已驗證過的作法）：
 * 外框改包在 .dialog-table-wrap（捲動容器本身）上，<table> 自己的外框拿掉，
 * sticky th 自己補 background + border-top/bottom: none，邊框全部改由 box-shadow
 * inset 畫（上下都要），避免 border-collapse 造成的邊框吃字元／捲動時邊框跟著捲走的問題。
 */
.dialog-table-wrap {
  max-height: 55vh;
  overflow: auto;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-top: 0;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  tr {
    min-height: 35px;

    td,
    th {
      border-right: 1px solid var(--color-neutral-300, #dcd3c4);
      border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
      padding: 6px 8px;
      text-align: center;

      &:last-child {
        border-right: none;
      }
    }

    &:first-child th {
      height: 40px;
      background: color-mix(in srgb, var(--color-accent-700, #8c491a) 8%, var(--color-neutral-100, #f9f4ed));
      color: var(--color-neutral-700, #645c50);
      font-weight: 700;
    }

    &:last-child td,
    &:last-child th {
      border-bottom: none;
    }
  }
}

.dialog-report-table {
  thead tr:first-child th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: color-mix(in srgb, var(--color-accent-700, #8c491a) 8%, var(--color-neutral-100, #f9f4ed));
    border-top: none;
    border-bottom: none;
    box-shadow:
      inset 0 1px 0 0 var(--color-neutral-300, #dcd3c4),
      inset 0 -1px 0 0 var(--color-neutral-300, #dcd3c4);
  }
}

.no-records {
  text-align: center;
  color: var(--color-neutral-700, #645c50);
  padding: 12px 0;
}

.amount-positive {
  color: #16a34a;
  font-weight: 700;
}

.amount-negative {
  color: #dc2626;
  font-weight: 700;
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
    color: var(--color-accent-700, #8c491a);
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
  color: var(--color-neutral-700, #645c50);
}

.issue-select {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--color-accent-700, #8c491a);
  border-radius: 0.25rem;
  color: var(--color-accent-700, #8c491a);
  font-weight: 600;
  cursor: pointer;
  outline: none;

  &:focus {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-700, #8c491a) 20%, transparent);
  }
}

.bets-table {
  table-layout: fixed;
  width: 100%;
}

.bet-balls {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
  justify-content: flex-start;
}
</style>
