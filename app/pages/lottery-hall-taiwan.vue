<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { type TaiwanLotteryResult } from '~/services/api'
import { TaiwanLotteryService } from '~/services/taiwanLotteryService'
import TaiwanLotteryPrizeDialog from '~/components/TaiwanLotteryPrizeDialog.vue'
import ShelfCard from '~/components/toys/ShelfCard.vue'
import ToyPlayDialog from '~/components/toys/ToyPlayDialog.vue'
import ToyHistoryDialog from '~/components/toys/ToyHistoryDialog.vue'
import { api, type ToyCatalogItem } from '~/services/api'

useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;600;700&family=Noto+Serif+TC:wght@700;900&family=Noto+Sans+TC:wght@400;500;700&display=swap'
    }
  ]
})

// 賓果賓果（1102）沒有官方中獎明細端點，玩法結構也跟其他 7 款不同，卡片不顯示「查看中獎明細」按鈕。
const BINGO_GAME_CODE = 1102

// 已有完整投注頁面的玩法，卡片按鈕直接跳轉過去；其餘玩法尚未實作投注頁，暫時維持開啟中獎明細彈窗。
const GAME_ROUTES: Record<number, string> = {
  5118: '/lottery/tw/dlt',
  5134: '/lottery/tw/superlotto',
  1197: '/lottery/tw/d539',
  1121: '/lottery/tw/m649',
  5120: '/lottery/tw/m539',
  2108: '/lottery/tw/p3',
  2109: '/lottery/tw/p4',
  1102: '/lottery/tw/bingo'
}

const GAME_META: Record<number, { mark: string; tagline: string; drawTime: string; topPrize: string; rules: string[] }> = {
  5134: {
    mark: '威',
    tagline: '兩區選號，頭獎累積無上限',
    drawTime: '每週一、四 20:30',
    topPrize: '頭獎 2 億起',
    rules: ['第一區從 01–38 選 6 個號碼。', '第二區從 01–08 選 1 個號碼。', '兩區全中即為頭獎。', '每注 100 元。']
  },
  5118: {
    mark: '樂',
    tagline: '49 選 6，加一個特別號',
    drawTime: '每週二、五 20:30',
    topPrize: '頭獎 1 億起',
    rules: ['從 01–49 中選 6 個號碼。', '另開出 1 個特別號。', '6 個全中即為頭獎。', '每注 50 元。']
  },
  1197: {
    mark: '539',
    tagline: '39 選 5，一週開六天',
    drawTime: '週一至週六 20:30',
    topPrize: '頭獎 800 萬',
    rules: ['從 01–39 中選 5 個號碼。', '5 個全中即為頭獎。', '中 2 個號碼就有獎。', '每注 50 元。']
  },
  5120: {
    mark: '39',
    tagline: '跟著今彩539開獎',
    drawTime: '週一至週六 20:30',
    topPrize: '四合 15 萬',
    rules: ['對應今彩539開出的號碼。', '可選二合、三合、四合。', '選中的號碼全開出才中獎。', '每注 25 元。']
  },
  1121: {
    mark: '49',
    tagline: '跟著大樂透開獎',
    drawTime: '每週二、五 20:30',
    topPrize: '四合 15 萬',
    rules: ['對應大樂透開出的號碼。', '可選二合、三合、四合。', '選中的號碼全開出才中獎。', '每注 25 元。']
  },
  2108: {
    mark: '3',
    tagline: '三位數字，正彩倒彩隨你選',
    drawTime: '週一至週六 20:30',
    topPrize: '正彩 5 萬',
    rules: ['選一組 000–999 的三位數。', '玩法分正彩、組彩、對彩。', '號碼與順序全中為正彩。', '每注 25 元。']
  },
  2109: {
    mark: '4',
    tagline: '四位數字，一次對到底',
    drawTime: '週一至週六 20:30',
    topPrize: '正彩 50 萬',
    rules: ['選一組 0000–9999 的四位數。', '玩法分正彩與組彩。', '號碼與順序全中為正彩。', '每注 25 元。']
  },
  1102: {
    mark: 'B',
    tagline: '80 選 20，五分鐘一期',
    drawTime: '每 5 分鐘一期',
    topPrize: '十星 25 萬',
    rules: ['每期從 01–80 開出 20 個號碼。', '可選 1 到 10 個號碼投注。', '另有猜大小、單雙等玩法。', '每 5 分鐘開一期。']
  }
}

