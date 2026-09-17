<script setup lang="ts">
import { computed } from 'vue'
import Digit from '~/components/lottery/tw/p4/base/Digit.vue'
import { STATUS_TIME } from '~/config/constants'
import { useP4 } from '~/composables/useP4'

/**
 * 4星彩頁首——版面比照 P3/M649/D539 的 Header.vue（左側標題／右側期別倒數＋開獎區）；
 * 開獎球顯示官方真實開出的 4 位數字（0~9，可重複），不是選號碼池，因此用 Digit.vue 而非 Ball.vue。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void, (event: 'open-rule-dialog'): void }>()

const { current: p4Current, drawAtDateLabel, drawAtWeekdayLabel, drawAtTimeLabel, isPendingSettlement } = useP4()

const currentStatus = computed(() => String(p4Current.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const lastOpenCode = computed(() => p4Current.runtime?.lastOpenCode ?? null)
const lastDigits = computed(() => lastOpenCode.value?.openCode ?? [])
</script>

<template>
  <header class="p4-header">
    <div class="p4-header-left">
      <div class="p4-brand">
        <span class="p4-title-badge">4D</span>
        <div class="p4-brand-text">
          <h1 class="p4-title">4星彩</h1>
          <div class="p4-title-sub">正彩・組彩</div>
        </div>
      </div>
      <p class="p4-sub">開獎號碼與獎金完全參考台灣彩券官方4星彩</p>
    </div>

    <div class="p4-header-right">
      <div class="p4-timer">
        <div class="p4-timer-card is-issue">
          <div class="p4-timer-label">本期期號</div>
          <div class="p4-timer-value">{{ p4Current.runtime?.issue ?? '—' }}</div>
        </div>
        <div class="p4-timer-card is-status">
          <div class="p4-timer-label">
            <span class="p4-timer-dot" :class="{ 'is-pending': isPendingSettlement }" />
            {{ currentStatus }}
          </div>
          <div class="p4-timer-value p4-timer-value-sm">
            <template v-if="drawAtDateLabel">{{ drawAtDateLabel }}<span
                class="p4-countdown-suffix">({{ drawAtWeekdayLabel }})</span>{{ drawAtTimeLabel }} <span
                class="p4-countdown-suffix">開獎</span></template>
            <template v-else>—</template>
          </div>
        </div>
      </div>

      <div class="p4-open" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
        @keydown.enter="emit('open-opencode-dialog')">
        <div class="p4-open-title">
          上一期開獎
          <template v-if="lastOpenCode">(第 {{ lastOpenCode.issue }} 期)</template>
        </div>
        <div v-if="lastOpenCode" class="p4-open-balls">
          <Digit v-for="(n, idx) in lastDigits" :key="`n-${idx}`" :num="n" size="lg" />
        </div>
        <div v-else class="p4-open-empty">尚無開獎紀錄</div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.p4-header {
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
  animation: p4-header-in 0.5s ease-out both;
}

@keyframes p4-header-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes p4-badge-glow {
  0%, 100% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(214, 127, 72, 0.5);
  }

  50% {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 0 0 8px rgba(214, 127, 72, 0);
  }
}

.p4-header::before,
.p4-header::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  height: 14px;
  background: var(--color-accent-700, #8c491a);
  background-image: radial-gradient(circle at 8px 7px, var(--color-bg, #f5ead8) 6px, transparent 6.5px);
  background-size: 16px 16px;
}

.p4-header::before {
  inset-block-start: 0;
  border-radius: 0.5rem 0.5rem 0 0;
}

.p4-header::after {
  inset-block-end: 0;
  border-radius: 0 0 0.5rem 0.5rem;
}

.p4-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;

  .p4-brand {
    display: flex;
    align-items: center;
    gap: 1.05rem;
  }

  .p4-title-badge {
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
    animation: p4-badge-glow 2.4s ease-in-out infinite;
  }

  .p4-brand-text {
    display: flex;
    flex-direction: column;
  }

  .p4-title {
    margin: 0;
    font-size: 38px;
    line-height: 1.1;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .p4-title-sub {
    font-size: 14px;
    letter-spacing: 0.16em;
    color: var(--color-accent-600, #b2622d);
  }

  .p4-sub {
    margin: 0;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }
}

.p4-header-right {
  flex: 2 1 420px;
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: 0.375rem;
  background: #fffbf4;
  overflow: hidden;
}

.p4-timer {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #e2a884;
}

.p4-timer-card {
  border-radius: 0.375rem;
  padding: 0.45rem 0.6rem;
  text-align: center;

  &.is-issue {
    background: var(--color-neutral-900, #2e2b25);
  }

  &.is-status {
    background: var(--color-accent-700, #8c491a);
  }

  .p4-timer-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .p4-timer-value {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-bg, #f5ead8);

    &.p4-timer-value-sm {
      font-size: 14px;
      font-family: inherit;
      font-weight: 700;
    }

    .p4-countdown-suffix {
      font-size: 11px;
      font-weight: 700;
    }
  }

  &.is-issue .p4-timer-label {
    color: var(--color-accent-300, #ffc6a5);
  }

  &.is-status .p4-timer-label {
    color: var(--color-accent-200, #ffe1d0);
  }
}

.p4-timer-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent-2-400, #aebf92);
  animation: p4-timer-pulse 1.6s steps(1, end) infinite;

  &.is-pending {
    background: #f59e0b;
  }
}

@keyframes p4-timer-pulse {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0.25; }
}

.p4-open {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;

  .p4-open-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .p4-open-balls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    flex-wrap: wrap;

    :deep(.p4-digit) {
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

    :deep(.p4-digit)::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -60%;
      width: 55%;
      height: 200%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      transform: rotate(20deg);
      animation: p4-digit-shine 2.6s ease-in-out infinite;
    }
  }

  .p4-open-empty {
    font-size: 13px;
    color: var(--color-neutral-700, #645c50);
  }
}

@keyframes p4-digit-shine {
  0% {
    left: -60%;
  }

  50%, 100% {
    left: 130%;
  }
}
</style>
