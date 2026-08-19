<script setup lang="ts">
import { computed, reactive } from 'vue'
import Ball from '~/components/lottery/bg/11x5/base/Ball.vue'
import DialogShell from '~/components/lottery/bg/11x5/block/DialogShell.vue'
import {
  x5NumbersOf,
  x5ParityAllOf,
  X5_BIG_LINE,
  X5_SUM_BIG_LINE,
  X5_SUM_TAIL_BIG_LINE
} from '#shared/config/x5'
import { useX5 } from '~/composables/useX5'

/**
 * 開獎歷史彈窗：可搜期號、翻轉排序，列出 5 顆號碼與總和的各組面
 *
 * 該期沒有下注的話整列反灰（灰底灰字、球去彩），一眼看得出哪幾期有下注。
 * ⚠️ 與 ssc 不同：11選5 沒有「後三牌型」「梭哈」這種區段／牌型玩法
 *    （號碼不重複，牌型概念不存在），那兩欄改成 11選5 真的有的
 *    「尾大小」與「爆池」——後者標出該期是不是爆池期（五球全單或全雙）。
 */
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { openCodeHistory: mxHistory, userRecord: mxRecord, actions: mxActions } = useX5()

/** 有下注的期號（來自使用者注單，逐期比對用） */
const betIssues = computed(() => new Set(mxRecord.betHistory.map((row) => String(row.issue))))
const hasBet = (issue: string | number) => betIssues.value.has(String(issue))
const state = reactive({ query: '', desc: true })

const rows = computed(() => {
  const query = state.query.trim()
  const list = mxHistory.list.filter((item) => !query || String(item.issue).includes(query))
  const sorted = [...list].sort((a, b) => String(a.issue).localeCompare(String(b.issue)))
  const ordered = state.desc ? sorted.reverse() : sorted
  // 總和／牌型在 template 各要用到兩次以上，先算好避免重複呼叫
  return ordered.map((item) => {
    const nums = x5NumbersOf(item.openCode as string[])
    const sum = mxActions.sumOf(item.openCode as string[])
    return {
      issue: String(item.issue),
      openCode: item.openCode as string[],
      time: item.time?.end ?? '',
      sum,
      isBig: sum >= X5_SUM_BIG_LINE,
      isOdd: sum % 2 === 1,
      isTailBig: sum % 10 >= X5_SUM_TAIL_BIG_LINE,
      /** 第一球大小（1-5球／兩面分頁最常看的一欄） */
      ballOne: nums ? (Number(nums[0]) >= X5_BIG_LINE ? '大' : '小') : '—',
      // 開獎號格式不合（不該發生）時留 '—'，不讓整列炸掉
      jackpot: nums ? (x5ParityAllOf(nums) ?? '—') : '—'
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
      <span class="doc-note">※ 與官方玩法為同一份開獎號；「爆池」欄有值＝該期五球全單或全雙</span>
    </div>

    <div class="dialog-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>期數</th>
            <th>開獎號（第一 → 第五球）</th>
            <th>總和</th>
            <th>大小</th>
            <th>單雙</th>
            <th>尾大小</th>
            <th>第一球</th>
            <th>爆池</th>
            <th>開獎時間</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.issue" :class="{ 'is-no-bet': !hasBet(item.issue) }">
            <td>{{ item.issue }}</td>
            <td>
              <span class="doc-balls">
                <Ball v-for="(code, idx) in item.openCode" :key="idx" :digit="code" size="sm" />
              </span>
            </td>
            <td class="is-sum">{{ item.sum }}</td>
            <td>{{ item.isBig ? '大' : '小' }}</td>
            <td>{{ item.isOdd ? '單' : '雙' }}</td>
            <td>{{ item.isTailBig ? '尾大' : '尾小' }}</td>
            <td>{{ item.ballOne }}</td>
            <td>
              <span v-if="item.jackpot !== '—'" class="tag is-pattern">{{ item.jackpot }}</span>
              <template v-else>—</template>
            </td>
            <td>{{ timeOf(item.time) }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="9" class="no-records">{{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}</td>
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

.doc-balls { display: inline-flex; gap: 3px; }

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
    .doc-balls {
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

/* 5 顆球一列，窄螢幕允許折行 */
.doc-balls {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
}

/* 後三牌型標籤：五種牌型共用一個中性底色，牌型本身用文字表達就夠了
   （不像大小單雙有紅藍語意，硬配色反而讓表格變花） */
.tag.is-pattern {
  background: #f1f5f9;
  color: #334155;
}
</style>
