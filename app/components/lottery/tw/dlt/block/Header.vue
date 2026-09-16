<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/tw/dlt/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { useDlt } from '~/composables/useDlt'

/**
 * 大樂透頁首——版面比照 K3-CD 的 Header.vue（左側標題／右側期別倒數＋開獎區），
 * 但拿掉彩池/爆池顯示（本玩法不做彩池，見 design.md Decision 2）；開獎球顯示的是
 * 官方真實開出的號碼（來自 recordOpenCode，非本站自建 RNG）。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void, (event: 'open-rule-dialog'): void }>()

const { current: mxCurrent, drawAtDateLabel, drawAtWeekdayLabel, drawAtTimeLabel, isPendingSettlement } = useDlt()

const currentStatus = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const lastOpenCode = computed(() => mxCurrent.runtime?.lastOpenCode ?? null)
const lastNumbers = computed(() => (lastOpenCode.value?.openCode ?? []).slice(0, 6))
const lastSpecial = computed(() => lastOpenCode.value?.openCode?.[6] ?? null)
</script>

<template>
  <header class="dlt-header">
    <div class="dlt-header-left">
      <div class="dlt-brand">
        <span class="dlt-title-badge">大</span>
        <div class="dlt-brand-text">
          <h1 class="dlt-title">大樂透</h1>
          <div class="dlt-title-sub">49選6</div>
        </div>
      </div>
      <p class="dlt-sub">開獎號碼與獎金完全參考台灣彩券官方大樂透</p>
    </div>

    <div class="dlt-header-right">
      <div class="dlt-timer">
        <div class="dlt-timer-card is-issue">
          <div class="dlt-timer-label">本期期號</div>
          <div class="dlt-timer-value">{{ mxCurrent.runtime?.issue ?? '—' }}</div>
        </div>
        <div class="dlt-timer-card is-status">
          <div class="dlt-timer-label">
            <span class="dlt-timer-dot" :class="{ 'is-pending': isPendingSettlement }" />
            {{ currentStatus }}
          </div>
          <div class="dlt-timer-value dlt-timer-value-sm">
            <template v-if="drawAtDateLabel">{{ drawAtDateLabel }}<span
                class="dlt-countdown-suffix">({{ drawAtWeekdayLabel }})</span>{{ drawAtTimeLabel }} <span
                class="dlt-countdown-suffix">開獎</span></template>
            <template v-else>—</template>
          </div>
        </div>
      </div>

      <div class="dlt-open" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
        @keydown.enter="emit('open-opencode-dialog')">
        <div class="dlt-open-title">
          上一期開獎
          <template v-if="lastOpenCode">(第 {{ lastOpenCode.issue }} 期)</template>
        </div>
        <div v-if="lastOpenCode" class="dlt-open-balls">
          <Ball v-for="(n, idx) in lastNumbers" :key="`n-${idx}`" :num="n" size="lg" />
          <span class="dlt-open-plus">+</span>
          <Ball :num="lastSpecial ?? undefined" size="lg" special />
        </div>
        <div v-else class="dlt-open-empty">尚無開獎紀錄</div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.dlt-header {
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
}

.dlt-header::before,
.dlt-header::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  height: 14px;
  background: var(--color-accent-700, #8c491a);
  background-image: radial-gradient(circle at 8px 7px, var(--color-bg, #f5ead8) 6px, transparent 6.5px);
  background-size: 16px 16px;
}

.dlt-header::before {
  inset-block-start: 0;
  border-radius: 0.5rem 0.5rem 0 0;
}

.dlt-header::after {
  inset-block-end: 0;
  border-radius: 0 0 0.5rem 0.5rem;
}

.dlt-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;

  .dlt-brand {
    display: flex;
    align-items: center;
    gap: 1.05rem;
  }

  .dlt-title-badge {
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
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18);
  }

  .dlt-brand-text {
    display: flex;
    flex-direction: column;
  }

  .dlt-title {
    margin: 0;
    font-size: 38px;
    line-height: 1.1;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .dlt-title-sub {
    font-size: 14px;
    letter-spacing: 0.22em;
    color: var(--color-accent-600, #b2622d);
  }

  .dlt-sub {
    margin: 0;
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }

  .dlt-rule-btn {
    align-self: flex-start;
    margin-top: 0.25rem;
    border: 1px solid var(--color-accent-700, #8c491a);
    color: var(--color-accent-700, #8c491a);
    background: var(--color-neutral-100, #f9f4ed);
    border-radius: 0.25rem;
    font-size: 12px;
    padding: 3px 10px;
    cursor: pointer;
  }
}

.dlt-header-right {
  flex: 2 1 420px;
  display: flex;
  gap: 0.75rem;
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: 0.375rem;
  background: #fffbf4;
  overflow: hidden;
}

.dlt-timer {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #e2a884;
}

.dlt-timer-card {
  border-radius: 0.375rem;
  padding: 0.45rem 0.6rem;
  text-align: center;

  &.is-issue {
    background: var(--color-neutral-900, #2e2b25);
  }

  &.is-status {
    background: var(--color-accent-700, #8c491a);
  }

  .dlt-timer-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .dlt-timer-value {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-bg, #f5ead8);

    &.dlt-timer-value-sm {
      font-size: 14px;
      font-family: inherit;
      font-weight: 700;
    }

    .dlt-countdown-suffix {
      font-size: 11px;
      font-weight: 700;
    }
  }

  &.is-issue .dlt-timer-label {
    color: var(--color-accent-300, #ffc6a5);
  }

  &.is-status .dlt-timer-label {
    color: var(--color-accent-200, #ffe1d0);
  }
}

.dlt-timer-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent-2-400, #aebf92);
  animation: dlt-timer-pulse 1.6s steps(1, end) infinite;

  &.is-pending {
    background: #f59e0b;
  }
}

@keyframes dlt-timer-pulse {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0.25; }
}

.dlt-open {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;

  .dlt-open-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .dlt-open-balls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    flex-wrap: wrap;

    /* 只在這裡的開獎球加金屬光澤，不動 Ball.vue 本體（其他地方共用同一支元件） */
    :deep(.dlt-ball) {
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

    :deep(.dlt-ball)::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -60%;
      width: 55%;
      height: 200%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.9), transparent);
      transform: rotate(20deg);
      animation: dlt-ball-shine 2.6s ease-in-out infinite;
    }
  }

  .dlt-open-plus {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .dlt-open-empty {
    font-size: 13px;
    color: var(--color-neutral-700, #645c50);
  }
}

@keyframes dlt-ball-shine {
  0% {
    left: -60%;
  }

  50%, 100% {
    left: 130%;
  }
}
</style>
