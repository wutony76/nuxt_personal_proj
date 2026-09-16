<script setup lang="ts">
import { useDlt } from '~/composables/useDlt'

/**
 * 送出／清空／新增一組（最多 5 組）
 * 刪除某一組已改在 CurrItems.vue 每列直接按「×」，這裡不再重複提供下拉選單刪除。
 */
const { canAddSlot, canSubmit, state, actions, fetch } = useDlt()

const { $dialog } = useNuxtApp()
const router = useRouter()
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const click = {
  addSlot: () => actions.addSlot(),
  clearAll: () => actions.clearAll(),
  submit: async () => {
    const result = await fetch.submit()
    // 登入失效：提示後導回登入頁（比照 bg 系列 Controls.vue 的既有做法）
    if (result.loginExpired) {
      $dialog.alert(result.message, { cb: () => router.push('/login') })
      return
    }
    $dialog.alert(
      result.ok ? `下注成功（${result.count} 組 / ${money(result.amount ?? 0)}）` : result.message
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

    <div class="dlt-controls-row">
      <button type="button" class="dlt-btn dlt-btn-submit" :disabled="!canSubmit" @click="click.submit">
        {{ state.submitStatus === 'loading' ? '送出中…' : '送出投注' }}
      </button>
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

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.dlt-btn-plain {
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-accent-700, #8c491a);
  }

  &.dlt-btn-submit {
    position: relative;
    overflow: hidden;
    width: 100%;
    border-color: var(--color-yellow-black-btn, #fecf13);
    background: var(--color-yellow-black-btn, #fecf13);
    color: var(--color-yellow-btn-text, #38300d);
    font-size: 15px;
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
</style>
