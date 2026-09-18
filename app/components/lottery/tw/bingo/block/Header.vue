<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/bingo/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { useBingo } from '~/composables/useBingo'

/**
 * 賓果賓果頁首——版面比照 P3/P4 的 Header.vue，但沒有「開獎日期／星期」這種日曆資訊
 * （每 5 分鐘連續開一期），倒數只顯示「分:秒」；上一期開獎額外顯示超級獎號＋大小/單雙標籤。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void, (event: 'open-rule-dialog'): void }>()

const { current: bingoCurrent, countdownLabel, isPendingSettlement } = useBingo()

const currentStatus = computed(() => String(bingoCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const lastOpenCode = computed(() => bingoCurrent.runtime?.lastOpenCode ?? null)
</script>

<template>
  <header class="bingo-header">
    <div class="bingo-header-left">
      <div class="bingo-brand">
        <span class="bingo-title-badge">B</span>
        <div class="bingo-brand-text">
          <h1 class="bingo-title">賓果賓果</h1>
          <div class="bingo-title-sub">80 選 20・五分鐘一期</div>
        </div>
      </div>
      <p class="bingo-sub">開獎號碼完全參考台灣彩券官方賓果賓果，賠率為官方公開固定金額</p>
    </div>

    <div class="bingo-header-right">
      <div class="bingo-timer">
        <div class="bingo-timer-card is-issue">
          <div class="bingo-timer-label">本期期號</div>
          <div class="bingo-timer-value">{{ bingoCurrent.runtime?.issue ?? '—' }}</div>
        </div>
        <div class="bingo-timer-card is-status">
          <div class="bingo-timer-label">
            <span class="bingo-timer-dot" :class="{ 'is-pending': isPendingSettlement }" />
            {{ currentStatus }}
          </div>
          <div class="bingo-timer-value bingo-timer-value-sm">{{ countdownLabel || '—' }}</div>
        </div>
      </div>

      <div class="bingo-open" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
        @keydown.enter="emit('open-opencode-dialog')">
        <div class="bingo-open-title">
          上一期開獎
          <template v-if="lastOpenCode">(第 {{ lastOpenCode.issue }} 期)</template>
        </div>
        <template v-if="lastOpenCode">
          <div class="bingo-open-balls">
            <Ball v-for="(n, idx) in lastOpenCode.openCode" :key="`n-${idx}`" :num="n"
              :hit="String(n) === lastOpenCode.superNumber && idx === lastOpenCode.openCode.length - 1" size="sm" />
          </div>
          <div class="bingo-open-tags">
            <span class="bingo-tag">超級獎號 {{ lastOpenCode.superNumber }}</span>
            <span class="bingo-tag">{{ lastOpenCode.lotBigSmall || '—' }}</span>
            <span class="bingo-tag">{{ lastOpenCode.lotOddEven || '—' }}</span>
          </div>
        </template>
        <div v-else class="bingo-open-empty">尚無開獎紀錄</div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.bingo-header {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 1rem;
  border: 2px solid #8c491a;
  border-radius: 0.5rem;
  background: linear-gradient(180deg, var(--color-accent-100, #fff2eb) 0%, var(--color-neutral-100, #f9f4ed) 100%);
  box-shadow: var(--shadow-md);
  padding: calc(1rem + 14px) 1.25rem calc(1rem + 14px);
  animation: bingo-header-in 0.5s ease-out both;
}

@keyframes bingo-header-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 常置動畫：徽章持續輕輕呼吸發光，比照其他 tw 玩法 Header（P3/D539/M649…）同一套語彙 */
@keyframes bingo-badge-glow {
  0%, 100% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(214, 127, 72, 0.5);
  }

  50% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 8px rgba(214, 127, 72, 0);
  }
}

.bingo-header::before,
.bingo-header::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  height: 14px;
  background: var(--color-accent-700, #8c491a);
  background-image: radial-gradient(circle at 8px 7px, var(--color-bg, #f5ead8) 6px, transparent 6.5px);
  background-size: 16px 16px;
}

.bingo-header::before {
  inset-block-start: 0;
  border-radius: 0.5rem 0.5rem 0 0;
}

.bingo-header::after {
  inset-block-end: 0;
  border-radius: 0 0 0.5rem 0.5rem;
}

.bingo-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;

  .bingo-brand {
    display: flex;
    align-items: center;
    gap: 1.05rem;
  }

  .bingo-title-badge {
    flex: none;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--color-accent-500, #d67f48);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 44px;
    color: var(--color-neutral-900, #2e2b25);
    animation: bingo-badge-glow 2.4s ease-in-out infinite;
  }

  .bingo-brand-text {
    display: flex;
    flex-direction: column;
  }

  .bingo-title {
    margin: 0;
    font-size: 38px;
    line-height: 1.1;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .bingo-title-sub {
    font-size: 13px;
    letter-spacing: 0.22em;
    color: var(--color-accent-600, #b2622d);
  }

  .bingo-sub {
    margin: 0;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }
}

.bingo-header-right {
  flex: 2 1 420px;
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: 0.375rem;
  background: #fffbf4;
  overflow: hidden;
}

.bingo-timer {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #e2a884;
}

.bingo-timer-card {
  border-radius: 0.375rem;
  padding: 0.45rem 0.6rem;
  text-align: center;

  &.is-issue {
    background: var(--color-neutral-900, #2e2b25);
  }

  &.is-status {
    background: var(--color-accent-700, #8c491a);
  }

  .bingo-timer-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .bingo-timer-value {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-bg, #f5ead8);

    &.bingo-timer-value-sm {
      font-variant-numeric: tabular-nums;
    }
  }

  &.is-issue .bingo-timer-label {
    color: var(--color-accent-300, #ffc6a5);
  }

  &.is-status .bingo-timer-label {
    color: var(--color-accent-200, #ffe1d0);
  }
}

.bingo-timer-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent-2-400, #aebf92);
  animation: bingo-timer-pulse 1.6s steps(1, end) infinite;

  &.is-pending {
    background: #f59e0b;
  }
}

@keyframes bingo-timer-pulse {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0.25; }
}

.bingo-open {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;

  .bingo-open-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .bingo-open-balls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    flex-wrap: wrap;
    max-width: 100%;

    /* 只在這裡的開獎球加金屬光澤，不動 Ball.vue 本體（其他地方共用同一支元件），比照 D539/M649 等玩法 */
    :deep(.bingo-ball) {
      position: relative;
      overflow: hidden;
      background-image:
        radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 35%),
        radial-gradient(circle at 75% 80%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 45%),
        linear-gradient(135deg,
          rgba(255, 255, 255, 0.3) 0%,
          rgba(88, 28, 135, 0.08) 45%,
          rgba(76, 29, 149, 0.55) 100%);
      box-shadow:
        0 2px 4px rgba(76, 29, 149, 0.4),
        inset 0 1px 2px rgba(255, 255, 255, 0.9),
        inset 0 -3px 4px rgba(76, 29, 149, 0.5);
    }

    :deep(.bingo-ball)::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -60%;
      width: 55%;
      height: 200%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      transform: rotate(20deg);
      animation: bingo-ball-shine 2.6s ease-in-out infinite;
    }
  }

  .bingo-open-tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .bingo-tag {
    border: 1px solid var(--color-accent-700, #8c491a);
    border-radius: 999px;
    background: var(--color-accent-100, #fff2eb);
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-accent-700, #8c491a);
  }

  .bingo-open-empty {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }
}

@keyframes bingo-ball-shine {
  0% {
    left: -60%;
  }

  50%, 100% {
    left: 130%;
  }
}
</style>
