/**
 * 6hc-cd 號碼推薦 —— 把「對沖排序」對應成各玩法的注項
 *
 * ⚠️ 必須是 .ts：本檔用 `#shared` 匯入，Nitro 對 shared 下的 .js 走 Node 原生 ESM 解析、
 *    不認得 `#shared` 別名（詳見 plays.ts 檔頭）。
 *
 * ── 設計：一句話規格 ─────────────────────────────────────────
 *   推薦引擎給出「49 個號碼的對沖排序」（落差越大越被看好）。
 *   本檔把排序前段當成「預測本期開獎的 7 顆球」，
 *   再把當前分頁「照這個預測會中獎」的注項挑出來。
 *
 *   預測開獎：第 1 名 = 特別號，第 2 ~ 7 名 = 6 顆正碼（升冪排序後為正一 ~ 正六）。
 *
 * ── 為什麼用「預測開獎」而不是「推薦號碼直接比對注項名稱」 ──
 *   舊做法只比對數字注項名稱，所以只有特碼／正碼／正碼特／連碼這幾個號碼池玩法有用，
 *   五行、半波、一肖、尾數、七碼、一肖量… 這些注項名稱不是數字的玩法全都推不出來。
 *   改用預測開獎後，單一注項型玩法一律直接丟進 judgeCreditBet 判定，
 *   「會中的就是推薦的」—— 與結算共用同一支判定邏輯，不可能推出實際上不會中的注項。
 *
 * ── 組合型玩法（一注是一組號碼／生肖／尾數）─────────────────
 *   注項不是單一項目，無法逐項判定，改為「照預測開獎組出一注必中的組合」：
 *     中／連中方向 → 從預測開獎裡取
 *     不中方向     → 從預測開獎「以外」取（對沖排序末段，最不被看好會開出的）
 *   組出來後仍會再用 judgeCreditBet 驗一次，驗過的才標 guaranteed。
 *   少數分頁照預測開獎組不出必中的一注（例：7 顆球涵蓋 7 個尾數時，
 *   「四尾連不中」只剩 3 個尾可選），此時退回最保險的一組並標 guaranteed: false，
 *   由畫面提示使用者「這組不保證必中」。
 *   一次點擊固定產生「一注」（取 pick 個），不做複式展開。
 */
import {
  judgeCreditBet,
  shengxiaoNumsOf,
  weishuAll,
  SX,
  CREDIT_QIMA_BALL_COUNT,
  CREDIT_ZHENGMA_NORMAL_COUNT,
  type CreditMatchMode
} from '#shared/config/6hc-cd'
import {
  creditComboOf,
  creditMatchModeOf,
  creditRtpOf,
  creditTabOddsOf,
  creditTiersOf,
  findCreditTab
} from '#shared/config/cd/helpers'

/** 預測開獎（7 顆球）：特別號 + 6 顆正碼 */
export type CreditPredictedDraw = {
  /** 完整 7 顆球，順序為「6 顆正碼（升冪）+ 特別號」，與真實開獎的排列一致 */
  openCode: string[]
  /** 特別號（對沖排序第 1 名） */
  special: string
  /** 6 顆正碼（升冪） */
  normals: string[]
}

/** 推薦結果 */
export type CreditRecommend = {
  /** 單一注項型玩法：要選取的注項名稱（如 ['05', '特大', '紅波']） */
  names: string[]
  /** 組合型玩法：一注的內容（號碼／生肖／尾數，如 ['03', '15', '22']） */
  codes: string[]
  /** 預測開獎，供畫面標示推薦依據 */
  draw: CreditPredictedDraw
  /**
   * 這組推薦「照預測開獎必中」嗎
   * 單一注項型恆為 true（會中的才選）；組合型在無解時退回最保險的一組並標 false，
   * 例如 7 顆球涵蓋 7 個尾數時，「四尾連不中」只剩 3 個尾可選，湊不出必中的四尾
   */
  guaranteed: boolean
}

const _pad = (num: number): string => String(num).padStart(2, '0')

/** 12 生肖（號碼對應逐年輪轉，名稱本身固定） */
const _animals = (): string[] => [...(SX as readonly string[])]
/** 尾數池 */
const _tails = (): string[] => Object.keys(weishuAll)

/**
 * 把對沖排序轉成預測開獎
 * @param ranked 對沖值由高到低排序的號碼（通常是全部 49 個；不足 7 個回 null）
 */
export function creditPredictDraw(ranked: Array<string | number>): CreditPredictedDraw | null {
  const nums: number[] = []
  ;(Array.isArray(ranked) ? ranked : []).forEach((item) => {
    const num = Number(item)
    if (!Number.isInteger(num) || num < 1 || num > 49) return
    if (!nums.includes(num)) nums.push(num)
  })
  const size = CREDIT_ZHENGMA_NORMAL_COUNT + 1 // 6 正碼 + 1 特別號
  if (nums.length < size) return null
  const special = _pad(nums[0] as number)
  // 正碼升冪，讓 tabId 4000 ~ 4005（正一特 ~ 正六特）能對到名次
  const normals = nums.slice(1, size).map(_pad).sort()
  return { openCode: [...normals, special], special, normals }
}

