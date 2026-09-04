<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import ChatPanelHud from '~/components/social/ChatPanelHud.vue'
import GameHighScoreHud from '~/components/social/GameHighScoreHud.vue'
import { useAuth } from '~/composables/useAuth'

type HallTab = 'lobby' | 'lottery' | 'taiwan'
type GameSlot = {
  id: number
  name: string
  description: string
  status: 'open' | 'coming'
  path?: string
}

/**
 * 遊戲中心（GAME HALL）
 *
 * 版面套用兩套 Cyberpunk 風格參考稿（SAMPLE/Text streaming/）：
 *   Hero（歡迎橫幅）  —— 比照「Personnel Management - Cyberpunk Home.html」：像素復古街機風，
 *                        Press Start 2P + VT323、粗黑像素框＋色塊位移陰影、故障字效標題。
 *   內容清單面板     —— 比照「Personnel Management - Cyberpunk.html」：俐落 HUD 風，Orbitron +
 *                        Share Tech Mono、clip-path 切角面板、霓虹描邊、徽章（badge）狀態顯示。
 * 兩份參考稿本身在同一個「Cyberpunk」設計語彙下，只是子頁面調性不同（歡迎主控台 vs. 資料管理列表），
 * 這裡刻意保留這個反差：Hero 像街機招牌迎賓，下面的面板則是嚴肅的「系統」選局介面。
 */
useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Orbitron:wght@600;700;800&family=Share+Tech+Mono&display=swap',
    },
  ],
})

const { isLoggedIn } = useAuth()

const TABS: Array<{ key: HallTab; label: string }> = [
  { key: 'lobby', label: '經典遊戲' },
  { key: 'lottery', label: 'BG彩票' },
  { key: 'taiwan', label: '彩運來' },
]

const activeTab = ref<HallTab>('lobby')
const activeTabLabel = computed(() => TABS.find((tab) => tab.key === activeTab.value)?.label ?? '')

const gameSlots = ref<GameSlot[]>([
  { id: 1, name: 'SNAKE', description: '經典像素貪吃蛇遊戲，挑戰可以吃多長', status: 'open', path: '/game/snake' },
  { id: 2, name: 'RACING', description: '賽車遊戲，閃避障礙物可以跑多遠', status: 'open', path: '/game/racing' },
  { id: 3, name: 'TETRIMINOS', description: '經典俄羅斯方塊，支援旋轉與消行', status: 'open', path: '/game/tetriminos' },
  { id: 4, name: 'MATCH3 RUSH', description: '限時消除寶石，考驗手速與爆發力', status: 'open', path: '/game/match3-rush' },
  { id: 5, name: 'MATCH3 CLASSIC', description: '限步數消除寶石，考驗策略與規劃', status: 'open', path: '/game/match3-classic' },
  { id: 6, name: 'PONG', description: '經典乒乓球，馬上PK', status: 'open', path: '/game/pong' },
  { id: 7, name: 'RUNNER', description: '側視角自動捲軸跑酷，跳躍下蹲閃避障礙', status: 'open', path: '/game/runner' },
  { id: 8, name: 'SPACE SHOOTER', description: '太空射擊，擊落敵機、閃避彈幕', status: 'open', path: '/game/space-shooter' },
  { id: 9, name: 'MINESWEEPER', description: '踩地雷，不要點到炸彈了，動動腦袋吧！', status: 'open', path: '/game/minesweeper' },
  { id: 10, name: 'PAC-MAN', description: '小精靈迷宮吃豆，閃避四隻鬼魂', status: 'open', path: '/game/pac-man' },
  { id: 11, name: 'SPACE INVADERS', description: '太空侵略者，整排外星艦隊步步進逼', status: 'open', path: '/game/space-invaders' },
  { id: 12, name: 'SOLITAIRE', description: '接龍遊戲，整理 52 張牌把 4 疊花色收齊', status: 'open', path: '/game/solitaire' },
  { id: 13, name: 'TYPING', description: '打字遊戲，看字輸入搶分數，快來試試你的手速', status: 'open', path: '/game/typing' },
  { id: 14, name: 'BREAKOUT', description: '打磚塊遊戲，清光磚塊可以快速累積分數', status: 'open', path: '/game/breakout' },
  { id: 15, name: 'ORB MATCH', description: '轉珠玩法，按住珠子連續拖曳跨格滑動，放開手指觸發消除連鎖', status: 'open', path: '/game/orb-match' },
  { id: 16, name: 'BATTLESHIP', description: '戰艦對戰，佈署艦隊，先擊沉敵方全部戰艦獲勝', status: 'open', path: '/game/battleship' },
  { id: 17, name: '2048', description: '數字合併玩法，滑動讓相同數字相撞加倍，一路挑戰合成出 2048', status: 'open', path: '/game/2048' },
  { id: 18, name: 'FLAPPY', description: '連續重力下墜穿越管道空隙，看能通過幾組', status: 'open', path: '/game/flappy' },
  { id: 19, name: 'FROGGER', description: '把青蛙順利送到另一邊', status: 'open', path: '/game/frogger' },
  { id: 20, name: 'CONNECT 4', description: '四子棋對戰，棋子連成四子獲勝', status: 'open', path: '/game/connect4' },
  { id: 21, name: 'WHACK-A-MOLE', description: '打地鼠', status: 'open', path: '/game/whack-a-mole' },
  { id: 22, name: 'LIGHTS OUT', description: '關燈益智玩法，點一格連動翻轉上下左右鄰格，把全部燈熄滅過關，步數越少分數越高', status: 'open', path: '/game/lights-out' },
  { id: 23, name: 'TOWER STACK', description: '疊塔玩法，抓時機讓移動方塊落在塔頂，完美對齊觸發 Perfect 連擊衝高分', status: 'open', path: '/game/tower-stack' },
  { id: 24, name: 'ARKANOID', description: 'BREAKOUT 進階版打磚塊，多次命中磚塊、移動磚塊與道具讓玩法更有變化', status: 'open', path: '/game/arkanoid' },
  { id: 25, name: 'TOWER DEFENSE', description: '塔防，防禦抵禦敵人，挑戰能撐到第幾波', status: 'open', path: '/game/tower-defense' },
  { id: 26, name: 'PINBALL', description: '彈珠台，操作 Flipper，不讓彈珠落下', status: 'open', path: '/game/pinball' },
  { id: 27, name: 'COMING SOON', description: '新機台開發中，敬請期待。', status: 'coming' },
])

