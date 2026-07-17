<script setup lang="ts">
import { computed } from 'vue'
import { actions } from '~/utils/common'
import { LHC_COLORS } from '#shared/config/6hc-cd'
import { use6hcCredit } from '~/composables/use6hcCredit'

type BetItem = { playId?: string | number; name: string | number; coin?: string | number }
const { state: mxState, select: mxSelect } = use6hcCredit()
const items = computed<BetItem[]>(() => (mxSelect.items ?? []) as BetItem[])
const totalCoin = computed(() => {
  if (mxState.select === 'tema') return items.value.length
  else return items.value.length || 0
})

const _handlers = {
  isNumber: (name: string | number) => /^\d+$/.test(String(name)),
  // 依號碼 / 波色文字推得色系（red / blue / green / yellow / ''）
  colorOf: (name: string | number) => {
    const s = String(name)
    if (/^\d+$/.test(s)) {
      const n = s.padStart(2, '0')
      if ((LHC_COLORS.red as readonly string[]).includes(n)) return 'red'
      if ((LHC_COLORS.blue as readonly string[]).includes(n)) return 'blue'
      if ((LHC_COLORS.green as readonly string[]).includes(n)) return 'green'
      return 'yellow'
    }
    if (s.includes('紅')) return 'red'
    if (s.includes('藍')) return 'blue'
    if (s.includes('綠')) return 'green'
    return ''
  },
}

const click = {
  toggle: () => {
    mxSelect.show = !mxSelect.show
  },
  // 直接輸入金額：保留原始輸入字串（不重格式化避免跳動），並同步 selectedCodes（同 Tema）
  onCoinInput: (item: BetItem, event: Event) => {
    const key = String(item.playId)
    const raw = (event.target as HTMLInputElement).value
    item.coin = raw
    const num = Math.max(0, Math.floor(Number(raw) || 0))
    if (num > 0) {
      if (!mxState.selectedCodes.includes(key)) mxState.selectedCodes = [...mxState.selectedCodes, key]
    } else {
      mxState.selectedCodes = mxState.selectedCodes.filter((code) => code !== key)
    }
  },
}
</script>

<template>
  <div class="block-curr-bets-wrap">
    <div class="block-curr-bets-title">
      <span>
        {{ `${mxState.select} [${mxState.selectTabName}]` }}
      </span>
      <span class="block-curr-bets-title-text"> 當前注項 </span>
    </div>
    <div class="group-list">
      <table class="report-table curr-bets-table">
        <colgroup>
          <col class="col-bet" />
          <col class="col-coin" />
        </colgroup>
        <thead>
          <tr>
            <th class="col-bet">投注號碼</th>
            <th class="col-coin">金額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in items" :key="item.playId ?? idx">
            <td class="col-bet">
              <span class="option" :class="[
                _handlers.isNumber(item.name) ? 'is-ball' : 'is-pill',
                _handlers.colorOf(item.name) ? `c-${_handlers.colorOf(item.name)}` : '',
              ]">
                {{ item.name }}
              </span>
            </td>
            <td class="col-coin">
              <input type="number" min="0" class="coin-input" :value="item.coin ?? 0" @click.stop
                @input="click.onCoinInput(item, $event)" />
            </td>
          </tr>
          <tr v-if="!items.length" class="tr-no-records">
            <td colspan="2" class="no-records">尚未選擇注項</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">注數：{{ actions.thousands(totalCoin) }}</div>
  </div>
</template>

<style scoped lang="scss">
.block-curr-bets-wrap {
  position: relative;
  width: 100%;
  min-height: 120px;
  max-height: 40vh;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #fff6f7 100%);
  padding: 10px 12px;
  border: 2px solid #7f1d1d;
  border-radius: 6px;
  box-shadow: 0 10px 28px rgba(127, 29, 29, 0.2), 0 2px 6px rgba(127, 29, 29, 0.1);
  display: flex;
  flex-direction: column;

  /* 頂部漸層飾條（同 .controls-wrap::before） */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: linear-gradient(90deg, #7f1d1d 0%, #c9a227 50%, #7f1d1d 100%);
  }

  .block-curr-bets-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-red-desc);
    // cursor: pointer;

    .block-curr-bets-title-text {
      font-size: 13px;
      font-weight: 800;
      color: var(--color-red-main);
    }
  }

  /* 參照 6hc-of .group-list：可捲動 + 自訂捲軸 */
  .group-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: scroll;
    overflow-x: hidden;
    /* 外框畫在捲動容器（固定不動），避免 sticky 表頭捲動時上下框跟著消失 */
    border: 1px solid var(--color-red-content);
    scrollbar-width: thin;
    scrollbar-color: var(--color-red-desc) #e8e6e6;

    &::-webkit-scrollbar {
      width: 8px;
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

  /* 參照 6hc-of .report-table（該樣式綁在 .lottery-6hc-of 下，CD 無法沿用，這裡自帶一份） */
  .report-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;

    td,
    th {
      height: 34px;
      border-right: 1px solid var(--color-red-content);
      border-bottom: 1px solid var(--color-red-content);
      padding: 0 4px;
      text-align: center;
      vertical-align: middle;
      font-size: 12px;

      &:last-child {
        border-right: none;
      }
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      height: 34px;
      background: color-mix(in srgb, var(--color-red-main) 8%, #fff);
      color: var(--color-red-desc);
      font-weight: 700;
      /* sticky 時 border 會被捲走，底線改用 inset 陰影；頂線交給容器外框，避免疊成雙線 */
      border-bottom: none;
      box-shadow: inset 0 -1px 0 0 var(--color-red-content);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .col-coin {
      width: 55%;
    }

    /* 投注號碼：與 .selector-warp（Tema）的 .option 號碼球 / 膠囊一致 */
    .option {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      background: #fff;
      color: var(--color-red-desc);

      &.is-ball {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 0.16rem solid var(--6hcOf-ball-yellow);
        font-size: 13px;
        color: #000;
      }

      &.is-pill {
        min-width: 46px;
        height: 24px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid var(--color-red-700);
        font-size: 13px;
        color: var(--color-red-main);
      }

      &.c-red {
        border-color: var(--6hcOf-ball-red);

        &.is-pill {
          color: var(--6hcOf-ball-red);
        }
      }

      &.c-blue {
        border-color: var(--6hcOf-ball-blue);

        &.is-pill {
          color: var(--6hcOf-ball-blue);
        }
      }

      &.c-green {
        border-color: var(--6hcOf-ball-green);

        &.is-pill {
          color: var(--6hcOf-ball-green);
        }
      }

      &.c-yellow {
        border-color: var(--6hcOf-ball-yellow);

        &.is-pill {
          color: var(--6hcOf-ball-yellow);
        }
      }
    }

    /* 金額 input（參照 Tema td-amount input） */
    .coin-input {
      width: 100%;
      height: 26px;
      border: 1px solid #f3b7bf;
      border-radius: 4px;
      background: #fff;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      outline: none;
      cursor: text;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:focus {
        border-color: var(--color-red-main);
        box-shadow: 0 0 0 2px rgba(213, 63, 83, 0.12);
      }
    }

    .tr-no-records .no-records {
      min-height: 80px;
      color: var(--color-red-desc);
      vertical-align: middle;
    }
  }

  /* 彙總 footer（樣式與 6hc-of ReportIssueBets .footer 一致） */
  .footer {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.65rem;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-red-desc);
    text-align: right;
    background: color-mix(in srgb, var(--color-red-main) 8%, #fff);
    border: 1px solid var(--color-red-content);
    border-top: unset;
  }
}
</style>
