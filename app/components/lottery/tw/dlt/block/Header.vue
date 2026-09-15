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
      <h1 class="dlt-title">大樂透</h1>
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
  border: 4px solid #7f1d1d;
  border-radius: 0.5rem;
  background: #fff;
  padding: 1rem 1.25rem;
}

.dlt-header-left {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  .dlt-title {
    margin: 0;
    font-size: 34px;
    font-weight: 900;
    color: var(--color-red-main, #7f1d1d);
    padding-left: 0.6rem;
    border-left: 5px solid var(--color-gold, #c9a227);
  }

  .dlt-sub {
    margin: 0;
    font-size: 12px;
    color: var(--color-red-desc, #9ca3af);
  }

  .dlt-rule-btn {
    align-self: flex-start;
    margin-top: 0.25rem;
    border: 1px solid var(--color-red-main, #7f1d1d);
    color: var(--color-red-main, #7f1d1d);
    background: #fff;
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
  border: 1px solid #fee2e2;
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
  background: rgba(254, 242, 242, 0.7);
  padding: 0.5rem;
  text-align: center;

  .dlt-issue {
    font-size: 12px;
    color: var(--color-red-desc, #9ca3af);
  }

  .dlt-status {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-red-main, #7f1d1d);

    &.is-pending {
      color: #b45309;
    }
  }

  .dlt-countdown {
    white-space: nowrap;
    font-size: 22px;
    font-weight: 900;
    color: var(--color-red-main, #7f1d1d);

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
    color: var(--color-red-desc, #9ca3af);
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
    color: var(--color-red-desc, #9ca3af);
  }

  .dlt-open-empty {
    font-size: 12px;
    color: var(--color-red-desc, #9ca3af);
  }
}
</style>
