<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { GET_CONT } from '../config/constants'
import { useRouter } from 'vue-router'
import type { LobbyItem } from '../types/lottery'

useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=cwTeXKai&family=JetBrains+Mono:wght@400;500&family=Bebas+Neue&display=swap',
    },
  ],
})

const CHINESE_NUMS = ['壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖', '拾']

const GAME_META: Record<string, { en: string; ribbon: string; desc: string }> = {
  '6HC': { en: 'LHC', ribbon: 'BG · 49 取 7', desc: '凡局開時不問名，\n自有規章定分明。\n一念無私循序轉，\n萬機皆在信中行。' },
}

const router = useRouter()

const ROUTE_DICT: Record<string, string> = {
  '6HC-CD': '/lottery/bg/6hc-cd',
  '6HC-OF': '/lottery/bg/6hc-of',
}

const state = reactive({
  list: [] as LobbyItem[],
  leaving: false,
})

const _handlers = {
  enterDelay: (base: number, idx: number, step = 0.12) => `${base + idx * step}s`,
}

const init = () => {
  state.list = GET_CONT.lotteryAll()
}

const click = {
  start: async (key: string) => {
    if (state.leaving) return
    const target = ROUTE_DICT[key]
    if (!target) return
    state.leaving = true
    await new Promise<void>(resolve => setTimeout(resolve, 500))
    router.push(target)
  },
}

onMounted(() => {
  init()
})
</script>

