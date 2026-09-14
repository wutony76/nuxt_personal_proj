<script setup lang="ts">
/** 對話框外殼：遮罩 + 標題 + 關閉鈕（複製自 k3/block/DialogShell.vue） */
const props = defineProps<{ visible: boolean; title: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="props.visible" class="dlt-dialog-mask" @click.self="emit('close')">
    <section class="dlt-dialog lottery-scrollbar" :style="props.width ? `width: ${props.width}` : undefined">
      <header class="dlt-dialog-header">
        <h3>{{ props.title }}</h3>
        <button type="button" class="close-btn" aria-label="關閉" @click="emit('close')">×</button>
      </header>
      <div class="dlt-dialog-body">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.dlt-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.dlt-dialog {
  width: min(1000px, 96vw);
  max-height: 88vh;
  overflow: auto;
  border: 4px solid #7f1d1d;
  border-radius: 8px;
  background: #fff;
  padding: 0.75rem;

  .dlt-dialog-header {
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
