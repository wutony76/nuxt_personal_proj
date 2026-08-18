<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Car from '~/components/lottery/bg/pk10/base/Car.vue'
import { STATUS_TIME } from '~/config/constants'
import { PK10_OF_PRIZE_TIERS, pk10OfMatchCounts, PK10_OF_PICK_COUNT } from '#shared/config/pk10-of'
import { PK10_CAR_COUNT, PK10_RANK_NAMES, PK10_SUM_BIG_LINE } from '#shared/config/pk10'
import { usePk10 } from '~/composables/usePk10'

/**
 * PK10 頁首
 *
 * 版面與樣式沿用 k3 的 Header（再往上是 6hc-of 的 Header）：
 *   .header-warp  4px 深紅外框 + 金色漸層頂條
 *   .left         .info（大標題 + 玩法 + LOTTERY_ID）＋ .info-bonus（獎金框）
 *   .right .inner .timer（期別／狀態／倒數，佔 30% 淡紅底）＋ .open-code（可點的開獎區）
 *
 * PK10 專屬差異：開獎是 10 台車的名次表，所以開獎區改成一排 10 顆車號球、
 * 球下方標名次；兩面改看「冠亞和」而不是骰子和值，也沒有圍骰那一格。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void }>()

const {
  current: mxCurrent, pool: mxPool, creditJackpot: mxJackpot, time: mxTime,
  lotteryMeta, isCd, actions: mxActions
} = usePk10()

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
 * 預估頭獎 = 可發放彩池 × 頭獎那一層的比例
 *
 * 比例讀 PK10_OF_PRIZE_TIERS 的 match 3（前三直選的頭獎層）而不是寫死 0.7 ——
 * 調整分層比例時這裡自動跟上。信用盤雖然按賠率派彩，但彩池是兩個盤口共用的，
 * 所以顯示同一份頭獎預估。
 */
const jackpotRatio = computed(() => {
  const top = PK10_OF_PRIZE_TIERS.find((tier) => tier.type === 'pool' && tier.match === PK10_OF_PICK_COUNT)
  return top && top.type === 'pool' ? Number(top.ratio) : 0
})
const estimatedJackpot = computed(() => Number((displayPool.value * jackpotRatio.value).toFixed(2)))

/**
 * 中獎機率 = 官方盤前三直選「隨機一注」有中到任一獎項（命中 ≥ 1 個名次）的機率
 *
 * 720 種前三名結果全部窮舉，不寫死數字 —— 分層一改這裡自動跟上。
 * 命中 1 個名次就有三獎，故門檻是 ≥ 1。
 * ⚠️ 前三名是排列，任一注的命中分布都一樣（不像快3 會因注碼而異），所以這個值就是精確值。
 * 常數運算，放模組層算一次，不隨 render 重算。
 */
const PK10_OF_WIN_RATE = (() => {
  const table = pk10OfMatchCounts()
  const total = table.reduce((sum, count) => sum + count, 0)
  const win = total - Number(table[0] ?? 0)
  return total > 0 ? (win / total) * 100 : 0
})()
const winRate = computed(() => `${PK10_OF_WIN_RATE.toFixed(2)}%`)

/**
 * 爆池（兩個盤口共吃一池，所以兩邊都顯示同一個數字）
 *
 * ⚠️ 與上面的「總獎金」是兩個不同的池：那個是官方盤的彩池分頁分層在吃的；
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

/** 已開獎的那一期名次（未開獎的當期不提前顯示） */
const openCode = computed(() => {
  const codes = Array.isArray(mxCurrent.runtime?.openCode) ? mxCurrent.runtime!.openCode : []
  return codes.length === PK10_CAR_COUNT ? codes : []
})
/** 冠亞和與它的兩面（分界讀 PK10_SUM_BIG_LINE，不寫死 12） */
const sum = computed(() => mxActions.sumOf(openCode.value))
const isBig = computed(() => sum.value >= PK10_SUM_BIG_LINE)
const isOdd = computed(() => sum.value % 2 === 1)

/**
 * 開獎動畫
 *
 *   準備開獎／開獎中 → 10 顆球持續跳動、車號亂數翻
 *   新一期開出       → 依序落下彈跳（revealToken 遞增讓 key 變動、CSS 動畫重播）
 *
 * ⚠️ 翻號用到 Math.random，只在 client 的 interval 內跑；初始狀態（rolling: false、
 *    rollCars 固定值）兩端一致，才不會有 hydration mismatch。
 */
const ROLL_INTERVAL_MS = 90
const INITIAL_CARS = Array.from({ length: PK10_CAR_COUNT }, (_, i) => i + 1)
const anim = reactive({
  rolling: false,
  rollCars: [...INITIAL_CARS] as number[],
  revealToken: 0
})
let rollTimer: ReturnType<typeof setInterval> | null = null

const isDrawing = computed(() =>
  currentStatus.value === STATUS_TIME.PREPARE_OPEN || currentStatus.value === STATUS_TIME.OPENING
)
/** 翻號中顯示隨機排列，其餘顯示該期開獎名次（沒開出就顯示待開狀態） */
const displayCars = computed(() => {
  if (anim.rolling) return anim.rollCars
  return openCode.value.length > 0 ? openCode.value.map((code) => Number(code)) : INITIAL_CARS.map(() => 0)
})