/** 該注項照預測開獎會不會中（共用結算的判定邏輯） */
const _wins = (
  playKey: string,
  tabId: number,
  betCode: string,
  draw: CreditPredictedDraw,
  year: number,
  betCodes?: string[]
): boolean => {
  const judged = judgeCreditBet({
    playKey,
    tabId,
    betCode,
    betCodes,
    openCode: draw.openCode,
    coin: 1,
    year,
    rtp: creditRtpOf(playKey, tabId),
    match: creditMatchModeOf(playKey, tabId),
    tiers: creditTiersOf(playKey, tabId),
    odds: creditTabOddsOf(playKey, tabId, betCode, year, betCodes)
  })
  return judged?.result === 'win'
}

/** 預測開獎涵蓋的生肖（依號碼出現順序，供「連中」方向優先取用） */
const _hitAnimals = (draw: CreditPredictedDraw, year: number): string[] => {
  const opened = draw.openCode.map((code) => Number(code))
  const hit: string[] = []
  _animals().forEach((animal) => {
    const nums = shengxiaoNumsOf(animal, year).map((code) => Number(code))
    if (opened.some((num) => nums.includes(num))) hit.push(animal)
  })
  return hit
}

/** 預測開獎涵蓋的尾數 */
const _hitTails = (draw: CreditPredictedDraw): string[] => {
  const tails = new Set(draw.openCode.map((code) => Number(code) % 10))
  return _tails().filter((name) => tails.has(Number(String(name).replace('尾', ''))))
}

/**
 * 組合型玩法的候選組合（依偏好排序，呼叫端逐個丟判定取第一個會中的）
 *
 * 為什麼要多個候選：同一個方向的中法未必只有一種 ——
 * 例如連碼「特串」必須是「特別號 + 1 顆正碼」，只取正碼會判成未中；
 * 「合肖中」則必須包含特別號所屬生肖。與其為每個分頁寫死規則，
 * 不如列出幾種合理組法、交給 judgeCreditBet 挑出真的會中的那組。
 *
 */
const _comboCandidates = (input: {
  /** 可選項目（號碼／生肖／尾數） */
  pool: string[]
  /** 預測開獎命中的項目 —— 中方向的取用來源，也是不中方向要避開的集合 */
  inDraw: string[]
  /** 中方向的偏好順序（預設同 inDraw；pick 大於命中項數時用來補滿，如「十選中一」） */
  hitOrder?: string[]
  /** 不中方向的偏好順序（號碼玩法用對沖排序末段，最不被看好會開出的） */
  missOrder?: string[]
  /** 特別號對應的那一項（合肖中／特串需要包含它，不中方向則要排到最後） */
  must?: string | null
  pick: number
  mode: CreditMatchMode
}): string[][] => {
  const { pool, inDraw, must = null, pick, mode } = input
  if (!(pick > 0)) return []
  const candidates: string[][] = []
  const push = (list: string[]) => {
    if (list.length === pick && new Set(list).size === pick) candidates.push(list)
  }
  /** 依偏好順序把 pool 排成一串（偏好清單裡的先來，其餘依 config 順序補在後面） */
  const order = (prefer: string[], exclude: string[] = []) => {
    const head = prefer.filter((item) => pool.includes(item) && !exclude.includes(item))
    const tail = pool.filter((item) => !head.includes(item) && !exclude.includes(item))
    return [...head, ...tail]
  }
  if (mode === 'miss') {
    // 不中方向：優先取「預測不會開出」的項目；
    // 命中項不夠避開時（如 12 生肖被 7 顆球佔掉 7 個、卻要選 6 肖不中）
    // 才退而取命中項 —— 但特別號那一項排到最後，合肖不中只在意特別號
    const missed = order(input.missOrder ?? [], inDraw)
    const spare = inDraw.filter((item) => item !== must)
    push([...missed, ...spare, ...(must ? [must] : [])].slice(0, pick))
    return candidates
  }
  // 1) 直接取命中項前段（命中項不足 pick 時用 hitOrder 補滿）
  push(order(inDraw).slice(0, pick))
  push(order(input.hitOrder ?? inDraw).slice(0, pick))
  // 2) 必含項（特別號那一項）擺第一，其餘依序補滿 —— 特串 / 合肖中靠這組
  if (must) push([must, ...order(input.hitOrder ?? inDraw, [must])].slice(0, pick))
  // 3) 取命中項末段（命中項剛好 pick 個時與 1) 相同，多的時候提供另一種組合）
  push(inDraw.slice(-pick))
  return candidates
}

/** 注項涵蓋的號碼與預測開獎的重疊數（越少代表「不中」方向越保險） */
const _overlapOf = (nums: unknown, draw: CreditPredictedDraw): number => {
  if (!Array.isArray(nums)) return 0
  const opened = new Set(draw.openCode.map((code) => Number(code)))
  return nums.filter((num) => opened.has(Number(num))).length
}

