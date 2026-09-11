<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { type TaiwanLotteryResult } from '~/services/api'
import { TaiwanLotteryService } from '~/services/taiwanLotteryService'
import TaiwanLotteryPrizeDialog from '~/components/TaiwanLotteryPrizeDialog.vue'

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

const GAME_META: Record<number, { mark: string; tagline: string }> = {
  5134: { mark: '威', tagline: '兩區選號，頭獎累積無上限' },
  5118: { mark: '樂', tagline: '49 選 6，加一個特別號' },
  1197: { mark: '539', tagline: '39 選 5，一週開六天' },
  5120: { mark: '39', tagline: '跟著今彩539開獎' },
  1121: { mark: '49', tagline: '跟著大樂透開獎' },
  2108: { mark: '3', tagline: '三位數字，正彩倒彩隨你選' },
  2109: { mark: '4', tagline: '四位數字，一次對到底' },
  1102: { mark: 'B', tagline: '80 選 20，五分鐘一期' }
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
  }
})

const todayLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日`
})

const marquee = computed(() => {
  const items = state.results.map((game) => `${game.gameName} 第 ${game.period || '-'} 期已開獎`)
  return [...items, '未滿十八歲不得購買、兌領彩券', '理性投注，量力而為']
})

const _handlers = {
  getBallClass: (index: number, total: number) => {
    if (index === total - 1) return 'bg-rose-500 text-white'
    const mod = index % 3
    if (mod === 0) return 'bg-amber-400 text-slate-900'
    if (mod === 1) return 'bg-sky-500 text-white'
    return 'bg-emerald-500 text-white'
  },
  meta: (gameCode: number) => GAME_META[gameCode] ?? { mark: '?', tagline: '' },
  updatedTime: (iso: string) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }
}

const _actions = {
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
  }
}

onMounted(async () => {
  await init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  _actions.loadLastNumber()
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
          <button type="button" class="tw-btn tw-btn-secondary" :disabled="state.loading"
            @click="_actions.loadLastNumber">
            {{ state.loading ? '更新中...' : '重新整理' }}
          </button>
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
          <h1 class="tw-hero-title">今仔日<br>開獎行情，好運報你知</h1>
          <p class="tw-hero-desc">大樂透、威力彩、今彩539 到賓果賓果，八款玩法一次看透透。開獎期數、獎號、明細寫甲清清楚楚，一眼就知影今仔日好運到未到。</p>
          <div class="tw-hero-actions">
            <a href="#tw-games" class="tw-btn tw-btn-primary">查看今仔日開獎</a>
            <a href="#tw-games" class="tw-btn tw-btn-secondary">看全部玩法</a>
          </div>
        </div>

        <div class="tw-hero-art">
          <div class="tw-hero-blob"></div>
          <div class="tw-hero-blob-sm"></div>
          <svg viewBox="0 0 320 300" class="tw-hero-svg" aria-label="大同電鍋與紅色郵筒插畫">
            <ellipse cx="160" cy="270" rx="128" ry="15" fill="#2e2b25" opacity="0.1"></ellipse>
            <rect x="228" y="120" width="58" height="146" rx="18" fill="#8c491a"></rect>
            <rect x="228" y="120" width="58" height="146" rx="18" fill="none" stroke="#402310" stroke-width="3"></rect>
            <path d="M222 122 q34 -26 70 0 z" fill="#402310"></path>
            <rect x="242" y="150" width="30" height="8" rx="4" fill="#f5ead8" opacity="0.85"></rect>
            <rect x="248" y="176" width="18" height="24" rx="4" fill="#f5ead8" opacity="0.35"></rect>
            <rect x="252" y="266" width="10" height="16" fill="#645c50"></rect>
            <path d="M52 250 q-14 0 -14 -16 v-72 q0 -58 66 -58 h44 q66 0 66 58 v72 q0 16 -16 16 z" fill="#dcd3c4">
            </path>
            <path d="M52 250 q-14 0 -14 -16 v-72 q0 -58 66 -58 h44 q66 0 66 58 v72 q0 16 -16 16 z" fill="none"
              stroke="#474238" stroke-width="4"></path>
            <path d="M44 168 h172" stroke="#474238" stroke-width="3" opacity="0.5"></path>
            <ellipse cx="130" cy="104" rx="82" ry="20" fill="#eee7db" stroke="#474238" stroke-width="4"></ellipse>
            <rect x="118" y="82" width="24" height="16" rx="7" fill="#8c491a" stroke="#402310" stroke-width="3"></rect>
            <circle cx="130" cy="200" r="26" fill="#8fa073" stroke="#474238" stroke-width="4"></circle>
            <path d="M130 182 v18 l13 8" stroke="#2e2b25" stroke-width="4" fill="none" stroke-linecap="round"></path>
            <rect x="40" y="232" width="180" height="10" rx="5" fill="#c67139" opacity="0.75"></rect>
          </svg>
          <div class="tw-hero-note">憨人有憨福</div>
        </div>
      </div>

      <div id="tw-games" class="tw-content">
        <div class="tw-section-head">
          <h2 class="tw-section-title">開獎總覽</h2>
          <span class="tw-section-sub">8 款台灣彩券 · 即時開獎</span>
        </div>

        <p v-if="state.errorMessage" class="tw-alert">{{ state.errorMessage }}</p>

        <div v-else-if="state.loading" class="tw-loading">正在取得彩運來開獎資料...</div>

        <div v-else class="tw-grid">
          <article v-for="game in state.results" :key="game.gameCode" class="tw-card">
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
                <div class="tw-card-stat-value">{{ game.period || '-' }}</div>
              </div>
              <div class="tw-card-stat-right">
                <div class="tw-card-stat-label">更新時間</div>
                <div class="tw-card-stat-value tw-card-stat-accent">{{ _handlers.updatedTime(state.updatedAt) }}</div>
              </div>
            </div>

            <div class="tw-balls">
              <span v-for="(num, idx) in game.lotNumber" :key="`${game.gameCode}-${idx}-${num}`" class="tw-ball"
                :class="_handlers.getBallClass(idx, game.lotNumber.length)">
                {{ String(num).padStart(2, '0') }}
              </span>
            </div>

            <template v-if="game.gameCode === BINGO_GAME_CODE">
              <div class="tw-bingo-tags">
                <span class="tw-tag">特別號 {{ game.lotSpecial ?? '-' }}</span>
                <span class="tw-tag">{{ game.lotBigSmall ?? '-' }}</span>
                <span class="tw-tag">{{ game.lotOddEven ?? '-' }}</span>
              </div>
            </template>
            <template v-else>
              <button type="button" class="tw-btn tw-btn-primary tw-btn-block" @click="click.openPrize(game)">
                查看中獎明細
              </button>
            </template>
          </article>
        </div>
      </div>

      <div class="tw-footer">
        <div class="tw-corrugated" />
        <div class="tw-footer-content">
          <span class="tw-footer-brand">彩運來 · 彩票大廳</span>
          <p>未滿十八歲不得購買、兌領彩券。理性投注，量力而為。彩運來開獎與中獎資料來源為台灣彩券官方公開 API。</p>
        </div>
      </div>

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
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: clamp(24px, 4vw, 56px);
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
  padding: clamp(28px, 5vw, 64px) clamp(16px, 4vw, 48px) clamp(20px, 3vw, 40px);
}

.tw-hero-tag {
  display: inline-block;
  transform: rotate(-2.5deg);
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
  line-height: 1.08;
  margin: 0 0 18px;
  color: var(--color-accent-800);
}

.tw-hero-desc {
  font-size: clamp(15px, 1.6vw, 18px);
  max-width: 34ch;
  line-height: 1.85;
  color: var(--color-neutral-800);
}

.tw-hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 26px;
}

.tw-hero-art {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 320px;
}

.tw-hero-blob {
  position: absolute;
  width: min(88%, 380px);
  aspect-ratio: 1;
  border-radius: 999px;
  background: var(--color-accent-2-200);
}

.tw-hero-blob-sm {
  position: absolute;
  inset: auto auto 6% 2%;
  width: 34%;
  max-width: 150px;
  aspect-ratio: 1;
  border-radius: 999px;
  background: var(--color-accent-200);
}

.tw-hero-svg {
  position: relative;
  width: min(94%, 420px);
  height: auto;
  filter: drop-shadow(0 10px 22px rgba(46, 43, 37, 0.18));
}

.tw-hero-note {
  position: absolute;
  right: 0;
  top: 4%;
  transform: rotate(6deg);
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
}

.tw-card-top {
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: var(--color-accent-500);
  background-image: repeating-linear-gradient(90deg,
      var(--color-accent-2-400) 0 14px,
      var(--color-accent-500) 14px 28px);
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
  white-space: nowrap;
}

.tw-card-tagline {
  margin: 0;
  font-size: 13px;
  color: var(--color-neutral-700);
  line-height: 1.5;
  white-space: nowrap;
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
}

.tw-bingo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tw-btn-block {
  width: 100%;
  margin-top: auto;
}

.tw-footer {
  margin-top: clamp(32px, 6vw, 64px);
  background: var(--color-neutral-900);
  color: var(--color-neutral-300);
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
</style>
