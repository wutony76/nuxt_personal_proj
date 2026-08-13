<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import K3Header from '~/components/lottery/bg/k3/block/Header.vue'
import OfPicker from '~/components/lottery/bg/k3/block/OfPicker.vue'
import CurrItems from '~/components/lottery/bg/k3/block/CurrItems.vue'
import Controls from '~/components/lottery/bg/k3/block/Controls.vue'
import Report from '~/components/lottery/bg/k3/block/Report.vue'
import History from '~/components/lottery/bg/k3/block/History.vue'
import DialogUser from '~/components/lottery/bg/k3/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/bg/k3/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/bg/k3/block/DialogRule.vue'
import { useK3 } from '~/composables/useK3'

/**
 * 快3 官方玩法（K3-OF）
 *
 * 一注 = 選 3 個點數（可重複），依命中顆數分層從共用彩池分配。
 * 期別／倒數／開獎骰子／彩池與信用盤共用（server/services/k3Shared.ts），
 * 所以兩個頁面看到的同一期骰子必然一致。
 * 版面骨架與 6hc-cd 一致（容器寬度、卡片邊框陰影、進場動畫）。
 */
const {
  state: mxState,
  wallet: mxWallet,
  pool: mxPool,
  ofPicked,
  actions: mxActions,
  fetch: mxFetch
} = useK3()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

/** 三個彈窗由 LotteryBgBaseTop 的 USER / OPENCODE / RULE 觸發 */
const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await mxFetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await mxFetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

onMounted(async () => {
  mxActions.setMode('of')
  // 官方盤限額（伺端 K3_OF_QUOTA）與信用盤不同，切過來要把金額夾回區間
  mxState.amount = Math.min(5000, Math.max(10, Math.trunc(Number(mxState.amount) || 0)))
  await mxFetch.initPageData()
  await mxFetch.userRecordAll()
  mxFetch.startPolling()
})
onBeforeUnmount(() => mxFetch.stopPolling())
</script>

<template>
  <div class="base lottery-k3 is-of">
    <div class="bg-fx">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>

    <LotteryBgBaseTop @open-user-dialog="dialogClick.openUser()"
      @open-opencode-dialog="dialogClick.openOpenCode()" @open-rule-dialog="dialogClick.openRule()" />

    <main class="main">
      <K3Header @open-opencode-dialog="dialogClick.openOpenCode()" />

      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp" @click="dialogClick.openUser()">
            <div class="user-title">{{ mxWallet.userName }}</div>
            <div class="user-content">
              <div class="row">
                <span>F幣餘額: <b class="is-coin">{{ money(mxWallet.coin) }}</b></span>
                <button type="button" class="deposit-btn" @click.stop="dialogClick.openUser()">明細</button>
              </div>
              <div class="row"><span>當期已投注:</span><b>{{ money(mxWallet.currentBets) }}</b></div>
              <div class="row"><span>累計已投注:</span><b>{{ money(mxWallet.totalBets) }}</b></div>
            </div>
            <p class="user-id">USER_ID: {{ mxWallet.userId }}</p>
          </div>
        </aside>
        <div class="info-main">
          <History />
        </div>
      </section>

      <section class="play-warp">
        <div class="play-tabs">
          <span class="play-tab active">選號（3 顆點數）</span>
          <NuxtLink to="/lottery/bg/k3-cd" class="mode-link">切換信用玩法 →</NuxtLink>
        </div>

        <div class="selector-warp">
          <div class="selector">
            <div class="head">
              <span>[ 官方玩法 · 獎池分層 ] 請選 3 個點數</span>
              <span>{{ ofPicked ? '已選滿' : '未選滿' }}</span>
            </div>
            <div class="body">
              <OfPicker />
            </div>
          </div>
        </div>
      </section>

      <section class="record-warp">
        <div class="record-main">
          <Report />
        </div>
        <aside class="record-side">
          <CurrItems />
          <Controls />
        </aside>
      </section>
    </main>

    <DialogUser :visible="dialog.user" @close="dialog.user = false" />
    <DialogOpenCode :visible="dialog.openCode" @close="dialog.openCode = false" />
    <DialogRule :visible="dialog.rule" @close="dialog.rule = false" />
  </div>
