<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import BingoHeader from '~/components/lottery/tw/bingo/block/Header.vue'
import Board from '~/components/lottery/tw/bingo/base/Board.vue'
import CurrItems from '~/components/lottery/tw/bingo/block/CurrItems.vue'
import Controls from '~/components/lottery/tw/bingo/block/Controls.vue'
import Report from '~/components/lottery/tw/bingo/block/Report.vue'
import History from '~/components/lottery/tw/bingo/block/History.vue'
import BetRecord from '~/components/lottery/tw/bingo/block/BetRecord.vue'
import DialogUser from '~/components/lottery/tw/bingo/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/tw/bingo/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/tw/bingo/block/DialogRule.vue'
import { useBingo } from '~/composables/useBingo'
import { useAuth } from '~/composables/useAuth'
import { useTwAutoActive } from '~/composables/useTwAutoActive'

/**
 * 賓果賓果（BINGO）——tw 分類，架構跟其他 7 款玩法差異最大：每 5 分鐘連續開一期，
 * 4 種投注類型（基本玩法／超級獎號／猜大小／猜單雙）在同一個 Board.vue 用 tab 切換
 * （見 openspec/changes/add-tw-lottery-suite/design.md Decision 6）。
 */
const { slots, wallet: bingoWallet, fetch: bingoFetch, isOpen, userRecord } = useBingo()

const router = useRouter()
const { isLoggedIn, init: authInit } = useAuth()
const { activate: activateAutoPanel, deactivate: deactivateAutoPanel } = useTwAutoActive()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await bingoFetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await bingoFetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

onMounted(async () => {
  await authInit()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  activateAutoPanel('bingo')
  await bingoFetch.initPageData()
  await bingoFetch.userRecordAll()
  bingoFetch.startPolling()
})
onBeforeUnmount(() => {
  bingoFetch.stopPolling()
  deactivateAutoPanel()
})
</script>

<template>
  <div class="lottery-bingo theme-taiwan-lottery">
    <LotteryTwBaseTop @open-user-dialog="dialogClick.openUser()" @open-opencode-dialog="dialogClick.openOpenCode()"
      @open-rule-dialog="dialogClick.openRule()" />

    <main class="main">
      <BingoHeader @open-opencode-dialog="dialogClick.openOpenCode()" @open-rule-dialog="dialogClick.openRule()" />

      <section class="info-warp">
        <aside class="user-warp" @click="dialogClick.openUser()">
          <div class="user-title">{{ bingoWallet.userName }}</div>
          <div class="user-content">
            <div class="row"><span>F幣餘額:</span><b class="is-coin">{{ money(bingoWallet.coin) }}</b></div>
            <div class="row"><span>當期已投注:</span><b>{{ money(bingoWallet.currentBets) }}</b></div>
            <div class="row"><span>累計已投注:</span><b>{{ money(bingoWallet.totalBets) }}</b></div>
          </div>
          <p class="user-id">USER_ID: {{ bingoWallet.userId }}</p>
        </aside>
        <div class="info-main">
          <History />
        </div>
      </section>

      <section class="play-section">
        <div class="play-warp">
          <p v-if="!isOpen" class="closed-hint">目前非開盤時間，暫不受理投注</p>
          <div class="board-warp">
            <Board :disabled="!isOpen" />
          </div>
          <div class="side">
            <CurrItems />
            <Controls />
            <Report />
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
.lottery-bingo {
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

@keyframes bingo-section-in {
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
.play-section,
.record-warp {
  animation: bingo-section-in 0.5s ease-out both;
}

.play-section {
  animation-delay: 0.12s;
}

.record-warp {
  animation-delay: 0.2s;
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
  }
}

.play-warp {
  position: relative;
  border: 1px solid #aebf92;
  border-radius: 0.5rem;
  background: var(--color-neutral-100, #f9f4ed);
  box-shadow: var(--shadow-sm);
  padding: 0.75rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-start;

  .closed-hint {
    flex-basis: 100%;
    margin: 0;
    font-size: 13px;
    color: #b45309;
  }

  .board-warp {
    flex: 1 1 600px;
    min-width: 0;
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
