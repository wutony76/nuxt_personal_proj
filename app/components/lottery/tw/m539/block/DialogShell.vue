<script setup lang="ts">
/** 對話框外殼：遮罩 + 標題 + 關閉鈕（複製自 tw/d539/block/DialogShell.vue） */
const props = defineProps<{ visible: boolean; title: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="props.visible" class="m539-dialog-mask" @click.self="emit('close')">
    <section class="m539-dialog taiwan-lottery-scrollbar" :style="props.width ? `width: ${props.width}` : undefined">
      <header class="m539-dialog-header">
        <h3>{{ props.title }}</h3>
        <button type="button" class="close-btn" aria-label="關閉" @click="emit('close')">×</button>
      </header>
      <div class="m539-dialog-body">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.m539-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.m539-dialog {
  width: min(1000px, 96vw);
  max-height: 88vh;
  overflow: auto;
  border: 4px solid var(--color-accent-700, #8c491a);
  border-radius: 8px;
  background: var(--color-neutral-100, #f9f4ed);
  padding: 0.75rem;

  .m539-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-accent-700, #8c491a);

    h3 { margin: 0; font-family: var(--font-heading); }

    .close-btn {
      position: absolute;
      top: -3px;
      right: 5px;
      border: none;
      background: none;
      font-size: 25px;
      font-weight: 700;
      line-height: 1;
      color: var(--color-neutral-700, #645c50);
      cursor: pointer;

      &:hover { color: var(--color-accent-700, #8c491a); }
    }
  }
}
</style>
