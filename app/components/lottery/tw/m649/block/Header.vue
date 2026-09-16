<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/m649/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { useM649 } from '~/composables/useM649'

/**
 * 49樂合彩頁首——版面比照 D539 的 Header.vue（左側標題／右側期別倒數＋開獎區）；
 * 開獎球顯示官方真實開出的 6 個號碼（＝當期大樂透主號，來自 recordOpenCode），
 * 49樂合彩沒有特別號，因此不顯示金色特別號與「+」號。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void, (event: 'open-rule-dialog'): void }>()

const { current: mxCurrent, drawAtDateLabel, drawAtWeekdayLabel, drawAtTimeLabel, isPendingSettlement } = useM649()

const currentStatus = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const lastOpenCode = computed(() => mxCurrent.runtime?.lastOpenCode ?? null)
const lastNumbers = computed(() => lastOpenCode.value?.openCode ?? [])
</script>

<template>
  <header class="m649-header">
    <div class="m649-header-left">
      <div class="m649-brand">
        <span class="m649-title-badge">49</span>
        <div class="m649-brand-text">
          <h1 class="m649-title">49樂合彩</h1>
          <div class="m649-title-sub">跟隨大樂透</div>
        </div>
      </div>
      <p class="m649-sub">開獎號碼與獎金完全參考台灣彩券官方49樂合彩</p>
    </div>

    <div class="m649-header-right">
      <div class="m649-timer">
        <div class="m649-timer-card is-issue">
          <div class="m649-timer-label">本期期號</div>
          <div class="m649-timer-value">{{ mxCurrent.runtime?.issue ?? '—' }}</div>
        </div>
        <div class="m649-timer-card is-status">
          <div class="m649-timer-label">
            <span class="m649-timer-dot" :class="{ 'is-pending': isPendingSettlement }" />
            {{ currentStatus }}
          </div>
          <div class="m649-timer-value m649-timer-value-sm">
            <template v-if="drawAtDateLabel">{{ drawAtDateLabel }}<span
                class="m649-countdown-suffix">({{ drawAtWeekdayLabel }})</span>{{ drawAtTimeLabel }} <span
                class="m649-countdown-suffix">開獎</span></template>
            <template v-else>—</template>
          </div>
        </div>
      </div>

      <div class="m649-open" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
        @keydown.enter="emit('open-opencode-dialog')">
        <div class="m649-open-title">
          上一期開獎
          <template v-if="lastOpenCode">(第 {{ lastOpenCode.issue }} 期)</template>
        </div>
        <div v-if="lastOpenCode" class="m649-open-balls">
          <Ball v-for="(n, idx) in lastNumbers" :key="`n-${idx}`" :num="n" size="lg" />
        </div>
        <div v-else class="m649-open-empty">尚無開獎紀錄</div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.m649-header {
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
  animation: m649-header-in 0.5s ease-out both;
}

@keyframes m649-header-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 常置動畫：徽章持續輕輕呼吸發光，跟 m649-timer-dot 的呼吸燈是同一種語彙 */
@keyframes m649-badge-glow {
  0%, 100% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(214, 127, 72, 0.5);
  }

  50% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 8px rgba(214, 127, 72, 0);
  }
}

.m649-header::before,
.m649-header::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  height: 14px;
  background: var(--color-accent-700, #8c491a);
  background-image: radial-gradient(circle at 8px 7px, var(--color-bg, #f5ead8) 6px, transparent 6.5px);
  background-size: 16px 16px;
}

.m649-header::before {
  inset-block-start: 0;
  border-radius: 0.5rem 0.5rem 0 0;
}

.m649-header::after {
  inset-block-end: 0;
  border-radius: 0 0 0.5rem 0.5rem;
}

.m649-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;

  .m649-brand {
    display: flex;
    align-items: center;
    gap: 1.05rem;
  }

  .m649-title-badge {
    flex: none;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--color-accent-500, #d67f48);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 32px;
    color: var(--color-neutral-900, #2e2b25);
    animation: m649-badge-glow 2.4s ease-in-out infinite;
  }

  .m649-brand-text {
    display: flex;
    flex-direction: column;
  }

  .m649-title {
    margin: 0;
    font-size: 38px;
    line-height: 1.1;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .m649-title-sub {
    font-size: 14px;
    letter-spacing: 0.22em;
    color: var(--color-accent-600, #b2622d);
  }

  .m649-sub {
    margin: 0;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }
}

.m649-header-right {
  flex: 2 1 420px;
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: 0.375rem;
  background: #fffbf4;
  overflow: hidden;
}

.m649-timer {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #e2a884;
}

.m649-timer-card {
  border-radius: 0.375rem;
  padding: 0.45rem 0.6rem;
  text-align: center;

  &.is-issue {
    background: var(--color-neutral-900, #2e2b25);
  }

  &.is-status {
    background: var(--color-accent-700, #8c491a);
  }

  .m649-timer-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .m649-timer-value {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-bg, #f5ead8);

    &.m649-timer-value-sm {
      font-size: 14px;
      font-family: inherit;
      font-weight: 700;
    }

    .m649-countdown-suffix {
      font-size: 11px;
      font-weight: 700;
    }
  }

  &.is-issue .m649-timer-label {
    color: var(--color-accent-300, #ffc6a5);
  }

  &.is-status .m649-timer-label {
    color: var(--color-accent-200, #ffe1d0);
  }
}

.m649-timer-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent-2-400, #aebf92);
  animation: m649-timer-pulse 1.6s steps(1, end) infinite;

  &.is-pending {
    background: #f59e0b;
  }
}

@keyframes m649-timer-pulse {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0.25; }
}

.m649-open {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;

  .m649-open-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .m649-open-balls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    flex-wrap: wrap;

    /* 只在這裡的開獎球加金屬光澤，不動 Ball.vue 本體（其他地方共用同一支元件） */
    :deep(.m649-ball) {
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

    :deep(.m649-ball)::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -60%;
      width: 55%;
      height: 200%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      transform: rotate(20deg);
      animation: m649-ball-shine 2.6s ease-in-out infinite;
    }
  }

  .m649-open-empty {
    font-size: 13px;
    color: var(--color-neutral-700, #645c50);
  }
}

@keyframes m649-ball-shine {
  0% {
    left: -60%;
  }

  50%, 100% {
    left: 130%;
  }
}
</style>
