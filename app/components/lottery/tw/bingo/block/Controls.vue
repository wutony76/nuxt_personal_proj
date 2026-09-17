<script setup lang="ts">
import { ref } from 'vue'
import { useBingo } from '~/composables/useBingo'

/** 送出／清空，版面比照 P3/P4 的 Controls.vue（本玩法沒有「新增一組」按鈕，加入注單在 Board.vue 各分頁內完成） */
const { canSubmit, state, actions, fetch } = useBingo()

const { $dialog } = useNuxtApp()
const router = useRouter()

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
  clearAll: () => actions.clearAll(),
  submit: async () => {
    const result = await fetch.submit()
    if (result.loginExpired) {
      $dialog.alert(result.message, { cb: () => router.push('/login'), options: { className: 'is-dlt' } })
      return
    }
    if (result.ok) fireBurst()
    $dialog.alert(result.ok ? '下注成功' : result.message, { options: { className: 'is-dlt' } })
  }
}
</script>

<template>
  <div class="bingo-controls">
    <div class="bingo-controls-row">
      <button type="button" class="bingo-btn bingo-btn-plain" @click="click.clearAll">全部清空</button>
    </div>

    <div class="bingo-controls-row bingo-submit-row">
      <button type="button" class="bingo-btn bingo-btn-submit" :disabled="!canSubmit" @click="click.submit">
        {{ state.submitStatus === 'loading' ? '送出中…' : '送出投注' }}
      </button>
      <span v-for="p in burst" :key="p.id" class="bingo-burst-ball" :class="{ 'is-hot': p.hot }"
        :style="{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg` }" />
    </div>
    <p class="bingo-hint">溫馨提醒：點擊投注，即刻扣款</p>
  </div>
</template>

<style scoped lang="scss">
.bingo-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bingo-controls-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.bingo-hint {
  margin: 0;
  text-align: right;
  font-size: 12px;
  color: var(--color-neutral-700, #645c50);
}

.bingo-btn {
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

  &.bingo-btn-plain {
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);

    &:hover:not(:disabled) {
      background: var(--color-accent-100, #fff2eb);
      border-color: var(--color-accent-700, #8c491a);
    }
  }

  &.bingo-btn-submit {
    position: relative;
    overflow: hidden;
    width: 100%;
    border-color: var(--color-yellow-black-btn, #fecf13);
    background: var(--color-yellow-black-btn, #fecf13);
    color: var(--color-yellow-btn-text, #38300d);
    font-size: 15px;
    padding: 10px 24px;

    &:hover:not(:disabled) {
      background: var(--color-yellow-black-btn, #fecf13);
      border-color: var(--color-yellow-black-btn, #fecf13);
    }

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -60%;
      width: 40%;
      height: 100%;
      background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.7), transparent);
      animation: bingo-btn-shine 2.2s ease-in-out infinite;
    }

    &:disabled::after {
      animation: none;
      display: none;
    }
  }
}

@keyframes bingo-btn-shine {
  0% { left: -60%; }
  60%, 100% { left: 130%; }
}

.bingo-submit-row {
  position: relative;
}

.bingo-burst-ball {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-yellow-black-btn, #fecf13);
  border: 1.5px solid var(--color-yellow-btn-text, #38300d);
  pointer-events: none;
  animation: bingo-burst 0.9s ease-out forwards;

  &.is-hot {
    background: #dc2626;
    border-color: #7a1a1a;
  }
}

@keyframes bingo-burst {
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
