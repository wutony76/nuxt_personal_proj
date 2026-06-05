<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { LOTTERY, GET_CONT, GAME_6HC_OF, STATUS_TIME } from '~/config/constants'
import { useAuth } from '~/composables/useAuth'
import { actions } from '~/utils/common'

// import { provide6hcOfficial } from '~/composables/use6hcOfficial'
import SinglePlay from '~/components/lottery/bg/6hc/of/Single.vue'
import DuplexPlay from '~/components/lottery/bg/6hc/of/Duplex.vue'
import DantuoPlay from '~/components/lottery/bg/6hc/of/Dantuo.vue'
import NumberPlay from '~/components/lottery/bg/6hc/of/Number.vue'
import Header from '~/components/lottery/bg/6hc/of/block/Header.vue'
import Road from '~/components/lottery/bg/6hc/of/block/Road.vue'
import DialogUser from '~/components/lottery/bg/6hc/of/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/bg/6hc/of/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/bg/6hc/of/block/DialogRule.vue'
import BarTabs from '~/components/lottery/bg/6hc/of/base/BarTabs.vue'
import IssueBlock from '~/components/lottery/bg/6hc/of/block/record/Issue.vue'
import AnalyzeBlock from '~/components/lottery/bg/6hc/of/block/record/Analyze.vue'
import { useBgAutoActive } from '~/composables/useBgAutoActive'

const use6hc = use6hcOfficial()
const { fetch: mxFetch } = use6hc
const router = useRouter()
const { user, isLoggedIn, init } = useAuth()
const { activate, deactivate } = useBgAutoActive()
const { $dialog } = useNuxtApp()
const state = reactive({
  lotteryId: LOTTERY['LHC-OF'].id,
  lotteryInfo: GET_CONT.lotteryById(LOTTERY['LHC-OF'].id),
  userDialogVisible: false,
  openCodeDialogVisible: false,
  ruleDialogVisible: false,
  entered: false,
  leaving: false,
})

const playMap = {
  SINGLE: SinglePlay,
  DUPLEX: DuplexPlay,
  DANTUO: DantuoPlay,
  NUMBER: NumberPlay
}

const currentPlay = computed(() => {
  const _key = (use6hc.state.status || GAME_6HC_OF.SINGLE.key) as keyof typeof playMap
  return playMap[_key] ?? SinglePlay
})

const userInfo = computed(() => {
  console.log('TTT2.UI userInfo.user', user.value)
  // console.log('TTT2.UI userInfo.user', userInfo.value)
  return {
    name: user.value?.name || 'USER',
    coin: Number(use6hc.wallet.coin ?? 0),
    currentBets: Number(use6hc.wallet.currentBets ?? 0),
    totalBets: Number(use6hc.wallet.totalBets ?? 0),
    analysis: String(use6hc.wallet.analysis ?? '-'),
    userId: user.value?.id || 'xxxxx'
  }
})

const userDialogData = computed(() => use6hc.userRecord)
const openCodeDialogData = computed(() => use6hc.openCodeHistory)

const headerAnchorRef = ref<HTMLElement | null>(null)

const showFloatingBtn = computed(() => {
  const status = String(use6hc.current.runtime?.currentStatus ?? '')
  return status !== '' && status !== STATUS_TIME.OPEN
})

const floatingBtnLabel = computed(() => {
  const status = String(use6hc.current.runtime?.currentStatus ?? '')
  if (status === STATUS_TIME.OPENING) return '開獎中...'
  if (status === STATUS_TIME.OPENED) return '當期開獎號'
  return '當期開獎號'
})

function scrollToHeader() {
  if (!headerAnchorRef.value) return
  const top = headerAnchorRef.value.getBoundingClientRect().top + window.scrollY - 20
  window.scrollTo({ top, behavior: 'smooth' })
}

