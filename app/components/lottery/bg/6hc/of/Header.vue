<script setup lang="ts">
import { computed } from 'vue'

type OpenCodeItem = string | number | { num?: string | number; animal?: string }

type HeaderData = {
  name?: string
  id?: string | number
  issueLatest?: string | number
  issueCurrent?: string | number
  countdown?: string
  totalJackpot?: string | number
  estimatedJackpot?: string | number
  winRate?: string | number
  openCode?: OpenCodeItem[]
}

const DEFAULT_HEADER_DATA: Required<HeaderData> = {
  name: '六合彩',
  id: '-',
  issueLatest: '999',
  issueCurrent: '999',
  countdown: '00:00',
  totalJackpot: '1,000,000,000',
  estimatedJackpot: '1,000,000',
  winRate: '98.76%',
  openCode: ['99', '99', '99', '99', '99', '99', '99']
}

const props = defineProps<{
  data?: HeaderData
}>()

const normalizedData = computed(() => ({
  ...DEFAULT_HEADER_DATA,
  ...(props.data ?? {}),
  openCode:
    Array.isArray(props.data?.openCode) && props.data.openCode.length > 0
      ? props.data.openCode
      : DEFAULT_HEADER_DATA.openCode
}))

const lotteryName = computed(() => normalizedData.value.name || '六合彩(OF)')
const lotteryId = computed(() => normalizedData.value.id || '-')
const issueLatest = computed(() => String(normalizedData.value.issueLatest))
const issueCurrent = computed(() => String(normalizedData.value.issueCurrent || issueLatest.value))
const countdown = computed(() => String(normalizedData.value.countdown))
const totalJackpot = computed(() => String(normalizedData.value.totalJackpot))
const estimatedJackpot = computed(() => String(normalizedData.value.estimatedJackpot))
const winRate = computed(() => String(normalizedData.value.winRate))
const openBalls = computed(() => {
  const list = normalizedData.value.openCode
  if (!Array.isArray(list) || list.length === 0) {
    return []
  }

  return list.map((item) => {
    if (Array.isArray(item)) {
      return {
        num: String(item[0] ?? '').padStart(2, '0'),
        animal: String(item[1] ?? '')
      }
    }

    if (typeof item === 'object' && item !== null) {
      return {
        num: String(item.num ?? '').padStart(2, '0'),
        animal: String(item.animal ?? '')
      }
    }

    return {
      num: String(item).padStart(2, '0'),
      animal: ''
    }
  })
})
</script>

<template>
  <header class="header-warp">
    <div class="header-warp-left">
      <div class="header-warp-main">
        <h1 class="header-warp-title">{{ lotteryName }}</h1>
        <p class="header-warp-sub">官方玩法</p>
        <p class="header-warp-id">LOTTERY_ID: {{ lotteryId }}</p>
      </div>
      <div class="header-warp-stats">
        <div class="header-warp-row">
          <span class="header-warp-label">總獎金</span>
          <span class="header-warp-val header-warp-val-big">{{ totalJackpot }}</span>
        </div>
        <div class="header-warp-row">
          <span class="header-warp-label">預估頭獎</span>
          <span class="header-warp-val header-warp-val-big">{{ estimatedJackpot }}</span>
        </div>
        <div class="header-warp-row">
          <span class="header-warp-label">中獎機率</span>
          <span class="header-warp-accent">{{ winRate }}</span>
        </div>
      </div>
    </div>

    <div class="header-warp-right">
      <div class="header-warp-wrap">
        <div class="header-warp-cd header-warp-cd-narrow">
          <div class="header-warp-issue">第{{ issueCurrent }}期 開獎中</div>
          <div class="header-warp-clock">
            {{ countdown }}
          </div>
        </div>
        <div class="header-warp-open">
          <div class="header-warp-issue">第{{ issueLatest }}期 開獎</div>
          <div class="header-warp-list">
            <div v-for="(ball, idx) in openBalls" :key="`${idx}-${ball.num}-${ball.animal}`" class="header-warp-item">
              <span v-if="idx === openBalls.length - 1" class="header-warp-plus">+</span>
              <div class="header-warp-ball">
                <div class="header-warp-num">{{ ball.num }}</div>
                <div class="header-warp-animal">{{ ball.animal }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
