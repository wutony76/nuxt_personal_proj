<script setup lang="ts">
import { computed, reactive } from 'vue'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import type { LotteryOpenCodeHistoryItem } from '~/services/api'

type SortKey = 'issue' | 'startAt' | 'endAt'
type SortOrder = 'asc' | 'desc'

const props = defineProps<{
  visible: boolean
  data: {
    isLoading: boolean
    isSuccess: boolean
    errorMessage: string
    list: LotteryOpenCodeHistoryItem[]
  }
  // 有下注的期數（未下注的列會淡化）
  betIssues?: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const state = reactive({
  sortKey: 'issue' as SortKey,
  sortOrder: 'desc' as SortOrder,
  issueQuery: '' as string,
})

// --- HANDLE ---
const _handlers = {
  colorOf: (code: string | number) => {
    const n = String(code).padStart(2, '0')
    if ((LHC_COLORS.red as readonly string[]).includes(n)) return 'red'
    if ((LHC_COLORS.blue as readonly string[]).includes(n)) return 'blue'
    if ((LHC_COLORS.green as readonly string[]).includes(n)) return 'green'
    return 'yellow'
  },
  displayCode: (code: string | number) => String(code).padStart(2, '0'),
  formatTime: (timestamp: number) => (Number(timestamp) > 0 ? new Date(Number(timestamp)).toLocaleString() : '-'),
  sortIcon: (key: SortKey) => (state.sortKey !== key ? ' ⇅' : state.sortOrder === 'asc' ? ' ↑' : ' ↓'),
}

// --- COMPUTED ---
const betIssueSet = computed(() => new Set(props.betIssues ?? []))
const sortedList = computed(() => {
  const list = [...props.data.list]
  const dir = state.sortOrder === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const valA = state.sortKey === 'issue' ? a.issue : Number(a[state.sortKey])
    const valB = state.sortKey === 'issue' ? b.issue : Number(b[state.sortKey])
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0
    return cmp * dir
  })
})
const filteredList = computed(() => {
  const query = state.issueQuery.trim()
  if (!query) return sortedList.value
  return sortedList.value.filter((item) => String(item.issue).includes(query))
})

const click = {
  sort: (key: SortKey) => {
    if (state.sortKey === key) {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
      return
    }
    state.sortKey = key
    state.sortOrder = 'asc'
  },
}
</script>

<template>
  <div v-if="visible" class="cd-dialog-mask" @click.self="emit('close')">
    <section class="cd-dialog">
      <header class="cd-dialog-header">
        <h3>開獎歷史（過去到最近期）</h3>
        <button type="button" class="close-btn" @click="emit('close')">×</button>
      </header>

      <div v-if="data.isLoading" class="cd-dialog-state">載入中...</div>
      <div v-else-if="data.errorMessage" class="cd-dialog-state is-error">{{ data.errorMessage }}</div>
      <div v-else class="cd-dialog-body">
        <section class="dialog-block">
          <div class="table-filter">
            <input v-model="state.issueQuery" type="text" class="issue-query-input" placeholder="查詢期數..." />
          </div>
          <div class="dialog-table-wrap">
            <table class="report-table dialog-report-table">
              <colgroup>
                <col style="width: 18%" />
                <col style="width: 40%" />
                <col style="width: 21%" />
                <col style="width: 21%" />
              </colgroup>
              <thead>
                <tr>
                  <th class="sortable-th" @click="click.sort('issue')">開獎期數{{ _handlers.sortIcon('issue') }}</th>
                  <th>開獎球號</th>
                  <th class="sortable-th" @click="click.sort('startAt')">開始時間{{ _handlers.sortIcon('startAt') }}</th>
                  <th class="sortable-th" @click="click.sort('endAt')">結束時間{{ _handlers.sortIcon('endAt') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredList" :key="item.issue" :class="{ 'no-bet': !betIssueSet.has(item.issue) }">
                  <td>{{ item.issue }}</td>
                  <td>
                    <div class="open-codes">
                      <template v-for="(code, idx) in item.openCode" :key="`${item.issue}-${idx}`">
                        <span v-if="idx === item.openCode.length - 1" class="plus">+</span>
                        <span class="option is-ball" :class="[`c-${_handlers.colorOf(code)}`]">
                          {{ _handlers.displayCode(code) }}
                        </span>
                      </template>
                    </div>
                  </td>
                  <td>{{ _handlers.formatTime(item.startAt) }}</td>
                  <td>{{ _handlers.formatTime(item.endAt) }}</td>
                </tr>
                <tr v-if="filteredList.length === 0" class="tr-no-records">
                  <td colspan="4" class="no-records">{{ state.issueQuery ? '查無符合期數' : '暫無資料' }}</td>
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
  width: min(1000px, 96vw);
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

  .cd-dialog-state {
    padding: 0.75rem;
    font-weight: 700;
    color: var(--color-red-desc);

    &.is-error {
      color: #b91c1c;
    }
  }

  .cd-dialog-body {
    .dialog-block {
      border: 1px solid var(--color-red-700);
      border-radius: 6px;
      padding: 0.6rem;

      .table-filter {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 6px;

        .issue-query-input {
          width: 160px;
          border: 1px solid var(--color-red-main);
          border-radius: 0.25rem;
          padding: 3px 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-red-main);
          outline: none;

          &::placeholder {
            color: #c9a0a8;
            font-weight: 400;
          }

          &:focus {
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-red-main) 20%, transparent);
          }
        }
      }

      .dialog-table-wrap {
        max-height: 360px;
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

        .sortable-th {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;

          &:hover {
            color: var(--color-red-main);
          }
        }

        .no-records {
          height: 150px;
          color: var(--color-red-desc);
        }

        /* 未下注的期數淡化 */
        tbody tr.no-bet td {
          opacity: 0.45;
        }

        .open-codes {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: nowrap;
          gap: 3px;

          .plus {
            margin: 0 2px;
            font-size: 13px;
            font-weight: 700;
            color: var(--color-red-desc);
          }
        }
      }
    }
  }

  /* 號碼球（與 Tema、ReportIssueBets 同一套樣式） */
  .option.is-ball {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 0.16rem solid var(--6hcOf-ball-yellow);
    border-radius: 50%;
    background: #fff;
    font-size: 12px;
    font-weight: 600;
    color: #000;

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
  }
}
</style>
