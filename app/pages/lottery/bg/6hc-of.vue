<script setup lang="ts">
import { computed, reactive } from 'vue'
import { LOTTERY, GET_CONT, GAME_6HC_OF } from '~/config/constants'

// import { provide6hcOfficial } from '~/composables/use6hcOfficial'
import SinglePlay from '~/components/lottery/bg/6hc/of/Single.vue'
import DuplexPlay from '~/components/lottery/bg/6hc/of/Duplex.vue'
import DantuoPlay from '~/components/lottery/bg/6hc/of/Dantuo.vue'
import NumberPlay from '~/components/lottery/bg/6hc/of/Number.vue'
import Header from '~/components/lottery/bg/6hc/of/Header.vue'
import BarTabs from '~/components/lottery/bg/6hc/of/BarTabs.vue'

const state = reactive({
  lotteryId: LOTTERY['6HC'].id,
  lotteryInfo: GET_CONT.lotteryById(LOTTERY['6HC'].id),
})

const use6hc = use6hcOfficial()
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

</script>

<template>
  <div class="lottery-6hc-of">
    <LotteryBgBaseTop />

    <main class="main">
      <Header :data="state.lotteryInfo" />

      <section class="info-warp">
        <aside class="info-side">
          <div class="user-warp">
            <div class="user-title">
              USER
            </div>
            <div class="user-content">
              <div class="row">
                F幣餘額: 1000
                <button type="button" class="deposit-btn">儲值</button>
              </div>
              <div class="row">當期已投注: 99999</div>
              <div class="row">累計已投注: 99999</div>
              <div class="row">投注百分比: 多了50%</div>
            </div>
            <p class="user-id">USER_ID: xxxxx</p>
          </div>
        </aside>
        <div class="info-main">
          <div class="road-warp">
            ROAD
          </div>
        </div>
      </section>

      <section class="play-warp">
        <BarTabs />
        <component :is="currentPlay" />
      </section>
    </main>
  </div>
</template>

<style lang="scss">
.lottery-6hc-of {
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
    height: 100%;
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
    gap: 0.5rem;
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
    // background: var(--color-red-700);

    .road-warp {
      flex: 1;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      // border: 1px solid var(--color-red-main);
      border-radius: var(--base-radius);
      // background: #fff;
      background: var(--color-red-desc);
      font-size: 0.875rem;
      font-weight: 700;
      color: #fff;
    }

  }


  .play-warp {
    margin-top: 0.75rem;
    border: 1px solid var(--color-red-700);
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
    box-shadow: 0 0.1rem 0.325rem rgba(0, 0, 0, 0.07);
  }
}
</style>