<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { use6hcCredit } from '~/composables/use6hcCredit'
import { api } from '~/services/api'
import PlayTabs from '~/components/lottery/bg/6hc/cd/PlayTabs.vue'
import PlayPanel from '~/components/lottery/bg/6hc/cd/PlayPanel.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const credit = use6hcCredit()
const state = reactive({
  userName: '-',
  userId: '-',
  creditLimit: 784500000,
  balanceLimit: 784500000,
  drawLabel: '澳門6合彩',
  issue: '2026044',
  openCodes: ['23', '49', '35', '21', '46', '06'],
  specialCode: '39',
  countdownSeconds: 300,
  countdownLabel: '00:05:00',
  countdownTimer: null
})

const playList = computed(() => credit.playList.value || [])
const availableCodes = computed(() => credit.availableCodes.value || [])
const canSubmit = computed(() => Boolean(credit.canSubmit.value))
const playKeySet = computed(() => new Set(playList.value.map((item) => item.key)))
const routePlayKey = computed(() => String(route.params.play || '').toLowerCase())
const ballClassMap = {
  red: new Set(['01', '02', '07', '08', '12', '13', '18', '19', '23', '24', '29', '30', '34', '35', '40', '45', '46']),
  blue: new Set(['03', '04', '09', '10', '14', '15', '20', '25', '26', '31', '36', '37', '41', '42', '47', '48']),
  green: new Set(['05', '06', '11', '16', '17', '21', '22', '27', '28', '32', '33', '38', '39', '43', '44', '49'])
}

const _handlers = {
  formatCountdown: (total) => {
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
    const hour = String(Math.floor(safeTotal / 3600)).padStart(2, '0')
    const minute = String(Math.floor((safeTotal % 3600) / 60)).padStart(2, '0')
    const second = String(safeTotal % 60).padStart(2, '0')
    return `${hour}:${minute}:${second}`
  },
  getBallClass: (code) => {
    const normalized = String(code || '').padStart(2, '0')
    if (ballClassMap.red.has(normalized)) return 'red'
    if (ballClassMap.blue.has(normalized)) return 'blue'
    return 'green'
  }
}

const _actions = {
  syncPlayByRoute: async () => {
    if (playList.value.length === 0) return
    const target = routePlayKey.value
    if (!playKeySet.value.has(target)) {
      await router.replace('/lottery/bg/6hc-cd/tema')
      return
    }
    await credit.actions.fetchPlayByKey(target)
  },
  syncCountdown: () => {
    state.countdownSeconds = Math.max(0, state.countdownSeconds - 1)
    state.countdownLabel = _handlers.formatCountdown(state.countdownSeconds)
    if (state.countdownSeconds === 0) {
      state.countdownSeconds = 300
      state.countdownLabel = _handlers.formatCountdown(state.countdownSeconds)
    }
  },
  startCountdown: () => {
    _actions.stopCountdown()
    state.countdownLabel = _handlers.formatCountdown(state.countdownSeconds)
    state.countdownTimer = setInterval(() => {
      _actions.syncCountdown()
    }, 1000)
  },
  stopCountdown: () => {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer)
      state.countdownTimer = null
    }
  },
  initUserInfo: async () => {
    await auth.init()
    state.userName = String(auth.user.value?.name || 'Guest')
    state.userId = String(auth.user.value?.id || '-')
    try {
      const userInfo = await api.lottery.userInfo()
      const coin = Number(userInfo?.coin ?? 0)
      state.creditLimit = coin
      state.balanceLimit = coin
    } catch {
      state.creditLimit = 784500000
      state.balanceLimit = 784500000
    }
  }
}

watch(routePlayKey, async () => {
  await _actions.syncPlayByRoute()
})

onMounted(async () => {
  await _actions.initUserInfo()
  await credit.actions.initPlay()
  await _actions.syncPlayByRoute()
  _actions.startCountdown()
})

onBeforeUnmount(() => {
  _actions.stopCountdown()
})
</script>

