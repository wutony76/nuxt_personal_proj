<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch, type Component } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { use6hcCredit } from '~/composables/use6hcCredit'
import { actions } from '~/utils/common'

import TemaPlay from '~/components/lottery/bg/6hc/cd/Tema.vue'
import ZhengmaPlay from '~/components/lottery/bg/6hc/cd/Zhengma.vue'
import ZhengmatePlay from '~/components/lottery/bg/6hc/cd/Zhengmate.vue'
import LianmaPlay from '~/components/lottery/bg/6hc/cd/Lianma.vue'
import QimaPlay from '~/components/lottery/bg/6hc/cd/Qima.vue'
import WuxingPlay from '~/components/lottery/bg/6hc/cd/Wuxing.vue'
import BanboPlay from '~/components/lottery/bg/6hc/cd/Banbo.vue'
import YixiaoPlay from '~/components/lottery/bg/6hc/cd/Yixiao.vue'
import TexiaoPlay from '~/components/lottery/bg/6hc/cd/Texiao.vue'
import HexiaoPlay from '~/components/lottery/bg/6hc/cd/Hexiao.vue'
import LianxiaoPlay from '~/components/lottery/bg/6hc/cd/Lianxiao.vue'
import WeishuPlay from '~/components/lottery/bg/6hc/cd/Weishu.vue'
import LianweiPlay from '~/components/lottery/bg/6hc/cd/Lianwei.vue'
import ZixuanbuzhongPlay from '~/components/lottery/bg/6hc/cd/Zixuanbuzhong.vue'
import DuoxuanzhongyiPlay from '~/components/lottery/bg/6hc/cd/Duoxuanzhongyi.vue'
import ZhengterenzhongPlay from '~/components/lottery/bg/6hc/cd/Zhengterenzhong.vue'
import IxiaolianPlay from '~/components/lottery/bg/6hc/cd/Ixiaolian.vue'
import WeishulianPlay from '~/components/lottery/bg/6hc/cd/Weishulian.vue'

import { useBgAutoActive } from '~/composables/useBgAutoActive'
import PlayTabs from '~/components/lottery/bg/6hc/cd/PlayTabs.vue'
import PlayPanel from '~/components/lottery/bg/6hc/cd/PlayPanel.vue'
import Header from '~/components/lottery/bg/6hc/cd/block/Header.vue'
import BarTabs from '~/components/lottery/bg/6hc/cd/base/BarTabs.vue'
import AutoSelect from '~/components/lottery/bg/6hc/cd/block/controls/AutoSelect.vue'
import Road from '~/components/lottery/bg/6hc/cd/block/Road.vue'
import IssueBlock from '~/components/lottery/bg/6hc/cd/block/record/Issue.vue'
import AnalyzeBlock from '~/components/lottery/bg/6hc/cd/block/Analyze.vue'
import DialogUser from '~/components/lottery/bg/6hc/cd/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/bg/6hc/cd/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/bg/6hc/cd/block/DialogRule.vue'
import Controls from '~/components/lottery/bg/6hc/cd/block/controls/Index.vue'
import CurrPlayItems from '~/components/lottery/bg/6hc/cd/block/controls/CurrPlayItems.vue'

const { user, isLoggedIn, init } = useAuth()
const route = useRoute()
const router = useRouter()
const use6hc = use6hcCredit()
const { fetch: mxFetch } = use6hc
const { activate, deactivate } = useBgAutoActive()
const { $dialog } = useNuxtApp()

const state = reactive({
  entered: false,
  leaving: false,
  showFloat: false, // 進場動畫跑完才顯示浮動投注鈕
  showControls: false, // 投注鈕開關：控制 Controls 面板顯示（進場動畫後才開）
  userDialogVisible: false, // 下注紀錄（餘額變動表 / 下注紀錄）
  openCodeDialogVisible: false, // 開獎歷史
  ruleDialogVisible: false, // 遊戲說明
})
let floatTimer: ReturnType<typeof setTimeout> | null = null

// key 對應 use6hc.state.select（= config 的玩法 key，小寫）
const playMap: Record<string, Component> = {
  tema: TemaPlay,
  zhengma: ZhengmaPlay,
  zhengmate: ZhengmatePlay,
  lianma: LianmaPlay,
  qima: QimaPlay,
  wuxing: WuxingPlay,
  banbo: BanboPlay,
  yixiao: YixiaoPlay,
  texiao: TexiaoPlay,
  hexiao: HexiaoPlay,
  lianxiao: LianxiaoPlay,
  weishu: WeishuPlay,
  lianwei: LianweiPlay,
  zixuanbuzhong: ZixuanbuzhongPlay,
  duoxuanzhongyi: DuoxuanzhongyiPlay,
  zhengterenzhong: ZhengterenzhongPlay,
  ixiaolian: IxiaolianPlay,
  weishulian: WeishulianPlay,
}