const openCount = computed(() => gameSlots.value.filter((slot) => slot.status === 'open').length)
const comingCount = computed(() => gameSlots.value.filter((slot) => slot.status === 'coming').length)
const pad2 = (value: number) => String(value).padStart(2, '0')

/** 分頁對應的清單面板文案（彩票／彩運來分頁沒有卡片清單，改顯示導頁面板） */
const PANEL_META: Record<HallTab, { title: string; meta: string }> = {
  lobby: { title: 'GAME.CARD', meta: '// 遊戲機台' },
  lottery: { title: 'BG.LOTTERY', meta: '// BG彩票玩法' },
  taiwan: { title: 'TW.LOTTERY', meta: '// 彩運來入口' },
}
const panel = computed(() => PANEL_META[activeTab.value])

/** 私有工具方法：卡片進場動畫的堆疊延遲（比照 lottery-hall.vue 的 enterDelay 慣例） */
const _handlers = {
  enterDelay: (base: number, idx: number, step = 0.08) => `${base + idx * step}s`,
}

/** 遊戲紀錄 Dialog 開關狀態（State Object） */
const ui = reactive({
  historyOpen: false,
})
const click = {
  openHistory: () => {
    ui.historyOpen = true
  },
  closeHistory: () => {
    ui.historyOpen = false
  },
}

