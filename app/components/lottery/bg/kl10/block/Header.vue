<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Ball from '~/components/lottery/bg/kl10/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import {
  kl10NumbersOf,
  kl10ParityZoneOf,
  kl10SumOf,
  kl10ZoneOf,
  KL10_BALL_COUNT,
  KL10_NUMBER_MAX,
  KL10_NUMBER_MIN,
  KL10_SUM_BIG_LINE
} from '#shared/config/kl10'
import { useKl10 } from '~/composables/useKl10'

/**
 * 快樂十分頁首
 *
 * 版面參照 k3 的 Header（app/components/lottery/bg/k3/block/Header.vue）：
 *   .header-warp  4px 深紅外框 + 金色漸層頂條
 *   .left         標題 + LOTTERY_ID
 *   .right .inner .timer（期別／狀態／倒數）＋ .open-code（可點的開獎區）
 *
 * ── 與 k3 的差異 ────────────────────────────────────────
 *   快樂十分只有信用盤，沒有共用彩池／頭獎預估／中獎機率那一塊獎金框
 *   （只有一個爆池，獎金框 `.info-bonus` 三列讀的是它），開獎球換成 8 顆號碼球（1~20，不重複）。
 *   兩面標示除了總和大小／單雙，另外帶上下盤與奇偶盤（爆池條件就看奇偶）。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void }>()

const { current: mxCurrent, creditJackpot: mxJackpot, time: mxTime, lotteryMeta } = useKl10()

const money = (value: number) =>
  Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * 彩池（獎金框）
 *
 * 版位與 k3 頁首的 `.info-bonus` 相同（總額／預估／機率三列 + 明細），但**資料來源不同**：
 * k3 的「總獎金」是**官方盤分層派彩在吃的共用彩池**（`pool.distributable`），
 * 快樂十分沒有官方盤、沒有那個池 —— 這裡三列全部讀爆池，各欄語意如下：
 *   總彩池   = 爆池可發放額（當期抽水 + 未發放滾存）
 *   預估發放 = 現在就觸發的話會發出多少（可發放額 × payoutRatio）
 *   觸發機率 = 爆池條件的發生機率（hitRate）
 * ⚠️ 不要把這裡的「總彩池」當成 k3 的共用彩池 —— 兩者是不同的帳，
 *    詳見 shared/config/jackpot.ts 檔頭的警告。
 */
const jackpotReady = computed(() => Number(mxJackpot.rakeRatio) > 0)
const jackpotPool = computed(() => Number(mxJackpot.distributable ?? 0))
const jackpotHitRate = computed(() => `${(Number(mxJackpot.hitRate ?? 0) * 100).toFixed(2)}%`)
/** 累積池未達門檻時不發放，畫面要講清楚 */
const jackpotBelowMin = computed(() => jackpotPool.value < Number(mxJackpot.minPool ?? 0))
const jackpotRakePct = computed(() => `${(Number(mxJackpot.rakeRatio ?? 0) * 100).toFixed(0)}%`)

/**
 * 池額跳動動畫（與 k3 / 6hc-of 的 Header 同一套）
 *
 * 彩池變大時用 rAF 在 15 秒內以 ease-out 跑到新值，變小（發放後歸零）則直接跳到底 ——
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
  displayPool.value = jackpotPool.value
  watch(jackpotPool, (next) => {
    if (next > displayPool.value) _poolAnim.to(next)
    else {
      _poolAnim.stop()
      displayPool.value = next
    }
  })
})

/** 預估發放：現在觸發會發出的金額（其餘滾存至下期） */
const estimatedPayout = computed(() =>
  Number((displayPool.value * Number(mxJackpot.payoutRatio ?? 0)).toFixed(2))
)

const issueCurrent = computed(() => String(mxCurrent.runtime?.issueCurrent ?? '—'))
const issueLatest = computed(() => String(mxCurrent.runtime?.issueLatest ?? '—'))
const currentStatus = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const countdown = computed(() => mxTime.statusRemainLabel || '00:00')

const _handlers = {
  /** 把 mm:ss 或 hh:mm:ss 轉成秒（封盤前 5 秒要換文案，同 k3） */
  countdownSeconds: (label: string) => {
    if (!label) return Number.POSITIVE_INFINITY
    const parts = label.split(':').map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
    return Number.POSITIVE_INFINITY
  }
}

