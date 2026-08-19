<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Ball from '~/components/lottery/bg/11x5/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import {
  X5_BALL_COUNT,
  X5_BALL_NAMES,
  X5_NUMBERS,
  X5_SUM_BIG_LINE,
  X5_SUM_TAIL_BIG_LINE
} from '#shared/config/x5'
import { useX5 } from '~/composables/useX5'

/**
 * 11選5 頁首
 *
 * 版面與樣式沿用 ssc / k3 的 Header（再往上是 6hc-of 的 Header）：
 *   .header-warp  4px 深紅外框 + 金色漸層頂條
 *   .left         .info（大標題 + 玩法 + LOTTERY_ID）＋ .info-bonus（獎金框）
 *   .right .inner .timer（期別／狀態／倒數，佔 30% 淡紅底）＋ .open-code（可點的開獎區）
 *
 * 11選5 專屬差異：開獎是 1~11 取 5 個**不重複**號碼，所以開獎區是一排 5 顆兩位數號碼球；
 * 兩面看「總和」（分界讀 X5_SUM_BIG_LINE）並多一組尾大／尾小。
 *
 * ⚠️ 獎金框只有「總獎金（共用彩池）」與「爆池」兩塊，**沒有** ssc 那邊的
 *    「預估頭獎／中獎機率」—— 那兩個值要由官方盤的分層設定（X5_OF_PRIZE_TIERS）推，
 *    階段 1 官方盤還不存在，寫任何數字都是憑空假設。階段 2 接上官方盤時
 *    比照 ssc 的 Header 補回這兩列。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void }>()

const {
  current: mxCurrent, pool: mxPool, creditJackpot: mxJackpot, time: mxTime,
  lotteryMeta, isCd, actions: mxActions
} = useX5()

const money = (value: number) =>
  Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * 獎金跳動動畫（與 k3 / 6hc-of 的 Header 同一套）
 *
 * 彩池變大時用 rAF 在 15 秒內以 ease-out 跑到新值，變小（結算後歸零）則直接跳到底 ——
 * 只有往上才慢慢加，看起來像獎金在累積。
 */
const POOL_ANIM_MS = 15000
const displayPool = ref(0)
let poolRafId: number | null = null

const _poolAnim = {
  stop: () => {
    if (poolRafId !== null) cancelAnimationFrame(poolRafId)
    poolRafId = null
  },
  to: (target: number, durationMs = POOL_ANIM_MS) => {
    _poolAnim.stop()
    const from = displayPool.value
    const diff = target - from
    if (Math.abs(diff) < 0.01) {
      displayPool.value = target
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      displayPool.value = Number((from + diff * ease).toFixed(2))
      poolRafId = t < 1 ? requestAnimationFrame(step) : null
    }
    poolRafId = requestAnimationFrame(step)
  }
}

onMounted(() => {
  displayPool.value = mxPool.distributable
  watch(() => mxPool.distributable, (next) => {
    if (next > displayPool.value) _poolAnim.to(next)
    else {
      _poolAnim.stop()
      displayPool.value = next
    }
  })
})

onBeforeUnmount(_poolAnim.stop)

/**
 * 爆池（兩個盤口共吃一池，所以兩邊都顯示同一個數字）
 *
 * ⚠️ 與上面的「總獎金」是兩個不同的池：那個是官方盤直選類（階段 2）要吃的；
 *    這個是爆池，開出爆池條件那期一次發放給**兩個盤口**該期有份的注單。
 */
const jackpotReady = computed(() => Number(mxJackpot.rakeRatio) > 0)
const jackpotPool = computed(() => Number(mxJackpot.distributable ?? 0))
const jackpotHitRate = computed(() => `${(Number(mxJackpot.hitRate ?? 0) * 100).toFixed(2)}%`)
/** 累積池未達門檻時不發放，畫面要講清楚 */
const jackpotBelowMin = computed(() => jackpotPool.value < Number(mxJackpot.minPool ?? 0))