/** 頁尾狀態列的即時時鐘（比照參考稿 .status-bar 的 SYNC 欄位） */
const clock = ref('00:00:00')
let clockTimer: ReturnType<typeof setInterval> | null = null
const _tickClock = () => {
  const now = new Date()
  clock.value = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => pad2(n)).join(':')
}
onMounted(() => {
  _tickClock()
  clockTimer = setInterval(_tickClock, 1000)
})
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <main class="ops-hall">
    <i class="hud-bg" />
    <GameHallSprites />

    <!-- TOP HEADER：清單風格（Orbitron 品牌字 + 切角導覽） -->
    <header class="op-header">
      <div class="brand">
        <div class="logo">G</div>
        <div>
          <div class="name">GAME<span class="accent">//</span>HALL</div>
          <div class="sub">v1.0.0 // ARCADE-CTRL</div>
        </div>
      </div>
      <nav class="top-nav">
        <NuxtLink to="/" class="nav-item">首頁</NuxtLink>
        <button v-for="tab in TABS" :key="tab.key" type="button" class="nav-item"
          :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }}
        </button>
      </nav>
      <div class="right-tools">
        <button type="button" class="status-pill history-btn" @click="click.openHistory">遊戲紀錄</button>
        <NuxtLink v-if="!isLoggedIn" :to="{ path: '/login', query: { redirect: '/game-hall' } }"
          class="status-pill login-btn">
          登入
        </NuxtLink>
        <span class="status-pill"><span class="dot" />SYS.ONLINE</span>
      </div>
    </header>

    <GameHistoryDialog :visible="ui.historyOpen" title="遊戲紀錄" @close="click.closeHistory" />

    <div class="page">
      <!-- HERO：像素復古街機風（比照 Cyberpunk Home.html） -->
      <section class="pixel-hero">
        <div class="hero-tag"><span class="blink-dot" />ARCADE.ZONE // ACTIVE</div>
        <h1>遊戲中心 <span class="accent">GAME HALL</span></h1>
        <p class="sub">// 遊戲機台全面啟動！ SELECT YOUR GAME</p>
        <div class="hero-stats">
          <div class="hero-stat" :style="`--enter-delay: ${_handlers.enterDelay(0.4, 0)}`">
            <div class="k">開放中</div>
            <div class="v">{{ pad2(openCount) }}</div>
          </div>
          <div class="hero-stat mag" :style="`--enter-delay: ${_handlers.enterDelay(0.4, 1)}`">
            <div class="k">準備中</div>
            <div class="v">{{ pad2(comingCount) }}</div>
          </div>
          <div class="hero-stat yel" :style="`--enter-delay: ${_handlers.enterDelay(0.4, 2)}`">
            <div class="k">當前分區</div>
            <div class="v small">{{ activeTabLabel }}</div>
          </div>
        </div>
      </section>


      <GameHallArcadeLane />

      <!-- 登入後：左側高分排行 + 右側聊天室 -->
      <div v-if="isLoggedIn" class="social-row">
        <section class="hud-panel score-panel">
          <div class="panel-title">
            <h2>SCORE.RANK</h2>
            <div class="meta">// 遊戲高分排行 · <b>熱門遊戲.快來跳戰</b></div>
          </div>
          <GameHighScoreHud />
        </section>

        <section class="hud-panel chat-panel">
          <div class="panel-title">
            <h2>CHAT.LINK</h2>
            <div class="meta">// 聊天室 · <b>LIVE</b></div>
          </div>
          <ChatPanelHud accent-color="#ff8a2b" />
        </section>
      </div>


      <!-- 清單面板：俐落 HUD 風（比照 Cyberpunk.html） -->
      <section class="hud-panel">
        <div class="panel-title">
          <h2>{{ panel.title }}</h2>
          <div class="meta">{{ panel.meta }} · <b>LIVE</b></div>
        </div>

        <div v-if="activeTab === 'lobby'" class="game-grid">
          <GameMachineCard v-for="(slot, idx) in gameSlots" :key="slot.id" :game="slot"
            :style="`--enter-delay: ${_handlers.enterDelay(0.1, idx)}`" />
        </div>

        <div v-else-if="activeTab === 'lottery'" class="link-panel">
          <p>凡局皆成勢 · 萬數自歸平</p>
          <NuxtLink to="/lottery-hall" class="btn btn-primary">前往BG彩票</NuxtLink>
        </div>

        <div v-else class="link-panel">
          <p>彩運來開獎與中獎明細請由此進入查看。</p>
          <NuxtLink to="/lottery-hall-taiwan" class="btn btn-primary">前往彩運來</NuxtLink>
        </div>
      </section>

      <GameHallInvasionLane />

      <!-- STATUS BAR -->
      <div class="status-bar">
        <div class="item"><span class="blink" />CONN <b>STABLE</b></div>
        <div class="item">ZONE <b>{{ activeTabLabel }}</b></div>
        <div class="item">SYNC <b>{{ clock }}</b></div>
        <div class="item push-right">USER › <b>GUEST</b></div>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
