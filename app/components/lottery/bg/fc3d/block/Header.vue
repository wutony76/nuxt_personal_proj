<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/fc3d/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { FC3D_DIGIT_MAX, FC3D_SUM_BIG_LINE, fc3dDigitsOf, fc3dSumOf, fc3dIsTriple } from '#shared/config/fc3d'
import { useFc3d } from '~/composables/useFc3d'

/**
 * 福彩3D頁首
 *
 * 版面比照 eggs 的 Header（`.header-warp` 4px 深紅外框 + 金色漸層頂條）。
 * 三星直選改吃分層彩池後補回獎金框（`.info-bonus`）——這裡顯示的是**全站爆池**
 * （開出豹子觸發，比照 eggs 的 jackpot-box）；三星直選自己的分層彩池另外顯示在
 * Board.vue 的三星直選分頁（那是玩法專屬資訊，不是全站資訊）。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void }>()

const { current: mxCurrent, time: mxTime, lotteryMeta, creditJackpot: mxJackpot } = useFc3d()

const money = (value: number) =>
  Number(value ?? 0).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 全站爆池（總額／預估發放／觸發機率，比照 eggs 的 .info-bonus 三列） */
const jackpotReady = computed(() => Number(mxJackpot.rakeRatio) > 0)
const jackpotPool = computed(() => Number(mxJackpot.distributable ?? 0))
const jackpotHitRate = computed(() => `${(Number(mxJackpot.hitRate ?? 0) * 100).toFixed(2)}%`)
const jackpotBelowMin = computed(() => jackpotPool.value < Number(mxJackpot.minPool ?? 0))
const jackpotRakePct = computed(() => `${(Number(mxJackpot.rakeRatio ?? 0) * 100).toFixed(0)}%`)
const estimatedPayout = computed(() => Number((jackpotPool.value * Number(mxJackpot.payoutRatio ?? 0)).toFixed(2)))

const issueCurrent = computed(() => String(mxCurrent.runtime?.issueCurrent ?? '—'))
const issueLatest = computed(() => String(mxCurrent.runtime?.issueLatest ?? '—'))
const currentStatus = computed(() => String(mxCurrent.runtime?.currentStatus ?? STATUS_TIME.PREPARE))
const countdown = computed(() => mxTime.statusRemainLabel || '00:00')

const _handlers = {
  /** 把 mm:ss 或 hh:mm:ss 轉成秒（封盤前 5 秒要換文案，同 eggs/k3） */
  countdownSeconds: (label: string) => {
    if (!label) return Number.POSITIVE_INFINITY
    const parts = label.split(':').map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
    return Number.POSITIVE_INFINITY
  }
}

/** 開盤中且剩 5 秒內改顯示「準備封盤 N」（同 eggs） */
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
const balls = computed(() => (openCode.value.length > 0 ? openCode.value : [0, 0, 0]))
const digits = computed(() => fc3dDigitsOf(openCode.value))
const sum = computed(() => (digits.value ? fc3dSumOf(digits.value) : 0))
const isTriple = computed(() => (digits.value ? fc3dIsTriple(digits.value) : false))
const isBig = computed(() => sum.value > FC3D_SUM_BIG_LINE)
const isOdd = computed(() => sum.value % 2 === 1)

/**
 * 開獎動畫
 *   準備開獎／開獎中 → 三顆球持續翻點並抖動（rolling）
 *   新一期開出       → 依序落下彈跳（revealToken 遞增讓 key 變動、CSS 動畫重播）
 */
const ROLL_INTERVAL_MS = 90
const anim = reactive({
  rolling: false,
  rollFaces: [0, 0, 0] as number[],
  revealToken: 0
})
let rollTimer: ReturnType<typeof setInterval> | null = null

const isDrawing = computed(() =>
  currentStatus.value === STATUS_TIME.PREPARE_OPEN || currentStatus.value === STATUS_TIME.OPENING
)
const displayBalls = computed(() => (anim.rolling ? anim.rollFaces : balls.value))