const playList = computed(() => use6hc.playList.value || [])
const availableCodes = computed(() => use6hc.availableCodes.value || [])
const playKeySet = computed(() => new Set(playList.value.map((item: any) => item.key)))
const routePlayKey = computed(() => String(route.params.play || '').toLowerCase())

const userInfo = computed(() => ({
  name: user.value?.name || 'USER',
  coin: Number(use6hc.wallet.coin ?? 0),
  currentBets: Number(use6hc.wallet.currentBets ?? 0),
  totalBets: Number(use6hc.wallet.totalBets ?? 0),
  analysis: String(use6hc.wallet.analysis ?? '-'),
  userId: user.value?.id || 'xxxxx',
}))
// 尚未實作看板的玩法（連碼 / 七碼…）先退回特碼看板，避免整片空白
const currentPlay = computed(() => playMap[String(use6hc.state.select)] ?? TemaPlay)
const selectedCount = computed(() => use6hc.state.selectedCodes.length)
// 有下注的期數：開獎歷史用來淡化未下注的期數
const betIssues = computed(() => use6hc.userRecord.betHistory.map((item) => item.issue))


const click = {
  // 下注紀錄（餘額變動表 / 下注紀錄 / 可領獎金）
  openUserDialog: async () => {
    state.userDialogVisible = true
    await Promise.all([mxFetch.userInfo(), mxFetch.userDialogRecord()])
  },
  closeUserDialog: () => {
    state.userDialogVisible = false
  },
  // 開獎歷史（同時取注單紀錄，用來淡化未下注的期數）
  openOpenCodeDialog: async () => {
    state.openCodeDialogVisible = true
    await Promise.all([mxFetch.openCodeHistory(), mxFetch.userDialogRecord()])
  },
  closeOpenCodeDialog: () => {
    state.openCodeDialogVisible = false
  },
  // 遊戲說明
  openRuleDialog: () => {
    state.ruleDialogVisible = true
  },
  closeRuleDialog: () => {
    state.ruleDialogVisible = false
  },
  claimOneIssue: async () => {
    const result = await mxFetch.claimOneIssue()
    $dialog.alert(result?.message || '領獎完成')
  },
  selectPlay: (playKey: string) => {
    if (!playKey || playKey === routePlayKey.value) return
    router.push(`/lottery/bg/6hc-cd/${playKey}`)
  },
  toggleControls: () => {
    state.showControls = !state.showControls
  },
}

const _actions = {
  syncPlayByRoute: async () => {
    if (playList.value.length === 0) return
    const target = routePlayKey.value
    if (!playKeySet.value.has(target)) {
      await router.replace('/lottery/bg/6hc-cd/tema')
      return
    }
    await use6hc.actions.fetchPlayByKey(target)
  },
}

watch(routePlayKey, async () => {
  await _actions.syncPlayByRoute()
})

onBeforeRouteLeave((_to, _from) => {
  if (!state.entered) return true
  state.leaving = true
  return new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(true), 380)
  })
})

onMounted(async () => {
  await init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  const _userId = String(user.value?.id ?? '')
  await use6hc.init.startServerTimeSync()
  await mxFetch.initPageData(_userId)
  // 首次載入依當前路由初始化玩法（設定 activePlay），watch 僅在路由變更時觸發
  await _actions.syncPlayByRoute()

  activate('6hc-cd')
  state.entered = true
  // 等頁面進場動畫（約 0.83s）結束後再顯示浮動投注鈕與 Controls 面板
  floatTimer = setTimeout(() => {
    state.showFloat = true
    state.showControls = true
  }, 900)
})

onBeforeUnmount(() => {
  use6hc.init.stopServerTimeSync()
  if (floatTimer) { clearTimeout(floatTimer); floatTimer = null }
  deactivate()
})
</script>

