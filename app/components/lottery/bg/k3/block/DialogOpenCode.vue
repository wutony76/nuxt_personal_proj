<script setup lang="ts">
import { computed, reactive } from 'vue'
import Dice from '~/components/lottery/bg/k3/base/Dice.vue'
import DialogShell from '~/components/lottery/bg/k3/block/DialogShell.vue'
import { useK3 } from '~/composables/useK3'

/**
 * 開獎歷史彈窗：可搜期號、翻轉排序，並標出和值／大小／單雙／圍骰
 *
 * 該期沒有下注的話整列反灰（灰底灰字、骰子與牌型去彩），一眼看得出哪幾期有下注。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { openCodeHistory: mxHistory, userRecord: mxRecord, actions: mxActions } = useK3()

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
const isTriple = (codes: string[]) => codes.length === 3 && new Set(codes).size === 1
</script>

<template>
  <DialogShell :visible="props.visible" title="開獎歷史" @close="emit('close')">
    <div class="doc-bar">
      <input v-model="state.query" type="text" class="doc-search" placeholder="搜尋期號" />
      <button type="button" class="doc-sort" @click="state.desc = !state.desc">
        期號 {{ state.desc ? '↓ 新→舊' : '↑ 舊→新' }}
      </button>
      <span class="doc-note">※ 與信用／官方玩法為同一份開獎號</span>
    </div>

    <table class="report-table">
      <thead>
        <tr><th>期數</th><th>骰子</th><th>和值</th><th>大小</th><th>單雙</th><th>牌型</th><th>開獎時間</th></tr>
      </thead>
      <tbody>
        <tr v-for="item in rows" :key="item.issue" :class="{ 'is-no-bet': !hasBet(item.issue) }">
          <td>{{ item.issue }}</td>
          <td>
            <span class="doc-dice">
              <Dice v-for="(code, idx) in item.openCode" :key="idx" :num="code" size="sm" />
            </span>
          </td>
          <td class="is-sum">{{ mxActions.sumOf(item.openCode) }}</td>
          <td>{{ mxActions.sumOf(item.openCode) >= 11 ? '大' : '小' }}</td>
          <td>{{ mxActions.sumOf(item.openCode) % 2 === 1 ? '單' : '雙' }}</td>
          <td>
            <span v-if="isTriple(item.openCode)" class="tag is-triple">圍骰</span>
            <span v-else-if="new Set(item.openCode).size === 2" class="tag is-pair">對子</span>
            <span v-else class="tag">三不同</span>
          </td>
          <td>{{ timeOf(item.time?.end ?? '') }}</td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="7" class="no-records">{{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}</td>
        </tr>
      </tbody>
    </table>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 空狀態撐開高度（同 6hc 的 .no-records）並反灰 */
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

.doc-dice { display: inline-flex; gap: 3px; }

:deep(.report-table) {
  .is-sum { font-weight: 700; color: var(--color-red-main); }

  /* 該期沒有下注：整列反灰（淡一點，只要能與有下注的列區隔就好） */
  tr.is-no-bet {
    td {
      background: #fcfcfc;
      color: #a3a3a3;
    }

    .is-sum {
      color: #a3a3a3;
    }

    /* 骰子改成淡紅（#eacccf）：外框與點都換色，不用 grayscale 才不會變成灰骰子 */
    .doc-dice {
      .k3-dice {
        border-color: #eacccf;
      }

      .dice-pip {
        background: #eacccf;
      }
    }

    /* 牌型標籤去彩，才不會在灰列裡跳出來 */
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

    &.is-triple { background: #fef3c7; color: #b45309; }
    &.is-pair { background: #fee2e2; color: #b91c1c; }
  }
}
</style>
