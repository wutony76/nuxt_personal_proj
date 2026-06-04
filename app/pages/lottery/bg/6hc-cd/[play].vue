<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { use6hcCredit } from '~/composables/use6hcCredit'
import PlayTabs from '~/components/lottery/bg/6hc/cd/PlayTabs.vue'
import PlayPanel from '~/components/lottery/bg/6hc/cd/PlayPanel.vue'
import Header from '~/components/lottery/bg/6hc/cd/block/Header.vue'

const route = useRoute()
const router = useRouter()
const credit = use6hcCredit()

const state = reactive({
  entered: false,
  leaving: false,
})

const playList = computed(() => credit.playList.value || [])
const availableCodes = computed(() => credit.availableCodes.value || [])
const canSubmit = computed(() => Boolean(credit.canSubmit.value))
const playKeySet = computed(() => new Set(playList.value.map((item: any) => item.key)))
const routePlayKey = computed(() => String(route.params.play || '').toLowerCase())

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
}

watch(routePlayKey, async () => {
  await _actions.syncPlayByRoute()
})

onBeforeRouteLeave((_to, _from, next) => {
  if (!state.entered) { next(); return }
  state.leaving = true
  setTimeout(() => next(), 380)
})

onMounted(async () => {
  await credit.actions.initUserInfo()
  await credit.actions.initPlay()
  await _actions.syncPlayByRoute()
  credit.actions.startCountdown()
  state.entered = true
})

onBeforeUnmount(() => {
  credit.actions.stopCountdown()
})
</script>

<template>
  <div class="base lottery-6hc-cd" :class="{ 'is-leaving': state.leaving }">
    <div class="bg-fx" aria-hidden="true">
      <span v-for="i in 8" :key="i" class="orb" :style="`--i: ${i}`" />
    </div>

    <LotteryBgBaseTop />

    <main class="main">
      <!-- DRAW HEADER -->
      <Header />

      <!-- CONTENT LAYOUT -->
      <section class="cd-layout">
        <!-- MEMBER SIDEBAR -->
        <aside class="member-side">
          <article class="member-card">
            <div class="member-head">
              <span class="member-head__name">{{ credit.wallet.userName }}</span>
              <span class="member-head__tag">CREDIT</span>
            </div>
            <div class="member-body">
              <div class="row">
                <span class="label">盤口類型</span>
                <strong>{{ credit.wallet.panType }}</strong>
              </div>
              <div class="row">
                <span class="label">信用額度</span>
                <strong>{{ Number(credit.wallet.creditLimit || 0).toLocaleString() }}</strong>
              </div>
              <div class="row">
                <span class="label">剩餘額度</span>
                <strong class="accent">{{ Number(credit.wallet.balanceLimit || 0).toLocaleString() }}</strong>
              </div>
            </div>
            <div class="member-id">USER_ID: {{ credit.wallet.userId }}</div>
          </article>
        </aside>

        <!-- PLAY AREA -->
        <section class="content-main">
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

  &.is-leaving {
    animation: cd-page-out 0.38s ease forwards;
    pointer-events: none;
  }

  .bg-fx {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;

    .orb {
      position: absolute;
      left: calc(var(--i) * 11.5% - 2%);
      bottom: -30px;
      width: calc(8px + var(--i) * 2px);
      height: calc(8px + var(--i) * 2px);
      border-radius: 50%;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(185, 28, 28, 0.2) 100%);
      animation: cd-orb-rise calc(7s + var(--i) * 0.6s) ease-in infinite;
      animation-delay: calc(var(--i) * -1.1s);
      opacity: 0;
      will-change: transform, opacity;
    }
  }

  > .main {
    position: relative;
    z-index: 1;
    width: min(1360px, 97%);
    margin: 0.8rem auto 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  // ── LAYOUT ─────────────────────────────────────────────────
  .cd-layout {
    display: grid;
    grid-template-columns: 230px 1fr;
    gap: 0.75rem;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.18s;
  }

  // ── MEMBER CARD ────────────────────────────────────────────
  .member-card {
    border: 1px solid var(--color-red-700, #b91c1c);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-red-main, #dc2626) 6%, #fff);
    overflow: hidden;
    animation: cd-card-glow 3.5s ease-in-out infinite;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #7f1d1d 0%, #c9a227 50%, #7f1d1d 100%);
    }
  }

  .member-head {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #f6d9de;
    padding: 0.5rem 0.75rem;

    &__name {
      font-family: 'cwTeXKai', 'Noto Serif TC', serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-red-main, #dc2626);
      letter-spacing: 0.04em;
    }

    &__tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.22em;
      color: #7f1d1d;
      background: linear-gradient(90deg, rgba(201, 162, 39, 0.15), rgba(245, 208, 96, 0.2));
      border: 1px solid rgba(201, 162, 39, 0.5);
      border-radius: 3px;
      padding: 1px 5px;
    }
  }

  .member-body {
    padding: 0.65rem 0.8rem;
    display: grid;
    gap: 0.5rem;

    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;

      .label {
        color: var(--color-red-desc, #a94452);
      }

      strong {
        color: var(--color-red-main, #dc2626);
        font-weight: 700;
      }

      .accent {
        color: #b91c1c;
        font-weight: 700;
      }
    }
  }

  .member-id {
    border-top: 1px solid #f6d9de;
    padding: 0.5rem 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--color-red-desc, #a94452);
    letter-spacing: 0.04em;
  }

  // ── PLAY AREA ──────────────────────────────────────────────
  .content-main {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    animation: cd-sec-in 0.55s ease both;
    animation-delay: 0.28s;
  }

  .state-block {
    color: var(--color-red-desc, #a94452);
    font-weight: 700;
    padding: 0.8rem;
    border: 1px solid #fee2e2;
    border-radius: 6px;
    background: #fff;

    &.error {
      color: #b91c1c;
    }
  }

  @media (max-width: 1080px) {
    .cd-layout {
      grid-template-columns: 1fr;
    }
  }
}

// ── KEYFRAMES ────────────────────────────────────────────────
@keyframes cd-sec-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes cd-page-out {
  to {
    opacity: 0;
    transform: scale(0.97) translateY(-8px);
  }
}

@keyframes cd-card-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(185, 28, 28, 0);
  }
  50% {
    box-shadow: 0 0 14px 3px rgba(185, 28, 28, 0.15);
  }
}

@keyframes cd-orb-rise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }
  8% {
    opacity: 0.55;
  }
  88% {
    opacity: 0.2;
  }
  100% {
    opacity: 0;
    transform: translateY(-100vh) scale(0.6);
  }
}
</style>
