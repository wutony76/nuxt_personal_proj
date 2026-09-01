<script setup lang="ts">
import { GAME_SPRITES, type GameSpriteAnim } from '~/config/gameSprites'

type Placement = {
  key: string
  icon: string
  anim: GameSpriteAnim
  glow: string
  side: 'left' | 'right'
  offset: string
  top: string
  size: number
  duration: string
  delay: string
}

/**
 * game-hall 背景漂浮裝飾：每個遊戲各出一個小圖示，用各自的動畫類型（crawl/fall/bounce/…）
 * 與主題色在畫面左右空白處緩慢漂浮，純呈現層、不影響任何互動或版面。
 * 位置與時間皆為寫死常數（不用 Math.random()），避免 SSR/CSR 算出不同值造成 hydration mismatch。
 * 對照表統一來自 app/config/gameSprites.ts，跟 GameMachineCard 的卡片圖示同一份設定，
 * 未來要幫卡片本身加動畫時直接沿用同一份 anim/glow 定義即可。
 */
const byKey = (key: string) => GAME_SPRITES.find((s) => s.key === key)!

type BasePlacement = Omit<Placement, 'icon' | 'anim' | 'glow'>

const BASE_PLACEMENTS: BasePlacement[] = [
  { key: 'solitaire', side: 'right', offset: '3vw', top: '6vh', size: 28, duration: '3.6s', delay: '0.7s' },
  { key: 'snake', side: 'left', offset: '2vw', top: '14vh', size: 30, duration: '9s', delay: '0s' },
  { key: 'spaceInvaders', side: 'right', offset: '3vw', top: '20vh', size: 28, duration: '5.5s', delay: '0.4s' },
  { key: 'typing', side: 'left', offset: '3.5vw', top: '28vh', size: 26, duration: '1.8s', delay: '0.4s' },
  { key: 'tetriminos', side: 'left', offset: '4vw', top: '36vh', size: 26, duration: '6.5s', delay: '0.8s' },
  { key: 'pacman', side: 'right', offset: '2.5vw', top: '44vh', size: 30, duration: '7.5s', delay: '1.2s' },
  { key: 'breakout', side: 'right', offset: '3vw', top: '50vh', size: 24, duration: '3.8s', delay: '0.5s' },
  { key: 'pong', side: 'left', offset: '3vw', top: '56vh', size: 26, duration: '4.5s', delay: '0.2s' },
  { key: 'minesweeper', side: 'right', offset: '4vw', top: '62vh', size: 26, duration: '2.4s', delay: '0.6s' },
  { key: 'spaceShooter', side: 'left', offset: '2.5vw', top: '74vh', size: 28, duration: '6s', delay: '1s' },
  { key: 'match3', side: 'right', offset: '3.5vw', top: '80vh', size: 26, duration: '3.2s', delay: '0.3s' },
  { key: 'runner', side: 'left', offset: '4vw', top: '90vh', size: 28, duration: '2.2s', delay: '0.5s' },
  { key: 'racing', side: 'right', offset: '2vw', top: '94vh', size: 30, duration: '5s', delay: '0.9s' }
]

const PLACEMENTS: Placement[] = BASE_PLACEMENTS.map((p) => ({ ...p, icon: byKey(p.key).icon, anim: byKey(p.key).anim, glow: byKey(p.key).glow }))
</script>

