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
  meta: (gameCode: number) => GAME_META[gameCode] ?? { mark: '?', tagline: '' }
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
            <div class="tw-brand-sub">開 獎 大 廳</div>
          </div>
        </div>
        <div class="tw-header-pills">
          <span class="tw-tag tw-pill-live">
            <span class="tw-blink-dot"></span>
            開獎中
          </span>
          <span class="tw-tag">今仔日 {{ todayLabel }}</span>
          <button
            type="button"
            class="tw-btn tw-btn-secondary"
            :disabled="state.loading"
            @click="_actions.loadLastNumber"
          >
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

      <div class="tw-content">
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
              <span class="tw-card-period">第 {{ game.period || '-' }} 期</span>
            </div>

            <div class="tw-balls">
              <span
                v-for="(num, idx) in game.lotNumber"
                :key="`${game.gameCode}-${idx}-${num}`"
                class="tw-ball"
                :class="_handlers.getBallClass(idx, game.lotNumber.length)"
              >
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
          <span class="tw-footer-brand">彩運來 · 開獎大廳</span>
          <p>未滿十八歲不得購買、兌領彩券。理性投注，量力而為。彩運來開獎與中獎資料來源為台灣彩券官方公開 API。</p>
        </div>
      </div>

      <TaiwanLotteryPrizeDialog
        :visible="state.dialog.visible"
        :game-code="state.dialog.gameCode"
        :game-name="state.dialog.gameName"
        :period="state.dialog.period"
        @close="click.closePrize"
      />
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
  background-image: repeating-linear-gradient(
    90deg,
    var(--color-accent-2-400) 0 14px,
    var(--color-accent-500) 14px 28px
  );
}

.tw-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-top: 6px;
}

.tw-card-badge {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 999px;
  background: var(--color-accent-2-200);
  border: 2px solid var(--color-accent-2-400);
  display: grid;
  place-items: center;
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 15px;
  color: var(--color-accent-2-800);
}

.tw-card-title-wrap {
  min-width: 0;
  flex: 1;
}

.tw-card-title {
  margin: 0 0 3px;
  font-size: 20px;
  color: var(--color-neutral-900);
}

.tw-card-tagline {
  margin: 0;
  font-size: 12px;
  color: var(--color-neutral-700);
  line-height: 1.5;
}

.tw-card-period {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-neutral-700);
  background: var(--color-neutral-200);
  border-radius: 999px;
  padding: 4px 10px;
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
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes twBlink {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0.25; }
}
</style>
