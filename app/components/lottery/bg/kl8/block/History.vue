<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Ball from '~/components/lottery/bg/kl8/base/Ball.vue'
import {
  kl8NumbersOf,
  kl8ParityZoneOf,
  kl8SumOf,
  kl8WuxingOf,
  kl8ZoneOf,
  KL8_SUM_BIG_LINE
} from '#shared/config/kl8'
import { useKl8 } from '~/composables/useKl8'

/**
 * 開獎歷史：一次只顯示一期（版面比原本「五列直向堆疊」矮很多），
 * 其他 4 期以輪播方式呈現——左右滑動／點箭頭／點下方圓點皆可切換。
 * index 0 = 最新一期；index 越大越舊。
 */
const { openCodeHistory: mxHistory } = useKl8()

/** 要保留幾期可切換 */
const HIST_ROWS = 5

const rows = computed(() => mxHistory.list.slice(0, HIST_ROWS).map((item) => {
  const nums = kl8NumbersOf(item.openCode)
  const sum = nums ? kl8SumOf(nums) : 0
  return {
    issue: String(item.issue),
    openCode: item.openCode,
    sum,
    isBig: sum >= KL8_SUM_BIG_LINE,
    isOdd: sum % 2 === 1,
    zone: nums ? kl8ZoneOf(nums) : '',
    parityZone: nums ? kl8ParityZoneOf(nums) : '',
    wuxing: nums ? kl8WuxingOf(sum) : ''
  }
}))

/** 目前顯示第幾期（0 = 最新） */
const activeIndex = ref(0)
const activeRow = computed(() => rows.value[activeIndex.value] ?? null)

// 開獎歷史換新一期時，一律跳回最新一期，不留在舊的 index 上
watch(() => rows.value[0]?.issue, () => { activeIndex.value = 0 })
watch(() => rows.value.length, (len) => {
  if (activeIndex.value > len - 1) activeIndex.value = Math.max(0, len - 1)
})

/** 拖曳／滑動狀態（滑鼠與觸控共用 Pointer Events） */
const drag = reactive({ active: false, startX: 0 })
const SWIPE_THRESHOLD = 40

const click = {
  /** 較新一期（index 變小） */
  prev: () => { activeIndex.value = Math.max(0, activeIndex.value - 1) },
  /** 較舊一期（index 變大） */
  next: () => { activeIndex.value = Math.min(rows.value.length - 1, activeIndex.value + 1) },
  goTo: (idx: number) => { activeIndex.value = Math.max(0, Math.min(rows.value.length - 1, idx)) }
}

const _handlers = {
  pointerDown: (event: PointerEvent) => {
    if (rows.value.length <= 1) return
    drag.active = true
    drag.startX = event.clientX
  },
  pointerUp: (event: PointerEvent) => {
    if (!drag.active) return
    drag.active = false
    const deltaX = event.clientX - drag.startX
    if (deltaX <= -SWIPE_THRESHOLD) click.next()
    else if (deltaX >= SWIPE_THRESHOLD) click.prev()
  },
  pointerCancel: () => { drag.active = false }
}
</script>

<template>
  <div class="block-main kl8-history">
    <div class="hist-head">
      <button type="button" class="nav-btn" :disabled="activeIndex <= 0" @click="click.prev">‹</button>
      <span class="hist-title">近五期開獎</span>
      <span v-if="rows.length" class="hist-page">{{ activeIndex + 1 }}/{{ rows.length }}</span>
      <button type="button" class="nav-btn" :disabled="activeIndex >= rows.length - 1" @click="click.next">›</button>
    </div>
    <div class="hist-body" @pointerdown="_handlers.pointerDown" @pointerup="_handlers.pointerUp"
      @pointercancel="_handlers.pointerCancel">
      <div v-if="activeRow" :key="activeRow.issue" class="hist-row">
        <span class="hist-issue">{{ activeRow.issue.slice(-3) }}</span>
        <span class="hist-ball">
          <Ball v-for="(code, idx) in activeRow.openCode" :key="idx" :num="code" size="xs" />
        </span>
        <span class="hist-meta">
          <b>和{{ activeRow.sum }}</b>
          <em :class="activeRow.isBig ? 'is-red' : 'is-blue'">{{ activeRow.isBig ? '大' : '小' }}</em>
          <em :class="activeRow.isOdd ? 'is-red' : 'is-blue'">{{ activeRow.isOdd ? '單' : '雙' }}</em>
          <em v-if="activeRow.zone" class="is-pattern">{{ activeRow.zone }}</em>
          <em v-if="activeRow.parityZone" class="is-pattern">{{ activeRow.parityZone }}</em>
          <em v-if="activeRow.wuxing" class="is-wuxing">{{ activeRow.wuxing }}</em>
        </span>
      </div>
      <div v-else class="hist-empty">
        {{ mxHistory.isLoading ? '載入中…' : '暫無資料' }}
      </div>
    </div>
    <div v-if="rows.length > 1" class="hist-dots">
      <button v-for="(row, idx) in rows" :key="row.issue" type="button" class="dot"
        :class="{ active: idx === activeIndex }" @click="click.goTo(idx)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.kl8-history {
  flex: 0 0 38%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;

  .hist-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 8px;

    .hist-title {
      flex: 1 1 auto;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .hist-page {
      flex: 0 0 auto;
      font-size: 11px;
      color: var(--color-red-desc);
    }

    .nav-btn {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      line-height: 1;
      border: 1px solid var(--color-red-content);
      border-radius: 999px;
      background: #fff;
      color: var(--color-red-main);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;

      &:hover:not(:disabled) {
        background: var(--color-red-main);
        color: #fff;
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }
  }

  .hist-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    /* 一次只顯示一期，交由 pointer 事件判斷左右滑動切換 */
    touch-action: pan-y;
    cursor: grab;
    user-select: none;

    .hist-row {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--color-red-content);
      border-radius: 6px;
      background: #fffafa;
      padding: 10px 8px;

      .hist-issue {
        font-size: 12px;
        color: var(--color-red-desc);
      }

      .hist-ball {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 3px;
      }

      .hist-meta {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 5px;
        font-size: 12px;

        b {
          font-weight: 700;
          color: var(--color-red-main);
        }

        em {
          font-style: normal;
          font-weight: 700;
          border-radius: 3px;
          padding: 0 5px;

          &.is-red {
            background: #fee2e2;
            color: #b91c1c;
          }

          &.is-blue {
            background: #dbeafe;
            color: #1d4ed8;
          }

          &.is-pattern {
            background: #fef3c7;
            color: #b45309;
          }

          &.is-wuxing {
            background: #ede9fe;
            color: #6d28d9;
          }
        }
      }
    }

    .hist-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: #f7f7f7;
      font-size: 12px;
      color: var(--text-gray);
    }
  }

  .hist-dots {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-top: 6px;

    .dot {
      width: 6px;
      height: 6px;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: var(--color-red-content);
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;

      &.active {
        background: var(--color-red-main);
        transform: scale(1.3);
      }
    }
  }
}
</style>
