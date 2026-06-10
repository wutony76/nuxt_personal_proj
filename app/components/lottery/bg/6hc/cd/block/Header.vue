<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import Ball from '~/components/lottery/bg/6hc/cd/base/Ball.vue'
import { STATUS_TIME } from '~/config/constants'
import { lottery_id as cdLotteryId } from '~/services/lottery6hcCreditService'

// ── Types ──────────────────────────────────────────────────────────────────

type OpenCodeItem = string | number | { num?: string | number; animal?: string }
type OpenCodePlayItem = {
  num?: string | number
  label?: string | number
  animal?: string
  countIssue?: number
  countShow?: number
}
type HeaderData = {
  name?: string
  id?: string | number
  issueLatest?: string | number
  issueCurrent?: string | number
  currentStatus?: string
  countdown?: string
  openCode?: OpenCodeItem[]
  openCodePlay?: OpenCodePlayItem[]
}
type LotteryInfoData = {
  name?: string
  id?: string | number
}

// ── Default fallbacks ─────────────────────────────────────────────────────

const DEFAULT_HEADER_DATA: Required<HeaderData> = {
  name: '六合彩',
  id: '-',
  issueLatest: '999',
  issueCurrent: '999',
  currentStatus: '開獎中',
  countdown: '00:00',
  openCode: ['1', '2', '3', '4', '5', '6', '14'],
  openCodePlay: []
}

// ── Composable ────────────────────────────────────────────────────────────
const props = defineProps<{
  lotteryInfo?: LotteryInfoData
}>()
const emit = defineEmits<{
  (event: 'open-opencode-dialog'): void
}>()
const { current: mxCurrent, time: mxTime, isOpening, livePool: mxLivePool } = use6hcCredit()


// ── Normalized data ───────────────────────────────────────────────────────
const normalizedData = computed(() => {
  const source = (mxCurrent.runtime ?? {}) as Partial<HeaderData>
  const base = props.lotteryInfo ?? {}
  return {
    name: base.name ?? DEFAULT_HEADER_DATA.name,
    id: base.id ?? DEFAULT_HEADER_DATA.id,
    issueLatest: source.issueLatest ?? DEFAULT_HEADER_DATA.issueLatest,
    issueCurrent: source.issueCurrent ?? DEFAULT_HEADER_DATA.issueCurrent,
    currentStatus: source.currentStatus ?? DEFAULT_HEADER_DATA.currentStatus,
    countdown: (mxTime.statusRemainSec > 0 ? mxTime.statusRemainLabel : '') || source.countdown || DEFAULT_HEADER_DATA.countdown,
    openCode:
      Array.isArray(source.openCode) && source.openCode.length > 0
        ? source.openCode
        : DEFAULT_HEADER_DATA.openCode,
    openCodePlay:
      Array.isArray(source.openCodePlay) && source.openCodePlay.length > 0
        ? source.openCodePlay
        : DEFAULT_HEADER_DATA.openCodePlay
  }
})


// ── Individual computeds ──────────────────────────────────────────────────
const lotteryName = computed(() => normalizedData.value.name || '六合彩(CD)')
const lotteryId = computed(() => cdLotteryId || normalizedData.value.id || '-')
const issueLatest = computed(() => String(normalizedData.value.issueLatest))
const issueCurrent = computed(() => String(normalizedData.value.issueCurrent || issueLatest.value))
const currentStatus = computed(() => String(normalizedData.value.currentStatus))
const countdown = computed(() => String(normalizedData.value.countdown))

// ── Jackpot animation ─────────────────────────────────────────────────────
const cdLivePool = mxLivePool

const displayPool = ref(0)
let rafId: number | null = null

function animateTo(target: number, durationMs = 15000) {
  if (rafId !== null) cancelAnimationFrame(rafId)
  const from = displayPool.value
  const diff = target - from
  if (Math.abs(diff) < 0.01) { displayPool.value = target; return }
  const start = performance.now()
  function step(now: number) {
    const t = Math.min((now - start) / durationMs, 1)
    const ease = 1 - Math.pow(1 - t, 3)
    displayPool.value = Number((from + diff * ease).toFixed(2))
    if (t < 1) { rafId = requestAnimationFrame(step) }
    else { rafId = null }
  }
  rafId = requestAnimationFrame(step)
}

