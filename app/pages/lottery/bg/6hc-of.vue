<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { LOTTERY, GET_CONT, GAME_6HC_OF } from '~/config/constants'
import { useAuth } from '~/composables/useAuth'
import { actions } from '~/utils/common'

// import { provide6hcOfficial } from '~/composables/use6hcOfficial'
import SinglePlay from '~/components/lottery/bg/6hc/of/Single.vue'
import DuplexPlay from '~/components/lottery/bg/6hc/of/Duplex.vue'
import DantuoPlay from '~/components/lottery/bg/6hc/of/Dantuo.vue'
import NumberPlay from '~/components/lottery/bg/6hc/of/Number.vue'
import Header from '~/components/lottery/bg/6hc/of/block/Header.vue'
import Road from '~/components/lottery/bg/6hc/of/block/Road.vue'
import BarTabs from '~/components/lottery/bg/6hc/of/base/BarTabs.vue'
import IssueBlock from '~/components/lottery/bg/6hc/of/block/record/Issue.vue'
import AnalyzeBlock from '~/components/lottery/bg/6hc/of/block/record/Analyze.vue'

const use6hc = use6hcOfficial()
const { fetch: mxFetch } = use6hc
const router = useRouter()
const { user, isLoggedIn, init } = useAuth()
const { $dialog } = useNuxtApp()
const state = reactive({
  lotteryId: LOTTERY['6HC'].id,
  lotteryInfo: GET_CONT.lotteryById(LOTTERY['6HC'].id),
  userDialogVisible: false,
  openCodeDialogVisible: false
})

const playMap = {
  SINGLE: SinglePlay,
  DUPLEX: DuplexPlay,
  DANTUO: DantuoPlay,
  NUMBER: NumberPlay
}

const currentPlay = computed(() => {
  const _key = (use6hc.state.status || GAME_6HC_OF.SINGLE.key) as keyof typeof playMap
  return playMap[_key] ?? SinglePlay
})

const userInfo = computed(() => {
  console.log('TTT2.UI userInfo.user', user.value)
  // console.log('TTT2.UI userInfo.user', userInfo.value)
  return {
    name: user.value?.name || 'USER',
    coin: Number(use6hc.wallet.coin ?? 0),
    currentBets: Number(use6hc.wallet.currentBets ?? 0),
    totalBets: Number(use6hc.wallet.totalBets ?? 0),
    analysis: String(use6hc.wallet.analysis ?? '-'),
    userId: user.value?.id || 'xxxxx'
  }
})

const userDialogData = computed(() => use6hc.userRecord)
const openCodeDialogData = computed(() => use6hc.openCodeHistory)

const click = {
  openUserDialog: async () => {
    state.userDialogVisible = true
    await mxFetch.userDialogRecord()
  },
  openOpenCodeDialog: async () => {
    state.openCodeDialogVisible = true
    await mxFetch.openCodeHistory()
  },
  closeUserDialog: () => {
    state.userDialogVisible = false
  },
  closeOpenCodeDialog: () => {
    state.openCodeDialogVisible = false
  },
  claimOneIssue: async () => {
    const result = await mxFetch.claimOneIssue()
    $dialog.alert(result?.message || '領獎完成')
  }
}

onMounted(async () => {
  await init()
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  const userId = String(user.value?.id ?? '')
  await use6hc.init.startServerTimeSync()
  await mxFetch.initPageData(userId)
})

onBeforeUnmount(() => {
  use6hc.init.stopServerTimeSync()
  mxFetch.stopCurrentInfoPolling()
  mxFetch.stopOrderDetailSync()
})

</script>

