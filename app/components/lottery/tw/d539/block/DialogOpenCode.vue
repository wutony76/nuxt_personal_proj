<script setup lang="ts">
import { computed, ref } from 'vue'
import DialogShell from '~/components/lottery/tw/d539/block/DialogShell.vue'
import Ball from '~/components/lottery/tw/d539/base/Ball.vue'
import { useD539 } from '~/composables/useD539'

/** 比照 DLT 的 DialogOpenCode.vue（排序／期數查詢／未下注期數淡化），今彩539一期 5 碼、無特別號 */
const props = defineProps<{ visible: boolean; betIssues?: string[] }>()
const emit = defineEmits<{ close: [] }>()

const { openCodeHistory } = useD539()

/** 排除 admin 測試工具留下的假開獎紀錄（issue 帶「（測試）」後綴，見 d539.ts _attemptSettlement()） */
const realList = computed(() => openCodeHistory.list.filter((row) => !row.issue.includes('（測試）')))

type SortKey = 'issue' | 'endAt'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey | null>('issue')
const sortDir = ref<SortDir>('desc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortedList = computed(() => {
  if (!sortKey.value) return realList.value
  return [...realList.value].sort((a, b) => {
    const key = sortKey.value!
    const valA = key === 'issue' ? a.issue : a[key]
    const valB = key === 'issue' ? b.issue : b[key]
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

function sortIcon(key: SortKey) {
  if (sortKey.value !== key) return ' ⇅'
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

const betIssueSet = computed(() => new Set(props.betIssues ?? []))

const issueQuery = ref('')

const filteredList = computed(() => {
  const q = issueQuery.value.trim()
  const base = sortedList.value
  if (!q) return base
  return base.filter((item) => item.issue.includes(q))
})
</script>

<template>
  <DialogShell :visible="props.visible" title="開獎歷史" @close="emit('close')">
    <p class="d539-opencode-hint">
      開獎號碼為官方今彩539實際開出的號碼，逐期由本站累積紀錄；上線初期筆數較少屬正常現象。
    </p>

    <div v-if="openCodeHistory.isLoading" class="user-dialog-loading">載入中...</div>
    <div v-else-if="openCodeHistory.errorMessage" class="user-dialog-error">{{ openCodeHistory.errorMessage }}</div>
    <section v-else class="dialog-block">
      <div class="table-filter">
        <input v-model="issueQuery" type="text" class="issue-query-input" placeholder="查詢期數..." />
      </div>
      <div class="dialog-table-wrap taiwan-lottery-scrollbar">
        <table class="report-table dialog-report-table">
          <thead>
            <tr>
              <th class="sortable-th" @click="toggleSort('issue')">開獎期數{{ sortIcon('issue') }}</th>
              <th>開獎球號</th>
              <th class="sortable-th" @click="toggleSort('endAt')">開獎時間{{ sortIcon('endAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredList" :key="item.issue" :class="{ 'no-bet': !betIssueSet.has(item.issue) }">
              <td>{{ item.issue }}</td>
              <td>
                <div class="d539-opencode-balls">
                  <Ball v-for="(n, idx) in item.openCode.slice(0, 5)" :key="idx" :num="n" size="sm" />
                </div>
              </td>
              <td>{{ new Date(item.endAt).toLocaleString() }}</td>
            </tr>
            <tr v-if="filteredList.length === 0">
              <td colspan="3" class="no-records">{{ issueQuery ? '查無符合期數' : '暫無資料' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </DialogShell>
</template>

<style scoped lang="scss">
.d539-opencode-hint {
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
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

.dialog-table-wrap {
  max-height: 55vh;
  overflow: auto;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-top: 0;
}

.table-filter {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  margin-bottom: 6px;

  .issue-query-input {
    font-size: 12px;
    padding: 3px 8px;
    border: 1px solid var(--color-accent-700, #8c491a);
    border-radius: 0.25rem;
    color: var(--color-accent-700, #8c491a);
    font-weight: 600;
    outline: none;
    width: 160px;

    &::placeholder {
      color: var(--color-neutral-400, #c0b6a5);
      font-weight: 400;
    }

    &:focus {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-700, #8c491a) 20%, transparent);
    }
  }
}

/*
 * .report-table 的基礎樣式比照 DLT 的 DialogOpenCode.vue 搬進 scoped，色票 token 完全對齊。
 * 捲動＋sticky 表頭外框改包在 .dialog-table-wrap，sticky th 邊框用 box-shadow inset 畫。
 */
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  tr {
    min-height: 35px;

    td, th {
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

    &:last-child td, &:last-child th {
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

  tbody tr.no-bet td {
    opacity: 0.4;
  }
}

.d539-opencode-balls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.no-records {
  text-align: center;
  color: var(--color-neutral-700, #645c50);
  padding: 12px 0;
}

.sortable-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  &:hover {
    color: var(--color-accent-700, #8c491a);
  }
}
</style>
