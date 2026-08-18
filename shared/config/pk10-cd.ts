/**
 * PK10 信用盤（PK10-CD）判定與賠率核心
 *
 * 賠率一律由「公平賠率 × RTP」推導，不寫死拍板數字：
 *   公平賠率 = 該注項的母數 ÷ 命中數（母數與命中數由 shared/config/pk10.ts 給）
 *
 * ── 玩法（對照 pcv2_0223 的 conf_pk10_cd.js）────────────
 *   定位胆    10 個名次 × 10 個車號        母數 10
 *   兩面      冠亞和 8 面 + 10 名次 × 4 面  母數 90 / 10
 *   冠亞組合  45 組（不分順序）             母數 90
 *   冠亞和    和3 ~ 和19                   母數 90
 *   龍虎鬥    5 組對戰                     母數 2
 *
 * ── 與 k3-cd 的分工一致 ────────────────────────────────
 *   本檔（shared/config/pk10-cd.ts）：判定包裝與賠率推導，不讀設定檔
 *   shared/config/pk10cd/*          ：看板設定（注項、限額、賠率），由 helpers 讀取
 *   ⚠️ 本檔不可 import pk10cd/helpers —— helpers 會 import 本檔，會形成循環。
 *      需要設定值（rtp / odds）的判定一律由呼叫端傳入。
 *
 * ── 沒有和局 ────────────────────────────────────────────
 *   快3 的大小單雙遇圍骰要判和局，PK10 名次必然分得出來、車號互異，
 *   因此結果只有 win / lose；`tie` 只保留給「注碼無法辨識」時由呼叫端退還本金用。
 */

import { type JackpotSettings } from '#shared/config/jackpot'
import {
  pk10AllCars,
  pk10AllChampionPairs,
  pk10AllComboPairs,
  pk10CarAt,
  pk10CarCode,
  pk10CarsOf,
  pk10ChanceOf,
  pk10IsHit,
  pk10KindOf,
  pk10RivalRank,
  pk10SumOf,
  PK10_BIG_LINE,
  PK10_CAR_COUNT,
  PK10_DRAGON_RANK_COUNT,
  PK10_PAIR_TOTAL,
  PK10_RANK_NAMES,
  PK10_SUM_BIG_LINE,
  PK10_SUM_COUNTS,
  PK10_SUM_MAX,
  PK10_SUM_MIN
} from '#shared/config/pk10'

// 名次基本運算收在 shared/config/pk10.ts（兩個盤口共用），這裡轉出以便呼叫端只 import 一支
export {
  pk10AllCars,
  pk10AllChampionPairs,
  pk10AllComboPairs,
  pk10CarAt,
  pk10CarCode,
  pk10CarsOf,
  pk10ChanceOf,
  pk10IsHit,
  pk10KindOf,
  pk10RivalRank,
  pk10SumOf,
  PK10_BIG_LINE,
  PK10_CAR_COUNT,
  PK10_DRAGON_RANK_COUNT,
  PK10_PAIR_TOTAL,
  PK10_RANK_NAMES,
  PK10_SUM_BIG_LINE,
  PK10_SUM_COUNTS,
  PK10_SUM_MAX,
  PK10_SUM_MIN
}

/** 預設回報率（同 6hc-cd / k3-cd 的信用盤慣例） */
export const PK10_RTP_FALLBACK = 0.97

export type Pk10BetResult = 'win' | 'lose' | 'tie'

export type Pk10JudgeResult = {
  kind: NonNullable<ReturnType<typeof pk10KindOf>>
  result: Pk10BetResult
  /** 賠率（含本金） */
  odds: number
  /** 派彩金額（含本金）；和局退還本金、未中為 0 */
  payout: number
}

/**
 * 取注項賠率（含本金）
 *
 * @param betCode 注碼（"冠軍01"、"冠軍大"、"冠軍龍"、"和3"、"和大單"、"組合01-02"…）
 * @param rtp     該分頁的回報率（由設定檔帶入）
 * @returns 賠率（無條件捨去到小數 2 位，避免浮點多給）；無法辨識回 0
 */
