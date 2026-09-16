<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/d539/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { useD539 } from '~/composables/useD539'

/**
 * 今彩539頁首——版面比照 DLT 的 Header.vue（左側標題／右側期別倒數＋開獎區）；
 * 開獎球顯示官方真實開出的 5 個號碼（來自 recordOpenCode），今彩539沒有特別號，
 * 因此不顯示 DLT 那顆金色特別號與「+」號。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void, (event: 'open-rule-dialog'): void }>()

const { current: mxCurrent, drawAtDateLabel, drawAtWeekdayLabel, drawAtTimeLabel, isPendingSettlement } = useD539()

const currentStatus = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const lastOpenCode = computed(() => mxCurrent.runtime?.lastOpenCode ?? null)
const lastNumbers = computed(() => lastOpenCode.value?.openCode ?? [])
</script>

<template>
  <header class="d539-header">
    <div class="d539-header-left">
      <div class="d539-brand">
        <span class="d539-title-badge">539</span>
        <div class="d539-brand-text">
          <h1 class="d539-title">今彩539</h1>
          <div class="d539-title-sub">39選5</div>
        </div>
      </div>
      <p class="d539-sub">開獎號碼與獎金完全參考台灣彩券官方今彩539</p>
    </div>

    <div class="d539-header-right">
      <div class="d539-timer">
        <div class="d539-timer-card is-issue">
          <div class="d539-timer-label">本期期號</div>
          <div class="d539-timer-value">{{ mxCurrent.runtime?.issue ?? '—' }}</div>
        </div>
        <div class="d539-timer-card is-status">
          <div class="d539-timer-label">
            <span class="d539-timer-dot" :class="{ 'is-pending': isPendingSettlement }" />
            {{ currentStatus }}
          </div>
          <div class="d539-timer-value d539-timer-value-sm">
            <template v-if="drawAtDateLabel">{{ drawAtDateLabel }}<span
                class="d539-countdown-suffix">({{ drawAtWeekdayLabel }})</span>{{ drawAtTimeLabel }} <span
                class="d539-countdown-suffix">開獎</span></template>
            <template v-else>—</template>
          </div>
        </div>
      </div>

      <div class="d539-open" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
        @keydown.enter="emit('open-opencode-dialog')">
        <div class="d539-open-title">
          上一期開獎
          <template v-if="lastOpenCode">(第 {{ lastOpenCode.issue }} 期)</template>
        </div>
        <div v-if="lastOpenCode" class="d539-open-balls">
          <Ball v-for="(n, idx) in lastNumbers" :key="`n-${idx}`" :num="n" size="lg" />
        </div>
        <div v-else class="d539-open-empty">尚無開獎紀錄</div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.d539-header {
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
  animation: d539-header-in 0.5s ease-out both;
}

@keyframes d539-header-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 常置動畫：徽章持續輕輕呼吸發光，跟 d539-timer-dot 的呼吸燈是同一種語彙 */
@keyframes d539-badge-glow {
  0%, 100% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(214, 127, 72, 0.5);
  }

  50% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 8px rgba(214, 127, 72, 0);
  }
}

.d539-header::before,
.d539-header::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  height: 14px;
  background: var(--color-accent-700, #8c491a);
  background-image: radial-gradient(circle at 8px 7px, var(--color-bg, #f5ead8) 6px, transparent 6.5px);
  background-size: 16px 16px;
}

.d539-header::before {
  inset-block-start: 0;
  border-radius: 0.5rem 0.5rem 0 0;
}

.d539-header::after {
  inset-block-end: 0;
  border-radius: 0 0 0.5rem 0.5rem;
}

.d539-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;

  .d539-brand {
    display: flex;
    align-items: center;
    gap: 1.05rem;
  }

  .d539-title-badge {
    flex: none;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--color-accent-500, #d67f48);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 26px;
    color: var(--color-neutral-900, #2e2b25);
    animation: d539-badge-glow 2.4s ease-in-out infinite;
  }

  .d539-brand-text {
    display: flex;
    flex-direction: column;
  }

  .d539-title {
    margin: 0;
    font-size: 38px;
    line-height: 1.1;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .d539-title-sub {
    font-size: 14px;
    letter-spacing: 0.22em;
    color: var(--color-accent-600, #b2622d);
  }

  .d539-sub {
    margin: 0;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }
}

.d539-header-right {
  flex: 2 1 420px;
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: 0.375rem;
  background: #fffbf4;
  overflow: hidden;
}

.d539-timer {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #e2a884;
}

.d539-timer-card {
  border-radius: 0.375rem;
  padding: 0.45rem 0.6rem;
  text-align: center;

  &.is-issue {
    background: var(--color-neutral-900, #2e2b25);
  }

  &.is-status {
    background: var(--color-accent-700, #8c491a);
  }

  .d539-timer-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .d539-timer-value {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-bg, #f5ead8);

    &.d539-timer-value-sm {
      font-size: 14px;
      font-family: inherit;
      font-weight: 700;
    }

    .d539-countdown-suffix {
      font-size: 11px;
      font-weight: 700;
    }
  }

  &.is-issue .d539-timer-label {
    color: var(--color-accent-300, #ffc6a5);
  }

  &.is-status .d539-timer-label {
    color: var(--color-accent-200, #ffe1d0);
  }
}

.d539-timer-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent-2-400, #aebf92);
  animation: d539-timer-pulse 1.6s steps(1, end) infinite;

  &.is-pending {
    background: #f59e0b;
  }
}

@keyframes d539-timer-pulse {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0.25; }
}

.d539-open {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;

  .d539-open-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .d539-open-balls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    flex-wrap: wrap;

    /* 只在這裡的開獎球加金屬光澤，不動 Ball.vue 本體（其他地方共用同一支元件） */
    :deep(.d539-ball) {
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

    :deep(.d539-ball)::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -60%;
      width: 55%;
      height: 200%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      transform: rotate(20deg);
      animation: d539-ball-shine 2.6s ease-in-out infinite;
    }
  }

  .d539-open-empty {
    font-size: 13px;
    color: var(--color-neutral-700, #645c50);
  }
}

@keyframes d539-ball-shine {
  0% {
    left: -60%;
  }

  50%, 100% {
    left: 130%;
  }
}
</style>
