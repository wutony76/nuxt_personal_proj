<template>
  <Teleport to="body">
    <div v-if="state.visible" class="dialog-default dialog-overlay" :class="{ 'dialog-loading': statusLoading }"
      @click.self="dialogClick.close()">
      <div class="dialog-container">
        <div v-if="!statusLoading" class="header">
          <h3 class="title">{{ state.title }}</h3>
          <button v-if="!lock" class="close" type="button" @click="click.close()">×</button>
        </div>
        <div class="dialog-content" :class="{ loading: statusLoading }">
          <slot>
            <div class="main" v-if="!statusLoading">
              <IconSvg v-if="type === ICON.ERROR" icon-class="fail" class="icon" color="var(--text-red)" />
              <IconSvg v-if="type === ICON.SUCCESS" icon-class="success" class="icon" color="var(--text-green)" />
              <IconSvg v-if="type === ICON.TIPS" icon-class="exclamation" class="icon" color="var(--text-blue)" />
              <div v-if="useHtml" class="content">
                <div v-html="state.content"></div>
              </div>
              <div v-else class="content">
                {{ state.content }}
              </div>
            </div>
            <div class="main" v-else>
              <div class="loading-spinner"></div>
              {{ state.content }}
            </div>
          </slot>
        </div>
        <div v-if="!statusLoading" class="dialog-footer" :class="{ 'single-action': !options?.cancelButton }">
          <button v-if="options?.cancelButton" class="btn-dialog btn-dialog-cancel" type="button"
            @click="click.close()">
            取消
          </button>
          <button class="btn-dialog btn-dialog-ok" type="button" @click="click.ok()">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineOptions({ name: 'AppDialog' })
const ICON = {
  ERROR: 'error',
  SUCCESS: 'success',
  LOADING: 'loading',
  TIPS: 'tips',
}
const STATUS = {
  LOADING: 'loading',
}
const { state, click } = useDialog()
type DialogOptions = {
  cancelButton?: boolean
  type?: string
  status?: string
  lock?: boolean
  useHtml?: boolean
}
const options = computed<DialogOptions>(() => (state?.options || {}) as DialogOptions)
const type = computed(() => options.value?.type || ICON.TIPS)
const statusLoading = computed(() => options.value?.status === STATUS.LOADING)
const lock = computed(() => options.value?.lock || false)
const useHtml = computed(() => options.value?.useHtml || false)

const dialogClick = {
  close: () => {
    if (statusLoading.value) return
    if (lock.value) return
    click.close()
  },
  ok: () => {
    click.ok()
  },
}
</script>

<style scoped lang="scss">
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.dialog-container {
  width: 100%;
  max-width: 320px;
  background: #fff;
  // border: 1px solid #d1d5db;
  border: 4px solid var(--color-red-black-btn);
  border-radius: 10px;
  box-shadow: 0 12px 28px var(--color-red-content) 30%;
  overflow: hidden;

  .main {
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;

    :deep(.icon) {
      flex: 0 0 auto;
      width: 23px;
      height: 23px;

      svg {
        // width: 23px;
      }
    }

    .content {
      flex: 1 1 180px;
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  }

  .header {
    background: var(--color-red-content);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 10px;
    border-bottom: 1px solid var(--color-red-main);

    .title {
      margin: 0;
      color: var(--color-red-black-btn);
      font-size: 16px;
      font-weight: 700;
    }
  }

  .dialog-footer {
    padding: 12px 20%;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    // background: #f1f5f9;
    // border-top: 1px solid #d1d5db;

    &.single-action {
      justify-content: center;
    }

    .btn-dialog {
      // border: 1px solid var(--color-red-main);
      border-radius: 4px;
      background: var(--color-red-black-btn);
      color: #fff;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      min-width: 72px;
    }

    .btn-dialog-cancel {
      background: #fff;
      color: var(--color-red-main);
    }
  }
}

.dialog-content.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  min-height: 140px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}







.dialog-content {
  padding: 16px 14px;
  color: #475569;
}

.close {
  border: none;
  background: transparent;
  color: var(--color-red-main);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
}
</style>
