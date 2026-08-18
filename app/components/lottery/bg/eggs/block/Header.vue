<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import Ball from '~/components/lottery/bg/eggs/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { EGGS_BIG_LINE, EGGS_DIGIT_MAX, eggsDigitsOf, eggsSumOf } from '#shared/config/eggs'
import { useEggs } from '~/composables/useEggs'

/**
 * PC蛋蛋頁首
 *
 * 版面參照 k3 的 Header（app/components/lottery/bg/k3/block/Header.vue）：
 *   .header-warp  4px 深紅外框 + 金色漸層頂條
 *   .left         標題 + LOTTERY_ID
 *   .right .inner .timer（期別／狀態／倒數）＋ .open-code（可點的開獎區）
 *
 * ── 與 k3 的差異 ────────────────────────────────────────
 *   PC蛋蛋只有信用盤，沒有共用彩池／頭獎預估／中獎機率那一塊獎金框，
 *   開獎球換成 3 顆號碼球（0~9，可重複）。
 */
const emit = defineEmits<{ (event: 'open-opencode-dialog'): void }>()

const { current: mxCurrent, time: mxTime, lotteryMeta } = useEggs()

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
const balls = computed(() => (openCode.value.length > 0 ? openCode.value : [0, 0, 0]))
const digits = computed(() => eggsDigitsOf(openCode.value))
const sum = computed(() => (digits.value ? eggsSumOf(digits.value) : 0))
const isTriple = computed(() => openCode.value.length === 3 && new Set(openCode.value).size === 1)
const isBig = computed(() => sum.value > EGGS_BIG_LINE)
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
/** 翻點中顯示隨機點數，其餘顯示該期開獎號 */
const displayBalls = computed(() => (anim.rolling ? anim.rollFaces : balls.value))

const _anim = {
  start: () => {
    if (rollTimer) return
    anim.rolling = true
    rollTimer = setInterval(() => {
      anim.rollFaces = [0, 1, 2].map(() => Math.floor(Math.random() * (EGGS_DIGIT_MAX + 1)))
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

onBeforeUnmount(_anim.stop)
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">PC蛋蛋</h1>
        <p class="sub">信用玩法</p>
        <p class="lotteryId">LOTTERY_ID: {{ lotteryMeta.id }}</p>
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
            <div v-for="(code, idx) in displayBalls" :key="`eggs-open-${anim.revealToken}-${idx}`" class="ball-warp"
              :class="{ 'is-rolling': anim.rolling }" :style="{ '--i': idx }">
              <Ball :digit="code" size="lg" :pending="!anim.rolling && openCode.length === 0" />
            </div>

            <div v-if="openCode.length > 0 && !anim.rolling" :key="`eggs-meta-${anim.revealToken}`" class="open-meta">
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
                transition: background 0.15s, color 0.15s;
              }
            }
          }

          .ball-warp {
            display: inline-flex;
            align-items: center;
            animation: eggs-ball-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
            animation-delay: calc(var(--i, 0) * 0.12s);

            &.is-rolling {
              animation: eggs-ball-roll 0.32s linear infinite;
              animation-delay: calc(var(--i, 0) * 0.06s);
            }
          }

          .open-meta {
            animation: eggs-meta-in 0.4s ease both;
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

@keyframes eggs-ball-in {
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

@keyframes eggs-ball-roll {
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

@keyframes eggs-meta-in {
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
