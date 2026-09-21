/**
 * 柑仔店櫥仔 8 款玩法共用的「難度」機制。
 *
 * 目標體驗（difficulty=1、賠率倍數=1 的預設狀態）：玩 10 次要有 9 次「贏」（拿回錢），
 * 每投入 100 元平均要能拿回 98 元（房子只抓 2%，不會整包吃掉）。8 款玩法機制完全不同
 * （骰子比大小、猜拳、猜牌、權重抽獎、高度門檻…），沒辦法只調一個共用參數就套用，所以
 * 分兩段處理：
 *
 * 1. 中不中獎：用 `resolveFate()` 決定「這次目標是贏還是輸」，各玩法自己的隨機邏輯
 *    （骰子、猜拳、抽卡…）完全不改，只是「重骰」到剛好命中這個目標為止（有次數上限，
 *    避免極端 difficulty 造成無窮迴圈）——玩家畫面上看到的骰子／牌／NPC選擇都是真的隨機
 *    產生，只是被引導到跟目標一致的那一種結果，不會出現「畫面說贏、錢沒進來」的落差。
 * 2. 贏了拿多少：各玩法自己原本就有的「派彩倍數」常數（例如大豬公的 1.9/2.5/5 倍、
 *    抽抽樂的 1.2/2/5/15/50 倍）統一乘上 `PAYOUT_SCALE[slug]`，把「中獎時平均拿回多少」
 *    壓到 ≈1.09 倍本金，這樣「90% 中獎 × 平均 1.09 倍」≈ 98% 回饋率。
 *
 * 難度（difficulty）越高，目標中獎機率越低：用「勝率↔勝敗賠率」換算，讓 baseP 在
 * difficulty=1 時完全等於原值，且不管 difficulty 多大/多小，結果永遠落在 (0,1) 之間。
 */

export const BASE_WIN_P = 0.9

/**
 * @param baseP 難度=1 時的基準勝率（0~1）
 * @param difficulty 後台設定的難度（預設 1，> 1 更難、< 1 更容易）
 * @returns 換算後的實際勝率（0~1 之間，不會出界）
 */
export function scaleWinProbability(baseP: number, difficulty: number): number {
  const d = Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 1
  const p = Math.min(0.999, Math.max(0.001, baseP))
  const odds = p / (1 - p)
  const scaledOdds = odds / d
  return scaledOdds / (1 + scaledOdds)
}

/**
 * 依難度決定「這次目標是不是要贏」。
 * @param difficulty 後台設定的難度
 * @param rng 均勻隨機
 */
export function resolveFate(difficulty: number, rng: () => number): boolean {
  return rng() < scaleWinProbability(BASE_WIN_P, difficulty)
}

/**
 * 重骰直到某玩法自己的隨機結果剛好符合目標（贏／輸），玩法內部邏輯完全不改，只是決定
 * 「用第幾次骰出來的結果」。有次數上限，極端情況（例如目標機率接近 0 或 1、玩法本身
 * 該方向的自然機率也接近 0）就接受最後一次骰到的結果，不會無窮迴圈。
 * @param targetWin 這次的目標是不是要贏
 * @param rollOnce 玩法自己的「骰一次、回傳是否算贏」邏輯（用 rng 吃隨機）
 * @param maxTries 最多重骰次數
 */
export function resolveWithFate<T extends { win: boolean }>(
  targetWin: boolean,
  rollOnce: () => T,
  maxTries = 40
): T {
  let last: T = rollOnce()
  for (let i = 1; i < maxTries && last.win !== targetWin; i++) {
    last = rollOnce()
  }
  return last
}