/* ══════════════════════════ PAGE CHROME（清單風配色，全頁底色） ══════════════════════════ */
.ops-hall {
  --bg: #070912;
  --bg-2: #0c1124;
  --panel: #0d1326;
  --line: #1c2a55;
  --line-soft: #15203f;
  --text: #cfe8ff;
  --text-dim: #7891b8;
  --text-mute: #4b5e85;
  --cyan: #00e5ff;
  --cyan-soft: #5cf3ff;
  --magenta: #ff2e88;
  --magenta-soft: #ff7ab8;
  --amber: #ffb627;
  --green: #39ffa0;
  --orange: #ff8a2b;
  --orange-soft: #ffab6e;
  --orange-deep: #a35412;

  /* Hero 專用的像素復古配色（獨立於清單面板，故意不共用同一組變數） */
  --px-panel: #1a0a2e;
  --px-line: #3b1a5c;
  --px-magenta: #ff2bb8;
  --px-magenta-deep: #a3127a;
  --px-cyan: #26e0d3;
  --px-cyan-deep: #0a8a8a;
  --px-yellow: #ffd84d;
  --px-text: #f4e8ff;
  --px-text-dim: #b78de0;
  --px-text-mute: #6b4a8a;

  position: relative;
  height: 100vh;
  overflow-y: auto;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(255, 46, 136, 0.1), transparent 60%),
    radial-gradient(900px 500px at -5% 110%, rgba(0, 229, 255, 0.08), transparent 60%),
    linear-gradient(180deg, #05070f 0%, #070912 100%);
  color: var(--text);
  font-family: "Share Tech Mono", "JetBrains Mono", monospace;
  font-size: 13px;
  letter-spacing: 0.02em;

  /* 捲軸改成 Cyberpunk HUD 風格，比照專案既有（如 ssc 系列元件）的自訂捲軸慣例 */
  scrollbar-width: thin;
  scrollbar-color: var(--cyan) var(--panel);

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: var(--panel);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--cyan);
    border-radius: 999px;
    border: 2px solid var(--panel);
    box-shadow: 0 0 6px rgba(0, 229, 255, 0.5);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--cyan-soft);
  }

  overflow-x: hidden;
}

.hud-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.045) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 90% 80% at 50% 30%, black 50%, transparent 100%);
  animation: crtBoot 1.1s ease-out both;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(to bottom,
        rgba(255, 255, 255, 0.02) 0,
        rgba(255, 255, 255, 0.02) 1px,
        transparent 1px,
        transparent 3px);
    mix-blend-mode: overlay;
  }
}

/* ══════════════════════════ HEADER（清單風：Orbitron + 切角導覽） ══════════════════════════ */
.op-header {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, #0a1126 0%, #060914 100%);
  border-bottom: 1px solid var(--cyan);
  box-shadow: 0 0 22px rgba(0, 229, 255, 0.18), inset 0 -1px 0 rgba(0, 229, 255, 0.35);
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 22px;
  animation: slideDown 0.6s cubic-bezier(.22, .68, 0, 1.2) both;

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-right: 36px;

    .logo {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 1px solid var(--cyan);
      background: rgba(0, 229, 255, 0.08);
      box-shadow: 0 0 12px rgba(0, 229, 255, 0.45), inset 0 0 10px rgba(0, 229, 255, 0.25);
      color: var(--cyan);
      font-family: "Orbitron", sans-serif;
      font-weight: 800;
      font-size: 14px;
      transform: skewX(-8deg);
    }

    .name {
      font-family: "Orbitron", sans-serif;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.18em;
      color: #e9f8ff;
      text-shadow: 0 0 8px rgba(0, 229, 255, 0.55);

      .accent {
        color: var(--magenta);
        text-shadow: 0 0 8px rgba(255, 46, 136, 0.6);
      }
    }

    .sub {
      color: var(--text-mute);
      font-size: 11px;
      letter-spacing: 0.2em;
    }
  }

  .top-nav {
    display: flex;
    height: 100%;
    align-items: stretch;
    gap: 2px;
  }

  .nav-item {
    padding: 0 22px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
    height: 100%;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    position: relative;
    font-family: "Share Tech Mono", monospace;
    border: none;
    background: none;

    &::before {
      content: "//";
      color: var(--cyan);
      opacity: 0.4;
    }

    &:hover {
      color: #fff;
    }

    &.active {
      color: #02131a;
      background: var(--cyan);
      clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
      font-weight: 700;

      &::before {
        color: #02131a;
        opacity: 0.65;
      }
    }
  }

  .right-tools {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    background: rgba(0, 229, 255, 0.05);
    padding: 5px 10px;
    font-size: 11px;
    letter-spacing: 0.16em;
    color: var(--text-dim);
    font-family: inherit;

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      animation: hud-pulse 1.6s infinite;
    }

    &.history-btn {
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;

      &:hover {
        color: #fff;
        border-color: var(--cyan);
      }
    }

    &.login-btn {
      cursor: pointer;
      color: var(--cyan);
      border-color: var(--cyan);
      background: rgba(0, 229, 255, 0.12);
      text-decoration: none;
      transition: color 0.15s, border-color 0.15s, background 0.15s;

      &:hover {
        color: #02131a;
        background: var(--cyan);
      }
    }
  }
}