/** 開盤中且剩 5 秒內改顯示「準備封盤 N」（同 k3） */
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

/** 已開獎的那一期號碼球（未開獎的當期不提前顯示） */
const openCode = computed(() => {
  const codes = Array.isArray(mxCurrent.runtime?.openCode) ? mxCurrent.runtime!.openCode : []
  return codes.length > 0 ? codes : []
})
const PLACEHOLDER_BALLS = Array.from({ length: KL10_BALL_COUNT }, () => 0)
const balls = computed(() => (openCode.value.length > 0 ? openCode.value : PLACEHOLDER_BALLS))
const nums = computed(() => kl10NumbersOf(openCode.value))
const sum = computed(() => (nums.value ? kl10SumOf(nums.value) : 0))
const isBig = computed(() => sum.value >= KL10_SUM_BIG_LINE)
const isOdd = computed(() => sum.value % 2 === 1)
/** 上下盤／奇偶盤（和盤在這裡如實顯示「和盤」，注碼才寫成 上下和／奇偶和） */
const zone = computed(() => (nums.value ? kl10ZoneOf(nums.value) : ''))
const parityZone = computed(() => (nums.value ? kl10ParityZoneOf(nums.value) : ''))

/**
 * 開獎動畫
 *   準備開獎／開獎中 → 8 顆球持續翻號並抖動（rolling）
 *   新一期開出       → 依序落下彈跳（revealToken 遞增讓 key 變動、CSS 動畫重播）
 */
const ROLL_INTERVAL_MS = 90
const anim = reactive({
  rolling: false,
  rollFaces: PLACEHOLDER_BALLS as number[],
  revealToken: 0
})
let rollTimer: ReturnType<typeof setInterval> | null = null

const isDrawing = computed(() =>
  currentStatus.value === STATUS_TIME.PREPARE_OPEN || currentStatus.value === STATUS_TIME.OPENING
)
/** 翻點中顯示隨機點數，其餘顯示該期開獎號 */
const displayBalls = computed(() => (anim.rolling ? anim.rollFaces : balls.value))