const click = {
  openUserDialog: async () => {
    state.userDialogVisible = true
    await mxFetch.userDialogRecord()
  },
  openOpenCodeDialog: async () => {
    state.openCodeDialogVisible = true
    await Promise.all([mxFetch.openCodeHistory(), mxFetch.userDialogRecord()])
  },
  closeUserDialog: () => {
    state.userDialogVisible = false
  },
  closeOpenCodeDialog: () => {
    state.openCodeDialogVisible = false
  },
  openRuleDialog: () => {
    state.ruleDialogVisible = true
  },
  closeRuleDialog: () => {
    state.ruleDialogVisible = false
  },
  claimOneIssue: async () => {
    const result = await mxFetch.claimOneIssue()
    $dialog.alert(result?.message || '領獎完成')
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (!state.entered) { next(); return }
  state.leaving = true
  setTimeout(() => next(), 380)
})

onMounted(async () => {
  await init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  const userId = String(user.value?.id ?? '')
  await use6hc.init.startServerTimeSync()
  await mxFetch.initPageData(userId)
  activate('6hc-of')
  state.entered = true
})

onBeforeUnmount(() => {
  mxFetch.stopOrderDetailSync()
  deactivate()
})

</script>

<template>
  <div class="base lottery-6hc-of" :class="{ 'is-leaving': state.leaving }">
    <div class="bg-fx" aria-hidden="true">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`"></span>
    </div>
    <LotteryBgBaseTop @open-user-dialog="click.openUserDialog()" @open-opencode-dialog="click.openOpenCodeDialog()"
      @open-rule-dialog="click.openRuleDialog()" />
    <main class="main">
      <div ref="headerAnchorRef">
        <Header :lottery-info="state.lotteryInfo" @open-opencode-dialog="click.openOpenCodeDialog()" />
      </div>
      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp" @click="click.openUserDialog()">
            <div class="user-title"> {{ userInfo.name }} </div>
            <div class="user-content">
              <div class="row">
                F幣餘額: {{ actions.thousands(userInfo.coin) }}
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
        <BarTabs />
        <component :is="currentPlay" />
      </section>
      <section class="record-warp">
        <IssueBlock />
        <AnalyzeBlock />
      </section>
    </main>
    <Transition name="float-btn">
      <div v-if="showFloatingBtn" class="opening-float-wrap">
        <button class="opening-float-btn" type="button" @click="scrollToHeader" aria-label="前往開獎">
          <span class="float-btn-text">獎</span>
        </button>
        <p v-if="floatingBtnLabel" class="opening-float-label">{{ floatingBtnLabel }}</p>
      </div>
    </Transition>

    <DialogUser :visible="state.userDialogVisible" :data="userDialogData" @close="click.closeUserDialog()"
      @claim="click.claimOneIssue()" />
    <DialogOpenCode :visible="state.openCodeDialogVisible" :data="openCodeDialogData"
      :betIssues="userDialogData.betHistory.map(b => b.issue)" @close="click.closeOpenCodeDialog()" />
    <DialogRule :visible="state.ruleDialogVisible" @close="click.closeRuleDialog()" />
  </div>
</template>

<style lang="scss">
.lottery-6hc-of {
  // font-family: 'Noto Serif TC', serif;
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  >.main {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-bottom: 0;

    >div {
      animation: sec-in 0.55s ease both;
      animation-delay: 0.08s;
    }
  }

  .info-warp {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.75rem;
    min-height: 200px;
    align-items: stretch;
    animation: sec-in 0.55s ease both;
    animation-delay: 0.18s;
  }

  .info-side {
    width: 22%;
  }

  .user-warp {
    min-height: 200px;
    // height: 100%;
    height: 250px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--color-red-700);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-red-main) 6%, #fff);
    animation: card-glow 3.5s ease-in-out infinite;
  }

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
    // gap: 0.5rem;
    padding: 0.75rem;
    font-size: 13px;
    color: var(--color-red-desc);

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
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

  .info-main {
    width: 100%;
    min-height: 100%;
    flex: 1;
    display: flex;
  }


  .play-warp {
    margin-top: 0.75rem;
    border: 1px solid var(--color-red-700);
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
    box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
    animation: sec-in 0.55s ease both;
    animation-delay: 0.28s;
  }


  .record-warp {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
    height: 500px;
    margin-top: 0.75rem;
    gap: 0.75rem;
    animation: sec-in 0.55s ease both;
    animation-delay: 0.38s;
  }


  .user-dialog-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .user-dialog {
    width: min(1100px, 96vw);
    max-height: 88vh;
    overflow: auto;
    background: #fff;
    border-radius: 8px;
    // border: 1px solid var(--color-red-700);
    border: 4px solid var(--color-red-black-btn);
    padding: 0.75rem;
  }

  .user-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-red-main);
  }

  .user-dialog-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    // margin-bottom: 0.75rem;
    margin-bottom: 10px;
    flex-wrap: wrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-red-desc);

    .claim-btn {
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

  .user-dialog-loading,
  .user-dialog-error {
    padding: 0.75rem;
    font-weight: 700;
  }

  .user-dialog-body {
    display: grid;
    gap: 10px;
  }

  .dialog-block {
    border: 1px solid var(--color-red-700);
    border-radius: 6px;
    padding: 0.6rem;

    h4 {
      margin: 0 0 0.5rem;
      color: var(--color-red-main);
    }

    .dialog-table-wrap {
      max-height: 280px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-red-desc) #e8e6e6;
    }

    .dialog-report-table {
      width: 100%;
      table-layout: fixed;

      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
      }

      .no-records {
        height: 150px;
        // min-height: 120px;
        color: var(--color-red-desc);
      }
    }
  }

  &.is-leaving {
    animation: page-out 0.38s ease forwards;
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
      background: radial-gradient(circle, rgba(251, 191, 36, 0.55) 0%, rgba(185, 28, 28, 0.25) 100%);
      animation: orb-rise calc(7s + var(--i) * 0.6s) ease-in infinite;
      animation-delay: calc(var(--i) * -1.1s);
      opacity: 0;
      will-change: transform, opacity;
    }
  }
}

.opening-float-wrap {
  position: fixed;
  right: 1.25rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 6px; */
}

.opening-float-btn {
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
  animation: float-btn-sway 0.7s ease-in-out infinite;
  transition: box-shadow 0.2s;

  &:hover {
    animation: none;
    transform: scale(1.12);
    box-shadow: 0 6px 28px rgba(185, 28, 28, 0.65), 0 0 0 6px rgba(251, 191, 36, 0.2);
  }

  &:active {
    transform: scale(0.93);
  }

  .float-btn-text {
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

.opening-float-label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-red-main);
  /* text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6); */
  white-space: nowrap;
  letter-spacing: 0.03em;
}

@keyframes float-btn-sway {

  0%,
  100% {
    transform: rotate(-18deg);
  }

  50% {
    transform: rotate(18deg);
  }
}

.float-btn-enter-active {
  animation: float-btn-slide-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.float-btn-leave-active {
  animation: float-btn-slide-out 0.3s ease-in forwards;
}

@keyframes float-btn-slide-in {
  0% {
    opacity: 0;
    transform: translateY(-50%) translateX(90px) scale(0.4);
  }

  60% {
    transform: translateY(-50%) translateX(-10px) scale(1.1);
    opacity: 1;
  }

  80% {
    transform: translateY(-50%) translateX(5px) scale(0.95);
  }

  100% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

@keyframes float-btn-slide-out {
  0% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-50%) translateX(90px) scale(0.4);
  }
}

@keyframes sec-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes page-out {
  to {
    opacity: 0;
    transform: scale(0.97) translateY(-8px);
  }
}

@keyframes card-glow {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
  }

  50% {
    box-shadow: 0 0 14px 3px rgba(185, 28, 28, 0.18);
  }
}

@keyframes orb-rise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }

  8% {
    opacity: 0.65;
  }

  88% {
    opacity: 0.25;
  }

  100% {
    opacity: 0;
    transform: translateY(-100vh) scale(0.6);
  }
}
</style>