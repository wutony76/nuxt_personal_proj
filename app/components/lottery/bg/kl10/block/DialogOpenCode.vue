<script setup lang="ts">
import { computed, reactive } from 'vue'
import Ball from '~/components/lottery/bg/kl10/base/Ball.vue'
import DialogShell from '~/components/lottery/bg/kl10/block/DialogShell.vue'
import {
  kl10NumbersOf,
  kl10ParityZoneOf,
  kl10SumOf,
  kl10ZoneOf,
  KL10_SUM_BIG_LINE
} from '#shared/config/kl10'
import { useKl10 } from '~/composables/useKl10'

/**
 * 開獎歷史彈窗：可搜期號、翻轉排序，並標出總和／大小／單雙／上下盤／奇偶盤
 * 該期沒有下注的話整列反灰，一眼看得出哪幾期有下注（同 k3 的 DialogOpenCode.vue）
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { openCodeHistory: mxHistory, userRecord: mxRecord } = useKl10()

/** 有下注的期號（來自使用者注單，逐期比對用） */
const betIssues = computed(() => new Set(mxRecord.betHistory.map((row) => String(row.issue))))
const hasBet = (issue: string | number) => betIssues.value.has(String(issue))
const state = reactive({ query: '', desc: true })

const rows = computed(() => {
  const query = state.query.trim()
  const list = mxHistory.list.filter((item) => !query || String(item.issue).includes(query))
  const sorted = [...list].sort((a, b) => String(a.issue).localeCompare(String(b.issue)))
  return state.desc ? sorted.reverse() : sorted
})
const timeOf = (iso: string) => (iso ? new Date(iso).toLocaleString('zh-TW') : '—')
const sumOf = (openCode: string[]) => {
  const nums = kl10NumbersOf(openCode)
  return nums ? kl10SumOf(nums) : 0
}
/** 上下盤／奇偶盤（4:4 顯示「和盤」；注碼是 上下和／奇偶和，見 kl10cd/plays.js） */
const zoneOf = (openCode: string[]) => {
  const nums = kl10NumbersOf(openCode)
  return nums ? kl10ZoneOf(nums) : ''
}
const parityZoneOf = (openCode: string[]) => {
  const nums = kl10NumbersOf(openCode)
  return nums ? kl10ParityZoneOf(nums) : ''
}
</script>

<template>
  <DialogShell :visible="props.visible" title="開獎歷史" @close="emit('close')">
    <div class="doc-bar">
      <input v-model="state.query" type="text" class="doc-search" placeholder="搜尋期號" />
      <button type="button" class="doc-sort" @click="state.desc = !state.desc">
        期號 {{ state.desc ? '↓ 新→舊' : '↑ 舊→新' }}
      </button>
      <span class="doc-note">※ 快樂十分只有信用玩法</span>
    </div>

    <div class="dialog-table-wrap">
      <table class="report-table">
        <thead>
          <tr><th>期數</th><th>開獎號碼</th><th>總和</th><th>大小</th><th>單雙</th><th>上下盤</th><th>奇偶盤</th><th>開獎時間</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.issue" :class="{ 'is-no-bet': !hasBet(item.issue) }">
            <td>{{ item.issue }}</td>
            <td>
              <span class="doc-ball">
                <Ball v-for="(code, idx) in item.openCode" :key="idx" :num="code" size="xs" />
              </span>
            </td>
            <td class="is-sum">{{ sumOf(item.openCode) }}</td>
            <td>{{ sumOf(item.openCode) >= KL10_SUM_BIG_LINE ? '大' : '小' }}</td>
            <td>{{ sumOf(item.openCode) % 2 === 1 ? '單' : '雙' }}</td>
            <td><span class="tag">{{ zoneOf(item.openCode) || '—' }}</span></td>
            <td><span class="tag">{{ parityZoneOf(item.openCode) || '—' }}</span></td>
            <td>{{ timeOf(item.time?.end ?? '') }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="8" class="no-records">{{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </DialogShell>
</template>

<style scoped lang="scss">
.dialog-table-wrap {
  max-height: 320px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-red-desc) #e8e6e6;
}

:deep(.report-table) {
  border-top: 0;

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    box-shadow:
      inset 0 1px 0 0 var(--color-red-content),
      inset 0 -1px 0 0 var(--color-red-content);
  }
}

.no-records {
  height: 150px;
  background: #f7f7f7;
  color: var(--text-gray);
}

.doc-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  .doc-search {
    width: 9rem;
    border: 1px solid var(--color-red-content);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 13px;
    color: var(--color-red-main);
    outline: none;

    &:focus { border-color: var(--color-red-main); }
  }

  .doc-sort {
    border: 1px solid var(--color-red-content);
    border-radius: 4px;
    background: #fff;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &:hover { background: #fff1f2; }
  }

  .doc-note { margin-left: auto; font-size: 11px; color: var(--color-red-desc); }
}

.doc-ball { display: inline-flex; gap: 3px; }

:deep(.report-table) {
  .is-sum { font-weight: 700; color: var(--color-red-main); }

  tr.is-no-bet {
    td {
      background: #fcfcfc;
      color: #a3a3a3;
    }

    .is-sum {
      color: #a3a3a3;
    }

    .doc-ball .kl10-ball {
      filter: grayscale(1);
      opacity: 0.55;
    }

    .tag {
      filter: grayscale(1);
      opacity: 0.55;
    }
  }

  .tag {
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 700;
    background: #f1f5f9;
    color: #475569;

  }
}
</style>
