<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import P3Header from '~/components/lottery/tw/p3/block/Header.vue'
import Board from '~/components/lottery/tw/p3/base/Board.vue'
import CurrItems from '~/components/lottery/tw/p3/block/CurrItems.vue'
import Controls from '~/components/lottery/tw/p3/block/Controls.vue'
import History from '~/components/lottery/tw/p3/block/History.vue'
import Road from '~/components/lottery/tw/p3/block/Road.vue'
import PopularPicks from '~/components/lottery/tw/p3/block/PopularPicks.vue'
import BetRecord from '~/components/lottery/tw/p3/block/BetRecord.vue'
import DialogUser from '~/components/lottery/tw/p3/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/tw/p3/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/tw/p3/block/DialogRule.vue'
import { useP3 } from '~/composables/useP3'
import { useAuth } from '~/composables/useAuth'
import { useTwAutoActive } from '~/composables/useTwAutoActive'

/**
 * 3星彩（P3）——比照 M649/D539 的「完全鏡射官方台彩」玩法，tw 分類
 * （見 openspec/changes/add-tw-lottery-suite/design.md Decision 5）。頁面骨架比照 m649.vue，
 * 選號互動改用「先選下注方式（正彩/組彩/前二對彩/後二對彩），再逐位填滿 3 位 0~9 數字」
 * （base/Board.vue，每組 A~E 各渲染一份、各自選定下注方式），不顯示彩池。
 */
const { slots, wallet: p3Wallet, fetch: p3Fetch, isOpen, isPendingSettlement, userRecord } = useP3()

const router = useRouter()
const { isLoggedIn, init: authInit } = useAuth()
const { activate: activateAutoPanel, deactivate: deactivateAutoPanel } = useTwAutoActive()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await p3Fetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await p3Fetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

onMounted(async () => {
  await authInit()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  activateAutoPanel('p3')
  await p3Fetch.initPageData()
  await p3Fetch.userRecordAll()
  p3Fetch.startPolling()
})
onBeforeUnmount(() => {
  p3Fetch.stopPolling()
  deactivateAutoPanel()
})
</script>

<template>
  <div class="lottery-p3 theme-taiwan-lottery">
    <LotteryTwBaseTop @open-user-dialog="dialogClick.openUser()" @open-opencode-dialog="dialogClick.openOpenCode()"
      @open-rule-dialog="dialogClick.openRule()" />

    <main class="main">
      <P3Header @open-opencode-dialog="dialogClick.openOpenCode()" @open-rule-dialog="dialogClick.openRule()" />

      <section class="info-warp">
        <aside class="user-warp" @click="dialogClick.openUser()">
          <div class="user-title">{{ p3Wallet.userName }}</div>
          <div class="user-content">
            <div class="row"><span>F幣餘額:</span><b class="is-coin">{{ money(p3Wallet.coin) }}</b></div>
            <div class="row"><span>當期已投注:</span><b>{{ money(p3Wallet.currentBets) }}</b></div>
            <div class="row"><span>累計已投注:</span><b>{{ money(p3Wallet.totalBets) }}</b></div>
          </div>
          <p class="user-id">USER_ID: {{ p3Wallet.userId }}</p>
        </aside>
        <div class="info-main">
          <History />
          <PopularPicks />
        </div>
      </section>

      <section class="road-warp">
        <Road />
      </section>

      <section class="play-section">
        <div class="play-warp">
          <svg class="p3-ticket-art" viewBox="0 0 160 100" aria-hidden="true">
            <g transform="rotate(-4 80 50)">
              <rect x="8" y="14" width="144" height="72" rx="10" fill="#fffdf8" stroke="#8c491a" stroke-width="2.5" />
              <line x1="104" y1="14" x2="104" y2="86" stroke="#c0b6a5" stroke-width="2" stroke-dasharray="4 4" />
              <circle cx="104" cy="14" r="7" fill="#fffbf4" />
              <circle cx="104" cy="86" r="7" fill="#fffbf4" />

              <circle cx="34" cy="40" r="12" fill="#fecf13" stroke="#38300d" stroke-width="1.5" />
              <text x="34" y="44" font-weight="900" font-size="11" fill="#38300d" text-anchor="middle">1</text>
              <circle cx="62" cy="40" r="12" fill="#fecf13" stroke="#38300d" stroke-width="1.5" />
              <text x="62" y="44" font-weight="900" font-size="11" fill="#38300d" text-anchor="middle">2</text>
              <circle cx="90" cy="40" r="12" fill="#fecf13" stroke="#38300d" stroke-width="1.5" />
              <text x="90" y="44" font-weight="900" font-size="11" fill="#38300d" text-anchor="middle">3</text>

              <text x="34" y="70" font-size="9" fill="#645c50">3星彩 · 正彩</text>

              <rect x="115" y="30" width="2" height="34" fill="#474238" />
              <rect x="121" y="30" width="4" height="34" fill="#474238" />
              <rect x="129" y="30" width="2" height="34" fill="#474238" />
              <rect x="135" y="30" width="3" height="34" fill="#474238" />
              <rect x="143" y="30" width="2" height="34" fill="#474238" />
              <text x="129" y="76" font-size="9" fill="#645c50" text-anchor="middle">25 元</text>
            </g>
          </svg>

          <p v-if="isPendingSettlement" class="closed-hint">本期已截止，等待台灣彩券官方公布開獎資料中，資料到位後會自動開下一期，請稍候</p>
          <p v-else-if="!isOpen" class="closed-hint">目前非開盤時間，暫不受理投注</p>
          <div class="boards">
            <Board v-for="slot in slots" :key="slot.id" :slot="slot" :disabled="!isOpen" />
          </div>
          <div class="side">
            <CurrItems />
            <Controls />
          </div>
        </div>
      </section>

      <section class="record-warp">
        <BetRecord />
      </section>
    </main>

    <DialogUser :visible="dialog.user" @close="dialog.user = false" />
    <DialogOpenCode :visible="dialog.openCode" :bet-issues="userRecord.betHistory.map((b) => b.issue)"
      @close="dialog.openCode = false" />
    <DialogRule :visible="dialog.rule" @close="dialog.rule = false" />
  </div>