<template>
  <div class="base lottery-6hc-cd" :class="{ 'is-leaving': state.leaving }">
    <div class="bg-fx" aria-hidden="true">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>
    <LotteryBgBaseTop @open-user-dialog="click.openUserDialog()" @open-opencode-dialog="click.openOpenCodeDialog()"
      @open-rule-dialog="click.openRuleDialog()" />

    <main class="main">
      <!-- DRAW HEADER -->
      <Header @open-opencode-dialog="click.openOpenCodeDialog()" />

      <!-- CONTENT LAYOUT -->
      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp" @click="click.openUserDialog()">
            <div class="user-title"> {{ userInfo.name }} </div>
            <div class="user-content">
              <div class="row">
                F幣餘額: {{ actions.money(userInfo.coin) }}
                <button type="button" class="deposit-btn" @click.stop="click.openUserDialog()">明細</button>
              </div>
              <div class="row">當期已投注: {{ actions.thousands(userInfo.currentBets) }}</div>
              <div class="row">累計已投注: {{ actions.thousands(userInfo.totalBets) }}</div>
              <div class="row">投注百分比: {{ userInfo.analysis }}</div>
            </div>
            <p class="user-id">USER_ID: {{ userInfo.userId }}</p>
          </div>
        </aside>
        <div class="info-main">
          <Road />
        </div>
      </section>
      <section class="play-warp">
        <div class="play-tabs">
          <button v-for="play in playList" :key="play.key" type="button" class="play-tab"
            :class="{ active: play.key === use6hc.state.select }" @click="click.selectPlay(play.key)">
            {{ play.name }}
          </button>
        </div>

        <div class="tabs-warp">
          <BarTabs />
          <AutoSelect />
        </div>
        <div class="selector-warp">
          <!-- <div class="left">
            <div v-for="play in playList" :key="play.key"> {{ play.name }} </div>
          </div> -->
          <div class="right selector">
            <div class="head"> {{ `[ ${use6hc.state.selectTabName} ] 請選擇注項` }} </div>
            <component :is="currentPlay" />
          </div>
        </div>
      </section>
      <section class="record-warp">
        <IssueBlock />
        <AnalyzeBlock />
      </section>
    </main>

    <Teleport to="body">
      <Transition name="cd-float-btn">
        <div v-if="state.showFloat" class="cd-opening-float-wrap">
          <button class="cd-opening-float-btn" type="button" :class="{ active: state.showControls }"
            @click="click.toggleControls()" aria-label="開啟投注面板">
            <span class="cd-float-btn-text">投</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="controls-pop">
        <div v-if="state.showControls" class="cd-controls-float">
          <Controls />
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="curr-play-items">
        <div v-if="state.showControls && use6hc.select.show" class="cd-curr-items-float">
          <CurrPlayItems />
        </div>
      </Transition>
    </Teleport>

    <DialogUser :visible="state.userDialogVisible" :data="use6hc.userRecord" @close="click.closeUserDialog()"
      @claim="click.claimOneIssue()" />
    <DialogOpenCode :visible="state.openCodeDialogVisible" :data="use6hc.openCodeHistory" :bet-issues="betIssues"
      @close="click.closeOpenCodeDialog()" />
    <DialogRule :visible="state.ruleDialogVisible" @close="click.closeRuleDialog()" />
  </div>
</template>

