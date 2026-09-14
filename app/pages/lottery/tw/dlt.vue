<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import DltHeader from '~/components/lottery/tw/dlt/block/Header.vue'
import Board from '~/components/lottery/tw/dlt/base/Board.vue'
import CurrItems from '~/components/lottery/tw/dlt/block/CurrItems.vue'
import Controls from '~/components/lottery/tw/dlt/block/Controls.vue'
import Report from '~/components/lottery/tw/dlt/block/Report.vue'
import History from '~/components/lottery/tw/dlt/block/History.vue'
import Road from '~/components/lottery/tw/dlt/block/Road.vue'
import DialogUser from '~/components/lottery/tw/dlt/block/DialogUser.vue'
import DialogOpenCode from '~/components/lottery/tw/dlt/block/DialogOpenCode.vue'
import DialogRule from '~/components/lottery/tw/dlt/block/DialogRule.vue'
import { useDlt } from '~/composables/useDlt'
import { useAuth } from '~/composables/useAuth'
import { useTwAutoActive } from '~/composables/useTwAutoActive'

/**
 * 大樂透（DLT）——唯一「完全鏡射官方台彩」的玩法，tw 分類（見
 * openspec/changes/add-dlt/design.md）。頁面骨架比照 K3-CD，但選號互動改用 7×7 方格
 * （base/Board.vue，每組 A~E 各渲染一份），且不顯示彩池／爆池（本玩法不做彩池）。
 */
const { slots, wallet: mxWallet, fetch: mxFetch, isOpen } = useDlt()

const router = useRouter()
const { isLoggedIn, init: authInit } = useAuth()
const { activate: activateAutoPanel, deactivate: deactivateAutoPanel } = useTwAutoActive()

const money = (value: number) => Number(value ?? 0).toLocaleString('zh-TW')

const dialog = reactive({ user: false, openCode: false, rule: false })
const dialogClick = {
  openUser: async () => { dialog.user = true; await mxFetch.userRecordAll() },
  openOpenCode: async () => { dialog.openCode = true; await mxFetch.openCodeHistoryAll() },
  openRule: () => { dialog.rule = true }
}

onMounted(async () => {
  await authInit()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  activateAutoPanel('dlt')
  await mxFetch.initPageData()
  await mxFetch.userRecordAll()
  mxFetch.startPolling()
})
onBeforeUnmount(() => {
  mxFetch.stopPolling()
  deactivateAutoPanel()
})
</script>

<template>
  <div class="lottery-dlt">
    <main class="main">
      <DltHeader @open-opencode-dialog="dialogClick.openOpenCode()" @open-rule-dialog="dialogClick.openRule()" />

      <section class="info-warp">
        <aside class="user-warp" @click="dialogClick.openUser()">
          <div class="user-title">{{ mxWallet.userName }}</div>
          <div class="user-content">
            <div class="row"><span>F幣餘額:</span><b class="is-coin">{{ money(mxWallet.coin) }}</b></div>
            <div class="row"><span>當期已投注:</span><b>{{ money(mxWallet.currentBets) }}</b></div>
            <div class="row"><span>累計已投注:</span><b>{{ money(mxWallet.totalBets) }}</b></div>
          </div>
          <p class="user-id">USER_ID: {{ mxWallet.userId }}</p>
        </aside>
        <div class="info-main">
          <History />
          <Road />
        </div>
      </section>

      <section class="play-warp">
        <p v-if="!isOpen" class="closed-hint">目前非開盤時間，暫不受理投注</p>
        <div class="boards">
          <Board v-for="slot in slots" :key="slot.id" :slot="slot" :disabled="!isOpen" />
        </div>
        <div class="side">
          <CurrItems />
          <Controls />
        </div>
      </section>

      <section class="record-warp">
        <Report />
      </section>
    </main>

    <DialogUser :visible="dialog.user" @close="dialog.user = false" />
    <DialogOpenCode :visible="dialog.openCode" @close="dialog.openCode = false" />
    <DialogRule :visible="dialog.rule" @close="dialog.rule = false" />
  </div>
</template>

<style scoped lang="scss">
.lottery-dlt {
  min-height: 100vh;

  .main {
    width: min(1360px, 97%);
    margin: 0.8rem auto 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
}

.info-warp {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;

  .user-warp {
    width: 22%;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-red-700, #f3b7bf);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-red-main, #7f1d1d) 6%, #fff);
    cursor: pointer;

    .user-title {
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #f6d9de;
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--color-red-main, #7f1d1d);
    }

    .user-content {
      flex: 1;
      display: grid;
      gap: 4px;
      padding: 0.6rem 0.75rem;
      font-size: 13px;
      color: var(--color-red-desc, #9ca3af);

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;

        b {
          font-weight: 700;
          color: var(--color-red-main, #7f1d1d);
        }

        b.is-coin {
          color: #15803d;
        }
      }
    }

    .user-id {
      margin: 0;
      border-top: 1px solid #f6d9de;
      padding: 0.4rem 0.75rem;
      font-size: 11px;
      color: var(--color-red-desc, #9ca3af);
    }
  }

  .info-main {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    gap: 0.75rem;

    > * {
      flex: 1 1 0;
      min-width: 0;
    }
  }
}

.play-warp {
  border: 1px solid var(--color-red-700, #f3b7bf);
  border-radius: 0.5rem;
  background: #fff;
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
}
</style>