export function pk10OddsOf(betCode: string | number, rtp: number = PK10_RTP_FALLBACK): number {
  const chance = pk10ChanceOf(betCode)
  if (!chance || !(chance.hit > 0) || !(chance.total > 0)) return 0
  const safeRtp = Number.isFinite(rtp) && rtp > 0 ? rtp : PK10_RTP_FALLBACK
  return Math.floor((chance.total / chance.hit) * safeRtp * 100) / 100
}

/**
 * PK10 中獎判定
 *
 * @param betCode  注碼（同 pk10OddsOf）
 * @param openCode 該期開獎（10 個名次的車號）
 * @param coin     注金
 * @param odds     下注時鎖定的賠率；未帶（或 ≤ 0）則以 rtp 即時推算
 * @param rtp      該分頁回報率
 * @returns 判定結果；注碼無法辨識或開獎格式不合回 null（呼叫端應視為和局退還本金）
 */
export function judgePk10Bet(
  betCode: string | number,
  openCode: Array<string | number>,
  coin: number,
  odds: number = 0,
  rtp: number = PK10_RTP_FALLBACK
): Pk10JudgeResult | null {
  const hit = pk10IsHit(betCode, openCode)
  if (hit === null) return null
  const kind = pk10KindOf(betCode)
  if (!kind) return null

  const lockedOdds = Number(odds) > 0 ? Number(odds) : pk10OddsOf(betCode, rtp)
  if (!(lockedOdds > 0)) return null

  const amount = Number(coin)
  const safeCoin = Number.isFinite(amount) && amount > 0 ? amount : 0
  return {
    kind,
    result: hit ? 'win' : 'lose',
    odds: lockedOdds,
    payout: hit ? Number((safeCoin * lockedOdds).toFixed(2)) : 0
  }
}

/**
 * 玩法定義（順序即前端玩法列的顯示順序，需與 pk10cd/plays.ts 一致）
 * 順序照 pcv2_0223 conf_pk10_cd.js 的 sort
 */
// ── 爆池（信用盤專屬，與官方盤的共用彩池是兩個獨立的池） ──────────

/** 爆池期的冠亞和（19 = 9 + 10，冠亞和的最大值） */
export const PK10_CD_JACKPOT_SUM = 19

/**
 * PK10 信用盤的爆池設定
 *
 * ── 爆池期怎麼定 ────────────────────────────────────────
 *   **冠亞和開出 19**（冠亞和的最大值 9+10）時觸發。理由與 k3-cd / ssc-cd 相同：
 *     1. 它是看板上真的存在的注項（冠亞和分頁的「和19」），玩家看得到也押得到
 *     2. 冠亞和共 90 種有序組合，19 只有 (9,10) 與 (10,9) 兩種 ——
 *        2/90 ≒ 2.22%，與 6hc-cd 的「特別號開 49」（1/49 ≒ 2.04%）幾乎一致
 *
 * ⚠️ rakeRatio 是**另外**再撥一份進信用盤自己的爆池，
 *    與原本進 pk10Shared 共用彩池（官方盤前三直選分層在吃）的抽水不互相吃。
 */
export const PK10_CD_JACKPOT: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  minPool: 1000,
  weightFallback: 1,
  hitLabel: `冠亞和開出 ${PK10_CD_JACKPOT_SUM}`,
  hitRate: 2 / 90
}

/**
 * 這一期是不是爆池期
 * @returns true = 冠亞和 19；開獎格式不合回 false
 */
export function pk10CdJackpotHit(openCode: Array<string | number>): boolean {
  const cars = pk10CarsOf(openCode)
  if (!cars) return false
  return pk10SumOf(cars) === PK10_CD_JACKPOT_SUM
}

/** 爆池期的開獎文字（寫進爆池紀錄，給看板顯示用） */
export function pk10CdJackpotLabel(openCode: Array<string | number>): string {
  const cars = pk10CarsOf(openCode)
  if (!cars) return ''
  return `冠亞和 ${pk10SumOf(cars)}`
}

export const PK10_PLAY_DEFINITIONS: Array<{ key: string; name: string }> = [
  { key: 'dingwei', name: '定位膽' },
  { key: 'liangmian', name: '兩面' },
  { key: 'zuhe', name: '冠亞組合' },
  { key: 'guanyahe', name: '冠亞軍和' },
  { key: 'longhu', name: '龍虎鬥' }
]
