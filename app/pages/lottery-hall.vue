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
      href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=cwTeXKai&family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;500&family=Bebas+Neue&display=swap',
    },
  ],
})

const CHINESE_NUMS = ['壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖', '拾']

const GAME_META: Record<string, { en: string; ribbon: string; desc: string }> = {
  '6HC': { en: 'MARK · SIX', ribbon: 'HK · 49 取 7', desc: '每週三場 · 含特別號。複式、膽拖、連肖、生肖、合數，賠付公式可於規則頁查閱。' },
}

const router = useRouter()

const ROUTE_DICT: Record<string, string> = {
  '6HC-CD': '/lottery/bg/6hc-cd',
  '6HC-OF': '/lottery/bg/6hc-of',
}

const state = reactive({
  list: [] as LobbyItem[],
})

const init = () => {
  state.list = GET_CONT.lotteryAll()
}

const click = {
  start: (key: string) => {
    const target = ROUTE_DICT[key]
    if (!target) return
    router.push(target)
  },
}

onMounted(() => {
  init()
})
</script>

<template>
  <main class="hall-stage">
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
      <div class="hall-hero__inner">
        <div class="hall-hero__text">
          <div class="hall-hero__zh">彩 票 大 廳</div>
          <div class="hall-hero__line"></div>
          <div class="mono hall-hero__en">LOTTERY · HALL · ALL GAMES · 2026</div>
          <div class="mono hall-hero__tagline">凡 局 皆 成 勢 · 萬 數 自 歸 平</div>
        </div>
        <div class="hall-hero__icons">
          <div v-for="item in state.list" :key="item.key" class="hall-hero__icon">
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
        <div v-for="(item, idx) in state.list" :key="item.key" class="gc">
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
      <span class="ticker__item">官方 × 信用 同期同彩</span>
      <span class="ticker__div">◆</span>
      <span class="ticker__item">即時賠率比對</span>
      <span class="ticker__div">◆</span>
      <span class="ticker__item">OFFICIAL × CREDIT · 2026</span>
      <span class="ticker__div">◆</span>
      <span class="ticker__item"> DUI CHONG JU</span>
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

.hall-stage {
  --red: #d11e2a;
  --red-deep: #9a0a18;
  --red-wine: #5a0a14;
  --red-ink: #2e060c;
  --red-bright: #e83a2c;
  --gold: #f5c842;
  --gold-deep: #c89530;
  --gold-bright: #ffe066;
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
}

// ===== TOP BAR =====
.hall-top {
  background: var(--red-ink);
  border-bottom: 2px solid var(--gold);
  padding: 16px 36px;

  &__inner {
    max-width: 1440px;
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
    color: var(--gold-bright);
    line-height: 0.95;
    letter-spacing: 0.04em;
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

  &__inner {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 40px;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__zh {
    font-family: 'cwTeXKai', 'Noto Serif TC', serif;
    font-weight: 900;
    font-size: 80px;
    line-height: 0.9;
    letter-spacing: 0.14em;
    color: var(--gold-bright);
  }

  &__line {
    width: 80px;
    height: 1.5px;
    background: var(--gold);
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
    box-shadow: 0 0 0 2px var(--gold), 0 4px 8px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
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
    max-width: 1440px;
    margin: 0 auto 40px;
    display: grid;
    grid-template-columns: 100px 1fr 200px;
    align-items: end;
    gap: 28px;
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
    color: #8a4a3a;
    letter-spacing: 0.35em;
    margin-top: 10px;
  }

  &__rt {
    font-size: 11px;
    color: #a04030;
    letter-spacing: 0.2em;
    text-align: right;
    line-height: 1.7;
  }
}

.games-grid {
  max-width: 1440px;
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
    font-size: 44px;
    line-height: 1;
    color: var(--red-deep);
    margin-top: 8px;
    letter-spacing: 0.06em;
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
    transition: all 0.2s;
    background: transparent;

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
  gap: 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--paper-2);
  letter-spacing: 0.15em;
  flex-wrap: wrap;

  &__lbl {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 16px;
    letter-spacing: 0.25em;
    color: var(--gold-bright);
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

  &__copy {
    color: var(--gold);
  }
}
</style>
