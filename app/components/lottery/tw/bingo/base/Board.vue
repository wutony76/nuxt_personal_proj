<script setup lang="ts">
import { computed } from 'vue'
import { useBingo } from '~/composables/useBingo'
import {
  BINGO_BET_UNIT,
  BINGO_BET_TYPES,
  BINGO_NUMBER_MIN,
  BINGO_NUMBER_MAX,
  BINGO_STAR_MIN,
  BINGO_STAR_MAX
} from '#shared/config/bingo'

/**
 * 賓果賓果投注面板——同時容納 4 種投注類型（基本玩法／超級獎號／猜大小／猜單雙），參考本站
 * 既有 `kl8` base/Board.vue「同一玩法下多種下注區塊並存」的版面模式，改用 tab 切換
 * （不像 kl8 是同一頁並排，賓果賓果 4 種類型的選號互動差異太大，並排會太擁擠）。
 *
 * ⚠️ 下注金額顯示刻意分開標示：基本玩法／猜大小／猜單雙皆為「25 元／注」，超級獎號額外
 * 標示「加購 25 元／注」，避免玩家誤以為選了超級獎號後基本玩法金額會變（design.md Decision 6）。
 */
const props = defineProps<{ disabled?: boolean }>()

const { state, starDraft, superDraft, starDraftReady, canAddSlot, actions } = useBingo()

const numberPool = computed(() => Array.from({ length: BINGO_NUMBER_MAX - BINGO_NUMBER_MIN + 1 }, (_, i) => BINGO_NUMBER_MIN + i))
const starOptions = computed(() => Array.from({ length: BINGO_STAR_MAX - BINGO_STAR_MIN + 1 }, (_, i) => BINGO_STAR_MIN + i))

const click = {
  setTab: (tab: typeof BINGO_BET_TYPES[number]['key']) => {
    if (props.disabled) return
    actions.setActiveTab(tab)
  },
  setStar: (star: number) => { if (!props.disabled) actions.setStar(star) },
  toggleStarNumber: (num: number) => { if (!props.disabled) actions.toggleStarNumber(num) },
  quickPickStar: () => { if (!props.disabled) actions.quickPickStar() },
  clearStarDraft: () => { if (!props.disabled) actions.clearStarDraft() },
  addStarSlot: () => { if (!props.disabled) actions.addStarSlot() },
  setSuperNumber: (num: number) => { if (!props.disabled) actions.setSuperNumber(num) },
  addSuperSlot: () => { if (!props.disabled) actions.addSuperSlot() },
  addBigSmallSlot: (pick: '大' | '小') => { if (!props.disabled) actions.addBigSmallSlot(pick) },
  addOddEvenSlot: (pick: '單' | '雙') => { if (!props.disabled) actions.addOddEvenSlot(pick) }
}
</script>

<template>
  <div class="bingo-board" :class="{ 'is-disabled': disabled }">
    <div class="bingo-tabs" role="tablist" aria-label="選擇投注類型">
      <button v-for="opt in BINGO_BET_TYPES" :key="opt.key" type="button" class="bingo-tab"
        :class="{ 'is-active': state.activeTab === opt.key }" :title="opt.desc" :disabled="disabled"
        @click="click.setTab(opt.key)">
        {{ opt.label }}
        <span class="bingo-tab-price">{{ opt.key === 'super' ? `加購 ${BINGO_BET_UNIT}` : `${BINGO_BET_UNIT} 元` }}</span>
      </button>
    </div>

    <!-- 基本玩法：選星數 → 選滿對應個數的號碼 -->
    <section v-if="state.activeTab === 'star'" class="bingo-panel">
      <div class="bingo-panel-head">
        <span class="bingo-panel-label">選星數</span>
        <div class="bingo-star-group" role="group">
          <button v-for="star in starOptions" :key="star" type="button" class="bingo-star-btn"
            :class="{ 'is-active': starDraft.star === star }" :disabled="disabled" @click="click.setStar(star)">
            {{ star }}
          </button>
        </div>
        <span class="bingo-panel-count" :class="{ 'is-full': starDraftReady }">
          已選 {{ starDraft.numbers.length }} / {{ starDraft.star }}
        </span>
        <div class="bingo-panel-actions">
          <button type="button" class="bingo-btn bingo-btn-primary" :disabled="disabled" @click="click.quickPickStar">電腦選號</button>
          <button type="button" class="bingo-btn" :disabled="disabled" @click="click.clearStarDraft">清空</button>
          <button type="button" class="bingo-btn bingo-btn-add" :disabled="disabled || !starDraftReady || !canAddSlot"
            @click="click.addStarSlot">
            加入注單（{{ BINGO_BET_UNIT }} 元）
          </button>
        </div>
      </div>
      <div class="bingo-number-grid">
        <button v-for="num in numberPool" :key="num" type="button" class="bingo-number-cell"
          :disabled="disabled" :class="{ 'is-selected': starDraft.numbers.includes(num) }"
          @click="click.toggleStarNumber(num)">
          {{ String(num).padStart(2, '0') }}
        </button>
      </div>
    </section>

    <!-- 超級獎號：選 1 個號碼，獨立加購 -->
    <section v-else-if="state.activeTab === 'super'" class="bingo-panel">
      <div class="bingo-panel-head">
        <span class="bingo-panel-label">選 1 個號碼（猜第 20 個開出的號碼）</span>
        <span class="bingo-panel-count" :class="{ 'is-full': superDraft.number !== null }">
          {{ superDraft.number !== null ? `已選 ${String(superDraft.number).padStart(2, '0')}` : '尚未選號' }}
        </span>
        <div class="bingo-panel-actions">
          <button type="button" class="bingo-btn bingo-btn-add" :disabled="disabled || superDraft.number === null || !canAddSlot"
            @click="click.addSuperSlot">
            加入注單（加購 {{ BINGO_BET_UNIT }} 元）
          </button>
        </div>
      </div>
      <div class="bingo-number-grid">
        <button v-for="num in numberPool" :key="num" type="button" class="bingo-number-cell"
          :disabled="disabled" :class="{ 'is-selected': superDraft.number === num }"
          @click="click.setSuperNumber(num)">
          {{ String(num).padStart(2, '0') }}
        </button>
      </div>
    </section>

    <!-- 猜大小：點選即加入注單 -->
    <section v-else-if="state.activeTab === 'bigSmall'" class="bingo-panel bingo-panel-simple">
      <p class="bingo-panel-hint">猜 20 個開出的號碼是「大」還是「小」，每次點選各自加入一組注單（{{ BINGO_BET_UNIT }} 元／注）；和局（官方回傳「－」）退款。</p>
      <div class="bingo-choice-group">
        <button type="button" class="bingo-choice-btn" :disabled="disabled || !canAddSlot" @click="click.addBigSmallSlot('大')">大</button>
        <button type="button" class="bingo-choice-btn" :disabled="disabled || !canAddSlot" @click="click.addBigSmallSlot('小')">小</button>
      </div>
    </section>

    <!-- 猜單雙：點選即加入注單 -->
    <section v-else class="bingo-panel bingo-panel-simple">
      <p class="bingo-panel-hint">猜 20 個開出的號碼是「單」還是「雙」，每次點選各自加入一組注單（{{ BINGO_BET_UNIT }} 元／注）；和局（官方回傳「－」）退款。</p>
      <div class="bingo-choice-group">
        <button type="button" class="bingo-choice-btn" :disabled="disabled || !canAddSlot" @click="click.addOddEvenSlot('單')">單</button>
        <button type="button" class="bingo-choice-btn" :disabled="disabled || !canAddSlot" @click="click.addOddEvenSlot('雙')">雙</button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.bingo-board {
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--base-radius, 0.375rem);
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  &.is-disabled {
    opacity: 0.6;
  }
}