<template>
  <div class="base lottery-6hc-of">
    <LotteryBgBaseTop @open-user-dialog="click.openUserDialog()" @open-opencode-dialog="click.openOpenCodeDialog()" />
    <main class="main">
      <Header :lottery-info="state.lotteryInfo" @open-opencode-dialog="click.openOpenCodeDialog()" />
      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp" @click="click.openUserDialog()">
            <div class="user-title"> {{ userInfo.name }} </div>
            <div class="user-content">
              <div class="row">
                F幣餘額: {{ actions.thousands(userInfo.coin) }}
                <button type="button" class="deposit-btn" @click.stop="click.openUserDialog()">明細</button>
              </div>
              <div class="row">當期已投注: {{ actions.thousands(userInfo.currentBets) }}</div>
              <div class="row">累計已投注: {{ actions.thousands(userInfo.totalBets) }}</div>
              <div class="row">投注百分比: {{ userInfo.analysis }}</div>
            </div>
            <p class="user-id">USER_ID: {{ userInfo.userId }}</p>
          </div>
        </aside>
        <div class="info-main">
          <Road />
        </div>
      </section>
      <section class="play-warp">
        <BarTabs />
        <component :is="currentPlay" />
      </section>
      <section class="record-warp">
        <IssueBlock />
        <AnalyzeBlock />
      </section>
    </main>
    <div v-if="state.userDialogVisible" class="user-dialog-mask" @click.self="click.closeUserDialog()">
      <section class="user-dialog">
        <header class="user-dialog-header">
          <h3>會員資產 / 下注紀錄</h3>
          <button type="button" @click="click.closeUserDialog()">×</button>
        </header>

        <div class="user-dialog-summary">
          <div>當期累積獎金：{{ actions.thousands(userDialogData.jackpot.currentIssueJackpot) }}</div>
          <div>累積滾存獎金：{{ actions.thousands(userDialogData.jackpot.carryJackpot) }}</div>
          <div>可領獎期數：{{ userDialogData.claimableIssues.length }}</div>
          <button
            type="button"
            class="claim-btn"
            :disabled="userDialogData.claimableIssues.length === 0 || userDialogData.isSubmittingClaim"
            @click="click.claimOneIssue()">
            {{ userDialogData.isSubmittingClaim ? '領獎中...' : '領取下一期獎金' }}
          </button>
        </div>

        <div v-if="userDialogData.isLoading" class="user-dialog-loading">載入中...</div>
        <div v-else-if="userDialogData.errorMessage" class="user-dialog-error">{{ userDialogData.errorMessage }}</div>
        <div v-else class="user-dialog-body">
          <section class="dialog-block">
            <h4>餘額變動表</h4>
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>期數</th>
                  <th>類型</th>
                  <th>變動</th>
                  <th>餘額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in userDialogData.balanceChanges" :key="item.id">
                  <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
                  <td>{{ item.issue }}</td>
                  <td>{{ item.type }}</td>
                  <td>{{ actions.thousands(item.amount) }}</td>
                  <td>{{ actions.thousands(item.after) }}</td>
                </tr>
                <tr v-if="userDialogData.balanceChanges.length === 0">
                  <td colspan="5" class="no-records">暫無資料</td>
                </tr>
              </tbody>
              </table>
            </div>
          </section>

          <section class="dialog-block">
            <h4>下注紀錄</h4>
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table">
              <thead>
                <tr>
                  <th>訂單</th>
                  <th>期數</th>
                  <th>號碼</th>
                  <th>金額</th>
                  <th>中獎</th>
                  <th>獎金</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in userDialogData.betHistory" :key="item.orderId">
                  <td>{{ item.orderId }}</td>
                  <td>{{ item.issue }}</td>
                  <td>{{ item.betCode.join(', ') }}</td>
                  <td>{{ actions.thousands(item.coin) }}</td>
                  <td>{{ item.winStatus }}</td>
                  <td>{{ actions.thousands(item.winAmount) }}</td>
                </tr>
                <tr v-if="userDialogData.betHistory.length === 0">
                  <td colspan="6" class="no-records">暫無資料</td>
                </tr>
              </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
    <div v-if="state.openCodeDialogVisible" class="user-dialog-mask" @click.self="click.closeOpenCodeDialog()">
      <section class="user-dialog">
        <header class="user-dialog-header">
          <h3>開獎歷史（過去到最近期）</h3>
          <button type="button" @click="click.closeOpenCodeDialog()">×</button>
        </header>
        <div v-if="openCodeDialogData.isLoading" class="user-dialog-loading">載入中...</div>
        <div v-else-if="openCodeDialogData.errorMessage" class="user-dialog-error">{{ openCodeDialogData.errorMessage }}</div>
        <div v-else class="user-dialog-body">
          <section class="dialog-block">
            <div class="dialog-table-wrap">
              <table class="report-table dialog-report-table">
              <thead>
                <tr>
                  <th>期數</th>
                  <th>開獎號</th>
                  <th>開始</th>
                  <th>結束</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in openCodeDialogData.list" :key="item.issue">
                  <td>{{ item.issue }}</td>
                  <td>{{ item.openCode.join(', ') }}</td>
                  <td>{{ new Date(item.startAt).toLocaleString() }}</td>
                  <td>{{ new Date(item.endAt).toLocaleString() }}</td>
                </tr>
                <tr v-if="openCodeDialogData.list.length === 0">
                  <td colspan="4" class="no-records">暫無資料</td>
                </tr>
              </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
    <section class="footer-warp"> footer</section>
  </div>