const issueCurrent = computed(() => String(mxCurrent.runtime?.issueCurrent ?? '—'))
const issueLatest = computed(() => String(mxCurrent.runtime?.issueLatest ?? '—'))
const currentStatus = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const countdown = computed(() => mxTime.statusRemainLabel || '00:00')

const _handlers = {
  /** 把 mm:ss 或 hh:mm:ss 轉成秒（封盤前 5 秒要換文案，同 6hc-of） */
  countdownSeconds: (label: string) => {
    if (!label) return Number.POSITIVE_INFINITY
    const parts = label.split(':').map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
    return Number.POSITIVE_INFINITY
  }
}

/** 開盤中且剩 5 秒內改顯示「準備封盤 N」（同 6hc-of） */
const displayCurrentStatus = computed(() => {
  if (currentStatus.value !== STATUS_TIME.OPEN) return currentStatus.value
  const remain = _handlers.countdownSeconds(countdown.value)
  const map: Record<number, string> = {
    5: STATUS_TIME.PREPARE_CLOSE_5,
    4: STATUS_TIME.PREPARE_CLOSE_4,
    3: STATUS_TIME.PREPARE_CLOSE_3,
    2: STATUS_TIME.PREPARE_CLOSE_2,
    1: STATUS_TIME.PREPARE_CLOSE_1
  }
  return map[remain] ?? currentStatus.value
})

/** 已開獎的那一期 5 個號碼（未開獎的當期不提前顯示） */
const openCode = computed(() => {
  const codes = Array.isArray(mxCurrent.runtime?.openCode) ? mxCurrent.runtime!.openCode : []
  return codes.length === X5_BALL_COUNT ? codes : []
})
/** 總和與它的三組面（分界讀 X5_SUM_BIG_LINE / X5_SUM_TAIL_BIG_LINE，不寫死 31 / 5） */
const sum = computed(() => mxActions.sumOf(openCode.value))
const isBig = computed(() => sum.value >= X5_SUM_BIG_LINE)
const isOdd = computed(() => sum.value % 2 === 1)
const isTailBig = computed(() => sum.value % 10 >= X5_SUM_TAIL_BIG_LINE)

/**
 * 開獎動畫
 *
 *   準備開獎／開獎中 → 5 顆球持續跳動、號碼亂數翻
 *   新一期開出       → 依序落下彈跳（revealToken 遞增讓 key 變動、CSS 動畫重播）
 *
 * ⚠️ 翻號用到 Math.random，只在 client 的 interval 內跑；初始狀態（rolling: false、
 *    rollBalls 固定值）兩端一致，才不會有 hydration mismatch。
 * ⚠️ 與 ssc 不同：11選5 五碼**不重複**，翻號用洗牌取前 5 個（同 pk10 的做法），
 *    各自亂數會翻出重複號碼、與真實開獎結構不符。
 */
const ROLL_INTERVAL_MS = 90
const anim = reactive({
  rolling: false,
  rollBalls: Array.from({ length: X5_BALL_COUNT }, (_, i) => i + 1) as number[],
  revealToken: 0
})
let rollTimer: ReturnType<typeof setInterval> | null = null

const isDrawing = computed(() =>
  currentStatus.value === STATUS_TIME.PREPARE_OPEN || currentStatus.value === STATUS_TIME.OPENING
)
/** 翻號中顯示隨機號碼，其餘顯示該期開獎號（沒開出就顯示待開狀態） */
const displayBalls = computed(() => {
  if (anim.rolling) return anim.rollBalls
  return openCode.value.length > 0 ? openCode.value.map((code) => Number(code)) : anim.rollBalls.map(() => -1)
})

