<script setup lang="ts">
import { inject } from 'vue'
import type { ToyCatalogItem } from '~/services/api'

/**
 * 共用彩池／未領金額目前卡在別款玩具時顯示的浮動視窗（8 款玩具共用）。
 * item 是卡住的那一款玩具（從 catalog.items 用 blockedGameKey 找出來），
 * 「前往」直接透過 ToyPlayDialog 的 switchToyDialog inject 切換面板，不用手動關閉再重開。
 */
const props = defineProps<{
  visible: boolean
  item: ToyCatalogItem | null
}>()

const switchToy = inject<((item: ToyCatalogItem) => void) | null>('switchToyDialog', null)
const closeToy = inject<(() => void) | null>('closeToyDialog', null)

const click = {
  go: () => {
    if (props.item && switchToy) switchToy(props.item)
  }
}
</script>

<template>
  <div v-if="visible" class="blocked-modal-mask">
    <section class="blocked-modal taiwan-lottery-scrollbar" role="dialog" aria-label="其他玩具還有未領金額">
      <h2>其他玩具還有未領金額</h2>
      <p v-if="item">「{{ item.name }}」還有未領的獎金／退款，要先去把它領完，這一款才能開新的注。</p>
      <p v-else>還有其他玩具未領完的獎金，要先處理完才能開新的注。</p>
      <div class="blocked-actions">
        <button v-if="item && switchToy" type="button" class="is-continue" @click="click.go">前往「{{ item.name }}」</button>
        <button v-if="closeToy" type="button" class="is-close" @click="closeToy()">關閉</button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.blocked-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1010;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(46, 43, 37, 0.55);
}

.blocked-modal {
  width: min(420px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-surface, #ebddc5);
  border: 2px solid var(--color-accent-2-400, #aebf92);
  border-radius: var(--radius-lg, 28px);
  padding: 20px;
  box-shadow: var(--shadow-lg);
  animation: blocked-modal-in 0.18s ease-out both;

  h2 {
    margin: 0 0 8px;
    color: var(--color-accent-800, #3d472b);
  }

  p {
    margin: 0 0 14px;
  }
}

@keyframes blocked-modal-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.blocked-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    border-radius: 999px;
    border: 0;
    padding: 10px 16px;
    background: var(--color-accent, #c67139);
    color: var(--color-bg, #f5ead8);
    font-weight: 700;
    cursor: pointer;
  }

  .is-continue {
    background: var(--color-accent-2-700, #56633f);
  }

  .is-close {
    background: #2e2b25;
  }
}
</style>