</template>

<style lang="scss">
.lottery-6hc-of {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  >.main {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-bottom: 0;
  }

  .info-warp {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.75rem;
    min-height: 200px;
    align-items: stretch;
  }

  .info-side {
    width: 22%;
  }

  .user-warp {
    min-height: 200px;
    // height: 100%;
    height: 250px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--color-red-700);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-red-main) 6%, #fff);
  }

  .user-title {
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid #f6d9de;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-red-main);
  }

  .user-content {
    flex: 1;
    display: grid;
    // gap: 0.5rem;
    padding: 0.75rem;
    font-size: 13px;
    color: var(--color-red-desc);

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
  }

  .deposit-btn {
    border: 1px solid #f2b7c1;
    border-radius: 0.25rem;
    background: #fff;
    padding: 0.25rem 0.5rem;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-red-main);
    cursor: pointer;
  }

  .user-id {
    margin: 0;
    border-top: 1px solid #f6d9de;
    padding: 0.5rem 0.75rem;
    font-size: 12px;
    color: var(--color-red-desc);
  }

  .info-main {
    width: 100%;
    min-height: 100%;
    flex: 1;
    display: flex;
  }


  .play-warp {
    margin-top: 0.75rem;
    border: 1px solid var(--color-red-700);
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
    box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
  }


  .record-warp {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
    height: 500px;
    margin-top: 0.75rem;
    gap: 0.75rem;

  }


  .footer-warp {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1.2rem;
    min-height: 300px;
    background: #e1d4d4;
    border-top: 1px solid #dcb4b4;
    font-size: 0.875rem;
    font-weight: 700;
    color: #fff;
  }

  .user-dialog-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .user-dialog {
    width: min(1100px, 96vw);
    max-height: 88vh;
    overflow: auto;
    background: #fff;
    border-radius: 8px;
    border: 1px solid var(--color-red-700);
    padding: 0.75rem;
  }

  .user-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .user-dialog-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;

    .claim-btn {
      border: 1px solid #f2b7c1;
      border-radius: 0.25rem;
      background: #fff;
      padding: 0.25rem 0.5rem;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-red-main);
      cursor: pointer;
    }
  }

  .user-dialog-loading,
  .user-dialog-error {
    padding: 0.75rem;
    font-weight: 700;
  }

  .user-dialog-body {
    display: grid;
    gap: 0.75rem;
  }

  .dialog-block {
    border: 1px solid var(--color-red-700);
    border-radius: 6px;
    padding: 0.6rem;

    h4 {
      margin: 0 0 0.5rem;
      color: var(--color-red-main);
    }

    .dialog-table-wrap {
      max-height: 280px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-red-desc) #e8e6e6;
    }

    .dialog-report-table {
      width: 100%;
      table-layout: fixed;

      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
      }

      .no-records {
        min-height: 120px;
        color: var(--color-red-desc);
      }
    }
  }

}
</style>