const _anim = {
  start: () => {
    if (rollTimer) return
    anim.rolling = true
    rollTimer = setInterval(() => {
      // 翻號用的隨機號碼允許重複（只是動畫），落定時才是真正不重複的開獎號
      anim.rollFaces = PLACEHOLDER_BALLS.map(
        () => KL10_NUMBER_MIN + Math.floor(Math.random() * (KL10_NUMBER_MAX - KL10_NUMBER_MIN + 1))
      )
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

  // 新一期開出：停下翻點並播放落下動畫
  watch(issueLatest, (next, prev) => {
    if (!next || next === '—' || next === prev) return
    _anim.stop()
    anim.revealToken += 1
  })
}

onBeforeUnmount(() => {
  _anim.stop()
  _poolAnim.stop()
})
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">快樂十分</h1>
        <p class="sub">信用玩法</p>
        <p class="lotteryId">LOTTERY_ID: {{ lotteryMeta.id }}</p>
      </div>

      <!-- 獎金框：版位同 k3，但三列讀的是爆池（快樂十分沒有官方盤共用彩池） -->
      <div class="info-bonus">
        <div class="row">
          <span class="label">總彩池</span>
          <span class="val val-big">{{ money(displayPool) }}</span>
        </div>
        <div class="row">
          <span class="label">預估發放</span>
          <span class="val val-big">{{ money(estimatedPayout) }}</span>
        </div>
        <div class="row">
          <span class="label">觸發機率</span>
          <span class="accent">{{ jackpotHitRate }}</span>
        </div>
        <p class="pool-note">※ 彩池由 [信用] 投注抽水 {{ jackpotRakePct }} 累積（本彩種無官方盤）</p>

        <div v-if="jackpotReady" class="jackpot-box">
          <div class="row">
            <span class="label">當期抽水</span>
            <span class="val">{{ money(mxJackpot.currentIssueJackpot) }}</span>
          </div>
          <div class="row">
            <span class="label">上期滾存</span>
            <span class="val">{{ money(mxJackpot.carryJackpot) }}</span>
          </div>
          <p class="jackpot-note">
            {{ mxJackpot.hitLabel }}時發放 {{ (mxJackpot.payoutRatio * 100).toFixed(0) }}%<template
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

            <!-- key 帶 revealToken：新一期開出時強制重建，CSS 落下動畫才會重播 -->
            <div v-for="(code, idx) in displayBalls" :key="`kl10-open-${anim.revealToken}-${idx}`" class="ball-warp"
              :class="{ 'is-rolling': anim.rolling }" :style="{ '--i': idx }">
              <Ball :num="code" size="md" :pending="!anim.rolling && openCode.length === 0" />
            </div>

            <div v-if="openCode.length > 0 && !anim.rolling" :key="`kl10-meta-${anim.revealToken}`" class="open-meta">
              <span class="meta-sum">總和 {{ sum }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isBig }">{{ isBig ? '大' : '小' }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isOdd }">{{ isOdd ? '單' : '雙' }}</span>
              <span v-if="zone" class="meta-tag is-zone">{{ zone }}</span>
              <span v-if="parityZone" class="meta-tag is-zone">{{ parityZone }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 樣式沿用 k3 的 .header-warp，僅把骰子換成號碼球、移除共用彩池獎金框 */
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
    flex: 0 0 auto;
    display: flex;
    align-items: stretch;
    justify-content: flex-start;
    /* 標題與獎金框並排（同 k3 的 .left） */
    gap: 1.25rem;
    border-radius: 0.375rem;
    padding: 0.5rem 0;

    .info {
      min-width: 0;
      flex-shrink: 0;

      .title {
        margin: 0;
        font-family: var(--font-brush), "Noto Serif TC", serif;
        font-size: 62px;
        letter-spacing: -2px;
        font-weight: 900;
        line-height: 1.05;
        color: var(--color-red-main);
        padding-left: 0.75rem;
        border-left: 5px solid var(--color-gold);
        white-space: nowrap;
      }

      .sub {
        margin: 0.25rem 0 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--color-red-desc);
        padding-left: 0.75rem;
      }

      .lotteryId {
        margin: 0.125rem 0 0;
        font-size: 13px;
        color: var(--color-red-desc);
        padding-left: 0.75rem;
      }

    }

    /* 獎金框：樣式沿用 k3 的 .info-bonus（固定寬度、不跟右側搶空間） */
    .info-bonus {
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
        border-top: 1px dashed var(--color-gold);
      }

      .jackpot-note {
        margin: 2px 0 0;
        font-size: 11px;
        line-height: 1.5;
        color: var(--color-red-desc);

        &.is-hit {
          color: var(--color-red-main);
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

        /* ⚠️ 8 顆球 + 兩面標籤同一列會超出寬度（eggs 只有 3 顆才 nowrap），故允許換行 */
        .main {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.4rem 0.3rem;
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

          .ball-warp {
            display: inline-flex;
            align-items: center;
            animation: kl10-ball-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
            animation-delay: calc(var(--i, 0) * 0.12s);

            &.is-rolling {
              animation: kl10-ball-roll 0.32s linear infinite;
              animation-delay: calc(var(--i, 0) * 0.06s);
            }
          }

          /* ⚠️ 兩面標示有 4 個（大小／單雙／上下盤／奇偶盤），直排會比球高一截，改流動排列 */
          .open-meta {
            animation: kl10-meta-in 0.4s ease both;
            animation-delay: 0.62s;
            margin-left: 0.5rem;
            display: inline-flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            max-width: 9rem;
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

              &.is-blue {
                border-color: var(--text-blue);
                color: var(--text-blue);
              }

              &.is-zone {
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

@media (max-width: 1180px) {
  .header-warp {
    flex-direction: column;

    .left {
      width: 100%;
    }
  }
}

@media (max-width: 720px) {
  .header-warp .left {
    /* 窄畫面標題與獎金框改上下排，獎金框不再固定 250px */
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-warp .left .info .title {
    font-size: 38px;
    letter-spacing: -1px;
  }

  .header-warp .left .info-bonus {
    flex: 1 1 100%;
  }
}

@keyframes kl10-ball-in {
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

@keyframes kl10-ball-roll {
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

@keyframes kl10-meta-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {

  .ball-warp,
  .ball-warp.is-rolling,
  .open-meta {
    animation: none !important;
  }
}
</style>
