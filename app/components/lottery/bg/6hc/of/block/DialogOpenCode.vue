<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  visible: boolean
  data: {
    isLoading: boolean
    isSuccess: boolean
    errorMessage: string
    list: { issue: string; openCode: string[]; time: { start: string; end: string }; startAt: number; endAt: number; status: 'pending' | 'opened' }[]
  }
  betIssues?: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

type SortKey = 'issue' | 'startAt' | 'endAt'
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
  if (!sortKey.value) return props.data.list
  return [...props.data.list].sort((a, b) => {
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
  <div v-if="visible" class="user-dialog-mask" @click.self="emit('close')">
    <section class="user-dialog">
      <header class="user-dialog-header">
        <h3>開獎歷史（過去到最近期）</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>
      <div v-if="data.isLoading" class="user-dialog-loading">載入中...</div>
      <div v-else-if="data.errorMessage" class="user-dialog-error">{{ data.errorMessage }}</div>
      <div v-else class="user-dialog-body">
        <section class="dialog-block">
          <div class="table-filter">
            <input v-model="issueQuery" type="text" class="issue-query-input" placeholder="查詢期數..." />
          </div>
          <div class="dialog-table-wrap">
            <table class="report-table dialog-report-table">
              <thead>
                <tr>
                  <th class="sortable" @click="toggleSort('issue')">開獎期數{{ sortIcon('issue') }}</th>
                  <th>開獎球號</th>
                  <th class="sortable" @click="toggleSort('startAt')">開始時間{{ sortIcon('startAt') }}</th>
                  <th class="sortable" @click="toggleSort('endAt')">結束時間{{ sortIcon('endAt') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredList" :key="item.issue" :class="{ 'no-bet': !betIssueSet.has(item.issue) }">
                  <td>{{ item.issue }}</td>
                  <td>
                    <div class="bet-balls">
                      <LotteryBg6hcOfBaseBall v-for="code in item.openCode" :key="code"
                        :data="{ label: String(+code).padStart(2, '0'), num: +code, selected: true }"
                        :isClick="false" />
                    </div>
                  </td>
                  <td>{{ new Date(item.startAt).toLocaleString() }}</td>
                  <td>{{ new Date(item.endAt).toLocaleString() }}</td>
                </tr>
                <tr v-if="filteredList.length === 0">
                  <td colspan="4" class="no-records">{{ issueQuery ? '查無符合期數' : '暫無資料' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
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

  .table-filter {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
    margin-bottom: 6px;

    .issue-query-input {
      font-size: 12px;
      padding: 3px 8px;
      border: 1px solid var(--color-red-main);
      border-radius: 0.25rem;
      color: var(--color-red-main);
      font-weight: 600;
      outline: none;
      width: 160px;

      &::placeholder {
        color: #c9a0a8;
        font-weight: 400;
      }

      &:focus {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-red-main) 20%, transparent);
      }
    }
  }

  .dialog-report-table {
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

    tbody tr.no-bet td {
      opacity: 0.4;
    }

    thead tr:first-child th.sortable {
      cursor: pointer;
      user-select: none;
    }

    thead tr:first-child th {
      position: sticky;
      top: 0;
      z-index: 1;
      box-shadow:
        inset 0 1px 0 0 var(--color-red-content),
        inset 0 -1px 0 0 var(--color-red-content);
    }
  }
}
</style>
