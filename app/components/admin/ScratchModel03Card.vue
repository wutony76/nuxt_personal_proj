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
 * 版面座標原本參考原始 Python 版 `get_scratch_card.py` 的
 * `get_model03_plist()`（固定公式：起始點 + 每局間距 `cx += 35, cy += 65`），
 * 但底圖上事先印好的 10 個手勢圈圈是人工排版、不是程式產生，逐局間距本身
 * 就有 ±10px 左右的自然落差（實測：第 1→2 局 (32,62)，第 4→5 局卻是
 * (42,56)）——任何單一的「起始點＋固定間距」公式都不可能同時完美貼合全部
 * 5 局，只能挑一組平均值，犧牲掉部分局的精準度。
 *
 * 改成逐局寫死精確座標（`HAND_POSITIONS`）：用 OpenCV 的 Hough circle
 * transform 直接在 `card-base.jpg` 上偵測 10 個圈圈的圓心像素座標（圓心
 * − 25 = 手勢圖示 50×50 的左上角），不是肉眼比對或固定公式，逐局誤差可以
 * 壓到 1px 等級。這組常數以後如果要調整，請先用等效的精確量測方式重新算過
 * 底圖，不要只憑肉眼在小截圖上比對（中途曾經因為肉眼比對不夠精確，誤改過
 * 兩次間距，造成誤差隨局數疊加）。
 *
 * 金額文字框的位置同樣經過精確量測、取代原始碼的猜測值（見下方
 * `COIN_CENTER_OFFSET` 常數說明）；中獎紅圈相對「我的猜拳」左上角的位移
 * （+65/-10）目前沿用原始碼的值，使用者截圖驗證沒有回報問題。
 *
 * ⚠️ 所有座標都換算成佔容器寬高的百分比（`pctX`／`pctY`），不是寫死的 px：
 * `.smc` 容器在版面擠壓時（視窗變窄、瀏覽器縮放）會透過 `max-width: 100%`
 * 等比例縮小，子元素如果還是寫死 px，縮小後的底圖座標系統跟寫死的 px
 * 數值就對不上，疊圖會整個跑位——這是曾經在較窄的畫面寬度下實際重現過的
 * 真實 bug，不是臆測。
 *
 * 另外調整「目標金額」徽章的位置——原始碼寫的 `(450-100, -30)` Y 座標是
 * 負值，疊圖時會被裁掉大半、幾乎看不到，這裡改放到右上角一個有底色的
 * 徽章內。以上都純粹是版面微調，不影響任何機率/派彩邏輯（那些已經在
 * `server/services/game/scratch/model03.ts` 忠實移植過了）。
 */
import { computed } from 'vue'
import type { ScratchModel03Card } from '~/services/api'

const props = defineProps<{
  card: ScratchModel03Card
}>()

const ASSET_BASE = '/images/scratch/model03'

/**
 * 5 局手勢圖示的精確位置（左上角 px，50×50 素材），逐局分開寫死，不是用
 * 「起始點＋每局間距」的公式算出來的——底圖上事先印好的 10 個圈圈是人工
 * 排版（不是用程式產生），逐局間距本身就有 ±10px 左右的自然落差（量測結果：
 * 第 1→2 局間距 (32,62)，第 4→5 局卻是 (42,56)），任何單一公式都不可能同時
 * 完美貼合全部 5 局。這組座標是直接用 OpenCV 的 Hough circle transform 在
 * `card-base.jpg` 上偵測 10 個圈圈的精確圓心算出來的（圓心 − 25 = 左上角），
 * 不是肉眼比對，逐局誤差可以壓到 1px 等級。
 */
const HAND_POSITIONS: Array<{ myHand: [number, number]; enemyHand: [number, number] }> = [
  { myHand: [59, 67], enemyHand: [191, 41] },
  { myHand: [91, 129], enemyHand: [229, 99] },
  { myHand: [125, 191], enemyHand: [265, 161] },
  { myHand: [157, 259], enemyHand: [301, 219] },
  { myHand: [199, 315], enemyHand: [339, 297] }
]

// px → 百分比換算，說明見檔頭註解
const BASE_W = 600
const BASE_H = 384
const pctX = (px: number) => `${(px / BASE_W) * 100}%`
const pctY = (px: number) => `${(px / BASE_H) * 100}%`

/**
 * 金額文字框（`coin`）相對「我的猜拳」左上角的中心點偏移，同樣用精確量測
 * 取代原本的公式猜測：逐一裁切放大底圖 5 局的金額框，量出框的實際中心點，
 * 換算成相對「我的猜拳」圓心的位移，5 局落在 (74~76, -11~-14) 之間，取平均
 * (75,-13)；再換算成相對「我的猜拳」左上角（圓心 + 25）＝ (100,12)。因為
 * 11 種金額文字框寬度不一（24~89px），用 `left`／`top` 指到這個中心點、
 * 搭配 CSS `transform: translate(-50%, -50%)` 置中（見 `.smc-coin`），不管
 * 文字框實際寬度多少都會自動置中，不用為每種金額分別硬算置中後的左上角。
 */
const COIN_CENTER_OFFSET: [number, number] = [100, 12]

const rounds = computed(() =>
  props.card.rounds.map((round, idx) => {
    const pos = HAND_POSITIONS[idx] ?? HAND_POSITIONS[HAND_POSITIONS.length - 1]!
    const [myLeft, myTop] = pos.myHand
    return {
      ...round,
      style: {
        myHand: { left: pctX(myLeft), top: pctY(myTop) },
        enemyHand: { left: pctX(pos.enemyHand[0]), top: pctY(pos.enemyHand[1]) },
        coin: { left: pctX(myLeft + COIN_CENTER_OFFSET[0]), top: pctY(myTop + COIN_CENTER_OFFSET[1]) },
        winCircle: { left: pctX(myLeft + 65), top: pctY(myTop - 10) }
      }
    }
  })
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
  /* 50px / 600px、50px / 384px（見 script 區塊的 pctX/pctY 換算說明） */
  width: 8.3333%;
  height: 13.0208%;
  pointer-events: none;
}

.smc-coin {
  width: auto;
  height: 6.25%;
  /* left/top 指到的是框的中心點（見 script 區塊 COIN_CENTER_OFFSET 說明），
     11 種金額文字框寬度不一，用 transform 置中取代手動計算每種寬度的左上角 */
  transform: translate(-50%, -50%);
}

.smc-win-circle {
  z-index: 2;
}

.smc-target {
  position: absolute;
  top: 2.6%;
  right: 1.7%;
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
