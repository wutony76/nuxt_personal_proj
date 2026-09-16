<script setup lang="ts">
import { ref } from 'vue'
import { useDlt } from '~/composables/useDlt'

/**
 * 送出／清空／新增一組（最多 5 組）
 * 刪除某一組已改在 CurrItems.vue 每列直接按「×」，這裡不再重複提供下拉選單刪除。
 */
const { canAddSlot, canSubmit, state, actions, fetch } = useDlt()

const { $dialog } = useNuxtApp()
const router = useRouter()

/** 送出成功時從按鈕中心炸開的號碼球，樣式呼應 play-warp 的 dlt-ticket-art 插畫配色 */
interface BurstBall { id: number; dx: number; dy: number; rot: number; special: boolean }
const burst = ref<BurstBall[]>([])
let burstSeq = 0
let burstTimer: ReturnType<typeof setTimeout> | null = null

function fireBurst() {
  if (burstTimer) clearTimeout(burstTimer)
  burst.value = Array.from({ length: 14 }, () => {
    const angle = Math.random() * Math.PI * 2
    const dist = 55 + Math.random() * 75
    return {
      id: burstSeq++,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 18,
      rot: (Math.random() - 0.5) * 520,
      special: Math.random() < 0.25
    }
  })
  burstTimer = setTimeout(() => { burst.value = [] }, 900)
}

const click = {
  addSlot: () => actions.addSlot(),
  clearAll: () => actions.clearAll(),
  submit: async () => {
    const result = await fetch.submit()
    // 登入失效：提示後導回登入頁（比照 bg 系列 Controls.vue 的既有做法）
    if (result.loginExpired) {
      $dialog.alert(result.message, { cb: () => router.push('/login'), options: { className: 'is-dlt' } })
      return
    }
    if (result.ok) fireBurst()
    $dialog.alert(
      result.ok ? '下注成功' : result.message,
      { options: { className: 'is-dlt' } }
    )
  }
}
</script>

<template>
  <div class="dlt-controls">
    <div class="dlt-controls-row dlt-controls-row-actions">
      <button type="button" class="dlt-btn" :disabled="!canAddSlot" @click="click.addSlot">
        新增 (最多5組)
      </button>
      <button type="button" class="dlt-btn dlt-btn-plain" @click="click.clearAll">全部清空</button>
    </div>

    <div class="dlt-controls-row dlt-controls-row-spacer"></div>

    <div class="dlt-controls-row dlt-submit-row">
      <button type="button" class="dlt-btn dlt-btn-submit" :disabled="!canSubmit" @click="click.submit">
        {{ state.submitStatus === 'loading' ? '送出中…' : '送出投注' }}
      </button>
      <span v-for="p in burst" :key="p.id" class="dlt-burst-ball" :class="{ 'is-special': p.special }"
        :style="{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg` }" />
    </div>
    <p class="dlt-hint">溫馨提醒：點擊投注，即刻扣款</p>
  </div>
</template>

<style scoped lang="scss">
.dlt-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dlt-controls-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dlt-controls-row-actions {
  justify-content: space-between;
}

/** 原本「刪除哪一組？」下拉選單改由 CurrItems.vue 每列的「×」取代，這裡留一列空間避免版面跳動 */
.dlt-controls-row-spacer {
  height: 28px;
}

.dlt-hint {
  margin: 0;
  text-align: right;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.dlt-btn {
  border: 1px solid var(--color-accent-700, #8c491a);
  background: var(--color-accent-700, #8c491a);
  color: #fff;
  border-radius: 0.25rem;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 14px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--color-accent-800, #643312);
    border-color: var(--color-accent-800, #643312);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.dlt-btn-plain {
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);

    &:hover:not(:disabled) {
      background: var(--color-accent-100, #fff2eb);
      border-color: var(--color-accent-700, #8c491a);
    }
  }

  &.dlt-btn-submit {
    position: relative;
    overflow: hidden;
    width: 100%;
    border-color: var(--color-yellow-black-btn, #fecf13);
    background: var(--color-yellow-black-btn, #fecf13);
    color: var(--color-yellow-btn-text, #38300d);
    font-size: 15px;

    &:hover:not(:disabled) {
      background: var(--color-yellow-black-btn, #fecf13);
      border-color: var(--color-yellow-black-btn, #fecf13);
    }
    padding: 10px 24px;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -60%;
      width: 40%;
      height: 100%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.7), transparent);
      animation: dlt-btn-shine 2.2s ease-in-out infinite;
    }

    &:disabled::after {
      animation: none;
      display: none;
    }
  }
}


@keyframes dlt-btn-shine {
  0% {
    left: -60%;
  }

  60%,
  100% {
    left: 130%;
  }
}

.dlt-submit-row {
  position: relative;
}

.dlt-burst-ball {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-yellow-black-btn, #fecf13);
  border: 1.5px solid var(--color-yellow-btn-text, #38300d);
  pointer-events: none;
  animation: dlt-burst 0.9s ease-out forwards;

  &.is-special {
    background: #dc2626;
    border-color: #7a1a1a;
  }
}

@keyframes dlt-burst {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
    opacity: 1;
  }

  100% {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)) scale(0.4);
    opacity: 0;
  }
}
</style>
