<script setup lang="ts">
import { ref } from 'vue'
import { useM649 } from '~/composables/useM649'

/**
 * 送出／清空／新增一組（最多 5 組）
 * 刪除某一組已改在 CurrItems.vue 每列直接按「×」，這裡不再重複提供下拉選單刪除。
 * $dialog 沿用共用的「彩運來／柑仔店主題」className: 'is-dlt'（見 app/components/Dialog.vue
 * 的 &.is-dlt，是主題 token 而非 DLT 專屬命名空間，49樂合彩同屬柑仔店主題直接共用）。
 */
const { canAddSlot, canSubmit, state, actions, fetch } = useM649()

const { $dialog } = useNuxtApp()
const router = useRouter()

/** 送出成功時從按鈕中心炸開的號碼球，樣式呼應 play-warp 的 m649-ticket-art 插畫配色 */
interface BurstBall { id: number; dx: number; dy: number; rot: number; hot: boolean }
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
      hot: Math.random() < 0.25
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
  <div class="m649-controls">
    <div class="m649-controls-row m649-controls-row-actions">
      <button type="button" class="m649-btn" :disabled="!canAddSlot" @click="click.addSlot">
        新增 (最多5組)
      </button>
      <button type="button" class="m649-btn m649-btn-plain" @click="click.clearAll">全部清空</button>
    </div>

    <div class="m649-controls-row m649-controls-row-spacer"></div>

    <div class="m649-controls-row m649-submit-row">
      <button type="button" class="m649-btn m649-btn-submit" :disabled="!canSubmit" @click="click.submit">
        {{ state.submitStatus === 'loading' ? '送出中…' : '送出投注' }}
      </button>
      <span v-for="p in burst" :key="p.id" class="m649-burst-ball" :class="{ 'is-hot': p.hot }"
        :style="{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg` }" />
    </div>
    <p class="m649-hint">溫馨提醒：點擊投注，即刻扣款</p>
  </div>
</template>

<style scoped lang="scss">
.m649-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.m649-controls-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.m649-controls-row-actions {
  justify-content: space-between;
}

/** 原本「刪除哪一組？」下拉選單改由 CurrItems.vue 每列的「×」取代，這裡留一列空間避免版面跳動 */
.m649-controls-row-spacer {
  height: 28px;
}

.m649-hint {
  margin: 0;
  text-align: right;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.m649-btn {
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

  &.m649-btn-plain {
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);

    &:hover:not(:disabled) {
      background: var(--color-accent-100, #fff2eb);
      border-color: var(--color-accent-700, #8c491a);
    }
  }

  &.m649-btn-submit {
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
      animation: m649-btn-shine 2.2s ease-in-out infinite;
    }

    &:disabled::after {
      animation: none;
      display: none;
    }
  }
}


@keyframes m649-btn-shine {
  0% {
    left: -60%;
  }

  60%,
  100% {
    left: 130%;
  }
}

.m649-submit-row {
  position: relative;
}

.m649-burst-ball {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-yellow-black-btn, #fecf13);
  border: 1.5px solid var(--color-yellow-btn-text, #38300d);
  pointer-events: none;
  animation: m649-burst 0.9s ease-out forwards;

  &.is-hot {
    background: #dc2626;
    border-color: #7a1a1a;
  }
}

@keyframes m649-burst {
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