.page {
  position: relative;
  z-index: 1;
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 24px 0px;
}

/* ══════════════════════════ HERO（像素復古街機風） ══════════════════════════ */
.pixel-hero {
  position: relative;
  background: var(--px-panel);
  border: 4px solid #000;
  box-shadow: 6px 6px 0 0 var(--px-magenta-deep), 0 0 0 2px var(--px-magenta);
  padding: 26px 30px;
  margin-bottom: 24px;
  font-family: "VT323", monospace;
  animation: pixelPopIn 0.55s cubic-bezier(.34, 1.56, .64, 1) 0.15s both;

  .hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: "Press Start 2P", monospace;
    font-size: 10px;
    color: var(--px-yellow);
    text-shadow: 2px 2px 0 #000;
    background: #000;
    border: 2px solid var(--px-yellow);
    padding: 8px 12px;
    width: fit-content;
    box-shadow: 3px 3px 0 0 #8a6e1a;

    .blink-dot {
      width: 8px;
      height: 8px;
      background: var(--px-yellow);
      animation: hud-blink 0.6s steps(2) infinite;
    }
  }

  h1 {
    margin-top: 16px;
    font-family: "Press Start 2P", monospace;
    font-size: 32px;
    line-height: 1.25;
    color: #fff;
    text-shadow: 3px 3px 0 var(--px-magenta), 6px 6px 0 var(--px-cyan), 9px 9px 0 #000;
    animation: hero-glitch 5s infinite;

    .accent {
      color: var(--px-cyan);
    }
  }

  .sub {
    margin-top: 14px;
    color: var(--px-text);
    font-size: 20px;
    letter-spacing: 0.05em;
    text-shadow: 2px 2px 0 #000;
  }

  .hero-stats {
    margin-top: 20px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .hero-stat {
    background: #000;
    border: 2px solid var(--px-cyan);
    padding: 8px 14px;
    box-shadow: 3px 3px 0 0 var(--px-cyan-deep);
    animation: fadeSlideUp 0.45s ease-out var(--enter-delay, 0.4s) both;

    .k {
      color: var(--px-cyan);
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .v {
      color: #fff;
      font-size: 24px;
      line-height: 1;
      font-family: "Press Start 2P", monospace;
      margin-top: 6px;

      &.small {
        font-size: 13px;
      }
    }

    &.mag {
      border-color: var(--px-magenta);
      box-shadow: 3px 3px 0 0 var(--px-magenta-deep);

      .k {
        color: var(--px-magenta);
      }
    }

    &.yel {
      border-color: var(--px-yellow);
      box-shadow: 3px 3px 0 0 #8a6e1a;

      .k {
        color: var(--px-yellow);
      }
    }
  }
}

/* ══════════════════════════ 清單面板（俐落 HUD 風，切角＋霓虹） ══════════════════════════ */
.hud-panel {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--cyan);
  padding: 22px;
  animation: fadeSlideUp 0.55s ease-out 0.35s both;
}

/*
 * 登入後社交列：左排行（紅色）+ 右聊天（橙色）
 */
.social-row {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 20px;
  margin-top: 20px;
  margin-bottom: 24px;
  align-items: stretch;
  /* 5 筆排行基準高度：每行 40px + 間距 10px × 4 */
  --rank-body-h: calc(5 * 40px + 4 * 10px);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  >.hud-panel {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .score-panel> :not(.panel-title) {
    flex: 1;
    min-height: var(--rank-body-h);
    height: auto;
    max-height: none;
  }

  /* 聊天面板固定高度（比照排行榜），內部 chp-list 才會真的捲動，不會被訊息撐高 */
  .chat-panel> :not(.panel-title) {
    flex: 1;
    min-height: var(--rank-body-h);
    height: var(--rank-body-h);
    max-height: var(--rank-body-h);
  }

  .panel-title {
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-bottom: 12px;
  }
}

.score-panel {
  background:
    radial-gradient(520px 180px at 15% 0%, rgba(255, 59, 74, 0.12), transparent 65%),
    #150808;
  border-color: #ff3b4a;
  box-shadow:
    0 0 24px rgba(255, 59, 74, 0.16),
    inset 0 0 26px rgba(255, 59, 74, 0.05),
    0 8px 28px rgba(0, 0, 0, 0.28);

  .panel-title h2 {
    color: #ff8a92;
    text-shadow: 0 0 10px rgba(255, 59, 74, 0.45);
  }

  .panel-title .meta {
    color: #a85a5a;

    b {
      color: #ff3b4a;
    }
  }
}

/*
 * 聊天室面板：box-shadow 與 .pixel-hero 一致（像素位移陰影 + 外框描邊）
 */
.chat-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-color: var(--orange);
  box-shadow: 6px 6px 0 0 var(--orange-deep), 0 0 0 2px var(--orange);

  background:
    radial-gradient(600px 200px at 15% 0%, rgba(255, 138, 43, 0.1), transparent 65%),
    #150e07;

  .panel-title h2 {
    color: var(--orange-soft);
    text-shadow: 0 0 10px rgba(255, 138, 43, 0.45);
  }

  .panel-title .meta {
    color: #a87a53;

    b {
      color: var(--orange);
    }
  }
}