<template>
  <div class="ghs-layer" aria-hidden="true">
    <span v-for="p in PLACEMENTS" :key="p.key" class="ghs-sprite" :class="`anim-${p.anim}`" :style="`
        ${p.side}: ${p.offset};
        top: ${p.top};
        font-size: ${p.size}px;
        animation-duration: ${p.duration};
        animation-delay: ${p.delay};
        --glow: ${p.glow};
      `">{{ p.icon }}</span>
  </div>
</template>

<style scoped lang="scss">
.ghs-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;

  @media (max-width: 1300px) {
    display: none;
  }
}

.ghs-sprite {
  position: absolute;
  opacity: 0.4;
  filter: drop-shadow(0 0 6px var(--glow, #00e5ff));
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  will-change: transform, opacity;
}

.anim-crawl {
  animation-name: sprite-crawl;
}

.anim-fall {
  animation-name: sprite-fall;
  animation-timing-function: linear;
}

.anim-bounce {
  animation-name: sprite-bounce;
}

.anim-march {
  animation-name: sprite-march;
  animation-timing-function: steps(2, end);
}

.anim-drift {
  animation-name: sprite-drift;
}

.anim-blink {
  animation-name: sprite-blink;
  animation-timing-function: steps(2, end);
}

.anim-sparkle {
  animation-name: sprite-sparkle;
}

.anim-hop {
  animation-name: sprite-hop;
}

.anim-fly {
  animation-name: sprite-fly;
  animation-timing-function: ease-in-out;
}

.anim-flip {
  animation-name: sprite-flip;
  animation-timing-function: ease-in-out;
}

.anim-jitter {
  animation-name: sprite-jitter;
  animation-timing-function: steps(1, end);
}

@keyframes sprite-crawl {

  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }

  25% {
    transform: translate(14px, 4px) rotate(4deg);
  }

  50% {
    transform: translate(26px, -2px) rotate(-2deg);
  }

  75% {
    transform: translate(12px, 6px) rotate(3deg);
  }
}

@keyframes sprite-fall {
  0% {
    transform: translateY(-10px) rotate(0deg);
    opacity: 0;
  }

  10% {
    opacity: 0.4;
  }

  90% {
    opacity: 0.4;
  }

  100% {
    transform: translateY(60px) rotate(180deg);
    opacity: 0;
  }
}

@keyframes sprite-bounce {

  0%,
  100% {
    transform: translate(0, 0);
  }

  25% {
    transform: translate(20px, -18px);
  }

  50% {
    transform: translate(36px, 0);
  }

  75% {
    transform: translate(20px, 18px);
  }
}

@keyframes sprite-march {

  0%,
  40% {
    transform: translateX(0);
  }

  50%,
  90% {
    transform: translateX(-18px);
  }

  100% {
    transform: translateX(0);
  }
}

@keyframes sprite-drift {

  0%,
  100% {
    transform: translate(0, 0);
  }

  50% {
    transform: translate(-10px, 14px);
  }
}

@keyframes sprite-blink {

  0%,
  49% {
    opacity: 0.4;
    transform: scale(1);
  }

  50%,
  100% {
    opacity: 0.12;
    transform: scale(0.92);
  }
}

@keyframes sprite-sparkle {

  0%,
  100% {
    transform: scale(0.85) rotate(0deg);
    opacity: 0.2;
  }

  50% {
    transform: scale(1.15) rotate(12deg);
    opacity: 0.5;
  }
}

@keyframes sprite-hop {

  0%,
  100% {
    transform: translate(0, 0);
  }

  30% {
    transform: translate(6px, -14px);
  }

  60% {
    transform: translate(14px, 0);
  }
}

@keyframes sprite-fly {
  0% {
    transform: translate(0, 0);
  }

  50% {
    transform: translate(24px, -10px);
  }

  100% {
    transform: translate(0, 0);
  }
}

@keyframes sprite-flip {

  0%,
  40% {
    transform: rotateY(0deg) scale(1);
  }

  50% {
    transform: rotateY(90deg) scale(0.85);
  }

  60%,
  100% {
    transform: rotateY(0deg) scale(1);
  }
}

@keyframes sprite-jitter {

  0%,
  100% {
    transform: translate(0, 0);
  }

  20% {
    transform: translate(-2px, 1px);
  }

  40% {
    transform: translate(2px, -1px);
  }

  60% {
    transform: translate(-1px, -1px);
  }

  80% {
    transform: translate(1px, 1px);
  }
}
</style>
