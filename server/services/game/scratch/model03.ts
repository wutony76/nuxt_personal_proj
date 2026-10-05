import {
  CARD_WIN_COINS,
  FORCED_WIN_COINS,
  PLAY1_PLAY_RES_COMB,
  PLAY1_WIN_COINS,
  WIN_COINS_COMB,
  type CoinCombo,
  type HandCombo,
  type HandValue,
  type RoundState
} from './model03Data'

/**
 * Model03（剪刀石頭布刮刮樂）試算邏輯。
 *
 * 忠實移植自外部 Python 專案 `py3_AVScratch_proj/scratch/scratch_model03.py`
 * 的 `get_coin_card()`／`get_play1()`／`analyze_card()`，機率表本身（見
 * `model03Data.ts`）跟演算流程都照搬，只有「畫刮刮樂卡片圖」（PIL 產生
 * base64 圖片）這部分故意不搬——這支是後台「遊戲試算」用的機率/派彩驗證
 * 工具，不是玩家會看到的畫面，圖片渲染對驗證數字正確性沒有幫助，詳見
 * `openspec/changes/add-scratch-model03-simulator/proposal.md`。
 *
 * 兩個刻意保留、跟原始碼一致的「非直覺」行為（使用者已確認要忠實移植，
 * 不擅自修正，見 `design.md`）：
 *
 * 1. `getCoin`（單局「得到金額」）只在雙方手勢完全相同（平手）時才會算出
 *    非零值（該局 coin 的一半）；即使該局被判定為「贏」（state 101），
 *    因為「贏」在猜拳規則下手勢必然不同，`getCoin` 這裡永遠是 0——這跟
 *    頁面規則文字「贏得獎金、平手得一半」不一致，是原始系統本來就有的
 *    落差，不是這次移植造成的
 * 2. `winCoin`（卡片最終顯示的「得到金額」）其實就是呼叫端一開始輸入的
 *    目標金額（`cardCredit`）本身，不是 5 局實際派彩的加總——原始碼
 *    `get_coin_card()` 回傳的 `card_win_coin` 就是直接把輸入參數原封不動
 *    傳回去，不是重新計算出來的
 */

/**
 * 單局模擬結果：顯示用標題、該局是否原本判定為贏/平手（影響顯示色）、雙方手勢文字、
 * 雙方手勢原始數值（`handValues`，給卡片視覺還原用——對應 item_0/1/2.png 這三個
 * 猜拳手勢圖示，`play` 的中文字只給純文字列表顯示用）、該局金額、該局「得到金額」
 */
export type Model03RoundResult = {
  title: string
  color: 'red' | 'black'
  play: [string, string]
  handValues: [HandValue, HandValue]
  coin: number
  getCoin: number
}

export type Model03AnalyzeResult = {
  rounds: Model03RoundResult[]
  /** 呼叫端輸入的目標金額本身（見檔頭註解第 2 點，不是 5 局派彩加總） */
  winCoin: number
}

const HAND_LABELS: Record<HandValue, string> = { 0: '剪刀', 1: '石頭', 2: '布' }

/**
 * 每個 state（100 輸／101 贏／102 平手）各自的「洗牌後待抽手勢組合」池，
 * 抽完整池再重新洗牌，確保同一輪抽牌循環內不會提早重複（忠實移植自
 * Python 版 `self.copy_play1_play_res_comb` 的 pop-until-empty-then-reshuffle
 * 寫法）。這是模組層級的共用狀態，會跨多次呼叫持續消耗/補充，不是每次
 * 呼叫都重置——行為跟原始碼的 process-wide 單例一致。
 */
const _rotatingHandPool: Record<RoundState, HandCombo[]> = { 100: [], 101: [], 102: [] }

function _shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i] as T
    copy[i] = copy[j] as T
    copy[j] = tmp
  }
  return copy
}

function _popHandCombo(state: RoundState): HandCombo {
  let pool = _rotatingHandPool[state]
  if (pool.length === 0) {
    pool = _shuffled([...PLAY1_PLAY_RES_COMB[state]])
    _rotatingHandPool[state] = pool
  }
  return pool.pop() as HandCombo
}

function _pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

type PlayRound = { hands: HandCombo; coin: number }

function _getPlay1(coinCombo: CoinCombo): { rounds: PlayRound[]; winHands: HandCombo[] } {
  const shuffledCoins = _shuffled([...coinCombo])
  const rounds: PlayRound[] = []
  const winHands: HandCombo[] = []

  for (const coinValue of shuffledCoins) {
    let state: RoundState
    if (coinValue > 0) {
      // 固定面額（200 以上，見 FORCED_WIN_COINS）一律強制判定為贏；
      // 只有 100 元這個面額才會真的走隨機 60% 贏／40% 平手
      state = FORCED_WIN_COINS.has(coinValue) ? 101 : (Math.random() < 0.6 ? 101 : 102)
    } else {
      state = 100
    }

    const hands = _popHandCombo(state)

    let coin: number
    if (state === 101) {
      coin = coinValue
    } else if (state === 102) {
      coin = coinValue * 2
    } else {
      // 輸的局也要給一個顯示用的金額（忠實移植：原始碼在這裡隨機挑一個面額，
      // 純粹墊顯示用，不影響派彩，因為「輸」這局的 getCoin 最終一定是 0）
      coin = _pickRandom(PLAY1_WIN_COINS)
    }

    rounds.push({ hands, coin })
    if (state === 101 || state === 102) winHands.push(hands)
  }

  return { rounds, winHands }
}

function _getCoinCard(cardWinCoin: number): { rounds: PlayRound[]; winHands: HandCombo[] } | null {
  if (!CARD_WIN_COINS.includes(cardWinCoin)) return null
  const combos = WIN_COINS_COMB[cardWinCoin]
  if (!combos || combos.length === 0) return null
  const combo = _pickRandom(combos)
  return _getPlay1(combo)
}

/** 列出這個 model 支援的目標金額（下拉選單用，對應 Python 版 `card_win_coins`） */
export function listModel03WinCoins(): readonly number[] {
  return CARD_WIN_COINS
}

/**
 * 試算一張卡：輸入目標金額，回傳 5 局模擬結果。目標金額不在支援清單內回傳 null
 * （對應 Python 版 `get_coin_card()` 回傳 None 的情況）。
 */
export function analyzeModel03Card(cardCredit: number): Model03AnalyzeResult | null {
  const card = _getCoinCard(cardCredit)
  if (!card) return null

  const winHandKeys = new Set(card.winHands.map((h) => h.join(',')))

  const rounds: Model03RoundResult[] = card.rounds.map((round, idx) => {
    const [myHand, enemyHand] = round.hands
    const color = winHandKeys.has(round.hands.join(',')) ? 'red' : 'black'
    const getCoin = myHand === enemyHand ? round.coin / 2 : 0

    return {
      title: `第${idx + 1}回`,
      color,
      play: [HAND_LABELS[myHand], HAND_LABELS[enemyHand]],
      handValues: [myHand, enemyHand],
      coin: round.coin,
      getCoin
    }
  })

  return { rounds, winCoin: cardCredit }
}
