<script setup lang="ts">
import { computed } from 'vue'
import Ball from '~/components/lottery/bg/6hc/of/base/Ball.vue'

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
  totalJackpot?: string | number
  estimatedJackpot?: string | number
  winRate?: string | number
  openCode?: OpenCodeItem[]
  openCodePlay?: OpenCodePlayItem[]
}

type LotteryInfoData = {
  name?: string
  id?: string | number
}

const DEFAULT_HEADER_DATA: Required<HeaderData> = {
  name: '六合彩',
  id: '-',
  issueLatest: '999',
  issueCurrent: '999',
  currentStatus: '開獎中',
  countdown: '00:00',
  totalJackpot: '1,000,000,000',
  estimatedJackpot: '1,000,000',
  winRate: '98.76%',
  openCode: ['1', '2', '3', '4', '5', '6', '14'],
  openCodePlay: []
}

const props = defineProps<{
  lotteryInfo?: LotteryInfoData
}>()

const { current: mxCurrent, time: mxTime } = use6hcOfficial()

const normalizedData = computed(() => {
  const source = (mxCurrent.runtime ?? {}) as Partial<HeaderData>
  const base = props.lotteryInfo ?? {}
  return {
    name: base.name ?? DEFAULT_HEADER_DATA.name,
    id: base.id ?? DEFAULT_HEADER_DATA.id,
    issueLatest: source.issueLatest ?? DEFAULT_HEADER_DATA.issueLatest,
    issueCurrent: source.issueCurrent ?? DEFAULT_HEADER_DATA.issueCurrent,
    currentStatus: source.currentStatus ?? DEFAULT_HEADER_DATA.currentStatus,
    countdown: mxTime.statusRemainLabel || source.countdown || DEFAULT_HEADER_DATA.countdown,
    totalJackpot: source.totalJackpot ?? DEFAULT_HEADER_DATA.totalJackpot,
    estimatedJackpot: source.estimatedJackpot ?? DEFAULT_HEADER_DATA.estimatedJackpot,
    winRate: source.winRate ?? DEFAULT_HEADER_DATA.winRate,
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

const lotteryName = computed(() => normalizedData.value.name || '六合彩(OF)')
const lotteryId = computed(() => normalizedData.value.id || '-')
const issueLatest = computed(() => String(normalizedData.value.issueLatest))
const issueCurrent = computed(() => String(normalizedData.value.issueCurrent || issueLatest.value))
const currentStatus = computed(() => String(normalizedData.value.currentStatus))
const countdown = computed(() => String(normalizedData.value.countdown))
const totalJackpot = computed(() => String(normalizedData.value.totalJackpot))
const estimatedJackpot = computed(() => String(normalizedData.value.estimatedJackpot))
const winRate = computed(() => String(normalizedData.value.winRate))
const openBalls = computed(() => {
  const playList = normalizedData.value.openCodePlay
  if (Array.isArray(playList) && playList.length > 0) {
    return playList.map((item) => {
      const rawNum = item.num ?? item.label ?? ''
      return {
        num: String(rawNum).padStart(2, '0'),
        animal: String(item.animal ?? ''),
        countIssue: Number(item.countIssue ?? -1),
        countShow: Number(item.countShow ?? -1)
      }
    })
  }

  const list = normalizedData.value.openCode
  if (!Array.isArray(list) || list.length === 0) return []

  return list.map((item) => {
    if (Array.isArray(item)) {
      return {
        num: String(item[0] ?? '').padStart(2, '0'),
        animal: String(item[1] ?? ''),
        countIssue: -1,
        countShow: -1
      }
    }

    if (typeof item === 'object' && item !== null) {
      return {
        num: String(item.num ?? '').padStart(2, '0'),
        animal: String(item.animal ?? ''),
        countIssue: -1,
        countShow: -1
      }
    }

    return {
      num: String(item).padStart(2, '0'),
      animal: '',
      countIssue: -1,
      countShow: -1
    }
  })
})
</script>

<template>
  <header class="header-warp">
    <div class="left">
      <div class="info">
        <h1 class="title">{{ lotteryName }}</h1>
        <p class="sub">官方玩法</p>
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
          <div class="issue">第{{ issueCurrent }}期 {{ currentStatus }}</div>
          <div class="countdown">
            {{ countdown }}
          </div>
        </div>
        <div class="open-code">
          <div class="issue">第{{ issueLatest }}期 開獎</div>
          <div class="main">
            <div class="ball-legend">
              <div class="ball-legend-title">
                <span>開獎號碼</span>
              </div>
              <div class="ball-legend-counts">
                <div class="ball-legend-count">相隔期數</div>
                <div class="ball-legend-count">攪出次數</div>
              </div>
            </div>

            <div v-for="(ball, idx) in openBalls" :key="`${idx}-${ball.num}-${ball.animal}`" class="ball-warp">
              <span v-if="idx === openBalls.length - 1" class="plus">+</span>
              <Ball
                :data="{
                  label: ball.num,
                  num: ball.num,
                  selected: true,
                  countIssue: ball.countIssue,
                  countShow: ball.countShow
                }"
              />
            </div>
          </div>
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
  border: 7px solid #b91c1c;
  border-radius: 0.5rem;
  background: #fff;
  padding: 10px 20px;
  box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);

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
        font-size: 45px;
        font-weight: 800;
        line-height: 1.05;
        color: var(--color-red-main);
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
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        border-left: 1px solid #fee2e2;

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
      }
    }
  }
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