const _anim = {
  start: () => {
    if (rollTimer) return
    anim.rolling = true
    rollTimer = setInterval(() => {
      // 洗牌而不是各自亂數：開獎一定是 1 ~ 10 的排列，翻號過程也維持這個性質
      const cars = [...INITIAL_CARS]
      for (let i = cars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = cars[i] as number
        cars[i] = cars[j] as number
        cars[j] = tmp
      }
      anim.rollCars = cars
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

/** 名次短標籤：冠／亞／季／4 ~ 10（球下方那一行，寫全名會太寬） */
const rankLabels = PK10_RANK_NAMES.map((name, idx) => {
  if (idx === 0) return '冠'
  if (idx === 1) return '亞'
  if (idx === 2) return '季'
  return String(idx + 1)
})
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">PK 10</h1>
        <p class="sub">{{ isCd ? '信用玩法' : '官方玩法' }}</p>
        <p class="lotteryId">LOTTERY_ID: {{ lotteryMeta.id }}</p>
      </div>
      <div class="info-bonus">
        <div class="row">
          <span class="label">總獎金</span>
          <span class="val val-big">{{ money(displayPool) }}</span>
        </div>
        <div class="row">
          <span class="label">預估頭獎</span>
          <span class="val val-big">{{ money(estimatedJackpot) }}</span>
        </div>
        <div class="row">
          <span class="label">中獎機率</span>
          <span class="accent">{{ winRate }}</span>
        </div>
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
            <div class="car-legend">
              <div class="car-legend-title"><span>名次</span></div>
            </div>

            <!-- 10 顆車號球：key 帶 revealToken，新一期開出時強制重建讓落下動畫重播 -->
            <div class="car-row">
              <div v-for="(car, idx) in displayCars" :key="`pk10-open-${anim.revealToken}-${idx}`" class="car-warp"
                :class="{ 'is-rolling': anim.rolling }" :style="{ '--i': idx }">
                <Car :car="car" size="md" :pending="!anim.rolling && openCode.length === 0" />
                <span class="car-rank">{{ rankLabels[idx] }}</span>
              </div>
            </div>

            <div v-if="openCode.length > 0 && !anim.rolling" :key="`pk10-meta-${anim.revealToken}`" class="open-meta">
              <span class="meta-sum">冠亞和 {{ sum }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isBig }">{{ isBig ? '大' : '小' }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isOdd }">{{ isOdd ? '單' : '雙' }}</span>
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
        font-size: 76px;
        letter-spacing: -6px;
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

        // &:hover .car-legend-title span {
        //   background: var(--color-red-main);
        //   color: #fff;
        // }

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
          flex-wrap: nowrap;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          /* ⚠️ 不能 overflow: hidden —— 骰子落下動畫會往上抬 18px，而這裡骰子上方
             只有 6px 空間，會被裁掉。橫向溢出仍由外層 .inner（overflow: hidden）擋住。 */
          overflow: visible;
          white-space: nowrap;

          .car-legend {
            display: inline-flex;
            flex-direction: column;
            align-items: flex-start;
            flex-shrink: 0;
            margin-right: 0.25rem;
            padding: 0.375rem 0.625rem;

            .car-legend-title {
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

          .car-warp {
            display: inline-flex;
            align-items: center;
            /* 新一期開出：依序落下彈跳（--i 是第幾顆） */
            animation: pk10-car-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
            animation-delay: calc(var(--i, 0) * 0.12s);

            /* 準備開獎／開獎中：持續翻點抖動 */
            &.is-rolling {
              animation: pk10-car-roll 0.32s linear infinite;
              animation-delay: calc(var(--i, 0) * 0.06s);
            }
          }

          .open-meta {
            /* 骰子落定後才浮出（延遲＝最後一顆的 delay + 動畫長度） */
            animation: pk10-meta-in 0.4s ease both;
            animation-delay: 0.62s;
            margin-left: 0.5rem;
            display: inline-flex;
            flex-direction: column;
            gap: 3px;
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

              &.is-triple {
                border-color: #d97706;
                background: #fef3c7;
                color: #b45309;
              }
            }
          }
        }
      }
    }
  }
}

/* 視窗不夠寬時退回上下兩段（一列會擠到開獎骰子） */
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
      letter-spacing: -4px;
    }
  }
}

/* ── 開獎動畫 ─────────────────────────────────────────────── */
@keyframes pk10-car-in {
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

@keyframes pk10-car-roll {
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

@keyframes pk10-meta-in {
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

  .car-warp,
  .car-warp.is-rolling,
  .open-meta {
    animation: none !important;
  }
}

/* ── PK10 專屬覆寫：開獎區要放 10 顆球，不是 3 顆骰子 ─────── */
.header-warp .right .inner .open-code .main {
  /* 10 顆球比 3 顆骰子寬得多，允許換行並讓球列吃掉剩餘寬度 */
  flex-wrap: wrap;

  .car-row {
    flex: 1 1 auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 4px;
    min-width: 0;
  }

  .car-warp {
    /* 球 + 名次標籤直向排列 */
    flex-direction: column;
    gap: 2px;

    .car-rank {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-red-desc);
    }
  }

  /* 冠亞和那組標籤在 10 顆球旁邊會太擠，改橫排靠右 */
  .open-meta {
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
}

@media (max-width: 1180px) {
  .header-warp .right .inner .open-code .main .car-row {
    /* 窄螢幕讓球自己折行，別把名次標籤壓扁 */
    flex-wrap: wrap;
  }
}
</style>
