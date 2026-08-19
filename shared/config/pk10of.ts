/**
 * PK10 官方盤的「賠率制」玩法（PK10-OF）
 *
 * 與 pk10-of.ts 的「猜前三名 → 獎池分層」是兩套並存的派彩方式：
 *   本檔這些玩法走固定賠率（莊家賠付），那一個玩法走共用彩池分層（相當於頭獎玩法）。
 *
 * ── 與快3 的差異：注碼判定不再重寫一份 ──────────────────
 *   k3of.ts 之所以自己實作一整套解析，是因為官方盤的注碼表（和3 / 三同1 / 二不同12…）
 *   本來就與信用盤不同。PK10 兩個盤口的注碼語意完全一樣，
 *   因此判定與機率一律沿用 shared/config/pk10.ts，本檔只負責：
 *     1. 官方盤自己的預設 rtp（比信用盤低一點）
 *     2. 派彩結果的資料形狀（status / odds / payout），對齊 k3of 的 judgeK3OfBet
 *
 * ⚠️ 本檔不可 import pk10of/helpers.ts（helpers 會 import 本檔，會形成循環）。
 */
import { pk10ChanceOf, pk10IsHit } from '#shared/config/pk10'

/** 取不到分頁 rtp 時的預設回報率（官方盤獎金部分來自彩池，抽得比信用盤兇一點） */
export const PK10OF_RTP_FALLBACK = 0.96

/**
 * 判定結果
 * ⚠️ PK10 名次必分得出來、車號互異，正常注碼不會有和局；
 *    `tie` 只在呼叫端遇到無法辨識的注碼時，自行以「退還本金」處理。
 */
export type Pk10OfBetResult = { status: 'win' | 'lose' | 'tie'; odds: number; payout: number }

/**
 * 注碼賠率（含本金）＝ 公平賠率 × rtp
 * @returns 賠率，取到小數 2 位；注碼無法辨識或機率為 0 回 0
 */
export function pk10OfOddsOf(betCode: string, rtp: number = PK10OF_RTP_FALLBACK): number {
  const chance = pk10ChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : PK10OF_RTP_FALLBACK
  return Number(((chance.total / chance.hit) * safeRtp).toFixed(2))
}

/**
 * 判定一注
 *
 * @param lockedOdds 下注時鎖進注單的賠率；> 0 就以它為準（避免改設定後回頭影響已成立的注單）
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null
 */
export function judgePk10OfBet(
  betCode: string,
  openCode: Array<string | number>,
  coin = 1,
  lockedOdds = 0
): Pk10OfBetResult | null {
  const hit = pk10IsHit(betCode, openCode)
  if (hit === null) return null

  const odds = lockedOdds > 0 ? Number(lockedOdds) : pk10OfOddsOf(betCode)
  const bet = Math.max(0, Number(coin) || 0)
  if (!hit) return { status: 'lose', odds, payout: 0 }
  return { status: 'win', odds, payout: Number((bet * odds).toFixed(2)) }
}