const _anim = {
  start: () => {
    if (rollTimer) return
    anim.rolling = true
    rollTimer = setInterval(() => {
      // 洗牌取前 5 個 —— 翻號畫面也維持「5 碼不重複」
      const pool = [...X5_NUMBERS]
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = pool[i] as number
        pool[i] = pool[j] as number
        pool[j] = tmp
      }
      anim.rollBalls = pool.slice(0, X5_BALL_COUNT)
    }, ROLL_INTERVAL_MS)
  },
  stop: () => {
    if (rollTimer) clearInterval(rollTimer)
    rollTimer = null
    anim.rolling = false
  }
}

if (import.meta.client) {
  watch(isDrawing, (drawing) => {
    if (drawing) _anim.start()
    else _anim.stop()
  }, { immediate: true })

  // 新一期開出：停下翻號並播放落下動畫
  watch(issueLatest, (next, prev) => {
    if (!next || next === '—' || next === prev) return
    _anim.stop()
    anim.revealToken += 1
  })
}

onBeforeUnmount(_anim.stop)

/** 球位短標籤（球下方那一行；沿用 X5_BALL_NAMES 但只取「第X」兩字，全名會太寬） */
const ballLabels = X5_BALL_NAMES.map((name) => name.replace('球', ''))
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">11選5</h1>
        <p class="sub">{{ isCd ? '信用玩法' : '官方玩法' }}</p>
        <p class="lotteryId">LOTTERY_ID: {{ lotteryMeta.id }}</p>
      </div>
      <div class="info-bonus">
        <div class="row">
          <span class="label">總獎金</span>
          <span class="val val-big">{{ money(displayPool) }}</span>
        </div>
        <!-- ⚠️ 沒有「預估頭獎／中獎機率」：那兩列要由官方盤分層推算，階段 2 才補（見檔頭說明） -->
        <p class="pool-note">※ 獎金由 [信用] 與 [官方] 累積</p>
<!-- 爆池：兩個盤口共吃一池，與上面的共用彩池是兩套帳 -->
        <div v-if="jackpotReady" class="jackpot-box">
          <div class="row">
            <span class="label">爆池</span>
            <span class="val">{{ money(jackpotPool) }}</span>
          </div>
          <p class="jackpot-note">
            {{ mxJackpot.hitLabel }}（{{ jackpotHitRate }}）時發放 {{ (mxJackpot.payoutRatio * 100).toFixed(0) }}%<template
              v-if="jackpotBelowMin">，未達 {{ money(mxJackpot.minPool) }} 不發放</template>
          </p>
          <p v-if="mxJackpot.lastHit" class="jackpot-note is-hit">
            上次爆池 第{{ mxJackpot.lastHit.issue }}期 {{ mxJackpot.lastHit.openLabel }}
            發出 {{ money(mxJackpot.lastHit.payout) }}（{{ mxJackpot.lastHit.orders }} 注 / {{ mxJackpot.lastHit.winners }} 人）
          </p>
        </div>
      </div>
    </div>

    <div class="right">
      <div class="inner">
        <div class="timer">
          <div class="issue">
            第{{ issueCurrent }}期
            <div>{{ displayCurrentStatus }}</div>
          </div>
          <div class="countdown">{{ countdown }}</div>
        </div>

        <div class="open-code" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
          @keydown.enter="emit('open-opencode-dialog')" @keydown.space.prevent="emit('open-opencode-dialog')">
          <div class="issue">第{{ issueLatest }}期 開獎</div>
          <div class="main">
            <div class="ball-legend">
              <div class="ball-legend-title"><span>開獎號碼</span></div>
            </div>

            <!-- 5 顆號碼球：key 帶 revealToken，新一期開出時強制重建讓落下動畫重播 -->
            <div class="ball-row">
              <div v-for="(ball, idx) in displayBalls" :key="`x5-open-${anim.revealToken}-${idx}`" class="ball-warp"
                :class="{ 'is-rolling': anim.rolling }" :style="{ '--i': idx }">
                <Ball :digit="ball" size="md" :pending="!anim.rolling && openCode.length === 0" />
                <span class="ball-pos">{{ ballLabels[idx] }}</span>
              </div>
            </div>

            <div v-if="openCode.length > 0 && !anim.rolling" :key="`x5-meta-${anim.revealToken}`" class="open-meta">
              <span class="meta-sum">總和 {{ sum }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isBig }">{{ isBig ? '大' : '小' }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isOdd }">{{ isOdd ? '單' : '雙' }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isTailBig }">{{ isTailBig ? '尾大' : '尾小' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 樣式沿用 6hc-of 的 .header-warp，僅把開獎球換成骰子、獎金列換成共用彩池。
   ⚠️ 與 6hc-of 的差異：這裡排成「一列」（row）—— 左側標題＋獎金框、右側期別＋開獎，
   6hc-of 是上下兩段（column）。 */