<template>
  <main class="hall-stage" :class="{ 'is-leaving': state.leaving }">
    <!-- TOP BAR -->
    <header class="hall-top">
      <div class="hall-top__inner">
        <div class="hall-top__left">
          <NuxtLink to="/" class="hall-top__home mono">← HOME</NuxtLink>
          <div class="hall-top__brand">
            <span class="bebas hall-top__year">2026</span>
            <span class="mono hall-top__sub">DRAGON </span>
          </div>
        </div>
        <div class="hall-top__right">
          <div class="bebas hall-top__title">LOTTERY HALL</div>
          <span class="mono hall-top__sub">OFFICIAL × CREDIT · 2026</span>
        </div>
      </div>
    </header>

    <!-- HERO -->
    <section class="hall-hero">
      <div class="hall-hero__particles">
        <span v-for="i in 10" :key="i" class="hall-hero__particle" />
      </div>
      <div class="hall-hero__inner">
        <div class="hall-hero__text">
          <div class="hall-hero__zh">彩 票 大 廳</div>
          <div class="hall-hero__line" />
          <div class="mono hall-hero__en">LOTTERY · HALL · ALL GAMES · 2026</div>
          <div class="mono hall-hero__tagline">凡 局 皆 成 勢 · 萬 數 自 歸 平</div>
        </div>
        <div class="hall-hero__icons">
          <div v-for="(item, idx) in state.list" :key="item.key" class="hall-hero__icon"
            :style="`--enter-delay: ${_handlers.enterDelay(0.55, idx, 0.15)}`">
            <div class="brush hall-hero__dot">{{ item.name.charAt(0) }}</div>
            <div class="hall-hero__icon-txt">
              <b class="brush">{{ item.name }}</b>
              <span class="mono">{{ GAME_META[item.key]?.en || item.key }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- BRUSH DIVIDER -->
    <div class="brush-div">
      <div class="brush-div__inner">
        <span class="mono">∕ 01</span>
        <span class="brush">選 局 入 場</span>
        <span class="mono">CHOOSE · YOUR · GAME</span>
      </div>
    </div>

    <!-- GAMES BAND -->
    <section class="games-band">
      <div class="games-band__head">
        <div class="brush games-band__lt">選 局 入 場</div>
        <div class="games-band__ct">
          <h2 class="bebas">CHOOSE <span class="gold">×</span> GAME</h2>
          <div class="mono games-band__sub">官 方 · 信 用 · 兩 式 同 局</div>
        </div>
        <div class="mono games-band__rt">
          即時派彩 ≤ 0.4s<br>
          ONLINE · {{ state.list.length * 2 }} MODES
        </div>
      </div>

      <div class="games-grid">
        <div v-for="(item, idx) in state.list" :key="item.key" class="gc"
          :style="`--enter-delay: ${_handlers.enterDelay(1.05, idx, 0.14)}`">
          <div class="brush gc__big-num">{{ CHINESE_NUMS[idx] || '' }}</div>
          <div class="mono gc__meta">L · {{ String(idx + 1).padStart(2, '0') }} / {{ item.key }}</div>
          <h3 class="brush gc__name">{{ item.name }}</h3>
          <div class="bebas gc__en">{{ GAME_META[item.key]?.en || item.key }}</div>
          <span class="mono gc__ribbon">{{ GAME_META[item.key]?.ribbon || '' }}</span>
          <p class="gc__desc">{{ GAME_META[item.key]?.desc || '' }}</p>
          <div class="gc__modes">
            <button class="gc__mode gc__mode--of" type="button" @click="click.start(`${item.key}-OF`)">
              <span class="brush gc__mode-label">官 方</span>
              <span class="mono gc__mode-tag">OFFICIAL · MODE</span>
            </button>
            <button class="gc__mode gc__mode--cd" type="button" @click="click.start(`${item.key}-CD`)">
              <span class="brush gc__mode-label">信 用</span>
              <span class="mono gc__mode-tag">CREDIT · MODE</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- TICKER -->
    <div class="ticker">
      <span class="bebas ticker__lbl">▍ TICKER</span>
      <div class="ticker__band">
        <div class="ticker__track">
          <span class="ticker__item">官方 × 信用 同期同彩</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">即時賠率比對</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">OFFICIAL × CREDIT · 2026</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">DUI CHONG JU</span>
          <span class="ticker__div">◆ ◆ ◆</span>
          <span class="ticker__item">官方 × 信用 同期同彩</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">即時賠率比對</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">OFFICIAL × CREDIT · 2026</span>
          <span class="ticker__div">◆</span>
          <span class="ticker__item">DUI CHONG JU</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <footer class="hall-foot">
      <span>DUI CHONG JU</span>
      <span class="mono hall-foot__copy">Copyright © 2026 HappyFatYoYo All Rights Reserved.</span>
      <span class="mono">BUILD · v2026</span>
    </footer>
  </main>
</template>

<style lang="scss" scoped>
.bebas {
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.05em;
}

.brush {
  font-family: 'cwTeXKai', 'Noto Serif TC', serif;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

// ===== KEYFRAMES =====
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeSlideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes leaveStage {
  0% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }

  25% {
    transform: scale(1.01);
    filter: brightness(1.6);
  }

  100% {
    opacity: 0;
    transform: scale(1.03);
    filter: brightness(0.3);
  }
}

@keyframes shimmerText {
  0% {
    background-position: -200% center;
  }

  100% {
    background-position: 200% center;
  }
}

@keyframes heroFloat {

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-7px);
  }
}

@keyframes lineExpand {
  from {
    width: 0;
    opacity: 0;
  }

  to {
    width: 80px;
    opacity: 1;
  }
}

@keyframes dotGlow {

  0%,
  100% {
    box-shadow: 0 0 0 2px var(--gold), 0 4px 8px rgba(0, 0, 0, .3);
  }

  50% {
    box-shadow: 0 0 0 2px var(--gold), 0 4px 16px rgba(0, 0, 0, .4), 0 0 22px 4px rgba(245, 200, 66, .45);
  }
}

@keyframes particleRise {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }

  12% {
    opacity: .9;
  }

  88% {
    opacity: .35;
  }

  100% {
    transform: translateY(-130px) scale(.25);
    opacity: 0;
  }
}

