/**
 * 爆池的泛用核心（快3／PK10／時時彩共用）
 *
 * ── 這是什麼 ────────────────────────────────────────────
 * 一般派彩（信用盤的固定賠率、官方盤的分層）都不吃這個池；爆池由「每注抽水」累積，
 * 並在**爆池期**一次發放給該期有份的注單，依「注金 × 權重」比例分配。
 * **信用盤與官方盤共吃同一個爆池**，兩邊的注單一起參與分配
 * （編排在各彩種的 `*Shared.ts`，見那邊的說明）。
 *
 * ── 與 6hc-cd 的關係 ────────────────────────────────────
 * 概念與 shared/config/6hc-cd.ts 的 CREDIT_JACKPOT / buildCreditJackpotShares 相同，
 * 但那一份與 6hc 的 CreditBetKind、特別號綁死了，沒辦法直接給其他彩種用。
 * 本檔把「怎麼分錢」抽成純函式，把兩件會因彩種而異的事交給呼叫端：
 *   1. 爆池期怎麼判 —— 由呼叫端算好 `triggered` 布林值傳進來
 *      （k3 圍骰／pk10 冠亞和極值／ssc 後三豹子，各自寫在該彩種的 *-cd.ts）
 *   2. 每注的權重 —— 由呼叫端用該彩種的 `*JackpotWeightOf()` 從看板設定讀出來傳進來
 * ⚠️ 6hc-cd 沿用它自己那一份，沒有改接本檔 —— 它多了 kind/tier 的權重解析，
 *    硬合併只會讓兩邊都變複雜。要改的話兩邊的分配演算法必須一起動。
 *
 * ── 與官方盤共用彩池的關係 ──────────────────────────────
 * ⚠️ 爆池是**獨立的池**，不吃共用彩池（`SHARED.pool`）——
 *    那個池是官方盤分層派彩用的，兩條結算路搶同一個 carry 會互相吃掉對方的滾存。
 *    爆池自己的狀態放在各彩種的 `*Shared.ts`（`*_JACKPOT`），兩個盤口共吃同一池。
 */

/** 爆池設定（各彩種在自己的 *-cd.ts 給一份） */
export type JackpotSettings = {
  /** 每筆投注額撥入爆池的比例 */
  rakeRatio: number
  /** 觸發時發放累積池的比例，其餘滾存至下期 */
  payoutRatio: number
  /** 累積池低於此金額不發放（避免發出零星小額） */
  minPool: number
  /** 注單查不到看板設定時的權重保底（0 代表不參與分配） */
  weightFallback: number
  /**
   * 盤口係數：該盤口的注單權重再乘上這個值
   *
   * ⚠️ 為什麼需要它 —— 信用盤與官方盤的 `weight` 各自是照「**該盤口**玩法的難度」分級的
   *    （都是 1 ~ 3），兩邊放進同一個鍋裡分錢，等於默認「CD 的難注項 = OF 的難注項」。
   *    這個等價關係沒有被驗證過，所以留一個係數讓它可以被調整；
   *    預設兩邊都是 1（即接受該等價假設）。
   * ⚠️ 改這個值會直接改變兩個盤口分到的比例，動之前先想清楚。
   */
  boardWeight: Record<string, number>
  /** 爆池條件的文字說明（給看板／說明頁顯示，不參與運算） */
  hitLabel: string
  /** 爆池條件的發生機率（0 ~ 1，由各彩種窮舉算好；只供顯示） */
  hitRate: number
}

/** 送進分配的一注 */
export type JackpotRow = {
  orderId: string
  userId: string
  coin: number
  /**
   * 這一注來自哪個盤口（'cd' / 'of'）
   *
   * 分配結果會原樣帶回 JackpotShare，讓各 class 只挑自己那半去寫回
   * 自己的 user record —— 共用層因此不必知道兩種 record 的形狀。
   */
  source: string
  /** 該注是否有份：一般取「非未中」（和局也算有份，與 6hc-cd 相同） */
  eligible: boolean
  /**
   * 分配權重（由呼叫端以該彩種的 *JackpotWeightOf() 從看板設定解析）。
   * 明確給 0 代表「該注項不參與分配」，只有完全沒帶（舊注單）才退回 weightFallback。
   */
  weight?: number
}