.header-warp {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 1rem;
  border: 4px solid #7f1d1d;
  border-radius: 0.5rem;
  background: #fff;
  padding: 10px 20px;
  box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
  position: relative;
  overflow: hidden;

  /* 金色漸層頂條 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: linear-gradient(90deg, #7f1d1d 0%, #c9a227 35%, #f5d060 50%, #c9a227 65%, #7f1d1d 100%);
    z-index: 1;
  }

  .left {
    /* 一列排版：左側依內容決定寬度，右側吃剩下的空間 */
    flex: 0 0 auto;
    display: flex;
    align-items: stretch;
    justify-content: flex-start;
    gap: 7rem;
    border-radius: 0.375rem;
    padding: 0.5rem 0;

    .info {
      min-width: 0;
      flex-shrink: 0;

      .title {
        margin: 0;
        font-family: var(--font-brush), "Noto Serif TC", serif;
        font-size: 62px;
        letter-spacing: -4px;
        font-weight: 900;
        line-height: 1.05;
        color: var(--color-red-main);
        padding-left: 0.75rem;
        border-left: 5px solid var(--color-gold);
      }

      .sub {
        margin: 0.25rem 0 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-red-desc);
      }

      .lotteryId {
        margin: 0.125rem 0 0;
        font-size: 13px;
        color: var(--color-red-desc);
      }
    }

    .info-bonus {
      /* 固定寬度，不跟右側搶空間 */
      flex: 0 0 250px;
      display: grid;
      gap: 0.375rem;
      align-content: start;
      border: 1px solid #fee2e2;
      border-radius: 0.375rem;
      padding: 0.625rem;

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        font-size: 12px;

        .label {
          white-space: nowrap;
          color: var(--color-red-desc);
        }

        .val {
          white-space: nowrap;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-red-main);

          &.val-big {
            font-size: 20px;
            font-weight: 700;
          }
        }

        .accent {
          white-space: nowrap;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: #15803d;
        }
      }

      .pool-note {
        margin: 0.25rem 0 0;
        font-size: 11px;
        color: var(--color-red-desc);
      }

      .jackpot-box {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px dashed rgba(255, 255, 255, .35);

        .val {
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
      }

      .jackpot-note {
        margin: 2px 0 0;
        font-size: 11px;
        line-height: 1.5;
        opacity: .78;

        &.is-hit {
          opacity: 1;
          font-weight: 700;
        }
      }
    }
  }

  .right {
    flex: 1 1 auto;
    min-width: 0;

    .inner {
      display: flex;
      min-height: 140px;
      height: 100%;
      overflow: hidden;
      border: 1px solid #fee2e2;
      border-radius: 0.375rem;
      background: #fff;

      .timer {
        width: 30%;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: rgba(254, 242, 242, 0.7);
        padding: 0 0.75rem;

        .issue {
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .countdown {
          margin-top: 0.5rem;
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 0.02em;
          color: var(--color-red-main);
        }
      }

      .open-code {
        position: relative;
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        border-left: 1px solid #fee2e2;
        cursor: pointer;

        .issue {
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-red-desc);
        }

        .main {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          /* ⚠️ 不能 overflow: hidden —— 球落下動畫會往上抬 18px，而這裡球上方
             只有 6px 空間，會被裁掉。橫向溢出仍由外層 .inner（overflow: hidden）擋住。 */
          overflow: visible;

          .ball-legend {
            display: inline-flex;
            flex-direction: column;
            align-items: flex-start;
            flex-shrink: 0;
            margin-right: 0.25rem;
            padding: 0.375rem 0.625rem;

            .ball-legend-title {
              height: 45px;
              display: flex;
              align-items: center;
              font-size: 12px;
              font-weight: 700;
              color: var(--color-red-main);

              span {
                border: 1px solid var(--color-red-main);
                border-radius: 0.25rem;
                padding: 0 0.25rem;
                transition: background 0.15s, color 0.15s;
              }
            }
          }

          .ball-row {
            flex: 1 1 auto;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            gap: 4px;
            min-width: 0;
          }

          .ball-warp {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            /* 新一期開出：依序落下彈跳（--i 是第幾顆） */
            animation: x5-ball-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
            animation-delay: calc(var(--i, 0) * 0.12s);

            /* 準備開獎／開獎中：持續翻點抖動 */
            &.is-rolling {
              animation: x5-ball-roll 0.32s linear infinite;
              animation-delay: calc(var(--i, 0) * 0.06s);
            }

            .ball-pos {
              font-size: 10px;
              font-weight: 700;
              color: var(--color-red-desc);
            }
          }

          .open-meta {
            /* 球落定後才浮出（延遲＝最後一顆的 delay + 動畫長度） */
            animation: x5-meta-in 0.4s ease both;
            animation-delay: 0.62s;
            margin-left: 0.5rem;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 700;

            .meta-sum {
              border-radius: 0.25rem;
              background: var(--color-red-main);
              padding: 1px 8px;
              text-align: center;
              color: #fff;
            }

            .meta-tag {
              border: 1px solid var(--color-red-main);
              border-radius: 0.25rem;
              padding: 1px 8px;
              text-align: center;
              color: var(--color-red-main);

              /* 小／雙用藍色（--text-blue 是專案既有的文字藍，與 6hc 球色同一支） */
              &.is-blue {
                border-color: var(--text-blue);
                color: var(--text-blue);
              }
            }
          }
        }
      }
    }
  }
}

