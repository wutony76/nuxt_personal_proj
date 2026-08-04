<script setup lang="ts">
import { computed, reactive } from 'vue'
import { use6hcCredit } from '~/composables/use6hcCredit'

// 隨機選號快捷注數
const QUICK_COUNTS = [1, 3, 5, 10, 20]
const { state: mxState, select: mxSelect, actions: mxActions } = use6hcCredit()

const state = reactive({
  count: 5 as number,
})

// --- COMPUTED ---
// 可隨機的注項數（號碼球優先，無號碼球才計入全部注項，與 composable randomPool 一致）
const poolSize = computed(() => {
  const balls = mxSelect.pool.filter((item) => /^\d+$/.test(String(item.name)))
  return balls.length > 0 ? balls.length : mxSelect.pool.length
})
const selectedCount = computed(() => mxSelect.items.length)
const quickCounts = computed(() => QUICK_COUNTS.filter((n) => n <= poolSize.value))
const canRandom = computed(() => poolSize.value > 0 && mxState.submitStatus !== 'loading')
const canClear = computed(() => selectedCount.value > 0 && mxState.submitStatus !== 'loading')

// --- HANDLE ---
const _handlers = {
  // 注數限制在 [1, poolSize]
  normalizeCount: (val: string | number) => {
    const num = Math.trunc(Number(val) || 0)
    const max = Math.max(1, poolSize.value)
    return Math.min(max, Math.max(1, num || 1))
  },
}

const click = {
  setCount: (n: number) => {
    state.count = _handlers.normalizeCount(n)
  },
  onCountInput: (event: Event) => {
    const target = event.target as HTMLInputElement
    const normalized = _handlers.normalizeCount(target.value)
    state.count = normalized
    // 夾值後強制寫回 DOM value：避免夾值結果與現有 state 相同時畫面不更新
    target.value = String(normalized)
  },
  random: () => {
    if (!canRandom.value) return
    state.count = _handlers.normalizeCount(state.count)
    mxActions.randomSelect(state.count)
  },
  clear: () => {
    if (!canClear.value) return
    mxActions.clearSelect()
  },
}
</script>

<template>
  <section class="auto-select">
    <span class="auto-select-label">隨機選號</span>

    <div class="auto-select-counts">
      <button v-for="n in quickCounts" :key="`auto-count-${n}`" type="button" class="count-btn"
        :class="{ active: state.count === n }" @click="click.setCount(n)">
        {{ n }}
      </button>
      <input type="number" class="count-input" min="1" :max="Math.max(1, poolSize)" :value="state.count"
        aria-label="隨機注數" @input="click.onCountInput" />
      <span class="count-unit">注</span>
    </div>

    <button type="button" class="act-btn is-random" :disabled="!canRandom" @click="click.random">
      機選
    </button>
    <button type="button" class="act-btn is-clear" :disabled="!canClear" @click="click.clear">
      清空
    </button>

    <span class="auto-select-hint">
      已選 <strong>{{ selectedCount }}</strong> / {{ poolSize }} 注 · 每注 <strong>{{ mxState.amount }}</strong>
    </span>
  </section>
</template>

<style scoped lang="scss">
.auto-select {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .auto-select-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  .auto-select-counts {
    display: flex;
    align-items: center;
    gap: 4px;

    .count-btn {
      min-width: 30px;
      height: 28px;
      padding: 0 6px;
      border: 1px solid #f3b7bf;
      border-radius: 0.25rem;
      background: #fff5f6;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(.active) {
        background: #fbe3e6;
      }

      &.active {
        background: var(--color-red-main);
        border-color: var(--color-red-main);
        color: #fff;
      }
    }

    .count-input {
      width: 56px;
      height: 28px;
      border: 1px solid #f3b7bf;
      border-radius: 0.25rem;
      background: #fff;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-red-main);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:focus {
        border-color: var(--color-red-main);
        box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
      }
    }

    .count-unit {
      font-size: 12px;
      color: var(--color-red-desc);
    }
  }

  .act-btn {
    height: 28px;
    padding: 0 14px;
    border-radius: 0.25rem;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;

    &.is-random {
      border: 1px solid var(--color-red-main);
      background: var(--color-red-main);
      color: #fff;

      &:hover:not(:disabled) {
        filter: brightness(1.08);
      }
    }

    &.is-clear {
      border: 1px solid #f3b7bf;
      background: #fff;
      color: var(--color-red-desc);

      &:hover:not(:disabled) {
        background: #fff5f6;
        color: var(--color-red-main);
      }
    }

    &:active:not(:disabled) {
      transform: scale(0.96);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .auto-select-hint {
    font-size: 12px;
    color: var(--color-red-desc);

    strong {
      color: var(--color-red-main);
      font-weight: 700;
    }
  }
}
</style>