export type JackpotShare = {
  orderId: string
  userId: string
  coin: number
  /** 對應 JackpotRow.source，供呼叫端分流寫回 */
  source: string
  weight: number
  weighted: number
  amount: number
}

export type JackpotResult = {
  triggered: boolean
  /** 未觸發原因：非爆池期 / 累積池未達門檻 / 無有份注單 */
  reason: 'hit' | 'not-hit-issue' | 'pool-too-low' | 'no-eligible'
  /** 可發放累積池（當期抽水 + 累積滾存） */
  pool: number
  /** 實際發出總額 */
  payout: number
  /** 滾存至下期 */
  remain: number
  shares: JackpotShare[]
}

/**
 * 計算爆池分配（純函式，server 結算與測試共用）
 *
 * @param rows      該期注單（已判定結果，eligible 由呼叫端決定）
 * @param triggered 這一期是不是爆池期（由各彩種的 *JackpotHit() 判定）
 * @param pool      可發放累積池（當期抽水 + 累積滾存）
 * @param settings  該彩種的爆池設定
 */
export function buildJackpotShares(
  rows: JackpotRow[],
  triggered: boolean,
  pool: number,
  settings: JackpotSettings
): JackpotResult {
  const safePool = Math.max(0, Number(Number(pool ?? 0).toFixed(2)))
  const base: JackpotResult = {
    triggered: false,
    reason: 'not-hit-issue',
    pool: safePool,
    payout: 0,
    remain: safePool,
    shares: []
  }

  if (!triggered) return base
  if (safePool < Number(settings.minPool)) return { ...base, reason: 'pool-too-low' }

  const eligible = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const coin = Number(row?.coin ?? 0)
      if (!row?.eligible || !(coin > 0)) return null
      // 權重以注單帶進來的設定值為主；明確給 0 代表「不參與分配」，
      // 只有完全沒帶（舊注單、已下架玩法）才退回 weightFallback
      const configWeight = row?.weight == null ? Number.NaN : Number(row.weight)
      const baseWeight = Number.isFinite(configWeight) && configWeight >= 0
        ? configWeight
        : Number(settings.weightFallback ?? 0)
      // 盤口係數：沒設定的盤口視為 1（不調整）
      const board = Number(settings.boardWeight?.[String(row?.source ?? '')] ?? 1)
      const weight = Number((baseWeight * (Number.isFinite(board) && board >= 0 ? board : 1)).toFixed(4))
      if (!(weight > 0)) return null
      return { row, coin, weight, weighted: coin * weight }
    })
    .filter((item): item is { row: JackpotRow; coin: number; weight: number; weighted: number } => Boolean(item))

  if (eligible.length === 0) return { ...base, reason: 'no-eligible' }

  const totalWeighted = eligible.reduce((sum, item) => sum + item.weighted, 0)
  const budget = Number((safePool * Number(settings.payoutRatio)).toFixed(2))
  let distributed = 0
  const shares: JackpotShare[] = eligible.map((item, index) => {
    // 最後一筆吃尾差，避免四捨五入造成總額不符
    const amount = index === eligible.length - 1
      ? Number((budget - distributed).toFixed(2))
      : Number((budget * item.weighted / totalWeighted).toFixed(2))
    distributed = Number((distributed + amount).toFixed(2))
    return {
      orderId: String(item.row.orderId),
      userId: String(item.row.userId),
      coin: item.coin,
      source: String(item.row.source ?? ''),
      weight: item.weight,
      weighted: item.weighted,
      amount
    }
  })

  const payout = Number(distributed.toFixed(2))
  return {
    triggered: true,
    reason: 'hit',
    pool: safePool,
    payout,
    remain: Number((safePool - payout).toFixed(2)),
    shares
  }
}

/** 最近一次爆池的紀錄（給看板／說明頁顯示） */
export type JackpotHitRecord = {
  issue: string
  /** 觸發時的開獎號（文字化，各彩種自己決定怎麼組） */
  openLabel: string
  pool: number
  payout: number
  /** 有份的玩家數 */
  winners: number
  /** 有份的注單數 */
  orders: number
  createdAt: number
}
