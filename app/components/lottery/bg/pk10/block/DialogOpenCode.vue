<script setup lang="ts">
import { computed, reactive } from 'vue'
import Car from '~/components/lottery/bg/pk10/base/Car.vue'
import DialogShell from '~/components/lottery/bg/pk10/block/DialogShell.vue'
import { PK10_SUM_BIG_LINE, pk10CarsOf, pk10CarAt, pk10RivalRank } from '#shared/config/pk10'
import { usePk10 } from '~/composables/usePk10'

/**
 * 開獎歷史彈窗：可搜期號、翻轉排序，列出完整 10 個名次與冠亞和／龍虎
 *
 * 該期沒有下注的話整列反灰（灰底灰字、球去彩），一眼看得出哪幾期有下注。
 * ⚠️ 這是唯一畫「完整 10 台車」的地方 —— 頁面上的近五期與注單欄位都只畫前三名，
 *    要對完整名次就開這個彈窗。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { openCodeHistory: mxHistory, userRecord: mxRecord, actions: mxActions } = usePk10()

/** 有下注的期號（來自使用者注單，逐期比對用） */
const betIssues = computed(() => new Set(mxRecord.betHistory.map((row) => String(row.issue))))
const hasBet = (issue: string | number) => betIssues.value.has(String(issue))
const state = reactive({ query: '', desc: true })

const rows = computed(() => {
  const query = state.query.trim()
  const list = mxHistory.list.filter((item) => !query || String(item.issue).includes(query))
  const sorted = [...list].sort((a, b) => String(a.issue).localeCompare(String(b.issue)))
  const ordered = state.desc ? sorted.reverse() : sorted
  // 冠亞和／龍虎在 template 各要用到兩次以上，先算好避免重複呼叫
  return ordered.map((item) => {
    const cars = pk10CarsOf(item.openCode as string[])
    const sum = mxActions.sumOf(item.openCode as string[])
    const champ = cars ? pk10CarAt(cars, 1) : 0
    const rival = cars ? pk10CarAt(cars, pk10RivalRank(1)) : 0
    return {
      issue: String(item.issue),
      openCode: item.openCode as string[],
      time: item.time?.end ?? '',
      sum,
      isBig: sum >= PK10_SUM_BIG_LINE,
      isOdd: sum % 2 === 1,
      // 車號互異，龍虎必分勝負（cars 解析失敗時兩邊都是 0，顯示為虎，但那種列本來就沒有球可畫）
      isDragon: champ > rival
    }
  })
})
const timeOf = (iso: string) => (iso ? new Date(iso).toLocaleString('zh-TW') : '—')
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

    <div class="dialog-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>期數</th>
            <th>名次（冠軍 → 第十名）</th>
            <th>冠亞和</th>
            <th>大小</th>
            <th>單雙</th>
            <th>冠軍龍虎</th>
            <th>開獎時間</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.issue" :class="{ 'is-no-bet': !hasBet(item.issue) }">
            <td>{{ item.issue }}</td>
            <td>
              <span class="doc-cars">
                <Car v-for="(code, idx) in item.openCode" :key="idx" :car="code" size="sm" />
              </span>
            </td>
            <td class="is-sum">{{ item.sum }}</td>
            <td>{{ item.isBig ? '大' : '小' }}</td>
            <td>{{ item.isOdd ? '單' : '雙' }}</td>
            <td>
              <span class="tag" :class="item.isDragon ? 'is-dragon' : 'is-tiger'">
                {{ item.isDragon ? '龍' : '虎' }}
              </span>
            </td>
            <td>{{ timeOf(item.time) }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="no-records">{{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </DialogShell>
</template>

<style scoped lang="scss">
/* 表格自己捲動（比照 6hc-of／6hc-cd 的 .dialog-table-wrap）——
   原本整個彈窗一起捲，表頭會跟著滑掉，資料多的時候看不出在看哪一欄 */
.dialog-table-wrap {
  max-height: 320px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-red-desc) #e8e6e6;
}

:deep(.report-table) {
  /* ⚠️ 表格自身的 border-top 要拿掉：它與下面 th 的 inset 上框會疊成 2px，
     看起來比表頭下緣（1px）粗一截。上框一律交給 th 的 inset 畫，
     捲動時才不會被捲走。 */
  border-top: 0;

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    /* 捲動時表格自身的上框會被捲走，改用 inset 畫上下框（同 6hc-cd） */
    box-shadow:
      inset 0 1px 0 0 var(--color-red-content),
      inset 0 -1px 0 0 var(--color-red-content);
  }
}

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

.doc-cars { display: inline-flex; gap: 3px; }

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
    .doc-cars {
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

/* PK10 專屬：10 顆球一列，窄螢幕允許折行；龍虎標籤沿用大紅／小藍的配色 */
.doc-cars {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
}

.tag.is-dragon {
  background: #fee2e2;
  color: #b91c1c;
}

.tag.is-tiger {
  background: #dbeafe;
  color: #1d4ed8;
}
</style>
