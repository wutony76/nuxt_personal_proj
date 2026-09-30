<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import BetPanel from '~/components/toys/BetPanel.vue'
import BlockedModal from '~/components/toys/BlockedModal.vue'
import ResultModal from '~/components/toys/ResultModal.vue'
import ToyGameHeader from '~/components/toys/ToyGameHeader.vue'
import { useToyCards } from '~/composables/useToyCards'

/** 版面比照 lucky-draw.vue 的骨架（未領彩池／連乘統計卡＋遊戲/規則雙分頁＋票框開獎格＋連乘進度條），
 *  翻牌與猜大小/相同的邏輯維持 useToyCards 既有行為不變，這裡只重排顯示。 */
const round = useToyCards()

const chips = computed(() => round.state.catalog?.betChips ?? [])
const blockedItem = computed(() =>
  round.state.catalog?.items.find((item) => item.slug === round.state.blockedGameKey) ?? null
)
type MainTab = 'game' | 'rules'
const ui = reactive({ mainTab: 'game' as MainTab, resultReady: false })

/** 翻牌結果先讓玩家看 1 秒，才解鎖操作／彈出結果視窗；這段期間鎖住翻牌與選擇按鈕 */
let resultDelayTimer: ReturnType<typeof setTimeout> | null = null
watch(() => round.state.revealed, (revealed) => {
  if (resultDelayTimer) {
    clearTimeout(resultDelayTimer)
    resultDelayTimer = null
  }
  if (revealed) {
    resultDelayTimer = setTimeout(() => {
      ui.resultReady = true
      resultDelayTimer = null
    }, 1000)
  } else {
    ui.resultReady = false
  }
}, { immediate: true })

/** 翻牌卡片的正／反面數字，要跟 CSS 的 0.6s 翻面動畫時間一致 */
const FLIP_DURATION_MS = 600
const flip = reactive({ front: null as number | null, back: null as number | null, open: false, noAnim: false })
let flipSettleTimer: ReturnType<typeof setTimeout> | null = null
/** round.state.rank 在翻牌動畫「開始播放的同一瞬間」就已經被改寫成新數字（見 useToyCards.ts
 *  的 applyView：revealed 變 true 那刻 rank 同時被换成新值），如果卡片正面直接綁這個值，
 *  玩家會在卡片都還沒轉到看不見正面角度時就先看到答案。這裡改用獨立的 front/back 快照：
 *  正面永遠停在翻牌前的數字，背面放翻牌後的數字，靠 backface-visibility 讓背面數字轉到
 *  超過 90 度以後才會露出來，動畫播完再把新數字疊回正面、角度歸零，準備下一次翻牌。
 *
 *  ⚠️ 動畫播完後不能直接把 open 改回 false 讓 CSS transition 自然「轉回去」：那樣會在
 *  疊字的同一瞬間又觸發一次 180→0 的倒轉動畫，畫面上看起來像翻過去又翻回來，而且倒轉
 *  途中會有一段時間正反兩面都轉到看不見（90°~270° 之間永遠有一面在轉場），玩家觀感上
 *  等同「答案沒有真的翻出來就直接變了」。做法是疊字的同時暫時關掉 transition（noAnim），
 *  angle 瞬間歸零、正面同時換成新數字，兩者視覺上完全等價、沒有動畫可看；下一幀再把
 *  transition 開回來，準備下一次翻牌。 */
/** 播放一次翻面：背面先定格成要揭曉的數字，轉完再疊回正面、瞬間歸零角度 */
const _playFlip = (backValue: number | null) => {
  flip.back = backValue
  flip.open = true
  if (flipSettleTimer) clearTimeout(flipSettleTimer)
  flipSettleTimer = setTimeout(() => {
    flip.noAnim = true
    flip.front = flip.back
    flip.open = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flip.noAnim = false
      })
    })
    flipSettleTimer = null
  }, FLIP_DURATION_MS)
}