/* 視窗不夠寬時退回上下兩段（一列會擠到開獎球） */
@media (max-width: 1180px) {
  .header-warp {
    flex-direction: column;

    .left {
      width: 100%;

      .info-bonus {
        flex: 1 1 auto;
      }
    }
  }
}

@media (max-width: 720px) {
  .header-warp .left {
    flex-direction: column;

    .info .title {
      font-size: 42px;
      letter-spacing: -2px;
    }
  }
}

/* ── 開獎動畫 ─────────────────────────────────────────────── */
@keyframes x5-ball-in {
  0% {
    opacity: 0;
    transform: translateY(-18px) scale(0.7) rotate(-20deg);
  }

  60% {
    opacity: 1;
    transform: translateY(3px) scale(1.08) rotate(5deg);
  }

  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes x5-ball-roll {
  0% {
    transform: translateY(0) rotate(0deg);
  }

  25% {
    transform: translateY(-7px) rotate(14deg);
  }

  50% {
    transform: translateY(0) rotate(0deg);
  }

  75% {
    transform: translateY(-5px) rotate(-14deg);
  }

  100% {
    transform: translateY(0) rotate(0deg);
  }
}

@keyframes x5-meta-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

/* 使用者要求減少動態時只留最終狀態 */
@media (prefers-reduced-motion: reduce) {

  .ball-warp,
  .ball-warp.is-rolling,
  .open-meta {
    animation: none !important;
  }
}
</style>
