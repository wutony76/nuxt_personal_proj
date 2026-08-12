<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import K3Header from '~/components/lottery/bg/k3/block/Header.vue'
import K3Board from '~/components/lottery/bg/k3/base/K3Board.vue'
import CurrItems from '~/components/lottery/bg/k3/block/CurrItems.vue'
import Controls from '~/components/lottery/bg/k3/block/Controls.vue'
import Report from '~/components/lottery/bg/k3/block/Report.vue'
import History from '~/components/lottery/bg/k3/block/History.vue'
import DialogUser from '~/components/lottery/bg/k3/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/bg/k3/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/bg/k3/block/DialogRule.vue'
import { useK3 } from '~/composables/useK3'

/**
 * 快3 信用玩法（K3-CD）
 *
 * 注項一律讀 shared/config/k3cd 的設定檔（與 6hc-cd 同一套結構），
 * 賠率由 helpers 依該分頁 rtp 即時推算，畫面顯示與伺端鎖進注單的值一致。
 * 期別／倒數／開獎骰子／彩池與官方盤共用（server/services/k3Shared.ts）。
 */
const {
  state: mxState,
  wallet: mxWallet,
  pool: mxPool,
  playList,
  groupList,
  selectedCount,
  totalAmount,
  actions: mxActions,
  fetch: mxFetch
} = useK3()

const { $dialog } = useNuxtApp()
const state = reactive({ randomCount: 5 })

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const currentPlayName = computed(() =>
  playList.value.find((play) => play.key === mxState.select)?.name ?? ''
)

const click = {
  play: (playKey: string) => mxActions.setPlay(playKey),
  tab: (tabId: number) => mxActions.setTab(tabId),
  random: () => {
    const applied = mxActions.randomSelect(state.randomCount)
    if (applied === 0) $dialog.alert('目前分頁沒有可選注項')
  }
}

/** 三個彈窗由 LotteryBgBaseTop 的 USER / OPENCODE / RULE 觸發 */
const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await mxFetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await mxFetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

onMounted(async () => {
  mxActions.setMode('cd')
  await mxFetch.initPageData()
  await mxFetch.userRecordAll()
  mxFetch.startPolling()
})
onBeforeUnmount(() => mxFetch.stopPolling())
</script>

<template>
  <div class="base lottery-k3">
    <!-- 背景光點（同 6hc-cd） -->
    <div class="bg-fx">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>

    <LotteryBgBaseTop @open-user-dialog="dialogClick.openUser()"
      @open-opencode-dialog="dialogClick.openOpenCode()" @open-rule-dialog="dialogClick.openRule()" />

    <main class="main">
      <K3Header />

      <!-- 使用者資訊 + 開獎歷史 -->
      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp">
            <div class="user-title">{{ mxWallet.userName }}</div>
            <div class="row">F幣餘額<b class="is-coin">{{ money(mxWallet.coin) }}</b></div>
            <div class="row">當期已投注<b>{{ money(mxWallet.currentBets) }}</b></div>
            <div class="row">累計已投注<b>{{ money(mxWallet.totalBets) }}</b></div>
            <div class="row">共用彩池<b>{{ money(mxPool.distributable) }}</b></div>
            <div class="row">累積滾存<b>{{ money(mxPool.carry) }}</b></div>
            <p class="user-id">USER_ID: {{ mxWallet.userId }}</p>
          </div>
        </aside>
        <div class="info-main">
          <History />
        </div>
      </section>

      <!-- 投注區 -->
      <section class="play-warp">
        <div class="play-tabs">
          <button v-for="play in playList" :key="play.key" type="button" class="play-tab"
            :class="{ active: mxState.select === play.key }" @click="click.play(String(play.key))">
            {{ play.name }}
          </button>
          <NuxtLink to="/lottery/bg/k3-of" class="mode-link">切換官方玩法 →</NuxtLink>
        </div>

        <div class="tabs-warp">
          <div v-if="groupList.length > 1" class="bar-tabs">
            <button v-for="tab in groupList" :key="tab.tabId" type="button" class="bar-tabs-btn"
              :class="{ active: Number(mxState.selectTabId) === Number(tab.tabId) }"
              @click="click.tab(Number(tab.tabId))">
              {{ tab.tabName }}
            </button>
          </div>
          <span v-else class="bar-tabs" />

          <div class="auto-select">
            <span>隨機選號</span>
            <input type="number" min="1" class="count-input" v-model.number="state.randomCount" />
            <span>注</span>
            <button type="button" class="act-btn" @click="click.random()">機選</button>
            <button type="button" class="act-btn is-clear" @click="mxActions.clearSelect()">清空</button>
          </div>
        </div>

        <div class="selector-warp">
          <div class="selector">
            <div class="head">
              <span>[ {{ currentPlayName }} · {{ mxState.selectTabName }} ] 請選擇注項</span>
              <span>已選 {{ selectedCount }} 注 · 共 {{ money(totalAmount) }}</span>
            </div>
            <div class="body">
              <K3Board />
            </div>
          </div>
        </div>
      </section>

      <!-- 注單 + 投注面板 -->
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
.lottery-k3 {
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
      flex: 0 0 240px;

      .user-warp {
        height: 100%;
        border: 1px solid var(--color-red-700);
        border-radius: var(--base-radius);
        background: #fff;
        padding: 0.6rem 0.75rem;
        cursor: default;

        .user-title {
          margin-bottom: 6px;
          font-size: 15px;
          font-weight: 700;
          color: var(--color-red-main);
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          font-size: 12px;
          line-height: 1.9;
          color: var(--color-red-desc);

          b { font-weight: 700; color: var(--color-red-main); }
          b.is-coin { color: #15803d; }
        }

        .user-id {
          margin: 8px 0 0;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #b9a3a3;
        }
      }
    }

    .info-main {
      flex: 1 1 auto;
      min-width: 0;
    }
  }

  /* 投注區（對應 6hc-cd 的 .play-warp）*/
  .play-warp {
    position: relative;
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

      .play-tab {
        padding: 8px 20px;
        border: 1px solid var(--color-red-700);
        border-radius: 6px;
        background: #fff;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-red-main);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(.active) { background: #fff5f6; }
        &.active { border-color: var(--color-red-main); background: var(--color-red-main); color: #fff; }
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

    /* 注項面板：帶標題列的白框（同 6hc-cd 的 .selector-warp .right.selector）*/
    .selector-warp {
      margin-top: 10px;
      display: flex;
      flex: 1;
      min-height: 0;

      .selector {
        flex: 1;
        min-width: 0;
        border: 1px solid #fee2e2;
        border-radius: 6px;
        background: #fff;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        .head {
          height: 36px;
          flex-shrink: 0;
          border-bottom: 1px solid var(--color-red-bets);
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
    height: 460px;
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
