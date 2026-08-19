<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import X5Header from '~/components/lottery/bg/11x5/block/Header.vue'
import X5Board from '~/components/lottery/bg/11x5/of/base/Board.vue'
import CurrItems from '~/components/lottery/bg/11x5/block/CurrItems.vue'
import Controls from '~/components/lottery/bg/11x5/block/Controls.vue'
import Report from '~/components/lottery/bg/11x5/block/Report.vue'
import History from '~/components/lottery/bg/11x5/block/History.vue'
import Road from '~/components/lottery/bg/11x5/block/Road.vue'
import DialogUser from '~/components/lottery/bg/11x5/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/bg/11x5/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/bg/11x5/block/DialogRule.vue'
import { useX5 } from '~/composables/useX5'
import { useAuth } from '~/composables/useAuth'
import { useBgAutoActive } from '~/composables/useBgAutoActive'

/**
 * 11選5 官方玩法（X5-OF）
 *
 * 版面與 11x5-cd 同一套，只有投注區換成官方盤看板（of/base/Board.vue）。
 * 注碼一律讀 shared/config/x5of 的設定檔：8 個玩法、54 個分頁、四種選號型態
 * （單選／單式／複式展開／膽拖）全部由 config 決定，這一頁不寫死任何玩法。
 * 期別／倒數／開獎號／彩池與信用盤共用（server/services/game/lottery/bg/x5Shared.ts）。
 *
 * ⚠️ 「後三直選」的兩個分頁吃共用彩池、依命中位數分層派彩，其餘 52 個分頁是固定賠率 ——
 *    看板會自己依 combo.pool 切換顯示，這一頁不需要分流。
 */
const {
  of: mxOf,
  wallet: mxWallet,
  ofPlayList,
  ofTabList,
  ofSelectedCount,
  ofTotalAmount,
  ofAutoMaxCount,
  actions: mxActions,
  fetch: mxFetch
} = useX5()

const { $dialog } = useNuxtApp()
const router = useRouter()
const { isLoggedIn, init: authInit } = useAuth()
/** 下方的自動下注／CHAT 面板由 app.vue 的 BgAutoPanel 統一渲染（同 k3 / pk10-cd） */
const { activate: activateAutoPanel, deactivate: deactivateAutoPanel } = useBgAutoActive()
const state = reactive({ randomCount: 5 })

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const currentPlayName = computed(() =>
  ofPlayList.value.find((play) => play.key === mxOf.play)?.name ?? ''
)

const click = {
  play: (playKey: string) => mxActions.setOfPlay(playKey),
  tab: (tabId: number) => mxActions.setOfTab(tabId),
  /** 機選：count 是「目標注數」；展開型分頁不見得剛好等於這個數（注數是乘積／組合數） */
  random: () => {
    const applied = mxActions.randomOfSelect(state.randomCount)
    if (applied === 0) $dialog.alert('此分頁無法自動選號，請確認注數上限')
  }
}

/** 三個彈窗由 LotteryBgBaseTop 的 USER / OPENCODE / RULE 觸發 */
const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await mxFetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await mxFetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

/**
 * 未登入處理：與 pk10-cd / k3 / 6hc 一致 —— 先 await useAuth().init() 確認登入狀態，
 * 沒登入就 router.replace('/login') 並中止後續初始化。
 * ⚠️ 一定要中止（return）：initPageData／userRecordAll 都會打需要登入的 API，
 *    沒攔住會先噴一串 401 才跳頁。
 */
onMounted(async () => {
  await authInit()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  mxActions.setMode('of')
  activateAutoPanel('x5-of')
  await mxFetch.initPageData()
  await mxFetch.userRecordAll()
  mxFetch.startPolling()
})
onBeforeUnmount(() => {
  mxFetch.stopPolling()
  deactivateAutoPanel()
})
</script>