watch(() => round.state.revealed, (revealed) => {
  if (!revealed) {
    flip.front = round.state.rank
    flip.back = round.state.nextRank
    flip.open = false
    return
  }
  if (round.state.nextRank != null) {
    // 猜牌之後的正常翻面，flip.back 已經在上面「revealed:false」那次定格好了
    _playFlip(flip.back)
    return
  }
  if (flip.front == null && round.state.rank != null) {
    // 剛發牌（這局第一張）：沒有「翻牌前」的舊數字可比對，直接顯示會讓答案瞬間出現，
    // 一樣要從「尚未發牌」的背面翻出這張數字，跟猜牌用同一套翻面動畫
    _playFlip(round.state.rank)
    return
  }
  // 其餘情況（例如中途重整頁面回來，已經有目前這張牌但沒有翻面可播）：直接顯示
  flip.front = round.state.rank
  flip.open = false
})
/** 領取／重玩後 round.state.rank 會被清成 null，這裡同步重置卡面，避免殘留上一局數字 */
watch(() => round.state.rank, (rank) => {
  if (rank == null) {
    if (flipSettleTimer) {
      clearTimeout(flipSettleTimer)
      flipSettleTimer = null
    }
    flip.front = null
    flip.back = null
    flip.open = false
  }
}, { immediate: true })

const isLocked = computed(() =>
  round.state.settling || round.state.status === 'playing' || (round.state.revealed && !ui.resultReady)
)

/** 猜對且還能繼續猜（canGuess）時不彈窗，改讓玩家直接翻下一張；只有猜錯或連勝到頂才彈出結果視窗
 *  （ResultModal 現在是蓋滿全螢幕的浮動視窗，canGuess 時若還彈出會擋住牌面，沒辦法繼續猜）。
 *  correct 在「重新整理/切換玩具後回來繼續」時，後端 snapshot 一律回傳 null，只看
 *  correct!=null 會讓已經有未領彩池、可以領取的畫面永遠彈不出來，要用 canClaim 一起判斷。 */
const modalVisible = computed(() =>
  round.state.revealed && round.state.status !== 'playing' && !round.state.canGuess && ui.resultReady
  && (round.state.correct != null || round.state.canClaim)
)
const modalTitle = computed(() => {
  if (round.state.claimed) return '已領取'
  if (round.state.correct === false) return '猜錯了'
  if (round.state.correct) return `連勝 ${round.state.streak}`
  return '結果'
})
const modalDetail = computed(() => {
  if (round.state.claimed) return `已寫入 F 幣 ${round.state.reward.toLocaleString('zh-TW')}`
  if (round.state.correct === false) return '本輪結束，未領金額已歸零。'
  if (round.state.correct) return `倍率 ×${round.state.multiplier}`
  return ''
})