</template>

<style lang="scss">
/* ── 版面骨架：與 6hc-cd 同一套（容器寬度、卡片邊框陰影、進場動畫）───────── */
/* ⚠️ 本頁 <style> 沒有 scoped，選擇器多帶一個 .is-of 用來隔開另一個盤口 ——
   k3-cd 與 k3-of 共用 .lottery-k3 根 class，NuxtLink 會預抓對面那頁的 CSS 並注入，
   兩頁同名規則（例如 .mode-link）就會互相覆蓋。 */
.lottery-k3.is-of {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  /* 背景上升光點（同 6hc-cd 的 .bg-fx，keyframes 另立 k3- 前綴避免依賴他頁） */
  .bg-fx {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;

    .orb {
      position: absolute;
      left: calc(var(--i) * 11.5% - 2%);
      bottom: -30px;
      width: calc(8px + var(--i) * 2px);
      height: calc(8px + var(--i) * 2px);
      border-radius: 50%;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(185, 28, 28, 0.2) 100%);
      animation: k3-orb-rise calc(7s + var(--i) * 0.6s) ease-in infinite;
      animation-delay: calc(var(--i) * -1.1s);
      opacity: 0;
      will-change: transform, opacity;
    }
  }

  > .main {
    position: relative;
    z-index: 1;
    width: min(1360px, 97%);
    margin: 0.8rem auto 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* 使用者資訊 + 開獎歷史（對應 6hc-cd 的 .info-warp）*/
  .info-warp {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
    animation: k3-sec-in 0.55s ease both;
    animation-delay: 0.18s;

    .info-side {
      /* 寬度與 6hc-of／6hc-cd 一致：同樣的 22%（三個盤口的 .main 都是 1240px → 273px）。
         不用 flex 固定值，才能跟 6hc 一樣隨容器縮放。 */
      width: 22%;

      /* 樣式參照 6hc-of 的 .user-warp（app/pages/lottery/bg/6hc-of.vue）：
         固定 250px 高的卡片 → 置中標題列（52px）／內容區吃剩餘高度／底部 USER_ID，
         淡紅底 + 呼吸光暈。差異：K3 側欄寬 240px（6hc-of 是 22%），
         且數值仍用 <b> 標粗、F幣餘額維持綠色。 */
      .user-warp {
        /* 固定 225px（6hc-of 是 250px，它的路珠剛好那麼高）。
           刻意不用 height: 100% —— 不跟同列的開獎歷史拉齊，各自維持自己的高度。 */
        height: 225px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--color-red-700);
        border-radius: 6px;
        background: color-mix(in srgb, var(--color-red-main) 6%, #fff);
        cursor: pointer;
        animation: k3-card-glow 3.5s ease-in-out infinite;

        .user-title {
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #f6d9de;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-red-main);
        }

        .user-content {
          flex: 1;
          display: grid;
          padding: 0.75rem;
          font-size: 13px;
          color: var(--color-red-desc);

          .row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;

            b { font-weight: 700; color: var(--color-red-main); }
            b.is-coin { color: #15803d; }
          }
        }

        .deposit-btn {
          border: 1px solid #f2b7c1;
          border-radius: 0.25rem;
          background: #fff;
          padding: 0.25rem 0.5rem;
          font-size: 12px;
          font-weight: 700;
          color: var(--color-red-main);
          cursor: pointer;
        }

        .user-id {
          margin: 0;
          border-top: 1px solid #f6d9de;
          padding: 0.5rem 0.75rem;
          font-size: 12px;
          color: var(--color-red-desc);
        }
      }
    }

    .info-main {
      /* flex-basis 給 0（同 6hc-of 的 flex: 1）——
         basis auto 時開獎歷史的內容寬度會去擠 .info-side，22% 會被壓成 111px */
      flex: 1 1 0;
      min-width: 0;
    }
  }

  /* 投注區（對應 6hc-cd 的 .play-warp）*/
  .play-warp {
    position: relative;
    /* ⚠️ animation 會讓本區自成堆疊脈絡，裡面賠率明細浮層的 z-index: 30 出不去，
       同為 .main flex 子項的 .record-warp（DOM 在後、也有 animation）就會蓋住它。
       這裡把整區疊在注單區之上，浮層才能完整顯示。 */
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border: 1px solid var(--color-red-700);
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
    box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
    animation: k3-sec-in 0.55s ease both;
    animation-delay: 0.28s;

    .play-tabs {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      /* 與 6hc-of 的 .bar-tabs-btn 一致
         （app/components/lottery/bg/6hc/of/base/BarTabs.vue）*/
      .play-tab {
        border: 1px solid #f3b7bf;
        border-radius: 0.25rem;
        background: #fff5f6;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--color-red-main);
        cursor: pointer;

        &.active {
          background: var(--color-red-main);
          color: #fff;
          border-color: var(--color-red-main);
        }
      }

      .mode-link {
        margin-left: auto;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-desc);
        text-decoration: none;

        &:hover { color: var(--color-red-main); }
      }
    }

    /* 分頁（左）與隨機選號（右）同一列 —— 同 6hc-cd 的 .tabs-warp */
    .tabs-warp {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;

      .bar-tabs {
        display: inline-flex;
        gap: 4px;

        .bar-tabs-btn {
          border: 1px solid var(--color-red-content);
          border-radius: 4px;
          background: #fff;
          padding: 3px 12px;
          font-size: 13px;
          font-weight: 700;
          color: var(--color-red-main);
          cursor: pointer;

          &.active { border-color: var(--color-red-main); background: var(--color-red-main); color: #fff; }
        }
      }

      .auto-select {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--color-red-desc);

        .count-input {
          width: 3.4rem;
          border: 1px solid var(--color-red-content);
          border-radius: 4px;
          padding: 3px 6px;
          text-align: right;
          font-size: 13px;
          color: var(--color-red-main);
          outline: none;

          &:focus { border-color: var(--color-red-main); }
        }

        .act-btn {
          border: 1px solid var(--color-red-main);
          border-radius: 4px;
          background: var(--color-red-main);
          padding: 3px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;

          &.is-clear { background: #fff; color: var(--color-red-main); }
        }
      }
    }

    /* 注項面板：外層容器與 6hc-of 的 .selector-warp 一致
       （app/components/lottery/bg/6hc/of/Single.vue）——
       display: flex + gap 12px + min-height 300px；
       margin-top 用 12px 對齊 6hc-of 那邊由父層 .single 的 gap: 12px 產生的間距。
       裡層 .selector（帶標題列的白框）是 K3 自己的，沿用 6hc-cd 的做法。 */
    .selector-warp {
      margin-top: 12px;
      display: flex;
      gap: 12px;
      min-height: 300px;

      .selector {
        flex: 1;
        min-width: 0;
        border: 1px solid #fee2e2;
        border-radius: 6px;
        background: #fff;
        display: flex;
        flex-direction: column;
        /* ⚠️ 不能用 overflow: hidden —— 群組標題的賠率明細浮層（點數 16 項）
           會被裁掉。圓角改由 .head 自己切上緣兩角。 */

        .head {
          height: 36px;
          flex-shrink: 0;
          border-bottom: 1px solid var(--color-red-bets);
          border-radius: 6px 6px 0 0;
          background: var(--color-red-bets);
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }

        .body { padding: 0.75rem; }
      }
    }
  }

  /* 注單 + 側欄（對應 6hc-cd 的 .record-warp）*/
  .record-warp {
    display: flex;
    gap: 0.75rem;
    min-height: 0;
    /* 高度與 6hc-cd 的 .record-warp 一致（那邊是 580px） */
    height: 580px;
    animation: k3-sec-in 0.55s ease both;
    animation-delay: 0.38s;

    .record-main {
      flex: 1 1 62%;
      min-width: 0;
      display: flex;
    }

    .record-side {
      flex: 0 0 34%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
  }
}

@keyframes k3-card-glow {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
  }

  50% {
    box-shadow: 0 0 14px 3px rgba(185, 28, 28, 0.18);
  }
}

@keyframes k3-sec-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: none; }
}

@keyframes k3-orb-rise {
  0% { opacity: 0; transform: translateY(0) scale(1); }
  8% { opacity: 0.55; }
  100% { opacity: 0; transform: translateY(-105vh) scale(1.35); }
}
</style>