/**
 * 依預測開獎推出當前分頁的推薦注項
 * @param input.ranked 對沖值由高到低排序的號碼（全部 49 個）
 * @param input.year   該期年份（生肖／五行號碼表逐年輪轉，判定必須用開獎期別的年份）
 */
export function creditRecommendOf(input: {
  playKey: string
  tabId: number
  ranked: Array<string | number>
  year: number
}): CreditRecommend | null {
  const { playKey, tabId, year } = input
  const draw = creditPredictDraw(input.ranked)
  if (!draw) return null
  const tab = findCreditTab(playKey, tabId)
  if (!tab) return null

  const combo = creditComboOf(playKey, tabId)
  const mode = creditMatchModeOf(playKey, tabId)
  // 分頁所有注項（號碼池型玩法的 tabGroup 就是號碼池）
  const items = (tab.tabGroup ?? []).flatMap((group) => group.groupList ?? [])
  const pool = items.map((item) => String(item.name ?? '')).filter(Boolean)
  const empty: CreditRecommend = { names: [], codes: [], draw, guaranteed: false }

  // ── 組合型玩法：組一注 ────────────────────────────────────
  if (combo) {
    const pick = combo.pick
    const isAnimal = pool.some((name) => _animals().includes(name))
    const isTail = pool.some((name) => /^\d尾$/.test(name))
    let candidates: string[][] = []
    if (isAnimal) {
      const hit = _hitAnimals(draw, year)
      // 特別號所屬生肖：合肖「中」必須包含它才會中、「不中」必須避開它
      const must = hit.find((animal) => shengxiaoNumsOf(animal, year).map(Number).includes(Number(draw.special))) ?? null
      candidates = _comboCandidates({ pool, inDraw: hit, must, pick, mode })
    } else if (isTail) {
      const hit = _hitTails(draw)
      const must = `${Number(draw.special) % 10}尾`
      candidates = _comboCandidates({ pool, inDraw: hit, must: hit.includes(must) ? must : null, pick, mode })
    } else {
      // 號碼組合：中方向取預測開獎、不中方向取對沖排序末段（最不被看好會開出的號碼）
      //
      // ⚠️ 預測開獎一律補零（"03"），但設定檔的注項名稱不一定（c_tema 等已改成 "3"），
      //    直接字串比對會全部對不上 —— 一律換算成「該分頁自己的寫法」再比
      const poolByNum = new Map(
        pool.filter((name) => /^\d+$/.test(name)).map((name) => [Number(name), name] as const)
      )
      const asPool = (code: string) => poolByNum.get(Number(code)) ?? code
      const opened = draw.openCode.map(asPool)
      const ranked = (Array.isArray(input.ranked) ? input.ranked : []).map((num) => asPool(_pad(Number(num))))
      candidates = _comboCandidates({
        pool,
        inDraw: opened,
        // 「八選中一」以上要選 8 ~ 10 個號，超過預測的 7 顆 ——
        // 中一只需命中一個，補進來的號碼不必命中，故用對沖排序前段補滿
        hitOrder: [...opened, ...ranked.filter((num) => !opened.includes(num))],
        missOrder: [...ranked].reverse(),
        must: asPool(draw.special),
        pick,
        mode
      })
    }
    // 逐個候選丟判定，取第一個真的會中的
    const codes = candidates.find((list) => _wins(playKey, tabId, String(list[0]), draw, year, list))
    if (codes) return { names: [], codes, draw, guaranteed: true }
    // 照預測開獎組不出必中的一注（例：7 顆球涵蓋 7 個尾數時，「四尾連不中」只剩 3 個尾可選）
    // 退回最保險的一組（重疊最少），並標記非必中讓畫面提示
    return candidates[0] ? { names: [], codes: candidates[0], draw, guaranteed: false } : empty
  }

  // ── 單一注項型玩法：逐項丟判定，會中的就是推薦的 ─────────
  const winners = items.filter((item) => item.name && _wins(playKey, tabId, String(item.name), draw, year))
  if (winners.length === 0) return empty
  // 「不中」方向（一肖不中 / 尾數不中）除了開出的那一項，其餘全部都會中 ——
  // 全選等於押 11 注，沒有推薦意義；只取「與預測開獎重疊最少」也就是最保險的那一項
  if (mode === 'miss') {
    const safest = [...winners].sort((a, b) => _overlapOf(a.nums, draw) - _overlapOf(b.nums, draw))[0]
    return { names: [String(safest?.name ?? '')], codes: [], draw, guaranteed: true }
  }
  return { names: winners.map((item) => String(item.name)), codes: [], draw, guaranteed: true }
}

/** 七碼的注項數（顆數組成注項為 0 ~ 7，共 8 項；供測試斷言用） */
export const CREDIT_QIMA_COMPOSITION_COUNT = CREDIT_QIMA_BALL_COUNT + 1