const money = (value: number) => Math.floor(value).toLocaleString('zh-TW')
const multLabel = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}`
}

/** 連勝上限次數，對應 server/services/game/toys/cards.ts 的 CARD_STREAK.length */
const STREAK_CAP = 5
/** 連勝進度＝目前連勝 ÷ 連勝上限 */
const progress = computed(() => `${Math.min(100, (round.state.streak / STREAK_CAP) * 100)}%`)

/** 猜大／小的連勝倍率表，抄自 server/services/game/toys/cards.ts 的 CARD_STREAK（不可改邏輯，這裡純顯示用） */
const STREAK_MULTIPLIERS = [1.8, 3, 5, 8, 15] as const
/** 猜「相同」固定倍率，抄自 server/services/game/toys/cards.ts 的 CARD_SAME_MULTIPLIER，不吃連勝表 */
const SAME_MULTIPLIER = 10

type Tone = { bg: string; fg: string; bd: string }
/** 沿用 lucky-draw 獎格配色語彙，依連勝次數由淺到深 */
const STREAK_TONE: Tone[] = [
  { bg: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)', bd: 'var(--color-accent-2-400)' },
  { bg: 'var(--color-accent-2-400)', fg: 'var(--color-accent-2-800)', bd: 'var(--color-accent-2-600, var(--color-accent-2-400))' },
  { bg: 'var(--color-accent-300)', fg: 'var(--color-accent-800)', bd: 'var(--color-accent-500)' },
  { bg: 'var(--color-accent-500)', fg: 'var(--color-neutral-900)', bd: 'var(--color-accent-700)' },
  { bg: 'var(--color-accent-700)', fg: 'var(--color-bg)', bd: 'var(--color-accent-900, var(--color-accent-700))' }
]

const headline = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return '其他玩具還有未領金額，先處理那一款'
  if (s.settling || s.status === 'playing') return '翻牌中…'
  if (s.rank == null) return '按「發牌」開始這一局'
  if (s.revealed && s.correct === false) return '猜錯了，這注歸零'
  if (s.revealed && s.correct === true) {
    return s.canGuess ? `猜對了！連勝 ${s.streak}，要繼續猜嗎？` : '已達連勝上限，趕緊領取'
  }
  return '猜下一張比較大、比較小，還是相同'
})
const headlineTone = computed(() => {
  const s = round.state
  if (s.blockedGameKey) return 'is-neutral'
  if (s.revealed && s.correct === false) return 'is-neutral'
  if (s.revealed && s.correct === true && !s.canGuess) return 'is-accent'
  return ''
})

const click = {
  setMainTab: (tab: MainTab) => { ui.mainTab = tab }
}

onMounted(() => {
  void round.actions.load()
})
onBeforeUnmount(() => {
  round.stopReveal()
  if (resultDelayTimer) clearTimeout(resultDelayTimer)
  if (flipSettleTimer) clearTimeout(flipSettleTimer)
})
</script>

<template>
  <main class="theme-taiwan-lottery cards">
    <!-- <ToyGameHeader :balance="round.state.balance" /> -->
    <section class="cards-body">
      <p v-if="round.state.catalogError" class="cards-error">{{ round.state.catalogError }}</p>
      <p v-else-if="round.state.error" class="cards-error">{{ round.state.error }}</p>
      <BlockedModal :visible="!!round.state.blockedGameKey" :item="blockedItem" />

      <div class="lucky-stats">
        <div class="stat-card is-dark">
          <div class="stat-label">未領彩池</div>
          <div class="stat-value">F 幣 {{ money(round.state.pot) }}</div>
        </div>
        <div class="stat-card is-accent">
          <div class="stat-label">目前連勝</div>
          <div class="stat-value">{{ round.state.streak > 0 ? `${round.state.streak} 連勝` : '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">F 幣餘額</div>
          <div class="stat-value">{{ money(round.state.balance) }}</div>
        </div>
      </div>

      <div class="tab-bar cards-main-tabs">
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'game' }"
          @click="click.setMainTab('game')">遊戲</button>
        <button type="button" class="tab-btn" :class="{ 'is-active': ui.mainTab === 'rules' }"
          @click="click.setMainTab('rules')">規則</button>
      </div>

      <div v-if="ui.mainTab === 'game'" class="lucky-panel">
        <div class="bet-row">
          <BetPanel :chips="chips" :bet="round.state.bet" :custom-bet="round.state.customBet"
            :disabled="isLocked || round.state.rank != null"
            @choose="round.actions.chooseChip" @update:custom-bet="round.state.customBet = $event"
            @apply-custom="round.actions.applyCustom" />
        </div>

        <div class="frame-headline" :class="headlineTone">{{ headline }}</div>

        <div class="frame-border">
          <article class="card">
            <div class="card-inner" :class="{ 'is-open': flip.open, 'no-anim': flip.noAnim }">
              <div class="card-face card-front">{{ flip.front ?? '？' }}</div>
              <!-- 背面只是花紋、不顯示 flip.back 的數字：真正的牌背不該讓玩家看到下一張是什麼，
                   數字要等翻完、疊回正面那一刻才「揭曉」，不能在背面就先看到答案 -->
              <div class="card-face card-back" />
            </div>
          </article>
          <p v-if="round.state.streak > 0" class="cards-streak">連勝 {{ round.state.streak }}</p>
          <div class="choices">
            <button type="button" :disabled="isLocked || !round.state.canGuess"
              @click="round.actions.guess('high')">大</button>
            <button type="button" :disabled="isLocked || !round.state.canGuess"
              @click="round.actions.guess('low')">小</button>
            <button type="button" :disabled="isLocked || !round.state.canGuess"
              @click="round.actions.guess('same')">相同</button>
          </div>

          <!-- 猜對但還沒到連勝上限時，結果彈窗故意不彈出（見上方 modalVisible 註解，避免擋住牌面），
               這裡補一顆常駐按鈕讓玩家可以隨時見好就收，不用被迫翻到連勝上限或猜錯歸零 -->
          <button v-if="round.state.canClaim && round.state.canGuess" type="button" class="claim-now"
            :disabled="isLocked || round.state.settling" @click="round.actions.claim">
            提前領取 F 幣 {{ money(round.state.pot) }}
          </button>

          <button v-if="round.state.rank == null" type="button" class="deal"
            :disabled="isLocked || round.state.blockedGameKey != null" @click="round.actions.start">
            發牌
          </button>
        </div>

        <div class="frame-progress">
          <div class="progress-row">
            <span>連勝進度</span>
            <span>上限 {{ STREAK_CAP }} 次（猜相同固定 ×{{ SAME_MULTIPLIER }}）</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress }" />
          </div>
        </div>
      </div>

      <div v-else class="lucky-rules">
        <section class="rule-section">
          <h3>連勝倍率（猜大／小）</h3>
          <ul class="tier-list">
            <li v-for="(mult, idx) in STREAK_MULTIPLIERS" :key="idx">
              <span class="tier-badge"
                :style="{ background: STREAK_TONE[idx]?.bg, color: STREAK_TONE[idx]?.fg, borderColor: STREAK_TONE[idx]?.bd }">
                {{ idx + 1 }}
              </span>
              <span class="tier-mult">第 {{ idx + 1 }} 次猜對 {{ multLabel(mult) }}</span>
            </li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>特例：猜「相同」</h3>
          <p class="side-note">猜「相同」固定 {{ multLabel(SAME_MULTIPLIER) }}，不受連勝次數影響，也不吃上面的連勝倍率表。</p>
        </section>

        <section class="rule-section">
          <h3>規則</h3>
          <ul class="rule-list">
            <li>牌組 1～13 點（無花色），抽完 13 張自動重新洗牌。</li>
            <li>猜對大、小依連勝次數計算倍率，最高連勝 {{ STREAK_CAP }} 次。</li>
            <li>猜對相同固定 ×{{ SAME_MULTIPLIER }}，不論目前連勝進度。</li>
            <li>猜錯本注歸零，重新發牌再開始。</li>
          </ul>
        </section>

        <section class="rule-section">
          <h3>頭家的話</h3>
          <p class="side-note">未滿十八歲不得購買。理性投注，量力而為。</p>
        </section>
      </div>

      <ResultModal :visible="modalVisible" :title="modalTitle" :detail="modalDetail"
        :can-claim="round.state.canClaim" :can-continue="false"
        :can-replay="round.state.finished && !round.state.canClaim" :busy="round.state.settling"
        @claim="round.actions.claim" @continue="() => {}" @replay="round.actions.playAgain" />
    </section>
  </main>
</template>

<style scoped lang="scss">
.cards-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cards-error {
  margin: 0 0 4px;
  color: var(--color-accent-800, #643312);
}

.lucky-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 6px;
}

.stat-card {
  background: var(--color-neutral-100, #f9f4ed);
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-md, 16px);
  padding: 9px 16px;

  .stat-label {
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--color-neutral-600, #82796a);
  }

  .stat-value {
    margin-top: 2px;
    font-family: var(--font-heading, serif);
    font-weight: 900;
    font-size: 20px;
    color: var(--color-accent-800, #643312);
  }

  &.is-dark {
    background: var(--color-neutral-900, #2e2b25);
    border-color: var(--color-neutral-900, #2e2b25);

    .stat-label {
      color: var(--color-accent-300, #ffc6a5);
    }

    .stat-value {
      color: var(--color-bg, #f5ead8);
    }
  }

  &.is-accent {
    background: var(--color-accent-700, #8c491a);
    border-color: var(--color-accent-700, #8c491a);

    .stat-label {
      color: var(--color-accent-200, #ffe1d0);
    }

    .stat-value {
      color: var(--color-bg, #f5ead8);
    }
  }
}

.cards-main-tabs {
  margin-bottom: 10px;
  max-width: 320px;
}

.tab-bar {
  display: flex;
  gap: 6px;
}

.tab-btn {
  flex: 1;
  border: 1px solid var(--color-accent-2-400, #aebf92);
  border-radius: 999px;
  background: transparent;
  padding: 6px 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent-2-800, #3d472b);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &.is-active {
    background: var(--color-accent-2-700, #56633f);
    border-color: var(--color-accent-2-700, #56633f);
    color: var(--color-bg, #f5ead8);
  }

  &:not(.is-active):hover {
    background: var(--color-accent-2-100, #f0fae1);
  }
}

.lucky-panel {
  background: var(--color-neutral-100, #f9f4ed);
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-lg, 28px);
  padding: 14px;
  box-shadow: var(--shadow-md);
}

.bet-row {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--color-neutral-400, #c0b6a5);
}

.frame-headline {
  background: var(--color-neutral-900, #2e2b25);
  color: var(--color-bg, #f5ead8);
  border-radius: 999px;
  padding: 9px 18px;
  text-align: center;
  font-family: var(--font-heading, serif);
  font-weight: 900;
  font-size: 14px;
  margin-bottom: 10px;

  &.is-accent {
    background: var(--color-accent-700, #8c491a);
  }

  &.is-neutral {
    background: var(--color-neutral-800, #474238);
  }
}

.frame-border {
  border: 6px solid var(--color-accent-600, #b2622d);
  border-radius: var(--radius-sm, 8px);
  padding: 12px 16px;
  background: #544c4b;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  .card {
    align-self: center;
    width: 100px;
    aspect-ratio: 3 / 4;
    position: relative;
    perspective: 800px;
  }

  /* 正反兩面各自定格（見 script 的 flip.front／flip.back），這裡只負責 3D 翻面：
     .card-inner 轉 180 度，正面轉走、backface-visibility 讓它超過 90 度就看不見，
     背面因為本身已經預先轉了 180 度，轉滿 180 度後總角度等於 360（跟正面同向），
     文字不會鏡射反過來，翻到一半以前也看不到答案 */
  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.6s ease;

    &.is-open {
      transform: rotateY(180deg);
    }

    /* 疊字歸零那一瞬間關掉 transition，避免瞬間又演一次 180→0 的倒轉動畫 */
    &.no-anim {
      transition: none;
    }
  }

  .card-face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md, 16px);
    border: 2px solid var(--color-accent-400, #d68a52);
    font-family: var(--font-heading, serif);
    font-weight: 900;
    font-size: 40px;
    backface-visibility: hidden;
  }

  .card-front {
    background: var(--color-neutral-100, #f9f4ed);
    color: var(--color-neutral-800, #474238);
  }

  .card-back {
    /* 跟正面（米白底、深字）的顏色故意拉開差異，斜紋 + 深色系，
       讓玩家一眼就能看出「這是背面」，不會誤以為只是換了個數字 */
    background: repeating-linear-gradient(
      135deg,
      var(--color-accent-700, #8c491a) 0 8px,
      var(--color-accent-800, #643312) 8px 16px
    );
    border-color: var(--color-accent-900, #4a2b0f);
    color: var(--color-bg, #f5ead8);
    transform: rotateY(180deg);
  }

  .cards-streak {
    margin: 0;
    color: var(--color-bg, #f5ead8);
    font-family: var(--font-heading, serif);
    font-weight: 900;
    font-size: 14px;
  }

  .choices {
    display: flex;
    gap: 8px;

    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      background: var(--color-accent-600, #b2622d);
      color: var(--color-bg, #f5ead8);
      font-weight: 700;
      cursor: pointer;
      transition: filter 0.15s ease;

      &:hover:not(:disabled) {
        filter: brightness(1.08);
      }

      &:disabled {
        opacity: 0.45;
        cursor: default;
      }
    }
  }

  .deal {
    border: 0;
    border-radius: 999px;
    padding: 10px 22px;
    background: var(--color-accent-700, #8c491a);
    color: var(--color-bg, #f5ead8);
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  .claim-now {
    border: 0;
    border-radius: 999px;
    padding: 10px 22px;
    background: #dc2626;
    color: var(--color-bg, #f5ead8);
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }
}

.frame-progress {
  margin-top: 16px;

  .progress-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--color-neutral-600, #82796a);
    margin-bottom: 6px;
  }

  .progress-track {
    height: 9px;
    border-radius: 999px;
    background: var(--color-neutral-300, #dcd3c4);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent-600, #b2622d);
    transition: width 0.3s ease;
  }
}

.lucky-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-section {
  background: var(--color-neutral-100, #f9f4ed);
  border: 1px solid var(--color-neutral-300, #dcd3c4);
  border-radius: var(--radius-lg, 28px);
  padding: 10px 16px;

  h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: var(--color-accent-800, #643312);
  }
}

.tier-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
}

.tier-badge {
  flex: none;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 2px solid;
  font-family: var(--font-heading, serif);
  font-weight: 900;
  font-size: 12px;
}

.tier-mult {
  flex: 1;
  font-weight: 700;
}

.rule-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-neutral-800, #474238);
}

.side-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-neutral-700, #645c50);
}
</style>