.panel-title {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 18px;

  h2 {
    font-family: "Orbitron", sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.22em;
    color: #fff;
    text-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
  }

  .meta {
    color: var(--text-mute);
    font-size: 11px;
    letter-spacing: 0.2em;

    b {
      color: var(--magenta);
      font-weight: 400;
    }
  }
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.link-panel {
  padding: 30px 10px;
  text-align: center;
  animation: fadeIn 0.5s ease-out both;

  p {
    color: var(--text-dim);
    font-size: 13px;
    letter-spacing: 0.06em;
    margin-bottom: 18px;
  }
}

.btn {
  height: 36px;
  padding: 0 26px;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: "Share Tech Mono", monospace;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--cyan);
  color: #02141a;
  font-weight: 700;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  box-shadow: 0 0 14px rgba(0, 229, 255, 0.5);

  &:hover {
    background: var(--cyan-soft);
    box-shadow: 0 0 22px rgba(0, 229, 255, 0.8);
  }
}

/* ══════════════════════════ STATUS BAR ══════════════════════════ */
.status-bar {
  padding: 10px 22px;
  border-top: 1px solid var(--cyan);
  background: rgba(0, 229, 255, 0.025);
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 10px;
  color: var(--text-mute);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  flex-wrap: wrap;
  animation: fadeIn 0.5s ease-out 0.75s both;

  .item {
    display: flex;
    align-items: center;
    gap: 8px;

    b {
      color: var(--cyan);
      font-weight: 400;
    }

    &.push-right {
      margin-left: auto;
    }
  }

  .blink {
    width: 6px;
    height: 6px;
    background: var(--green);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--green);
    animation: hud-pulse 1.2s infinite;
  }
}

/* ══════════════════════════ 進場動畫（比照 lottery-hall.vue 的 slideDown / fadeSlideUp / fadeIn 慣例） ══════════════════════════ */
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeSlideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes pixelPopIn {
  0% {
    transform: translateY(24px) scale(0.94);
    opacity: 0;
  }

  70% {
    transform: translateY(-3px) scale(1.01);
    opacity: 1;
  }

  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* 開機掃描效果：HUD 網格背景從全暗到浮現，兩次閃爍後穩定，模擬 CRT 螢幕開機 */
@keyframes crtBoot {
  0% {
    opacity: 0;
  }

  15% {
    opacity: 0.6;
  }

  25% {
    opacity: 0.05;
  }

  40% {
    opacity: 1;
  }

  100% {
    opacity: 1;
  }
}

@keyframes hud-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}

@keyframes hud-blink {

  0%,
  49% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0.25;
  }
}

@keyframes hero-glitch {

  0%,
  88%,
  100% {
    text-shadow: 3px 3px 0 var(--px-magenta), 6px 6px 0 var(--px-cyan), 9px 9px 0 #000;
    transform: translate(0, 0);
  }

  89% {
    text-shadow: -3px 3px 0 var(--px-magenta), 6px 6px 0 var(--px-cyan), 9px 9px 0 #000;
    transform: translate(2px, -1px);
  }

  90% {
    text-shadow: 4px -2px 0 var(--px-magenta), -4px 6px 0 var(--px-cyan), 9px 9px 0 #000;
    transform: translate(-2px, 1px);
  }

  91% {
    text-shadow: 3px 3px 0 var(--px-magenta), 6px 6px 0 var(--px-cyan), 9px 9px 0 #000;
    transform: translate(1px, 0);
  }

  93% {
    text-shadow: -2px 4px 0 var(--px-magenta), 7px 5px 0 var(--px-cyan), 9px 9px 0 #000;
    transform: translate(-1px, 1px);
  }
}
</style>