@keyframes tickerScroll {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

@keyframes cdShimmer {
  0% {
    left: -80%;
    opacity: 0;
  }

  5% {
    opacity: 1;
  }

  45%,
  100% {
    left: 160%;
    opacity: 0;
  }
}

// ===== STAGE =====
.hall-stage {
  --red: var(--color-red-main);
  --red-deep: #7f1d1d;
  --red-wine: #5a0a14;
  --red-ink: #2e060c;
  --red-bright: #b91c1c;
  --gold: var(--color-gold);
  --gold-deep: var(--color-gold);
  --gold-bright: var(--color-yellow-black-btn);
  --paper: #fff5dc;
  --paper-2: #fbe7bd;
  --paper-3: #f5d59a;
  --ivory: #fff9e8;

  width: 100%;
  min-height: 100vh;
  background: var(--red-ink);
  font-family: 'Noto Serif TC', serif;
  color: var(--paper);
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;

  &.is-leaving {
    animation: leaveStage 0.55s ease-in forwards;
    pointer-events: none;
  }
}

// ===== TOP BAR =====
.hall-top {
  background: var(--red-ink);
  border-bottom: 2px solid var(--gold);
  padding: 16px 36px;
  animation: slideDown 0.65s cubic-bezier(.22, .68, 0, 1.2) both;

  &__inner {
    max-width: var(--base-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  &__home {
    font-size: 12px;
    letter-spacing: 0.25em;
    color: var(--gold);
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: var(--gold-bright);
    }
  }

  &__brand {
    display: flex;
    flex-direction: column;
    padding-left: 20px;
    border-left: 1.5px solid var(--gold);
  }

  &__year {
    font-size: 30px;
    color: var(--gold-bright);
    line-height: 0.9;
    letter-spacing: 0.04em;
  }

  &__sub {
    font-size: 10px;
    letter-spacing: 0.28em;
    color: var(--paper-3);
    margin-top: 3px;
  }

  &__right {
    text-align: right;
  }

  &__title {
    font-size: 48px;
    line-height: 0.95;
    letter-spacing: 0.04em;
    background: linear-gradient(90deg,
        var(--gold-bright) 0%,
        #fffef2 38%,
        var(--gold-bright) 52%,
        var(--gold-bright) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
    animation: shimmerText 3.5s linear 1s infinite;
  }
}

// ===== HERO =====
.hall-hero {
  background:
    radial-gradient(ellipse 1200px 600px at 30% 60%, #c01a26 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 90% 20%, #b81222 0%, transparent 60%),
    var(--red);
  padding: 60px 36px 70px;
  position: relative;
  overflow: hidden;
  animation: fadeIn 0.7s ease-out 0.2s both;

  &__particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  &__particle {
    position: absolute;
    border-radius: 50%;
    background: var(--gold-bright);
    animation: particleRise 8s ease-in-out infinite;

    &:nth-child(1) {
      left: 8%;
      bottom: 10%;
      width: 4px;
      height: 4px;
      animation-delay: 0s;
    }

    &:nth-child(2) {
      left: 20%;
      bottom: 5%;
      width: 6px;
      height: 6px;
      animation-delay: 1.4s;
    }

    &:nth-child(3) {
      left: 35%;
      bottom: 20%;
      width: 3px;
      height: 3px;
      animation-delay: 2.8s;
    }

    &:nth-child(4) {
      left: 50%;
      bottom: 8%;
      width: 5px;
      height: 5px;
      animation-delay: 0.7s;
    }

    &:nth-child(5) {
      left: 62%;
      bottom: 28%;
      width: 3px;
      height: 3px;
      animation-delay: 3.5s;
    }

    &:nth-child(6) {
      left: 77%;
      bottom: 14%;
      width: 4px;
      height: 4px;
      animation-delay: 1.9s;
    }

    &:nth-child(7) {
      left: 88%;
      bottom: 32%;
      width: 3px;
      height: 3px;
      animation-delay: 4.2s;
    }

    &:nth-child(8) {
      left: 14%;
      bottom: 42%;
      width: 3px;
      height: 3px;
      animation-delay: 5.1s;
    }

    &:nth-child(9) {
      left: 44%;
      bottom: 48%;
      width: 5px;
      height: 5px;
      animation-delay: 2.2s;
    }

    &:nth-child(10) {
      left: 70%;
      bottom: 50%;
      width: 4px;
      height: 4px;
      animation-delay: 6.0s;
    }
  }

  &__inner {
    max-width: var(--base-width);
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 40px;
    position: relative;
    z-index: 1;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: fadeSlideUp 0.7s ease-out 0.38s both;
  }

  &__zh {
    font-family: 'cwTeXKai', 'Noto Serif TC', serif;
    font-weight: 900;
    font-size: 80px;
    line-height: 0.9;
    letter-spacing: 0.14em;
    color: var(--gold-bright);
    animation: heroFloat 5s ease-in-out 1.6s infinite;
  }

  &__line {
    width: 80px;
    height: 1.5px;
    background: var(--gold);
    animation: lineExpand 0.9s ease-out 0.7s both;
  }

  &__en {
    font-size: 11px;
    letter-spacing: 0.35em;
    color: var(--paper-3);
  }

  &__tagline {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--paper-2);
    opacity: 0.7;
  }

  &__icons {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__icon {
    display: flex;
    gap: 12px;
    align-items: center;
    animation: fadeSlideUp 0.5s ease-out var(--enter-delay, 0.55s) both;
  }

  &__dot {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--gold-bright);
    color: var(--red-deep);
    display: grid;
    place-items: center;
    font-size: 24px;
    border: 2px solid var(--red-deep);
    box-shadow: 0 0 0 2px var(--gold), 0 4px 8px rgba(0, 0, 0, .3);
    flex-shrink: 0;
    animation: dotGlow 3s ease-in-out 2s infinite;
  }

  &__icon-txt {
    display: flex;
    flex-direction: column;

    b {
      font-size: 18px;
      letter-spacing: 0.1em;
      color: var(--gold-bright);
    }

    span {
      font-size: 10px;
      letter-spacing: 0.2em;
      color: var(--paper-3);
    }
  }
}

// ===== BRUSH DIVIDER =====
.brush-div {
  height: 56px;
  background: var(--red);
  border-top: 1px solid rgba(245, 200, 66, 0.3);
  border-bottom: 1px solid rgba(245, 200, 66, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeSlideUp 0.5s ease-out 0.78s both;

  &__inner {
    display: flex;
    align-items: center;
    gap: 16px;

    .brush {
      font-size: 22px;
      color: var(--gold-bright);
      letter-spacing: 0.4em;
    }

    .mono {
      font-size: 11px;
      color: var(--gold);
      letter-spacing: 0.3em;
    }
  }
}

// ===== GAMES =====
.games-band {
  background: var(--paper);
  padding: 60px 36px 80px;
  flex: 1;

  &__head {
    max-width: var(--base-width);
    margin: 0 auto 40px;
    display: grid;
    grid-template-columns: 100px 1fr 200px;
    align-items: end;
    gap: 28px;
    animation: fadeSlideUp 0.55s ease-out 0.9s both;
  }

  &__lt {
    font-size: 30px;
    color: var(--red-deep);
    line-height: 1.15;
    letter-spacing: 0.06em;
    writing-mode: vertical-rl;
    white-space: nowrap;
    height: 180px;
    display: flex;
    align-items: center;
  }

  &__ct {
    text-align: center;

    &::before,
    &::after {
      content: '';
      display: block;
      width: 50%;
      height: 2px;
      background: var(--red);
      margin: 0 auto 16px;
    }

    &::after {
      margin: 16px auto 0;
    }

    h2 {
      font-size: 72px;
      color: var(--red-deep);
      line-height: 0.9;
      letter-spacing: 0.04em;
      white-space: nowrap;

      .gold {
        color: var(--gold-deep);
      }
    }
  }

  &__sub {
    font-size: 11px;
    color: var(--color-red-desc);
    letter-spacing: 0.35em;
    margin-top: 10px;
  }

  &__rt {
    font-size: 11px;
    color: var(--color-red-desc);
    letter-spacing: 0.2em;
    text-align: right;
    line-height: 1.7;
  }
}

.games-grid {
  max-width: var(--base-width);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
}

.gc {
  background: var(--ivory);
  border: 1.5px solid var(--red-deep);
  position: relative;
  padding: 40px 24px 24px;
  overflow: hidden;
  min-height: 340px;
  display: flex;
  flex-direction: column;
  animation: fadeSlideUp 0.6s ease-out var(--enter-delay, 1.05s) both;
  transition: transform 0.35s ease, box-shadow 0.35s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 18px 50px rgba(0, 0, 0, .18), 0 0 0 1.5px var(--red-bright);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: repeating-linear-gradient(90deg,
        var(--red) 0 12px,
        var(--gold) 12px 14px,
        var(--red) 14px 26px,
        var(--gold) 26px 28px);
  }

  &__big-num {
    position: absolute;
    top: 8px;
    right: 14px;
    font-size: 100px;
    line-height: 0.85;
    color: var(--paper-2);
    z-index: 0;
    pointer-events: none;
    user-select: none;
  }

  &__meta {
    font-size: 10px;
    letter-spacing: 0.3em;
    color: var(--gold-deep);
    position: relative;
    z-index: 1;
  }

  &__name {
    font-family: cursive;
    font-size: 48px;
    font-weight: 900;
    line-height: 1;
    color: var(--red-deep);
    margin-top: 8px;
    letter-spacing: 0.1em;
    position: relative;
    z-index: 1;
  }

  &__en {
    font-size: 16px;
    letter-spacing: 0.25em;
    color: #a04030;
    margin-top: 6px;
    position: relative;
    z-index: 1;
  }

  &__ribbon {
    display: inline-block;
    padding: 3px 10px;
    background: var(--red);
    color: var(--paper);
    font-size: 10px;
    letter-spacing: 0.2em;
    margin-top: 14px;
    position: relative;
    z-index: 1;
  }

  &__desc {
    font-size: 12px;
    line-height: 1.75;
    color: #5a2a1f;
    margin-top: 12px;
    letter-spacing: 0.04em;
    position: relative;
    z-index: 1;
    flex: 1;
    white-space: pre-line;
  }

  &__modes {
    margin-top: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    position: relative;
    z-index: 1;
  }

  &__mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 10px;
    border: 1.5px solid;
    cursor: pointer;
    transition: all 0.22s;
    background: transparent;
    position: relative;

    &--of {
      border-color: var(--red-deep);
      color: var(--red-deep);

      &:hover {
        background: var(--red-deep);
        color: var(--paper);

        .gc__mode-tag {
          color: var(--paper-3);
        }
      }
    }

    &--cd {
      border-color: var(--gold-deep);
      color: var(--red-ink);
      background: var(--gold);
      overflow: hidden;

      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: -80%;
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .4), transparent);
        animation: cdShimmer 3.2s ease-in-out 2.5s infinite;
      }

      &:hover {
        background: var(--gold-bright);
      }

      .gc__mode-tag {
        color: #8a4a3a;
      }
    }
  }

  &__mode-label {
    font-size: 22px;
    letter-spacing: 0.12em;
    line-height: 1;
  }

  &__mode-tag {
    font-size: 9px;
    letter-spacing: 0.2em;
    margin-top: 4px;
  }
}

// ===== TICKER =====
.ticker {
  background: var(--red-deep);
  border-top: 2px solid var(--gold);
  border-bottom: 2px solid var(--gold);
  padding: 14px 36px;
  display: flex;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--paper-2);
  letter-spacing: 0.15em;
  overflow: hidden;
  animation: fadeIn 0.5s ease-out 1.5s both;

  &__lbl {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 16px;
    letter-spacing: 0.25em;
    color: var(--gold-bright);
    flex-shrink: 0;
    margin-right: 24px;
  }

  &__band {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
    mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
  }

  &__track {
    display: flex;
    align-items: center;
    gap: 24px;
    width: max-content;
    white-space: nowrap;
    animation: tickerScroll 24s linear infinite;
  }

  &__div {
    color: var(--gold);
  }
}

// ===== FOOTER =====
.hall-foot {
  background: var(--red-ink);
  color: var(--paper-3);
  padding: 20px 36px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.25em;
  border-top: 1px solid var(--gold);
  animation: fadeIn 0.5s ease-out 1.6s both;

  &__copy {
    color: var(--gold);
  }
}
</style>