</template>

<style scoped lang="scss">
.lottery-p3 {
  min-height: 100vh;
  display: flow-root;

  .main {
    width: min(1360px, 97%);
    margin: 0.8rem auto 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
}

@keyframes p3-section-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.info-warp,
.road-warp,
.play-section,
.record-warp {
  animation: p3-section-in 0.5s ease-out both;
}

.road-warp {
  animation-delay: 0.08s;
}

.play-section {
  animation-delay: 0.16s;
}

.record-warp {
  animation-delay: 0.24s;
}

@keyframes p3-ticket-float {
  0%, 100% {
    transform: translateY(0) rotate(-1deg);
  }

  50% {
    transform: translateY(-5px) rotate(1deg);
  }
}

.info-warp {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;

  .user-warp {
    width: 22%;
    min-width: 200px;
    height: 250px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-accent-400, #f6a06b);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-accent-700, #8c491a) 6%, var(--color-neutral-100, #f9f4ed));
    box-shadow: var(--shadow-sm);
    cursor: pointer;

    &::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 6px;
      background: var(--color-accent-500);
      background-image: repeating-linear-gradient(90deg,
        var(--color-accent-2-500) 0 14px,
        var(--color-accent-500) 14px 28px);
    }

    .user-title {
      height: 44px;
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--color-neutral-300, #dcd3c4);
      font-size: 0.875rem;
      font-weight: 700;
      font-family: var(--font-heading);
      color: var(--color-accent-700, #8c491a);
    }

    .user-content {
      flex: 1;
      display: grid;
      align-content: start;
      gap: 4px;
      padding: 0.6rem 0.75rem;
      font-size: 13px;
      color: var(--color-neutral-700, #645c50);

      .row {
        height: 32.12px;
        display: flex;
        align-items: center;

        b {
          margin-left: 5px;
          font-weight: 700;
          color: var(--color-accent-700, #8c491a);
        }
      }
    }

    .user-id {
      margin: 0;
      border-top: 1px solid var(--color-neutral-300, #dcd3c4);
      padding: 0.4rem 0.75rem;
      font-size: 11px;
      color: var(--color-neutral-700, #645c50);
    }
  }

  .info-main {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    gap: 0.75rem;

    >.p3-history {
      flex: 1 1 auto;
      min-width: 0;
    }

    >.p3-popular {
      flex: 0 0 auto;
    }
  }
}

.play-warp {
  position: relative;
  border: 1px solid #aebf92;
  border-radius: 0.5rem;
  background: var(--color-neutral-100, #f9f4ed);
  box-shadow: var(--shadow-sm);
  padding: calc(0.75rem + 6px) 0.75rem 0.75rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-start;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 6px;
    border-radius: 0.5rem 0.5rem 0 0;
    background: var(--color-accent-500);
    background-image: repeating-linear-gradient(90deg,
      var(--color-accent-2-500) 0 14px,
      var(--color-accent-500) 14px 28px);
  }

  .p3-ticket-art {
    position: absolute;
    top: -31px;
    left: -20px;
    width: 90px;
    height: auto;
    z-index: 1;
    pointer-events: none;
    filter: drop-shadow(0 4px 6px rgba(46, 43, 37, 0.18));
    animation: p3-ticket-float 3.2s ease-in-out infinite;
  }

  .closed-hint {
    flex-basis: 100%;
    margin: 0;
    font-size: 13px;
    color: #b45309;
  }

  .boards {
    flex: 1 1 600px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .side {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
}

.record-warp {
  display: flex;
  height: 380px;
}
</style>