onMounted(() => {
  displayPool.value = cdLivePool.value
  watch(cdLivePool, (newVal) => {
    if (newVal > displayPool.value) {
      animateTo(newVal)
    } else {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      displayPool.value = newVal
    }
  })
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

const totalJackpot = computed(() => {
  if (cdLivePool.value > 0) {
    return displayPool.value.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(mxCurrent.runtime?.jackpot?.currentIssueJackpot ?? '1,000,000,000')
})

const estimatedJackpot = computed(() => {
  if (cdLivePool.value > 0) {
    return (displayPool.value * 0.4).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(mxCurrent.runtime?.jackpot?.carryJackpot ?? '1,000,000')
})

const winRate = computed(() => '25.84%')

// ── Status display ────────────────────────────────────────────────────────
const _handlers = {
  parseCountdownSeconds: (countdownLabel: string) => {
    if (!countdownLabel) return Number.POSITIVE_INFINITY
    const timeParts = countdownLabel
      .split(':')
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 0)
    if (timeParts.length === 2) {
      const minute = timeParts[0] ?? 0
      const second = timeParts[1] ?? 0
      return (minute * 60) + second
    }
    if (timeParts.length === 3) {
      const hour = timeParts[0] ?? 0
      const minute = timeParts[1] ?? 0
      const second = timeParts[2] ?? 0
      return (hour * 3600) + (minute * 60) + second
    }
    return Number.POSITIVE_INFINITY
  }
}

const displayCurrentStatus = computed(() => {
  if (currentStatus.value !== STATUS_TIME.OPEN) return currentStatus.value
  const remainSeconds = _handlers.parseCountdownSeconds(countdown.value)
  if (remainSeconds === 5) return STATUS_TIME.PREPARE_CLOSE_5
  if (remainSeconds === 4) return STATUS_TIME.PREPARE_CLOSE_4
  if (remainSeconds === 3) return STATUS_TIME.PREPARE_CLOSE_3
  if (remainSeconds === 2) return STATUS_TIME.PREPARE_CLOSE_2
  if (remainSeconds === 1) return STATUS_TIME.PREPARE_CLOSE_1
  return currentStatus.value
})

const openBalls = computed(() => {
  const playList = normalizedData.value.openCodePlay
  if (Array.isArray(playList) && playList.length > 0) {
    return playList.map((item) => ({
      num: String(item.num ?? item.label ?? '').padStart(2, '0'),
      countShow: Number(item.countShow ?? -1)
    }))
  }
  return normalizedData.value.openCode.map((item) => ({
    num: String(typeof item === 'object' && item !== null ? (item as any).num ?? '' : item).padStart(2, '0'),
    countShow: -1
  }))
})

const openingBalls = computed(() => {
  const codes = Array.isArray(mxCurrent.runtime?.openingCode) ? (mxCurrent.runtime!.openingCode as string[]) : []
  if (codes.length === 0) return Array.from({ length: 7 }, () => '??')
  return codes.map((c) => String(c).padStart(2, '0'))
})
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">{{ lotteryName }}</h1>
        <p class="sub">信用玩法</p>
        <p class="lotteryId">LOTTERY_ID: {{ lotteryId }}</p>
      </div>
      <div class="info-bonus">
        <div class="row">
          <span class="label">總獎金</span>
          <span class="val val-big">{{ totalJackpot }}</span>
        </div>
        <div class="row">
          <span class="label">預估頭獎</span>
          <span class="val val-big">{{ estimatedJackpot }}</span>
        </div>
        <div class="row">
          <span class="label">中獎機率</span>
          <span class="accent">{{ winRate }}</span>
        </div>
      </div>
    </div>

    <div class="right">
      <div class="inner">
        <div class="timer">
          <div class="issue">第{{ issueCurrent }}期
            <div>{{ displayCurrentStatus }}</div>
          </div>
          <div class="countdown">{{ countdown }}</div>
        </div>
        <div class="open-code" role="button" tabindex="0" @click="emit('open-opencode-dialog')"
          @keydown.enter="emit('open-opencode-dialog')" @keydown.space.prevent="emit('open-opencode-dialog')">
          <div class="issue">第{{ issueLatest }}期 開獎</div>
          <div class="main">
            <div class="ball-legend">
              <div class="ball-legend-title">
                <span>開獎號碼</span>
              </div>
              <div class="ball-legend-counts">
                <div class="ball-legend-count">攪出次數</div>
              </div>
            </div>
            <div v-for="(ball, idx) in openBalls" :key="`${idx}-${ball.num}`" class="ball-warp">
              <span v-if="idx === openBalls.length - 1" class="plus">+</span>
              <Ball :data="{ label: ball.num, num: ball.num, selected: true, countShow: ball.countShow }" :is-click="false" />
            </div>
          </div>

          <Transition name="overlay-fade">
            <div v-if="isOpening" class="opening-overlay">
              <div class="opening-issue">第{{ issueCurrent }}期 正在開獎</div>
              <div class="opening-balls">
                <div v-for="(code, idx) in openingBalls" :key="idx" class="opening-slot">
                  <span v-if="idx === openingBalls.length - 1" class="opening-plus">+</span>
                  <div class="opening-ball-inner">
                    <Ball :data="{ label: code, num: code, selected: true }" :is-click="false" />
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header-warp {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 4px solid #7f1d1d;
  border-radius: 0.5rem;
  background: #fff;
  padding: 10px 20px;
  box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
  position: relative;
  overflow: hidden;
  animation: cd-header-in 0.55s ease both;
  animation-delay: 0.08s;

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
    width: 100%;
    display: flex;
    align-items: stretch;
    justify-content: flex-start;
    gap: 1rem;
    border-radius: 0.375rem;
    padding: 1rem;
    background: unset;

    .info {
      min-width: 0;
      flex-shrink: 0;

      .title {
        margin: 0;
        font-family: var(--font-brush), "Noto Serif TC", serif;
        font-size: 65px;
        letter-spacing: -8px;
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
      margin-top: 0.75rem;
      min-width: 240px;
      flex: 1;
      display: grid;
      gap: 0.375rem;
      border: 1px solid #fee2e2;
      border-radius: 0.375rem;
      padding: 0.625rem;
      background: unset;

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
          color: #b91c1c;
        }
      }
    }
  }

  .right {
    flex: 1;

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
          gap: 0.3rem;
          overflow: hidden;
          white-space: nowrap;

          .ball-legend {
            display: inline-flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            flex-shrink: 0;
            margin-right: 0.25rem;
            padding: 0.375rem 0.625rem;
            background: #fff;

            .ball-legend-title {
              height: 45px;
              display: flex;
              align-items: center;
              justify-content: start;
              font-size: 12px;
              font-weight: 700;
              color: var(--color-red-main);

              span {
                border: 1px solid var(--color-red-main);
                border-radius: 0.25rem;
                padding: 0 0.25rem;
              }
            }

            .ball-legend-counts {
              margin-top: 6px;
              display: grid;
              gap: 2px;
            }

            .ball-legend-count {
              text-align: left;
              font-size: 12px;
              color: var(--color-red-desc);
              border: 1px solid var(--color-red-desc);
              border-radius: 0.25rem;
              padding: 0 0.25rem;
            }
          }
        }

        .ball-warp {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;

          :deep(.ball) {
            width: 45px;
            height: 45px;
            font-size: 26px;
            cursor: default;
          }

          .plus {
            margin-right: 0.5rem;
            display: inline-flex;
            align-items: flex-start;
            justify-content: start;
            flex-shrink: 0;
            height: 60px;
            font-size: 22px;
            line-height: 1;
            font-weight: 700;
            color: var(--color-black);
          }
        }

        .opening-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.97);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          z-index: 10;
          pointer-events: none;

          .opening-issue {
            font-size: 13px;
            font-weight: 700;
            color: var(--color-red-main);
            letter-spacing: 0.02em;
          }

          .opening-balls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.3rem;

            .opening-slot {
              display: flex;
              align-items: center;

              .opening-plus {
                margin-right: 0.5rem;
                font-size: 20px;
                font-weight: 700;
                color: var(--color-black);
              }

              .opening-ball-inner {
                :deep(.ball) {
                  width: 45px;
                  height: 45px;
                  font-size: 26px;
                  cursor: default;
                }
              }
            }
          }
        }
      }
    }
  }

}

@keyframes cd-header-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes placeholder-pulse {
  from {
    opacity: 0.4;
    transform: scale(0.92);
  }

  to {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes ball-drop-in {
  0% {
    transform: translateY(-40px) scale(0.4) rotate(-120deg);
    opacity: 0;
  }

  55% {
    transform: translateY(6px) scale(1.2) rotate(8deg);
    opacity: 1;
  }

  75% {
    transform: translateY(-4px) scale(0.93) rotate(-3deg);
  }

  100% {
    transform: translateY(0) scale(1) rotate(0deg);
    opacity: 1;
  }
}

.ball-pop-enter-active {
  animation: ball-drop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ball-pop-leave-active {
  transition: all 0.1s ease;
}

.ball-pop-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.35s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

@media (min-width: 1024px) {
  .header-warp {
    flex-direction: row;

    .left {
      width: 40%;
    }

    .info {
      margin-right: 0.75rem;
    }

    .open-code {
      width: 60%;
    }
  }
}
</style>
