<script setup lang="ts">
import { useBroadcast } from '~/composables/useBroadcast'

const { toasts, actions } = useBroadcast()

const click = {
  dismiss: (id: string) => actions.dismiss(id)
}
</script>

<template>
  <div class="broadcast-banner">
    <TransitionGroup name="toast" tag="div" class="broadcast-list">
      <div v-for="toast in toasts" :key="toast.id" class="broadcast-toast" :class="`level-${toast.level}`">
        <span class="text">{{ toast.text }}</span>
        <button type="button" class="close" aria-label="關閉" @click="click.dismiss(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
/* 全站掛載於 app.vue 根層級，不依賴任何頁面的 CSS 變數，自成一套獨立配色 */
.broadcast-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  width: min(480px, calc(100vw - 32px));
  pointer-events: none;
}

.broadcast-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.broadcast-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: #fff;
  background: rgba(13, 19, 38, 0.94);
  border: 1px solid #00e5ff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);

  &.level-warning {
    border-color: #ffb627;
  }

  &.level-success {
    border-color: #39ffa0;
  }
}

.close {
  flex-shrink: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
