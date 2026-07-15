<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { use6hcCredit } from '~/composables/use6hcCredit'
import { actions } from '~/utils/common'

import TemaPlay from '~/components/lottery/bg/6hc/cd/Tema.vue'

import { useBgAutoActive } from '~/composables/useBgAutoActive'
import PlayTabs from '~/components/lottery/bg/6hc/cd/PlayTabs.vue'
import PlayPanel from '~/components/lottery/bg/6hc/cd/PlayPanel.vue'
import Header from '~/components/lottery/bg/6hc/cd/block/Header.vue'
import BarTabs from '~/components/lottery/bg/6hc/cd/base/BarTabs.vue'

const { user, isLoggedIn, init } = useAuth()
const route = useRoute()
const router = useRouter()
const use6hc = use6hcCredit()
const { fetch: mxFetch } = use6hc
const { activate, deactivate } = useBgAutoActive()

const state = reactive({
  entered: false,
  leaving: false,
})

const playMap = {
  TEMA: TemaPlay
}


const playList = computed(() => use6hc.playList.value || [])
const availableCodes = computed(() => use6hc.availableCodes.value || [])
const canSubmit = computed(() => Boolean(use6hc.canSubmit.value))
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
const currentPlay = computed(() => {
  const _key = (use6hc.state.select) as keyof typeof playMap
  return playMap[_key] ?? TemaPlay
})


const click = {
  // CD 尚無明細 Dialog，先重新拉取使用者資訊（餘額 / 投注）
  openUserDialog: async () => {
    await mxFetch.userInfo()
  },
  selectPlay: (playKey: string) => {
    if (!playKey || playKey === routePlayKey.value) return
    router.push(`/lottery/bg/6hc-cd/${playKey}`)
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
  const _userId = String(user.value?.id ?? '')
  await use6hc.init.startServerTimeSync()
  await mxFetch.initPageData(_userId)

  activate('6hc-cd')
  state.entered = true
})

onBeforeUnmount(() => {
  use6hc.init.stopServerTimeSync()
  deactivate()
})
</script>

<template>
  <div class="base lottery-6hc-cd" :class="{ 'is-leaving': state.leaving }">
    <div class="bg-fx" aria-hidden="true">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>
    <LotteryBgBaseTop />

    <main class="main">
      <!-- DRAW HEADER -->
      <Header />

      <!-- CONTENT LAYOUT -->
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
          <!-- TODO: CD 版 Road 走勢圖尚未實作 -->
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

    </main>
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
    margin: 0.8rem auto 1.8rem;
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
    animation: sec-in 0.55s ease both;
    animation-delay: 0.28s;

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
