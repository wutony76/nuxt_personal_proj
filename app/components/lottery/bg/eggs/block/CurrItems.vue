<script setup lang="ts">
import { computed } from 'vue'
import { useEggs, type EggsSelectItem } from '~/composables/useEggs'

/** 當前注項：已選注項列表，金額可直接改（PC蛋蛋只有信用盤，沒有官方盤那一分支） */
const { select: mxSelect, totalAmount, selectedCount, currentQuota: mxQuota, actions: mxActions } = useEggs()

const click = {
  /**
   * 逐項改金額
   * 輸入中不動 item.select —— 一旦改成 false，_syncSelectItems 會把這列從清單移除，
   * 使用者正在打的欄位就消失了。改成離開欄位（blur）時才夾回單注限額。
   */
  coinInput: (item: EggsSelectItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const digits = target.value.replace(/\D/g, '')
    const coin = Math.min(mxQuota.value.item.max, Math.trunc(Number(digits) || 0))
    item.coin = coin
    target.value = digits ? String(coin) : ''
    mxActions.syncSelectItems()
  },
  /** 離開欄位：夾回 [min, max]，不讓它留在 0（0 會讓整筆被伺端拒單） */
  coinBlur: (item: EggsSelectItem, event: Event) => {
    const target = event.target as HTMLInputElement
    const quota = mxQuota.value.item
    const coin = Math.min(quota.max, Math.max(quota.min, Math.trunc(Number(item.coin) || 0)))
    item.coin = coin
    target.value = String(coin)
    mxActions.syncSelectItems()
  }
}

const currCountLabel = computed(() => `${selectedCount.value} 注`)
</script>

<template>
  <section class="block-main eggs-curr">
    <div class="curr-head">
      <span class="curr-title">當前注項</span>
      <span class="curr-count">{{ currCountLabel }}</span>
    </div>

    <div class="curr-body">
      <table class="curr-table">
        <thead>
          <tr>
            <th class="c-code">投注號碼</th>
            <th class="c-odds">賠率</th>
            <th class="c-coin">金額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in mxSelect.items" :key="String(item.playId)">
            <td class="c-code">{{ item.name }}</td>
            <td class="c-odds">{{ item.odds }}</td>
            <td class="c-coin">
              <input type="number" min="0" :max="mxQuota.item.max" class="coin-input" :value="item.coin || ''"
                placeholder="0" @input="click.coinInput(item, $event)" @blur="click.coinBlur(item, $event)" />
            </td>
          </tr>
          <tr v-if="mxSelect.items.length === 0"><td colspan="3" class="c-empty">尚未選擇注項</td></tr>
        </tbody>
      </table>
    </div>

    <button v-if="mxSelect.items.length > 0" type="button" class="clear-btn" @click="mxActions.clearSelect()">
      清空
    </button>
  </section>
</template>

<style scoped lang="scss">
/* 卡片外框由全域 .lottery-eggs .block-main 提供，這裡只寫內容樣式（同 k3） */
.eggs-curr {
  height: 350px;
  display: flex;
  flex-direction: column;
  background: #fff;

  .curr-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;

    .curr-title { font-weight: 700; color: var(--color-red-main); }
    .curr-count { font-size: 12px; font-weight: 700; color: var(--color-red-main); }
  }

  .curr-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid var(--color-red-content);
    border-top: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #ffc6c6;
      border-radius: 999px;
    }

    &::-webkit-scrollbar-thumb {
      background: #f54c07;
      border-radius: 999px;
      border: 2px solid #ffc6c6;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #de4304;
    }
  }

  .curr-table {
    width: 100%;
    border-collapse: collapse;
    border: unset;
    font-size: 13px;

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      border-top: none;
      border-bottom: none;
      box-shadow:
        inset 0 1px 0 0 var(--color-red-content),
        inset 0 -1px 0 0 var(--color-red-content);
      padding: 4px 6px;
      background: #fff5f6;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-desc);
    }

    td {
      border-bottom: 1px dashed #f3d9dc;
      padding: 4px 6px;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .c-code {
      text-align: left;
      font-weight: 700;
      color: var(--color-red-main);
    }

    .c-odds {
      text-align: center;
      font-weight: 700;
      color: #d97706;
    }

    .c-coin {
      text-align: right;
      font-weight: 700;

      .coin-input {
        width: 100%;
        min-width: 0;
        height: 24px;
        border: 1px solid #f3b7bf;
        border-radius: 4px;
        background: #fff;
        padding: 0 4px;
        text-align: right;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-main);
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:focus {
          border-color: var(--color-red-main);
          box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
        }
      }
    }

    th.c-code,
    th.c-odds,
    th.c-coin {
      color: var(--color-red-desc);
    }

    .c-empty {
      text-align: center;
      color: var(--color-red-desc);
    }
  }

  .clear-btn {
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 8px;
    border: 1px solid var(--color-red-content);
    border-radius: 4px;
    background: #fff;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;

    &:hover { background: #fff1f2; }
  }
}
</style>
