<template>
  <Teleport to="body">
    <div v-if="state.visible" class="dialog-default dialog-overlay" :class="{ 'dialog-loading': statusLoading }"
      @click.self="dialogClick.close()">
      <!-- className：呼叫端可以掛自己的 class 只調整「這一個」彈窗的樣式，
           不必動到全域的 .btn-dialog（全專案 47 個 $dialog 呼叫點共用這支） -->
      <div class="dialog-container" :class="options?.className">
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
          <button class="btn-dialog btn-dialog-ok" type="button" @click="click.ok()">確認</button>
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
  /** 只想調整某一個彈窗時，由呼叫端掛 class（例如登出二次確認的 is-logout） */
  className?: string
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

  &:has(.dialog-container.is-admin) {
    background: color-mix(in srgb, #1c1c22 32%, transparent);
  }
}

.dialog-container {
  width: 100%;
  max-width: 320px;
  background: #fff;
  /* border: 1px solid #d1d5db; */
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
        /* width: 23px; */
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
    /* background: #f1f5f9; */
    /* border-top: 1px solid #d1d5db; */

    &.single-action {
      justify-content: center;
    }

    .btn-dialog {
      /* border: 1px solid var(--color-red-main); */
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

  /* ── 登出二次確認（呼叫端傳 className: 'is-logout'）──────────
     只有這一個彈窗把兩顆鈕的主次對調：取消變實心紅底、確認變白底外框。
     ⚠️ 這裡刻意與全域相反 —— 登出是破壞性動作，讓「取消」比較顯眼比較安全。
     ⚠️ 全域的 .btn-dialog / .btn-dialog-cancel 一個字都不能動：
        全專案 47 個 $dialog 呼叫點共用那支，改了會全部一起變。 */
  &.is-logout .dialog-footer {
    .btn-dialog-cancel {
      background: var(--color-red-main);
      color: #fff;
    }

    .btn-dialog-ok {
      border: 1px solid var(--color-red-main);
      background: #fff;
      color: var(--color-red-main);
    }
  }

  /* ── 後台 admin 主題（呼叫端傳 className: 'is-admin' 或 'is-admin is-admin-logout'）──
     黑白編輯風，token 對齊 app/assets/style/themes/admin/_admin.scss；Teleport 到 body 故在此自帶變數。 */
  &.is-admin {
    --admin-ink: #1c1c22;
    --admin-paper: #ffffff;
    --admin-line: color-mix(in srgb, #1c1c22 14%, #ffffff);
    --admin-muted: color-mix(in srgb, #1c1c22 58%, #ffffff);
    --admin-wash: color-mix(in srgb, #1c1c22 4%, #ffffff);

    max-width: 360px;
    border: 1px solid var(--admin-line);
    border-radius: 2px;
    box-shadow: 0 8px 24px color-mix(in srgb, #1c1c22 12%, transparent);
    background: var(--admin-paper);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Noto Sans TC', sans-serif;

    .header {
      background: var(--admin-ink);
      border-bottom: 1px solid color-mix(in srgb, #ffffff 14%, #1c1c22);
      padding: 10px 14px;

      .title {
        color: var(--admin-paper);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
    }

    .close {
      color: color-mix(in srgb, #ffffff 72%, #1c1c22);

      &:hover {
        color: var(--admin-paper);
      }
    }

    .dialog-content {
      color: color-mix(in srgb, #1c1c22 72%, #ffffff);
      font-size: 13.5px;
      line-height: 1.75;
      padding: 18px 14px;
    }

    .dialog-footer {
      padding: 12px 14px 16px;
      justify-content: flex-end;
      gap: 8px;

      .btn-dialog {
        border-radius: 2px;
        height: 34px;
        padding: 0 16px;
        font-size: 12.5px;
        font-weight: 600;
        min-width: 72px;
        border: none;
        transition: background 0.12s;
      }

      .btn-dialog-cancel {
        border: 1px solid var(--admin-line);
        background: transparent;
        color: var(--admin-ink);

        &:hover {
          background: var(--admin-wash);
        }
      }

      .btn-dialog-ok {
        background: var(--admin-ink);
        color: var(--admin-paper);

        &:hover {
          background: color-mix(in srgb, #1c1c22 82%, #ffffff);
        }
      }
    }

    /* 登出二次確認：取消（留在後台）用實心主色、確認登出改為外框，降低誤觸風險 */
    &.is-admin-logout .dialog-footer {
      .btn-dialog-cancel {
        border: none;
        background: var(--admin-ink);
        color: var(--admin-paper);

        &:hover {
          background: color-mix(in srgb, #1c1c22 82%, #ffffff);
        }
      }

      .btn-dialog-ok {
        border: 1px solid var(--admin-line);
        background: transparent;
        color: var(--admin-ink);

        &:hover {
          background: var(--admin-wash);
        }
      }
    }
  }

  /* ── 彩運來／柑仔店主題（呼叫端傳 className: 'is-dlt'）──────────
     Teleport 到 body，脫離 .theme-taiwan-lottery 的 DOM 範圍，
     taiwan_lottery.scss 那組 --color-* 變數在這裡吃不到，所以顏色直接寫死 hex
     （跟 is-admin 的做法一樣），字體則沿用 taiwan_lottery.scss 已全域載入的
     Caprasimo／Noto Serif TC 字型檔（@import 是真的載入字型，不受 DOM 範圍限制）。 */
  &.is-dlt {
    max-width: 340px;
    border: 2px solid #8c491a;
    border-radius: 0.5rem;
    box-shadow: 0 12px 28px rgba(46, 43, 37, 0.22);
    background: #f9f4ed;

    .header {
      background: #2e2b25;
      border-bottom: none;
      padding: 10px 14px;

      .title {
        color: #f5ead8;
        font-family: 'Caprasimo', 'Noto Serif TC', serif;
        font-weight: 900;
        font-size: 16px;
      }
    }

    .close {
      color: rgba(245, 234, 216, 0.75);

      &:hover {
        color: #f5ead8;
      }
    }

    .dialog-content {
      color: #474238;
      font-size: 14px;
      line-height: 1.7;
      padding: 18px 16px;
    }

    .dialog-footer {
      padding: 12px 16px 16px;

      .btn-dialog {
        border-radius: 0.25rem;
        font-weight: 700;
      }

      .btn-dialog-cancel {
        border: 1px solid #8c491a;
        background: #f9f4ed;
        color: #8c491a;
      }

      .btn-dialog-ok {
        background: #8c491a;
        color: #f9f4ed;
        border: 1px solid #8c491a;
      }
    }

    /* 登出二次確認（呼叫端傳 className: 'is-logout is-dlt'）：
       沿用 is-logout「取消變顯眼、確認變低調」的安全設計，只是換成柑仔店色票，
       避免直接吃到 is-logout 預設的 BG 紅色系跟這裡的暖色調打架。 */
    &.is-logout .dialog-footer {
      .btn-dialog-cancel {
        background: #8c491a;
        color: #f9f4ed;
      }

      .btn-dialog-ok {
        border: 1px solid #8c491a;
        background: #f9f4ed;
        color: #8c491a;
      }
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
