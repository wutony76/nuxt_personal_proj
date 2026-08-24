<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import Pl3Header from '~/components/lottery/bg/pl3/block/Header.vue'
import Pl3Board from '~/components/lottery/bg/pl3/base/Board.vue'
import CurrItems from '~/components/lottery/bg/pl3/block/CurrItems.vue'
import Controls from '~/components/lottery/bg/pl3/block/Controls.vue'
import Report from '~/components/lottery/bg/pl3/block/Report.vue'
import History from '~/components/lottery/bg/pl3/block/History.vue'
import Road from '~/components/lottery/bg/pl3/block/Road.vue'
import DialogUser from '~/components/lottery/bg/pl3/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/bg/pl3/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/bg/pl3/block/DialogRule.vue'
import { usePl3 } from '~/composables/usePl3'
import { useAuth } from '~/composables/useAuth'
import { useBgAutoActive } from '~/composables/useBgAutoActive'

/**
 * 排列3官方玩法
 *
 * 注項一律讀 shared/config/pl3of 的設定檔，賠率由 helpers 依該分頁 rtp 即時推算，
 * 畫面顯示與伺端鎖進注單的值一致。
 * ⚠️ 與 EGGS 同款單頁骨架（無盤口切換），但 pl3 沒有彩池／爆池，也沒有選號彩池玩法，
 *    比 EGGS 更單純——版面拿掉獎金框與彩池選號分頁。
 */
const {
  state: mxState,
  wallet: mxWallet,
  playList,
  groupList,
  selectedCount,
  totalAmount,
  actions: mxActions,
  fetch: mxFetch
} = usePl3()

const router = useRouter()
const { isLoggedIn, init: authInit } = useAuth()
const { activate: activateAutoPanel, deactivate: deactivateAutoPanel } = useBgAutoActive()
const state = reactive({ randomCount: 5 })

const { $dialog } = useNuxtApp()
const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')
const currentPlayName = computed(() =>
  playList.value.find((play) => play.key === mxState.play)?.name ?? ''
)

const click = {
  play: (playKey: string) => mxActions.setPlay(playKey),
  tab: (tabId: number) => mxActions.setTab(tabId),
  random: () => {
    const applied = mxActions.randomSelect(state.randomCount)
    if (applied === 0) $dialog.alert('目前分頁沒有可選注項')
  },
  clear: () => mxActions.clearBoard()
}

/** 三個彈窗由 LotteryBgBaseTop 的 USER / OPENCODE / RULE 觸發 */
const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await mxFetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await mxFetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

onMounted(async () => {
  await authInit()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  activateAutoPanel('pl3')
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
  <div class="base lottery-pl3">
    <!-- 背景光點（同 eggs） -->
    <div class="bg-fx">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>

    <LotteryBgBaseTop @open-user-dialog="dialogClick.openUser()" @open-opencode-dialog="dialogClick.openOpenCode()"
      @open-rule-dialog="dialogClick.openRule()" />

    <main class="main">
      <Pl3Header @open-opencode-dialog="dialogClick.openOpenCode()" />

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
        <!-- 玩法（左）／隨機選號（右）同一列 -->
        <div class="play-tabs">
          <button v-for="play in playList" :key="play.key" type="button" class="play-tab"
            :class="{ active: mxState.play === play.key }" @click="click.play(String(play.key))">
            {{ play.name }}
          </button>

          <div class="auto-select">
            <span>隨機選號</span>
            <input type="number" min="1" class="count-input" v-model.number="state.randomCount" />
            <span>注</span>
            <button type="button" class="act-btn" @click="click.random()">機選</button>
            <button type="button" class="act-btn is-clear" @click="click.clear()">清空</button>
          </div>
        </div>

        <!-- 分頁列：只有一個分頁時整列不渲染（否則留 10px 空白） -->
        <div v-if="groupList.length > 1" class="tabs-warp">
          <div class="bar-tabs">
            <button v-for="tab in groupList" :key="tab.tabId" type="button" class="bar-tabs-btn"
              :class="{ active: Number(mxState.tabId) === Number(tab.tabId) }"
              @click="click.tab(Number(tab.tabId))">
              {{ tab.tabName }}
            </button>
          </div>
        </div>

        <!-- 注項盤（左）＋ 當前注項／投注金額（右）同一列 -->
        <div class="selector-warp">
          <div class="selector">
            <div class="head">
              <span>[ {{ currentPlayName }} · {{ mxState.tabName }} ] 請選擇注項</span>
              <span>已選 {{ selectedCount }} 注 · 共 {{ money(totalAmount) }}</span>
            </div>
            <div class="body">
              <Pl3Board />
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
/* ── 版面骨架：與 eggs 同一套（容器寬度、卡片邊框陰影、進場動畫）───────── */
.lottery-pl3 {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

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
      animation: pl3-orb-rise calc(7s + var(--i) * 0.6s) ease-in infinite;
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
    animation: pl3-sec-in 0.55s ease both;
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
        animation: pl3-card-glow 3.5s ease-in-out infinite;

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

      .pl3-road {
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
    animation: pl3-sec-in 0.55s ease both;
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
    animation: pl3-sec-in 0.55s ease both;
    animation-delay: 0.38s;

    .record-main {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
    }
  }
}

@keyframes pl3-card-glow {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
  }

  50% {
    box-shadow: 0 0 14px 3px rgba(185, 28, 28, 0.18);
  }
}

@keyframes pl3-sec-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes pl3-orb-rise {
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