<template>
  <div class="base lottery-6hc-cd">
    <LotteryBgBaseTop theme="blue" />
    <main class="main">
      <section class="cd-layout">
        <aside class="member-side">
          <article class="member-card">
            <div class="member-head">{{ state.userName }}</div>
            <div class="member-body">
              <div class="row">
                <span>盤口類型：</span>
                <strong>盤口A</strong>
              </div>
              <div class="row">
                <span>信用額度：</span>
                <strong>{{ Number(state.creditLimit || 0).toLocaleString() }}</strong>
              </div>
              <div class="row">
                <span>剩餘額度：</span>
                <strong>{{ Number(state.balanceLimit || 0).toLocaleString() }}</strong>
              </div>
            </div>
            <div class="member-id">USER_ID: {{ state.userId }}</div>
          </article>
        </aside>

        <section class="content-main">
          <header class="draw-header">
            <div class="draw-left">
              <div class="draw-title">
                <h1>{{ state.drawLabel }}</h1>
                <span>第 {{ state.issue }} 期</span>
              </div>
              <div class="draw-balls">
                <span
                  v-for="code in state.openCodes"
                  :key="`normal-${code}`"
                  class="ball"
                  :class="_handlers.getBallClass(code)">
                  {{ code }}
                </span>
                <span class="plus-sign">+</span>
                <span class="ball" :class="_handlers.getBallClass(state.specialCode)">
                  {{ state.specialCode }}
                </span>
              </div>
            </div>
            <div class="draw-right">
              <span>倒計時</span>
              <strong>{{ state.countdownLabel }}</strong>
            </div>
          </header>

          <PlayTabs
            :plays="playList"
            :selected-key="credit.state.selectedPlayKey"
            base-path="/lottery/bg/6hc-cd" />

          <div v-if="credit.state.fetchStatus === 'loading'" class="state-block">玩法資料載入中...</div>
          <div v-else-if="credit.state.fetchStatus === 'error'" class="state-block error">{{ credit.state.errorMessage }}</div>
          <PlayPanel
            v-else-if="credit.state.activePlay"
            :play="credit.state.activePlay"
            :selected-type="credit.state.selectedTypeName"
            :available-codes="availableCodes"
            :selected-codes="credit.state.selectedCodes"
            :amount="credit.state.amount"
            :custom-code-input="credit.state.customCodeInput"
            :can-submit="canSubmit"
            :submit-status="credit.state.submitStatus"
            :message="credit.state.message"
            :error-message="credit.state.errorMessage"
            :last-order-id="credit.state.lastOrderId"
            :last-orders="credit.state.lastOrders"
            @select-type="credit.click.handleSelectType"
            @toggle-code="credit.click.handleToggleCode"
            @quick-amount="credit.click.handleQuickAmount"
            @submit-bet="credit.click.handleSubmitBet"
            @append-custom-code="credit.click.handleAppendCustomCode"
            @reset-selection="credit.click.handleResetSelection"
            @update:amount="credit.state.amount = $event"
            @update:custom-code-input="credit.state.customCodeInput = $event" />
        </section>
      </section>
    </main>
  </div>
</template>

<style lang="scss">
.lottery-6hc-cd {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  >.main {
    width: min(1360px, 97%);
    margin: 0.8rem auto 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .cd-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0.75rem;
    min-height: 0;
  }

  .member-side {
    min-height: 100%;
  }

  .member-card {
    border: 1px solid #d7dee7;
    border-radius: 8px;
    background: #fff;
    overflow: hidden;
  }

  .member-head {
    padding: 0.65rem 0.8rem;
    font-weight: 700;
    color: #516b7d;
    border-bottom: 1px solid #e7edf2;
  }

  .member-body {
    padding: 0.65rem 0.8rem;
    display: grid;
    gap: 0.45rem;

    .row {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      color: #6a7f8f;
      font-size: 0.8rem;

      strong {
        color: #405564;
      }
    }
  }

  .member-id {
    border-top: 1px solid #e7edf2;
    padding: 0.55rem 0.8rem;
    font-size: 0.72rem;
    color: #94a4b0;
  }

  .content-main {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .draw-header {
    border: 1px solid #d7dee7;
    border-radius: 8px;
    background: #fff;
    padding: 0.7rem 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .draw-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .draw-title {
    h1 {
      margin: 0;
      font-size: 1rem;
      color: #405564;
    }

    span {
      display: block;
      margin-top: 0.2rem;
      color: #7c90a0;
      font-size: 0.75rem;
    }
  }

  .draw-balls {
    display: flex;
    align-items: center;
    gap: 0.32rem;
  }

  .ball {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 0.9rem;

    &.red {
      background: #2d9fe2;
    }

    &.blue {
      background: #459bd4;
    }

    &.green {
      background: #6ab2e3;
    }
  }

  .plus-sign {
    color: #5f7483;
    font-size: 1rem;
    font-weight: 700;
  }

  .draw-right {
    min-width: 140px;
    border: 1px solid #e7edf2;
    border-radius: 6px;
    padding: 0.45rem 0.6rem;
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;

    span {
      color: #7f94a4;
      font-size: 0.72rem;
    }

    strong {
      color: #2f8fd1;
      font-size: 1.1rem;
    }
  }

  .state-block {
    color: #5f7483;
    font-weight: 700;
    padding: 0.8rem;
    border: 1px solid #e7edf2;
    border-radius: 6px;
    background: #fff;

    &.error {
      color: #2f6d96;
    }
  }

  @media (max-width: 1080px) {
    .cd-layout {
      grid-template-columns: 1fr;
    }

    .draw-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
}
</style>