const _anim = {
  start: () => {
    if (rollTimer) return
    anim.rolling = true
    rollTimer = setInterval(() => {
      anim.rollFaces = [0, 1, 2].map(() => Math.floor(Math.random() * (FC3D_DIGIT_MAX + 1)))
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

  watch(issueLatest, (next, prev) => {
    if (!next || next === '—' || next === prev) return
    _anim.stop()
    anim.revealToken += 1
  })
}

onBeforeUnmount(() => { _anim.stop() })
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">福彩3D</h1>
        <p class="sub">官方玩法</p>
        <p class="lotteryId">LOTTERY_ID: {{ lotteryMeta.id }}</p>
      </div>

      <!-- 獎金框：全站爆池（開出豹子觸發），版位比照 eggs 的 .info-bonus -->
      <div class="info-bonus">
        <div class="row">
          <span class="label">爆池總額</span>
          <span class="val val-big">{{ money(jackpotPool) }}</span>
        </div>
        <div class="row">
          <span class="label">預估發放</span>
          <span class="val val-big">{{ money(estimatedPayout) }}</span>
        </div>
        <div class="row">
          <span class="label">觸發機率</span>
          <span class="accent">{{ jackpotHitRate }}</span>
        </div>
        <p class="pool-note">※ 彩池由全部分頁投注抽水 {{ jackpotRakePct }} 累積</p>

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
              <div class="ball-legend-title"><span>百 / 十 / 個</span></div>
            </div>

            <div v-for="(code, idx) in displayBalls" :key="`fc3d-open-${anim.revealToken}-${idx}`" class="ball-warp"
              :class="{ 'is-rolling': anim.rolling }" :style="{ '--i': idx }">
              <Ball :digit="code" size="lg" :pending="!anim.rolling && openCode.length === 0" />
            </div>

            <div v-if="openCode.length > 0 && !anim.rolling" :key="`fc3d-meta-${anim.revealToken}`" class="open-meta">
              <span class="meta-sum">和值 {{ sum }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isBig }">{{ isBig ? '大' : '小' }}</span>
              <span class="meta-tag" :class="{ 'is-blue': !isOdd }">{{ isOdd ? '單' : '雙' }}</span>
              <span v-if="isTriple" class="meta-tag is-triple">豹子</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 樣式沿用 eggs 的 .header-warp，移除獎金框（fc3d 沒有彩池／爆池） */
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
    align-items: center;
    justify-content: flex-start;
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

    /* 獎金框：全站爆池，樣式沿用 eggs 的 .info-bonus（固定寬度、不跟右側搶空間） */
    .info-bonus {
      flex: 0 0 250px;
      display: grid;
      gap: 0.375rem;
      align-content: start;
      border: 1px solid #fee2e2;
      border-radius: 0.375rem;
      padding: 0.625rem;
      margin-left: 1rem;

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

        .main {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          overflow: visible;
          white-space: nowrap;

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
              }
            }
          }

          .ball-warp {
            display: inline-flex;
            align-items: center;
            animation: fc3d-ball-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
            animation-delay: calc(var(--i, 0) * 0.12s);

            &.is-rolling {
              animation: fc3d-ball-roll 0.32s linear infinite;
              animation-delay: calc(var(--i, 0) * 0.06s);
            }
          }

          .open-meta {
            animation: fc3d-meta-in 0.4s ease both;
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

@media (max-width: 1180px) {
  .header-warp {
    flex-direction: column;

    .left {
      width: 100%;
    }
  }
}

@media (max-width: 720px) {
  .header-warp .left .info .title {
    font-size: 38px;
    letter-spacing: -1px;
  }
}

@keyframes fc3d-ball-in {
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

@keyframes fc3d-ball-roll {
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

@keyframes fc3d-meta-in {
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
