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
const state = reactive({
  lotteryId: LOTTERY['6HC'].id,
  lotteryInfo: GET_CONT.lotteryById(LOTTERY['6HC'].id)
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
    <LotteryBgBaseTop />
    <main class="main">
      <Header :lottery-info="state.lotteryInfo" />
      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp">
            <div class="user-title"> {{ userInfo.name }} </div>
            <div class="user-content">
              <div class="row">
                F幣餘額: {{ actions.thousands(userInfo.coin) }}
                <button type="button" class="deposit-btn">儲值</button>
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

}
</style>