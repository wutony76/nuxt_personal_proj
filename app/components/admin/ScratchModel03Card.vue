<script setup lang="ts">
/**
 * 刮刮樂 model03（剪刀石頭布）試算結果的「卡片融合」視覺還原。
 *
 * 底圖與手勢/金額圖示素材皆取自原始 Python 專案
 * `py3_AVScratch_proj/scratch/Scratch/model03/`（`AV_model03_2.jpg` 底圖、
 * `av03_texture.png` 材質圖集），用一次性腳本依 `av03_texture.plist` 記錄的
 * 矩形座標切出 15 張獨立小圖（11 種金額文字＋3 種手勢圖示＋1 個中獎紅圈），
 * 存成 `public/images/scratch/model03/*.png`，不是執行期才切圖。
 *
 * 版面座標忠實沿用原始 Python 版 `get_scratch_card.py` 的
 * `get_model03_plist()`：底圖是 600×384px，5 局手勢圖示沿對角線排列
 * （`cx += 35, cy += 65` 每局往右下偏移），跟底圖上事先印好的 5 組圈圈
 * 位置對應。唯一調整的是「目標金額」徽章的位置——原始碼寫的
 * `(450-100, -30)` Y 座標是負值，疊圖時會被裁掉大半、幾乎看不到，這裡
 * 改放到右上角一個有底色的徽章內，純粹是版面微調，不影響任何機率/
 * 派彩邏輯（那些已經在 `server/services/game/scratch/model03.ts` 忠實
 * 移植過了）。
 */
import { computed } from 'vue'
import type { ScratchModel03Card } from '~/services/api'

const props = defineProps<{
  card: ScratchModel03Card
}>()

const ASSET_BASE = '/images/scratch/model03'

const rounds = computed(() =>
  props.card.rounds.map((round, idx) => ({
    ...round,
    style: {
      myHand: { left: `${10 + idx * 35}px`, top: `${10 + idx * 65}px` },
      enemyHand: { left: `${10 + idx * 35 + 130}px`, top: `${10 + idx * 65 - 20}px` },
      coin: { left: `${10 + idx * 35 + 65}px`, top: `${10 + idx * 65 + 10}px` },
      winCircle: { left: `${10 + idx * 35 + 65}px`, top: `${10 + idx * 65 - 10}px` }
    }
  }))
)
</script>

<template>
  <div class="smc">
    <img class="smc-base" :src="`${ASSET_BASE}/card-base.jpg`" alt="刮刮樂底圖" />

    <div class="smc-target">
      <span class="smc-target-label">目標</span>
      <img :src="`${ASSET_BASE}/coin_${card.winCoin}.png`" :alt="`目標金額 ${card.winCoin}`" />
    </div>

    <template v-for="(round, idx) in rounds" :key="idx">
      <img
        class="smc-sprite smc-hand"
        :style="round.style.myHand"
        :src="`${ASSET_BASE}/item_${round.handValues[0]}.png`"
        :alt="round.play[0]"
      />
      <img
        class="smc-sprite smc-hand"
        :style="round.style.enemyHand"
        :src="`${ASSET_BASE}/item_${round.handValues[1]}.png`"
        :alt="round.play[1]"
      />
      <img
        class="smc-sprite smc-coin"
        :style="round.style.coin"
        :src="`${ASSET_BASE}/coin_${round.coin}.png`"
        :alt="`第${idx + 1}回金額 ${round.coin}`"
      />
      <img
        v-if="round.color === 'red'"
        class="smc-sprite smc-win-circle"
        :style="round.style.winCircle"
        :src="`${ASSET_BASE}/red_circle.png`"
        alt="中獎標記"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.smc {
  position: relative;
  width: 600px;
  max-width: 100%;
  aspect-ratio: 600 / 384;
  overflow: hidden;
}

.smc-base {
  display: block;
  width: 100%;
  height: 100%;
}

.smc-sprite {
  position: absolute;
  width: 50px;
  height: 50px;
  pointer-events: none;
}

.smc-coin {
  width: auto;
  height: 24px;
}

.smc-win-circle {
  z-index: 2;
}

.smc-target {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  z-index: 3;
}

.smc-target-label {
  font-size: 11px;
  color: #5a2a1f;
}
</style>