<template>
  <div class="base lottery-x5 is-of">
    <!-- 背景光點（同 pk10-cd / k3-cd） -->
    <div class="bg-fx">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>

    <LotteryBgBaseTop @open-user-dialog="dialogClick.openUser()" @open-opencode-dialog="dialogClick.openOpenCode()"
      @open-rule-dialog="dialogClick.openRule()" />

    <main class="main">
      <X5Header @open-opencode-dialog="dialogClick.openOpenCode()" />

      <!-- 使用者資訊 + 開獎歷史 -->
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
          <Road />
        </div>
      </section>

      <!-- 投注區 -->
      <section class="play-warp">
        <!-- 玩法（左）／隨機選號＋切換盤口（右）同一列 -->
        <div class="play-tabs">
          <button v-for="play in ofPlayList" :key="play.key" type="button" class="play-tab"
            :class="{ active: mxOf.play === play.key }" @click="click.play(String(play.key))">
            {{ play.name }}
          </button>

          <div class="auto-select">
            <span>隨機選號</span>
            <input type="number" min="1" :max="ofAutoMaxCount || 1" class="count-input"
              v-model.number="state.randomCount" />
            <span>注</span>
            <button type="button" class="act-btn" @click="click.random()">機選</button>
            <button type="button" class="act-btn is-clear" @click="mxActions.clearOf()">清空</button>
          </div>

          <NuxtLink to="/lottery/bg/11x5-cd" class="mode-link">切換信用玩法 →</NuxtLink>
        </div>

        <!-- 分頁列：只有一個分頁時整列不渲染（否則留 10px 空白） -->
        <div v-if="ofTabList.length > 1" class="tabs-warp">
          <div class="bar-tabs">
            <button v-for="tab in ofTabList" :key="tab.tabId" type="button" class="bar-tabs-btn"
              :class="{ active: Number(mxOf.tabId) === Number(tab.tabId) }"
              @click="click.tab(Number(tab.tabId))">
              {{ tab.tabName }}
            </button>
          </div>
        </div>

        <!-- 注項盤（左）＋ 當前注項／投注金額（右）同一列 -->
        <div class="selector-warp">
          <div class="selector">
            <div class="head">
              <span>[ {{ currentPlayName }} · {{ mxOf.tabName }} ] 請選擇注碼</span>
              <span>已選 {{ ofSelectedCount }} 注 · 共 {{ money(ofTotalAmount) }}</span>
            </div>
            <div class="body">
              <X5Board />
            </div>
          </div>
          <aside class="selector-side">
            <CurrItems />
            <Controls />
          </aside>
        </div>
      </section>

      <!-- 注單 -->
      <section class="record-warp">
        <div class="record-main">
          <Report />
        </div>
      </section>
    </main>

    <DialogUser :visible="dialog.user" @close="dialog.user = false" />
    <DialogOpenCode :visible="dialog.openCode" @close="dialog.openCode = false" />
    <DialogRule :visible="dialog.rule" @close="dialog.rule = false" />
  </div>
</template>

<style lang="scss">
/* ── 版面骨架：與 pk10-cd 同一套（容器寬度、卡片邊框陰影、進場動畫）───────── */
/* ⚠️ 本頁 <style> 沒有 scoped，選擇器多帶一個 .is-of 用來隔開另一個盤口 ——
   11x5-cd 與 11x5-of 共用 .lottery-x5 根 class，NuxtLink 會預抓對面那頁的 CSS 並注入，
   兩頁同名規則（例如 .mode-link）就會互相覆蓋。 */
.lottery-x5.is-of {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  /* 背景上升光點（同 pk10-cd 的 .bg-fx，keyframes 另立 x5- 前綴避免依賴他頁） */
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
      animation: x5-orb-rise calc(7s + var(--i) * 0.6s) ease-in infinite;
      animation-delay: calc(var(--i) * -1.1s);
      opacity: 0;
      will-change: transform, opacity;
    }
  }

  >.main {
    position: relative;
    z-index: 1;
    width: min(1360px, 97%);
    margin: 0.8rem auto 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* 使用者資訊 + 開獎歷史 */
  .info-warp {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
    animation: x5-sec-in 0.55s ease both;
    animation-delay: 0.18s;

    .info-side {
      width: 22%;

      .user-warp {
        height: 225px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--color-red-700);
        border-radius: 6px;
        background: color-mix(in srgb, var(--color-red-main) 6%, #fff);
        cursor: pointer;
        animation: x5-card-glow 3.5s ease-in-out infinite;

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

            b {
              font-weight: 700;
              color: var(--color-red-main);
            }

            b.is-coin {
              color: #15803d;
            }
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
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      gap: 0.75rem;

      .x5-road {
        flex: 1 1 auto;
      }
    }
  }

  /* 投注區 */
  .play-warp {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border: 1px solid var(--color-red-700);
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
    box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
    animation: x5-sec-in 0.55s ease both;
    animation-delay: 0.28s;

    .play-tabs {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

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
        font-size: 12px;
        font-weight: 700;
        color: var(--color-red-desc);
        text-decoration: none;

        &:hover {
          color: var(--color-red-main);
        }
      }
    }

    .auto-select {
      margin-left: auto;
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

        &:focus {
          border-color: var(--color-red-main);
        }
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

        &.is-clear {
          background: #fff;
          color: var(--color-red-main);
        }
      }
    }

    .tabs-warp {
      margin-top: 10px;
      display: flex;
      align-items: center;
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

          &.active {
            border-color: var(--color-red-main);
            background: var(--color-red-main);
            color: #fff;
          }
        }
      }
    }

    .selector-warp {
      margin-top: 12px;
      display: flex;
      gap: 12px;
      min-height: 300px;

      .selector {
        flex: 1 1 auto;
        min-width: 0;
        border: 1px solid #fee2e2;
        border-radius: 6px;
        background: #fff;
        display: flex;
        flex-direction: column;

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

        .body {
          padding: 0.75rem;
        }
      }

      .selector-side {
        flex: 0 0 300px;
        width: 300px;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
    }
  }

  /* 注單 */
  .record-warp {
    display: flex;
    gap: 0.75rem;
    min-height: 0;
    height: 380px;
    animation: x5-sec-in 0.55s ease both;
    animation-delay: 0.38s;

    .record-main {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
    }
  }
}

@keyframes x5-card-glow {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
  }

  50% {
    box-shadow: 0 0 14px 3px rgba(185, 28, 28, 0.18);
  }
}

@keyframes x5-sec-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes x5-orb-rise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }

  8% {
    opacity: 0.55;
  }

  100% {
    opacity: 0;
    transform: translateY(-105vh) scale(1.35);
  }
}
</style>
