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
        <div class="dlt-issue">本期{{ mxCurrent.runtime?.issue ?? '—' }}</div>
        <div class="dlt-status" :class="{ 'is-pending': isPendingSettlement }">{{ currentStatus }}</div>
        <div class="dlt-countdown">
          <template v-if="drawAtDateLabel">{{ drawAtDateLabel }}<span
              class="dlt-countdown-suffix">({{ drawAtWeekdayLabel }})</span>{{ drawAtTimeLabel }} <span
              class="dlt-countdown-suffix">開獎</span></template>
          <template v-else>—</template>
        </div>
      </div>

      <div class="dlt-open" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
        @keydown.enter="emit('open-opencode-dialog')">
        <div class="dlt-open-title">
          上一期開獎
          <template v-if="lastOpenCode">(第 {{ lastOpenCode.issue }} 期)</template>
        </div>
        <div v-if="lastOpenCode" class="dlt-open-balls">
          <Ball v-for="(n, idx) in lastNumbers" :key="`n-${idx}`" :num="n" size="md" />
          <span class="dlt-open-plus">+</span>
          <Ball :num="lastSpecial ?? undefined" size="md" special />
        </div>
        <div v-else class="dlt-open-empty">尚無開獎紀錄</div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.dlt-header {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 1rem;
  border: 4px solid var(--color-accent-700, #8c491a);
  border-radius: 0.5rem;
  background: var(--color-neutral-100, #f9f4ed);
  padding: 1rem 1.25rem;
}

.dlt-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  .dlt-brand {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .dlt-title-badge {
    flex: none;
    width: 66px;
    height: 66px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--color-accent-500, #d67f48);
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 38px;
    color: var(--color-neutral-900, #2e2b25);
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18);
  }

  .dlt-brand-text {
    display: flex;
    flex-direction: column;
  }

  .dlt-title {
    margin: 0;
    font-size: 33px;
    line-height: 1.1;
    font-weight: 900;
    font-family: var(--font-heading);
    color: var(--color-accent-700, #8c491a);
  }

  .dlt-title-sub {
    font-size: 12px;
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
  overflow: hidden;
}

.dlt-timer {
  flex: 0 0 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: var(--color-accent-100, #fff2eb);
  padding: 0.5rem;
  text-align: center;

  .dlt-issue {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }

  .dlt-status {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-accent-700, #8c491a);

    &.is-pending {
      color: #b45309;
    }
  }

  .dlt-countdown {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    color: var(--color-accent-700, #8c491a);

    .dlt-countdown-suffix {
      font-size: 13px;
      font-weight: 700;
    }
  }
}

.dlt-open {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;

  .dlt-open-title {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }

  .dlt-open-balls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .dlt-open-plus {
    font-weight: 700;
    color: var(--color-neutral-700, #645c50);
  }

  .dlt-open-empty {
    font-size: 12px;
    color: var(--color-neutral-700, #645c50);
  }
}
</style>