const router = useRouter()
const { initialized, isLoggedIn, init } = useAuth()
const taiwanLotteryService = new TaiwanLotteryService()

const isCheckingAuth = computed(() => !initialized.value)
const state = reactive({
  loading: false,
  errorMessage: '',
  updatedAt: '',
  results: [] as TaiwanLotteryResult[],
  dialog: {
    visible: false,
    gameCode: 0,
    gameName: '',
    period: ''
  },
  shelf: {
    loading: false,
    error: '',
    items: [] as ToyCatalogItem[],
    active: null as ToyCatalogItem | null,
    enabled: true
  },
  historyOpen: false
})

/** 英雄插畫上的閃星；位置用百分比，避免跟著版面重排跑掉。 */
const HERO_STARS = [
  { id: 's1', x: '8%', y: '10%', d: '0s', s: '8px' },
  { id: 's2', x: '22%', y: '6%', d: '0.6s', s: '5px' },
  { id: 's3', x: '46%', y: '8%', d: '1.2s', s: '6px' },
  { id: 's4', x: '68%', y: '5%', d: '0.3s', s: '7px' },
  { id: 's5', x: '84%', y: '14%', d: '1.6s', s: '9px' },
  { id: 's6', x: '92%', y: '32%', d: '0.9s', s: '5px' },
  { id: 's7', x: '14%', y: '34%', d: '1.9s', s: '6px' },
  { id: 's8', x: '74%', y: '22%', d: '2.2s', s: '4px' }
]

/** 流星錯開延遲，避免同時劃過。 */
const HERO_METEORS = [
  { id: 'm1', y: '6%', d: '0.4s', dur: '7s', angle: '28deg' },
  { id: 'm2', y: '18%', d: '2.8s', dur: '8.4s', angle: '34deg' },
  { id: 'm3', y: '2%', d: '5.1s', dur: '6.6s', angle: '22deg' }
]

const todayLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日`
})

const marquee = computed(() => {
  const items = state.results.map((game) => `${game.gameName} 第 ${game.period || '-'} 期已開獎`)
  return [...items, '未滿十八歲不得購買、兌領彩券', '理性投注，量力而為']
})

const _handlers = {
  getBallClass: (index: number, total: number) => (index === total - 1 ? 'tw-ball-special' : 'tw-ball-regular'),
  meta: (gameCode: number) => GAME_META[gameCode] ?? { mark: '?', tagline: '', drawTime: '-', topPrize: '-', rules: [] },
  currentPeriod: (period?: string) => {
    if (!period) return '-'
    const next = Number(period) + 1
    if (!Number.isFinite(next)) return period
    return String(next).padStart(period.length, '0')
  },
  updatedTime: (iso: string) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }
}

const _actions = {
  loadShelf: async () => {
    state.shelf.loading = true
    state.shelf.error = ''
    try {
      const catalog = await api.games.toys.catalog()
      state.shelf.items = catalog.items
      state.shelf.enabled = catalog.enabled
    } catch {
      state.shelf.error = '櫥仔暫時讀不到，彩票卡片不受影響。'
      state.shelf.items = []
    } finally {
      state.shelf.loading = false
    }
  },
  loadLastNumber: async () => {
    state.loading = true
    state.errorMessage = ''
    try {
      const response = await taiwanLotteryService.fetchLastNumber()
      state.updatedAt = response.updatedAt
      state.results = response.results
    } catch {
      state.errorMessage = '目前無法取得彩運來開獎資料，請稍後再試。'
    } finally {
      state.loading = false
    }
  }
}

const click = {
  openPrize: (game: TaiwanLotteryResult) => {
    state.dialog.visible = true
    state.dialog.gameCode = game.gameCode
    state.dialog.gameName = game.gameName
    state.dialog.period = game.period || ''
  },
  closePrize: () => {
    state.dialog.visible = false
  },
  openToy: (item: ToyCatalogItem) => {
    if (!state.shelf.enabled || item.status !== 'open' || !item.path) return
    state.shelf.active = item
  },
  closeToy: () => {
    state.shelf.active = null
  },
  openHistory: () => {
    state.historyOpen = true
  },
  closeHistory: () => {
    state.historyOpen = false
  },
  enterGame: (game: TaiwanLotteryResult) => {
    const route = GAME_ROUTES[game.gameCode]
    if (route) {
      router.push(route)
      return
    }
    click.openPrize(game)
  }
}

onMounted(async () => {
  await init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  _actions.loadLastNumber()
  void _actions.loadShelf()
})
</script>

<template>
  <main class="theme-taiwan-lottery">
    <section v-if="isCheckingAuth" class="tw-shell">
      <p>正在檢查登入狀態...</p>
    </section>

    <section v-else-if="!isLoggedIn" class="tw-shell">
      <h1>尚未登入</h1>
      <p>請先登入後再進入彩運來。</p>
      <NuxtLink to="/login" class="tw-btn tw-btn-primary">前往登入</NuxtLink>
    </section>

    <template v-else>
      <div class="tw-header">
        <div class="tw-brand">
          <span class="tw-brand-badge">彩</span>
          <div>
            <div class="tw-brand-name">彩運來</div>
            <div class="tw-brand-sub">彩 票 大 廳</div>
          </div>
        </div>
        <div class="tw-header-pills">
          <NuxtLink to="/" class="tw-tag tw-home-link">首頁</NuxtLink>
          <span class="tw-tag tw-pill-live">
            <span class="tw-blink-dot"></span>
            開獎中
          </span>
          <span class="tw-tag">今仔日 {{ todayLabel }}</span>
          <!-- <button type="button" class="tw-btn tw-btn-secondary" :disabled="state.loading"
            @click="_actions.loadLastNumber">
            {{ state.loading ? '更新中...' : '重新整理' }}
          </button> -->
        </div>
      </div>

      <div class="tw-corrugated"></div>

      <div v-if="!state.loading && !state.errorMessage" class="tw-marquee">
        <div class="tw-marquee-track">
          <div class="tw-marquee-group">
            <span v-for="(m, i) in marquee" :key="`a-${i}`">◆ {{ m }}</span>
          </div>
          <div class="tw-marquee-group" aria-hidden="true">
            <span v-for="(m, i) in marquee" :key="`b-${i}`">◆ {{ m }}</span>
          </div>
        </div>
      </div>

      <div class="tw-hero">
        <div class="tw-hero-copy">
          <span class="tw-hero-tag">彩 運 來 · 彩 票 大 廳</span>
          <h1 class="tw-hero-title">今仔日<br><span class="tw-hero-title-cross">試手氣，好運叩叩來</span></h1>
          <p class="tw-hero-desc">大樂透、威力彩、今彩539 到賓果賓果，八款玩法一次看透透。開獎期數、獎號、明細寫甲清清楚楚，一眼就知影今仔日好運到未到。</p>
          <div class="tw-hero-actions">
            <a href="#tw-games" class="tw-btn tw-btn-primary">來一注 • 大樂透</a>
            <a href="#tw-games" class="tw-btn tw-btn-secondary">看全部玩法</a>
          </div>
        </div>

        <div class="tw-hero-art">
          <div class="tw-hero-blob"></div>
          <div class="tw-hero-blob-sm"></div>
          <img src="/images/pig_treasure.png" class="tw-hero-img" alt="紅色存錢筒與彩球玩具堆疊插畫" />
          <div class="tw-hero-fx" aria-hidden="true">
            <span v-for="star in HERO_STARS" :key="star.id" class="tw-star"
              :style="{ '--x': star.x, '--y': star.y, '--d': star.d, '--s': star.s }" />
            <span v-for="meteor in HERO_METEORS" :key="meteor.id" class="tw-meteor"
              :style="{ '--y': meteor.y, '--angle': meteor.angle }">
              <span class="tw-meteor-body" :style="{ '--d': meteor.d, '--dur': meteor.dur }" />
            </span>
          </div>
          <div class="tw-hero-note">憨人有憨福</div>
        </div>
      </div>

      <div id="tw-games" class="tw-content">
        <div class="tw-section-head">
          <h2 class="tw-section-title">玩法貨架</h2>
          <span class="tw-section-sub">熟悉的玩法，簡單的樂趣</span>
        </div>

        <p v-if="state.errorMessage" class="tw-alert">{{ state.errorMessage }}</p>

        <div v-else-if="state.loading" class="tw-loading">正在取得彩運來開獎資料...</div>

        <div v-else class="tw-grid">
          <article v-for="(game, cardIdx) in state.results" :key="game.gameCode" class="tw-card"
            :style="{ '--tw-i': `${cardIdx * 0.06}s` }">
            <div class="tw-card-top" />
            <div class="tw-card-head">
              <div class="tw-card-badge">{{ _handlers.meta(game.gameCode).mark }}</div>
              <div class="tw-card-title-wrap">
                <h2 class="tw-card-title">{{ game.gameName }}</h2>
                <p class="tw-card-tagline">{{ _handlers.meta(game.gameCode).tagline }}</p>
              </div>
            </div>

            <div class="tw-card-stat">
              <div>
                <div class="tw-card-stat-label">本期期號</div>
                <div class="tw-card-stat-value">{{ _handlers.currentPeriod(game.period) }}</div>
              </div>
              <div class="tw-card-stat-right">
                <div class="tw-card-stat-label">更新時間</div>
                <div class="tw-card-stat-value tw-card-stat-accent">{{ _handlers.updatedTime(state.updatedAt) }}</div>
              </div>
            </div>

            <div class="tw-card-info">
              <div class="tw-card-info-cell">
                <div class="tw-card-info-label">開獎</div>
                <div class="tw-card-info-value">{{ _handlers.meta(game.gameCode).drawTime }}</div>
              </div>
              <div class="tw-card-info-cell">
                <div class="tw-card-info-label">最高獎金</div>
                <div class="tw-card-info-value tw-card-info-accent">{{ _handlers.meta(game.gameCode).topPrize }}</div>
              </div>
            </div>

            <ul class="tw-card-rules">
              <li v-for="(rule, ruleIdx) in _handlers.meta(game.gameCode).rules" :key="ruleIdx">{{ rule }}</li>
            </ul>

            <div class="tw-balls-label">最近期開獎（{{ game.period || '-' }} 期）</div>
            <div class="tw-balls">
              <span v-for="(num, idx) in game.lotNumber" :key="`${game.gameCode}-${idx}-${num}`" class="tw-ball"
                :class="_handlers.getBallClass(idx, game.lotNumber.length)"
                :style="{ animationDelay: `${0.15 + idx * 0.03}s` }">
                {{ String(num).padStart(2, '0') }}
              </span>
            </div>

            <template v-if="game.gameCode === BINGO_GAME_CODE">
              <div class="tw-bingo-tags">
                <span class="tw-tag">特別號 {{ game.lotSpecial ?? '-' }}</span>
                <span class="tw-tag">{{ game.lotBigSmall ?? '-' }}</span>
                <span class="tw-tag">{{ game.lotOddEven ?? '-' }}</span>
              </div>
              <button type="button" class="tw-btn tw-btn-primary tw-btn-block" @click="click.enterGame(game)">
                來一注 • {{ game.gameName }}
              </button>
            </template>
            <template v-else>
              <button type="button" class="tw-btn tw-btn-primary tw-btn-block" @click="click.enterGame(game)">
                來一注 • {{ game.gameName }}
              </button>
            </template>
          </article>
        </div>
      </div>

      <section v-if="state.shelf.loading || state.shelf.error || state.shelf.enabled" id="tw-shelf" class="tw-shelf">
        <div class="tw-shelf-head">
          <h2>柑仔店櫥仔</h2>
          <span>懷舊零嘴 · 古早玩具</span>
          <button type="button" class="tw-btn tw-btn-secondary tw-shelf-history-btn" @click="click.openHistory">購買紀錄</button>
        </div>
        <p v-if="state.shelf.loading" class="tw-shelf-note">櫥仔準備中...</p>
        <p v-else-if="state.shelf.error" class="tw-shelf-note">{{ state.shelf.error }}</p>
        <div v-else class="tw-shelf-grid">
          <ShelfCard v-for="item in state.shelf.items" :key="item.slug" :item="item" @open="click.openToy(item)" />
        </div>
      </section>

      <div class="tw-footer">
        <div class="tw-corrugated tw-corrugated-bottom" />
        <div class="tw-footer-content">
          <span class="tw-footer-brand">彩運來 · 彩票大廳</span>
          <p>未滿十八歲不得購買、兌領彩券。理性投注，量力而為。彩運來開獎與中獎資料來源為台灣彩券官方公開 API。</p>
        </div>
      </div>

      <ToyPlayDialog :item="state.shelf.active" @close="click.closeToy" @switch="click.openToy" />
      <ToyHistoryDialog :visible="state.historyOpen" @close="click.closeHistory" />
      <TaiwanLotteryPrizeDialog :visible="state.dialog.visible" :game-code="state.dialog.gameCode"
        :game-name="state.dialog.gameName" :period="state.dialog.period" @close="click.closePrize" />
    </template>
  </main>
</template>

<style scoped lang="scss">
.tw-shell {
  max-width: 640px;
  margin: 0 auto;
  padding: 64px 24px;
  text-align: center;
}

.tw-header {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 14px clamp(16px, 4vw, 48px);
  background: var(--color-neutral-900);
  color: var(--color-bg);
  animation: twDrop 0.45s ease-out backwards;
}

.tw-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tw-brand-badge {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 999px;
  background: var(--color-accent-500);
  display: grid;
  place-items: center;
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 20px;
  color: var(--color-neutral-900);
  animation: twBadgePulse 3.2s ease-in-out infinite;
}

.tw-brand-name {
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 22px;
  line-height: 1.1;
}

.tw-brand-sub {
  font-size: 11px;
  letter-spacing: 0.22em;
  color: var(--color-accent-300);
}

.tw-header-pills {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  .tw-tag {
    background: rgba(245, 234, 216, 0.1);
    border: 1px solid rgba(245, 234, 216, 0.22);
    color: var(--color-bg);
  }

  .tw-home-link {
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;

    &:hover {
      background: rgba(245, 234, 216, 0.2);
      border-color: rgba(245, 234, 216, 0.4);
    }
  }

  .tw-btn-secondary {
    border-color: rgba(245, 234, 216, 0.35);
    color: var(--color-bg);

    &:hover {
      background: rgba(245, 234, 216, 0.2);
      border-color: rgba(245, 234, 216, 0.5);
    }
  }
}

.tw-pill-live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.tw-blink-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--color-accent-2-400);
  animation: twBlink 1.6s steps(1, end) infinite;
}

.tw-marquee {
  overflow: hidden;
  background: var(--color-accent-2-200);
  border-bottom: 1px solid var(--color-accent-2-300);
  padding: 9px 0;
}

.tw-marquee-track {
  display: flex;
  width: max-content;
  animation: twMarquee 30s linear infinite;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent-2-800);
}

.tw-marquee-group {
  display: flex;
  gap: 40px;
  padding-right: 40px;

  span {
    white-space: nowrap;
  }
}

.tw-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(24px, 4vw, 56px);
  align-items: end;
  max-width: 1400px;
  margin: 0 auto;
  padding: clamp(28px, 5vw, 64px) clamp(16px, 4vw, 48px) clamp(20px, 3vw, 40px);
}

@media (min-width: 760px) {
  .tw-hero {
    grid-template-columns: minmax(280px, 0.75fr) minmax(360px, 1.45fr);
  }
}

.tw-hero-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.tw-hero-title-cross {
  display: inline;
}

@media (min-width: 760px) {
  .tw-hero-title-cross {
    position: relative;
    z-index: 2;
    display: inline-block;
    white-space: nowrap;
    padding: 0 0.12em;
    background: color-mix(in srgb, var(--color-bg) 30%, transparent);
    line-height: 1.15;
  }
}

.tw-hero-tag {
  display: inline-block;
  transform: translateY(-30px) rotate(-2.5deg);
  animation: twFade 0.45s ease-out backwards;
  background: var(--color-accent-200);
  color: var(--color-accent-800);
  border: 1px dashed var(--color-accent-500);
  padding: 5px 16px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  margin-bottom: 18px;
}

.tw-hero-title {
  font-size: clamp(40px, 7vw, 76px);
  line-height: 1.25;
  margin: 0 0 18px;
  color: var(--color-accent-800);
  animation: twRise 0.55s ease-out 0.08s backwards;
}

.tw-hero-desc {
  font-size: clamp(15px, 1.6vw, 18px);
  max-width: 34ch;
  line-height: 1.85;
  color: var(--color-neutral-800);
  animation: twRise 0.55s ease-out 0.16s backwards;
}

.tw-hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 26px;
  animation: twRise 0.55s ease-out 0.24s backwards;

  .tw-btn-primary {
    font-size: 16px;
    padding: 13px 30px;
  }

  .tw-btn-secondary {
    font-size: 15px;
    padding: 13px 26px;
  }
}

.tw-hero-art {
  position: relative;
  display: grid;
  place-items: end center;
  min-height: 320px;
  animation: twRise 0.7s ease-out 0.12s backwards;
}

.tw-hero-blob {
  position: absolute;
  width: min(88%, 380px);
  aspect-ratio: 1;
  border-radius: 999px;
  background: var(--color-accent-2-200);
  animation: twBlob 6s ease-in-out infinite;
}

.tw-hero-blob-sm {
  position: absolute;
  inset: auto auto 6% 2%;
  width: 34%;
  max-width: 150px;
  aspect-ratio: 1;
  border-radius: 999px;
  background: var(--color-accent-200);
  animation: twBlob 5s ease-in-out infinite reverse;
}

.tw-hero-img {
  position: relative;
  width: 100%;
  height: auto;
}

.tw-hero-fx {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
}

.tw-star {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--s);
  height: var(--s);
  background: #fff6d0;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  filter: drop-shadow(0 0 4px rgba(255, 214, 120, 0.9));
  animation: twTwinkle 2.2s ease-in-out var(--d) infinite;
}

.tw-meteor {
  position: absolute;
  top: var(--y);
  left: -12%;
  width: 0;
  height: 0;
  transform: rotate(var(--angle));
  transform-origin: 0 0;
}

.tw-meteor-body {
  position: absolute;
  top: 0;
  left: 0;
  width: 90px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #fff8e4 78%, #fff);
  box-shadow: 0 0 8px rgba(255, 230, 160, 0.75);
  animation: twMeteor var(--dur) ease-in var(--d) infinite;

  &::after {
    content: '';
    position: absolute;
    right: -1px;
    top: 50%;
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: #fff;
    transform: translateY(-50%);
    box-shadow: 0 0 8px #fff6d0;
  }
}

.tw-hero-note {
  position: absolute;
  right: 0;
  top: 4%;
  z-index: 2;
  animation: twNote 3.4s ease-in-out infinite;
  background: var(--color-bg);
  border: 1px solid var(--color-neutral-300);
  border-radius: 4px;
  padding: 8px 12px;
  box-shadow: var(--shadow-sm);
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent-800);
}

.tw-section-head {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  border-bottom: 3px double var(--color-accent-500);
  padding-bottom: 12px;
  margin-bottom: 28px;
  animation: twRise 0.5s ease-out backwards;
}

.tw-section-title {
  margin: 0;
  font-size: clamp(26px, 3.4vw, 40px);
  color: var(--color-accent-800);
}

.tw-section-sub {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--color-neutral-700);
}

.tw-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 48px) clamp(16px, 4vw, 48px);
}

.tw-alert {
  border: 1px solid var(--color-accent-400);
  background: var(--color-accent-100);
  color: var(--color-accent-800);
  border-radius: var(--radius-md);
  padding: 14px 18px;
}

.tw-loading {
  padding: 24px;
  color: var(--color-neutral-700);
}

.tw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: clamp(16px, 2vw, 24px);
}

.tw-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  padding: 22px 22px 20px;
  box-shadow: var(--shadow-sm);
  animation: twRise 0.55s ease-out var(--tw-i, 0s) backwards;
  transition: transform 0.22s ease, box-shadow 0.22s ease;

  &:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-md);
  }
}

.tw-card-top {
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: var(--color-accent-500);
  background-image: repeating-linear-gradient(90deg,
      var(--color-accent-2-500) 0 14px,
      var(--color-accent-500) 14px 28px);
  animation: twStripe 8s linear infinite;
}

.tw-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-top: 6px;
}

.tw-card-badge {
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 999px;
  background: var(--color-accent-2-200);
  border: 2px solid var(--color-accent-2-400);
  display: grid;
  place-items: center;
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 17px;
  color: var(--color-accent-2-800);
}

.tw-card-title-wrap {
  min-width: 0;
  flex: 1;
}

.tw-card-title {
  margin: 0 0 3px;
  font-size: 22px;
  color: var(--color-neutral-900);
}

.tw-card-tagline {
  margin: 0;
  font-size: 13px;
  color: var(--color-neutral-700);
  line-height: 1.5;
}

.tw-card-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--color-neutral-200);
  border: 1px dashed var(--color-neutral-400);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
}

.tw-card-stat-right {
  text-align: right;
}

.tw-card-stat-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--color-neutral-600);
}

.tw-card-stat-value {
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 17px;
  color: var(--color-neutral-900);
}

.tw-card-stat-accent {
  color: var(--color-accent-700);
}

.tw-card-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tw-card-info-cell {
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
}

.tw-card-info-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--color-neutral-600);
}

.tw-card-info-value {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.tw-card-info-accent {
  color: var(--color-accent-800);
}

.tw-card-rules {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: var(--color-neutral-800);
  line-height: 1.6;
}

.tw-balls-label {
  border-top: 3px double var(--color-neutral-300);
  padding-top: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-neutral-700);
}

.tw-balls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tw-ball {
  display: flex;
  height: 34px;
  min-width: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
  animation: twBallIn 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards;

  &.tw-ball-regular {
    background: #f1c419;
    color: #9c5410;
  }

  &.tw-ball-special {
    background: var(--color-red-main);
    color: var(--color-bg);
  }
}

.tw-bingo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tw-btn {
  transition: transform 0.15s ease, background-color 0.15s ease;

  &:hover {
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
}

.tw-btn-block {
  width: 100%;
  margin-top: auto;
}

.tw-shelf {
  position: relative;
  max-width: 1400px;
  margin: 20px auto 0;
  padding: 0 clamp(16px, 4vw, 48px);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* 玻璃櫥窗固定反光，兩條 45 度斜帶（一粗一細），不做動畫，呼應「柑仔店櫥仔」的展示櫃質感 */
.tw-shelf::before,
.tw-shelf::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 160%;
  background: rgba(255, 255, 255, 0.32);
  transform: translate(-50%, -50%) rotate(45deg);
  pointer-events: none;
  z-index: 1;
}

.tw-shelf::before {
  left: 26%;
  height: 26px;
}

.tw-shelf::after {
  left: 30%;
  height: 8px;
  background: rgba(255, 255, 255, 0.28);
}

.tw-shelf-head {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 6px;
  background-color: var(--color-surface);
  border: 2px solid var(--color-accent-2-400);
  border-bottom: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: clamp(20px, 3vw, 34px) clamp(20px, 3vw, 34px) 8px;
  background-image: radial-gradient(circle at 12px 12px, rgba(122, 138, 94, 0.16) 3px, transparent 3.5px);
  background-size: 24px 24px;

  h2 {
    margin: 0;
    font-size: clamp(24px, 3vw, 34px);
    color: var(--color-accent-2-800);
  }

  span {
    margin-bottom: 5px;
    font-size: 13px;
    color: var(--color-neutral-600);
  }
}

.tw-shelf-history-btn {
  margin-left: auto;
  margin-bottom: 5px;
  padding: 8px 18px;
  font-size: 13px;
}

.tw-shelf-note,
.tw-shelf-grid {
  background: var(--color-surface);
  border: 2px solid var(--color-accent-2-400);
  border-top: 0;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  padding: 8px clamp(20px, 3vw, 34px) clamp(20px, 3vw, 34px);
}

.tw-shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}

.tw-footer {
  margin-top: clamp(32px, 6vw, 64px);
  background: var(--color-neutral-900);
  color: var(--color-neutral-300);
  animation: twRise 0.5s ease-out 0.2s backwards;
}

.tw-footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 48px) 32px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 12px;

  p {
    margin: 0;
    max-width: 60ch;
    line-height: 1.7;
  }
}

.tw-footer-brand {
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 16px;
  color: var(--color-bg);
}

@keyframes twMarquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

@keyframes twDrop {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes twRise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes twFade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes twTwinkle {

  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.55) rotate(0deg);
  }

  50% {
    opacity: 1;
    transform: scale(1) rotate(16deg);
  }
}

@keyframes twMeteor {
  0% {
    opacity: 0;
    transform: translateX(0);
  }

  8% {
    opacity: 1;
  }

  32% {
    opacity: 0;
    transform: translateX(720px);
  }

  100% {
    opacity: 0;
    transform: translateX(720px);
  }
}

@keyframes twBlob {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.06);
  }
}

@keyframes twNote {

  0%,
  100% {
    transform: rotate(4deg) translateY(0);
  }

  50% {
    transform: rotate(8deg) translateY(-6px);
  }
}

@keyframes twBadgePulse {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.06);
  }
}

@keyframes twStripe {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 28px 0;
  }
}

@keyframes twBallIn {
  from {
    opacity: 0;
    transform: scale(0.6);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes twBlink {

  0%,
  60% {
    opacity: 1;
  }

  61%,
  100% {
    opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {

  .tw-header,
  .tw-brand-badge,
  .tw-hero-tag,
  .tw-hero-title,
  .tw-hero-desc,
  .tw-hero-actions,
  .tw-hero-art,
  .tw-star,
  .tw-meteor-body,
  .tw-hero-blob,
  .tw-hero-blob-sm,
  .tw-hero-note,
  .tw-section-head,
  .tw-card,
  .tw-card-top,
  .tw-ball,
  .tw-footer {
    animation: none;
  }

  .tw-card:hover,
  .tw-btn:hover,
  .tw-btn:active {
    transform: none;
  }
}
</style>
