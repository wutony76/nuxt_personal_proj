<script setup lang="ts">
import { computed } from 'vue'
import type { CardColor, Rank, Suit } from '~/utils/solitaireEngine'

/**
 * 純呈現用牌面元件：Tableau／Foundation／Stock／Waste 四個區域共用，唯一需要畫牌面的地方，
 * 不含任何遊戲規則邏輯。純 CSS/Text 畫花色符號與點數，不使用圖片素材
 * （見 add-solitaire-game design.md Decision 6，這是本次唯一破例拆出的共用元件）。
 */
const props = withDefaults(
  defineProps<{
    suit: Suit
    rank: Rank
    faceUp: boolean
    selected?: boolean
  }>(),
  { selected: false }
)

const SUIT_SYMBOL: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const RANK_LABEL: Record<Rank, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K'
}
const COLOR_OF: Record<Suit, CardColor> = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' }

const suitSymbol = computed(() => SUIT_SYMBOL[props.suit])
const rankLabel = computed(() => RANK_LABEL[props.rank])
const isRed = computed(() => COLOR_OF[props.suit] === 'red')
</script>

<template>
  <div class="pcard" :class="{ 'is-face-up': faceUp, 'is-red': isRed, 'is-selected': selected }">
    <template v-if="faceUp">
      <div class="corner top">
        <span class="rank">{{ rankLabel }}</span>
        <span class="suit">{{ suitSymbol }}</span>
      </div>
      <div class="pip">{{ suitSymbol }}</div>
      <div class="corner bottom">
        <span class="rank">{{ rankLabel }}</span>
        <span class="suit">{{ suitSymbol }}</span>
      </div>
    </template>
    <div v-else class="back" />
  </div>
</template>

<style scoped lang="scss">
.pcard {
  position: relative;
  width: 64px;
  height: 90px;
  border-radius: 4px;
  border: 1px solid #0a0a0a;
  background: #f4f4f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  user-select: none;
  transition: box-shadow 0.15s ease, transform 0.15s ease;

  &.is-selected {
    box-shadow: 0 0 0 3px #2ecc71, 0 2px 6px rgba(0, 0, 0, 0.5);
    transform: translateY(-4px);
  }

  .corner {
    position: absolute;
    left: 4px;
    top: 3px;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    font-family: 'Share Tech Mono', monospace;
    font-weight: 700;
    font-size: 13px;
    color: #111;

    .suit {
      font-size: 12px;
      margin-top: 1px;
    }

    &.bottom {
      left: auto;
      right: 4px;
      top: auto;
      bottom: 3px;
      transform: rotate(180deg);
    }
  }

  .pip {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 30px;
    color: #111;
  }

  &.is-red .corner,
  &.is-red .pip {
    color: #d21e2b;
  }

  .back {
    position: absolute;
    inset: 2px;
    border-radius: 2px;
    background:
      repeating-linear-gradient(45deg, #1b3a8a 0 4px, #24469e 4px 8px),
      repeating-linear-gradient(-45deg, #1b3a8a 0 4px, #24469e 4px 8px);
    background-blend-mode: multiply;
    border: 1px solid #0a1d55;
  }
}
</style>
