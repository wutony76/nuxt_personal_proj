<script setup lang="ts">
/** 對話框外殼：遮罩 + 標題 + 關閉鈕（樣式與 6hc 的 .cd-dialog 一致） */
const props = defineProps<{ visible: boolean; title: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="props.visible" class="ssc-dialog-mask" @click.self="emit('close')">
    <section class="ssc-dialog lottery-scrollbar" :style="props.width ? `width: ${props.width}` : undefined">
      <header class="ssc-dialog-header">
        <h3>{{ props.title }}</h3>
        <button type="button" class="close-btn" aria-label="關閉" @click="emit('close')">×</button>
      </header>
      <div class="ssc-dialog-body">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.ssc-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.ssc-dialog {
  width: min(1000px, 96vw);
  max-height: 88vh;
  overflow: auto;
  border: 4px solid #7f1d1d;
  border-radius: 8px;
  background: #fff;
  padding: 0.75rem;

  .ssc-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-red-main);

    h3 { margin: 0; }

    .close-btn {
      position: absolute;
      top: -3px;
      right: 5px;
      border: none;
      background: none;
      font-size: 25px;
      font-weight: 700;
      line-height: 1;
      color: var(--color-red-desc);
      cursor: pointer;

      &:hover { color: var(--color-red-main); }
    }
  }
}
</style>
