<script setup lang="ts">
import { computed, reactive } from 'vue'
import { LOTTERY, GET_CONT } from '~/config/constants'

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
  const key = (use6hc.state || 'single') as keyof typeof playMap
  return playMap[key] ?? SinglePlay
})

</script>

<template>
  <div class="lottery-6hc-of">
    <LotteryBgBaseTop />

    <main class="main">
      <Header :data="state.lotteryInfo" />

      <div class="info-warp" style="border: 1px solid red; margin-top: 10px; display: flex; ;">
        <div class="left" style="width: 20%; ">
          <div class="user-warp"
            style="border: 1px solid blue; min-height: 200px; height: 100% ; display: flex; flex-direction: column; ">
            <div
              style="height:30%; border-bottom: 1px solid red; display: flex; justify-content: center; align-items: center; ">
              USER </div>
            <div style=" flex:1;">
              <div> F幣餘額: 1000
                <button> 儲值 </button>
              </div>
              <div> 當期已投注: 99999</div>
              <div> 累計已投注: 99999</div>
              <div> 投注百分比: 多了50% </div>
            </div>
            <p> USER_ID: xxxxx</p>
          </div>
        </div>
        <div class="right" style="flex:1 ;">
          <div class="row-warp" style="margin-left: 15px; border: 1px solid green; height: 100% ;">
            ROAD
          </div>
        </div>

      </div>
      <BarTabs />
      <section class="play-warp" style="margin-top: 10px;">
        <component :is="currentPlay" />
      </section>
    </main>
  </div>
</template>