.bingo-tabs {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;

  .bingo-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--color-accent-700, #8c491a);
    border-radius: 0.375rem;
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);
    font-size: 13px;
    font-weight: 700;
    padding: 6px 14px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;

    .bingo-tab-price {
      font-size: 10px;
      font-weight: 600;
      opacity: 0.85;
    }

    &:hover:not(:disabled):not(.is-active) {
      background: var(--color-accent-100, #fff2eb);
    }

    &.is-active {
      background: var(--color-accent-700, #8c491a);
      color: #fff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
}

.bingo-panel-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;

  .bingo-panel-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-accent-700, #8c491a);
  }

  .bingo-panel-count {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);

    &.is-full {
      color: #15803d;
      font-weight: 700;
    }
  }

  .bingo-panel-actions {
    margin-left: auto;
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }
}

.bingo-star-group {
  display: inline-flex;
  gap: 0.25rem;
  flex-wrap: wrap;

  .bingo-star-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--color-accent-700, #8c491a);
    border-radius: 50%;
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;

    &.is-active {
      background: var(--color-accent-700, #8c491a);
      color: #fff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }
}

.bingo-btn {
  border: 1px solid var(--color-accent-700, #8c491a);
  border-radius: 0.25rem;
  background: var(--color-neutral-100, #f9f4ed);
  color: var(--color-accent-700, #8c491a);
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--color-accent-100, #fff2eb);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.bingo-btn-primary {
    background: var(--color-accent-700, #8c491a);
    color: #fff;

    &:hover:not(:disabled) {
      background: var(--color-accent-800, #643312);
    }
  }

  &.bingo-btn-add {
    border-color: var(--color-yellow-black-btn, #fecf13);
    background: var(--color-yellow-black-btn, #fecf13);
    color: var(--color-yellow-btn-text, #38300d);

    &:hover:not(:disabled) {
      background: var(--color-yellow-black-btn, #fecf13);
      opacity: 0.9;
    }
  }
}

.bingo-number-grid {
  display: grid;
  grid-template-columns: repeat(10, 32px);
  justify-content: center;
  gap: 0.3rem;
}

.bingo-number-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1.5px solid #d1242f;
  border-radius: 4px;
  background: #fffdf8;
  color: #d1242f;
  font-family: var(--font-heading, inherit);
  font-weight: 700;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.1s ease, color 0.1s ease;

  &.is-selected {
    background: #6c2424;
    border-color: #6c2424;
    color: #fff;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.28);
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
}

.bingo-panel-simple {
  .bingo-panel-hint {
    margin: 0 0 0.6rem;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }

  .bingo-choice-group {
    display: flex;
    gap: 0.6rem;

    .bingo-choice-btn {
      flex: 1;
      border: 2px solid #d1242f;
      border-radius: 0.5rem;
      background: #fffdf8;
      color: #d1242f;
      font-family: var(--font-heading, inherit);
      font-weight: 900;
      font-size: 22px;
      padding: 0.75rem 0;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;

      &:hover:not(:disabled) {
        background: #d1242f;
        color: #fff;
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }
}
</style>