<style lang="scss">
.lottery-6hc-cd {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  &.is-leaving {
    animation: cd-page-out 0.38s ease forwards;
    pointer-events: none;
  }

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
      animation: cd-orb-rise calc(7s + var(--i) * 0.6s) ease-in infinite;
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

  /* ── USER INFO ────────────────────────────────────────────── */
  .info-warp {
    display: flex;
    gap: 0.75rem;
    min-height: 200px;
    align-items: stretch;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.18s;

    .info-side {
      width: 22%;
    }

    .user-warp {
      min-height: 200px;
      height: 250px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid var(--color-red-700);
      border-radius: 6px;
      background: color-mix(in srgb, var(--color-red-main) 6%, #fff);
      animation: cd-card-glow 3.5s ease-in-out infinite;

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
      }

      .user-id {
        margin: 0;
        border-top: 1px solid #f6d9de;
        padding: 0.5rem 0.75rem;
        font-size: 12px;
        color: var(--color-red-desc);
      }
    }

    .info-main {
      width: 100%;
      min-height: 100%;
      flex: 1;
      display: flex;
    }
  }

  /* ── PLAY TABS ────────────────────────────────────────────── */
  .play-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.24s;

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

      &:hover:not(.active) {
        background: #fff5f6;
      }

      &.active {
        background: var(--color-red-main);
        border-color: var(--color-red-main);
        color: #fff;
      }
    }
  }

  /* ── PLAY AREA ────────────────────────────────────────────── */
  .play-warp {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 500px;
    margin-top: 1.9rem;

    border: 1px solid var(--color-red-700);
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
    box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
    /* 原本寫 sec-in（定義在 6hc-of 頁），直接進入本頁時該 keyframes 不存在 → 沒有進場動畫 */
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.28s;

    /* 分頁（左）與隨機選號（右）同一列 */
    .tabs-warp {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .selector-warp {
      display: flex;
      flex: 1;
      min-height: 0;

      .left {
        width: 200px;
        flex-shrink: 0;
        background: #7f1d1d;
      }

      .right {
        flex: 1;
        min-width: 0;

        background: #fff;
        border: 1px solid #fee2e2;
        /* border-radius: 0px 6px 6px 0px; */
        border-radius: 6px;
        /* border-top: unset; */
        /* border-left: unset; */
        overflow: hidden;
        display: flex;
        flex-direction: column;

        .head {
          height: 36px;
          background: var(--color-red-bets);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--color-red-bets);
          padding: 0 12px;
          font-size: 13px;
          font-weight: 600;
        }
      }
    }

    .play-tabs {
      position: absolute;
      top: -30px;
      gap: 3px;

      .play-tab {
        height: 30px;
        padding: 0 13px;
        // padding-left: 15px;
        display: inline-flex;
        align-items: center;
        border-radius: 9px 13px 0 0;

        &.active {
          position: relative;
          border: 1px solid var(--color-red-bets);
          background: var(--color-red-bets);
          color: var(--color-yellow-text);

          /* 前方（左側）黃條 */
          &::before {
            content: '';
            position: absolute;
            left: 5px;
            top: 0;
            bottom: 0;
            width: 3px;
            /* background: var(--color-yellow-text); */
            background: #c9a227;
            border-radius: 13px 0 0 0;
          }
        }
      }
    }

  }

  /* ── RECORD（當期注單 60% / 注號分析 40%） ─────────────────── */
  .record-warp {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
    /* 高度由「注號分析」的號碼檢視決定：49 顆球排 5 列（每列 = 球 2.5rem + 下方統計數字）
       需要 357px，加上角度 tab、標題列（上下各 15px 邊距）與上方號碼推薦面板後為 580px。
       當期注單與注號分析同在這個 flex 列裡，故兩者高度自動對齊。
       ⚠️ 動到 .analyze-issue-bets 的 header 邊距或球尺寸就要同步調這個值，
          否則第 5 列會被 .record-analyze 的 overflow: hidden 裁掉。 */
    height: 580px;
    // margin-top: 0.75rem;
    gap: 0.75rem;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.38s;
  }

  /* ── LAYOUT ───────────────────────────────────────────────── */
  .cd-layout {
    display: grid;
    grid-template-columns: 230px 1fr;
    gap: 0.75rem;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.18s;
  }

  /* ── MEMBER CARD ──────────────────────────────────────────── */
  .member-card {
    border: 1px solid var(--color-red-700, #b91c1c);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-red-main, #dc2626) 6%, #fff);
    overflow: hidden;
    animation: cd-card-glow 3.5s ease-in-out infinite;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #7f1d1d 0%, #c9a227 50%, #7f1d1d 100%);
    }
  }

  .member-head {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #f6d9de;
    padding: 0.5rem 0.75rem;

    &__name {
      font-family: 'cwTeXKai', 'Noto Serif TC', serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-red-main, #dc2626);
      letter-spacing: 0.04em;
    }

    &__tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.22em;
      color: #7f1d1d;
      background: linear-gradient(90deg, rgba(201, 162, 39, 0.15), rgba(245, 208, 96, 0.2));
      border: 1px solid rgba(201, 162, 39, 0.5);
      border-radius: 3px;
      padding: 1px 5px;
    }
  }

  .member-body {
    padding: 0.65rem 0.8rem;
    display: grid;
    gap: 0.5rem;

    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;

      .label {
        color: var(--color-red-desc, #a94452);
      }

      strong {
        color: var(--color-red-main, #dc2626);
        font-weight: 700;
      }

      .accent {
        color: #b91c1c;
        font-weight: 700;
      }
    }
  }

  .member-id {
    border-top: 1px solid #f6d9de;
    padding: 0.5rem 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--color-red-desc, #a94452);
    letter-spacing: 0.04em;
  }

  /* ── PLAY AREA ────────────────────────────────────────────── */
  .content-main {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.28s;
  }

  .state-block {
    color: var(--color-red-desc, #a94452);
    font-weight: 700;
    padding: 0.8rem;
    border: 1px solid #fee2e2;
    border-radius: 6px;
    background: #fff;

    &.error {
      color: #b91c1c;
    }
  }

  @media (max-width: 1080px) {
    .cd-layout {
      grid-template-columns: 1fr;
    }
  }
}

/* ── FLOAT CONTROLS（浮動固定在投注鈕上方） ─────────────────── */
.cd-controls-float {
  position: fixed;
  right: 5.3rem;
  // bottom: 9rem;
  bottom: 3rem;
  z-index: 200;
  transform-origin: bottom right;
}

/* Controls 開關過場 */
.controls-pop-enter-active,
.controls-pop-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.controls-pop-enter-from,
.controls-pop-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

/* ── 當前注項（浮動在 Controls 面板正上方，同寬對齊） ─────────── */
.cd-curr-items-float {
  position: fixed;
  right: 5.3rem;
  /* 3rem（Controls 底距）+ Controls 面板高度 + 間距 */
  bottom: calc(3rem + 106px);
  width: 570px;
  max-height: 40vh;
  z-index: 200;
  transform-origin: bottom right;
}

/* 當前注項 開關過場 */
.curr-play-items-enter-active,
.curr-play-items-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.curr-play-items-enter-from,
.curr-play-items-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

/* ── FLOAT SUBMIT BUTTON ────────────────────────────────────── */
/* 本頁 style 為全域（Teleport 到 body 需要），class / keyframes 一律加 cd- 前綴，
   避免與 6hc-of 頁同名全域樣式互相覆蓋（of → cd 導覽時按鈕會被拉到畫面中間） */
.cd-opening-float-wrap {
  position: fixed;
  right: 1.25rem;
  bottom: 6.5rem;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.cd-opening-float-btn {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(145deg, #b91c1c 0%, #dc2626 45%, #d97706 100%);
  border: 2.5px solid #fbbf24;
  box-shadow: 0 4px 18px rgba(185, 28, 28, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  animation: cd-float-btn-sway 0.7s ease-in-out infinite;
  transition: box-shadow 0.2s;

  &:hover:not(:disabled) {
    animation: none;
    transform: scale(1.12);
    box-shadow: 0 6px 28px rgba(185, 28, 28, 0.65), 0 0 0 6px rgba(251, 191, 36, 0.2);
  }

  &:active:not(:disabled) {
    transform: scale(0.93);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: none;
  }

  /* 面板開啟中：停搖擺、微放大、加光暈 */
  &.active {
    animation: none;
    transform: scale(1.06);
    box-shadow: 0 6px 22px rgba(185, 28, 28, 0.6), 0 0 0 5px rgba(251, 191, 36, 0.28);
  }

  .cd-float-btn-text {
    font-size: 50px;
    font-weight: 900;
    color: #fff;
    -webkit-text-stroke: 3px var(--color-red-main);
    paint-order: stroke fill;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    line-height: 1;
    letter-spacing: -0.02em;
    pointer-events: none;
  }
}

@keyframes cd-float-btn-sway {

  0%,
  100% {
    transform: rotate(-18deg);
  }

  50% {
    transform: rotate(18deg);
  }
}

.cd-float-btn-enter-active {
  animation: cd-float-btn-slide-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cd-float-btn-leave-active {
  animation: cd-float-btn-slide-out 0.3s ease-in forwards;
}

@keyframes cd-float-btn-slide-in {
  0% {
    opacity: 0;
    transform: translateX(90px) scale(0.4);
  }

  60% {
    transform: translateX(-10px) scale(1.1);
    opacity: 1;
  }

  80% {
    transform: translateX(5px) scale(0.95);
  }

  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes cd-float-btn-slide-out {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateX(90px) scale(0.4);
  }
}

/* ── KEYFRAMES ──────────────────────────────────────────────── */
@keyframes cd-sec-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes cd-page-out {
  to {
    opacity: 0;
    transform: scale(0.97) translateY(-8px);
  }
}

@keyframes cd-card-glow {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
  }

  50% {
    box-shadow: 0 0 14px 3px rgba(185, 28, 28, 0.15);
  }
}

@keyframes cd-orb-rise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }

  8% {
    opacity: 0.55;
  }

  88% {
    opacity: 0.2;
  }

  100% {
    opacity: 0;
    transform: translateY(-100vh) scale(0.6);
  }
}
</style>
