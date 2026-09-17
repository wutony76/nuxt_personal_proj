/**
 * 3星彩（P3）判定核心。
 *
 * ⚠️ 跟 DLT（大樂透）／D539（今彩539）／M649（49樂合彩）一樣是「完全鏡射官方台彩」的玩法——
 *   開獎號碼與各獎項派彩金額完全鏡射官方 3星彩（gameCode 2108）即時資料
 *   （見 openspec/changes/add-tw-lottery-suite/design.md Decision 5）。
 *
 * 位數判定的概念參考本站既有 `pl3.ts`／`pl3-of.ts`（排列3），但依 design.md「tw 分類不依賴 bg
 * 分類 shared config」的既有慣例（比照 DLT `tw/orders.ts` 逐字複製、不跨分類 import），本檔獨立
 * 重寫一份精簡版，只保留 3星彩需要的「正彩」「組彩」「前二對彩」「後二對彩」4 種判定，不含 pl3
 * 的彩池／RTP／複式展開／其餘注別（定位膽、不定位、大小單雙、和值）。
 *
 * ── 3 種下注方式（每注固定 25 元，3 位數字 0~9、可重複）──────────────────
 *   正彩：投注 3 位數字與開獎號碼「逐位對應」完全相同才中獎 → 官方 lotto3DFirstAssign（頭獎）
 *   組彩：投注數字與開獎號碼「數字相同、順序不同」也算中獎，依投注數字本身的排列數分兩級：
 *     3 碼互異（排列數 6）→ 官方 lotto3DSecondAssign（二獎）
 *     恰有 2 碼相同（排列數 3）→ 官方 lotto3DThirdAssign（三獎）
 *     3 碼全同（豹子，排列數 1＝自己）沒有組彩意義，下組彩注時應拒絕（見 p3ValidateGroupBet）
 *   對彩（本站官方 pl3/fc3d 既有邏輯沒有的新規則）：前二對彩／後二對彩，皆為投注完整 3 位數字，
 *     判定函式各自取前 2 碼／後 2 碼比對；兩者各自獨立判定、可同時中獎，固定獎金 750 元
 *     （25 元 × 30 倍，不查官方 API、寫死常數）。
 */

export const P3_DIGIT_MIN = 0
export const P3_DIGIT_MAX = 9
export const P3_DIGIT_COUNT = 3
/** 每注固定金額（coin），四種下注方式皆同一價，玩家不可調整 */
export const P3_BET_AMOUNT = 25
/** 對彩（前二／後二）固定獎金：25 元本金 × 30 倍，不查官方 API */
export const P3_PAIR_PRIZE = 750
/** 一次送單最多可含幾組獨立注碼（比照 M649/M539 的 A~E） */
export const P3_MAX_SLOTS = 5

/** 官方開獎日：每天開獎（週一至週六），跟今彩539／49樂合彩(週期不同)一樣是每天版本 */
export const P3_DRAW_WEEKDAYS = [1, 2, 3, 4, 5, 6]
/** 投注截止時間（開獎當日，24 小時制） */
export const P3_CUTOFF_HOUR = 20
export const P3_CUTOFF_MINUTE = 0
/** 開獎時間（開獎當日，24 小時制） */
export const P3_DRAW_HOUR = 20
export const P3_DRAW_MINUTE = 30

/** 上線初期尚無「上一次頭獎（正彩）金額」歷史紀錄時，單期額度上限的回退基準 */
export const P3_QUOTA_FALLBACK_COIN = 500_000

/**
 * 3 個官方獎項，`key`／`label` 直接沿用官方 `3DResult` 的欄位命名
 * （見 server/services/game/lottery/tw/taiwanLotteryApi.ts 的 GAME_DEFS[2108].tiers，
 * 避免兩處各自定義同一份對照表）。對彩（前二／後二）不在此表——固定獎金不查官方 API。
 */
export type P3TierKey = 'lotto3DFirstAssign' | 'lotto3DSecondAssign' | 'lotto3DThirdAssign'

export type P3TierDef = {
  key: P3TierKey
  label: string
}

export const P3_TIERS: P3TierDef[] = [
  { key: 'lotto3DFirstAssign', label: '頭獎' },
  { key: 'lotto3DSecondAssign', label: '二獎' },
  { key: 'lotto3DThirdAssign', label: '三獎' }
]

/** 4 種下注方式：正彩／組彩／前二對彩／後二對彩，各自獨立成一組注單（不是複式） */
export type P3BetType = 'zhengcai' | 'zucai' | 'front-pair' | 'back-pair'

export type P3BetTypeDef = {
  key: P3BetType
  label: string
  desc: string
}

export const P3_BET_TYPES: P3BetTypeDef[] = [
  { key: 'zhengcai', label: '正彩', desc: '投注 3 位數字與開獎號碼逐位對應完全相同才中獎（頭獎）' },
  { key: 'zucai', label: '組彩', desc: '投注數字與開獎號碼相同、不計順序即中獎（二獎或三獎），豹子（3 碼全同）不可下組彩' },
  { key: 'front-pair', label: '前二對彩', desc: '開獎前 2 碼與投注前 2 碼順序相同即中獎，固定 750 元' },
  { key: 'back-pair', label: '後二對彩', desc: '開獎後 2 碼與投注後 2 碼順序相同即中獎，固定 750 元' }
]

/** 把注碼（字串或陣列）解析成 3 個 0~9 的數字；可重複，格式不符回 null。伺端結算與 quota 驗證的唯一判定入口 */
function _parseDigits(input: string | number | Array<string | number>): number[] | null {
  const raw = Array.isArray(input) ? input : String(input ?? '').split('')
  if (raw.length !== P3_DIGIT_COUNT) return null
  const digits = raw.map((d) => Number(String(d).trim()))
  if (digits.some((n) => !Number.isInteger(n) || n < P3_DIGIT_MIN || n > P3_DIGIT_MAX)) return null
  return digits
}

/** 把注碼／開獎號正規化成 3 個數字陣列；格式不符回 null（號碼可重複，不檢查唯一性） */
export function p3DigitsOf(input: string | number | Array<string | number>): number[] | null {
  return _parseDigits(input)
}

/** 豹子判定（三碼相同，如 000 / 555 / 999） */
export function p3IsTriple(digits: number[]): boolean {
  const nums = (Array.isArray(digits) ? digits : []).map((n) => Number(n))
  if (nums.length !== P3_DIGIT_COUNT) return false
  return nums.every((n) => n === nums[0])
}

/** 驗證＋正規化注碼成字串（例如 "123"），格式不符回 null；不檢查組彩豹子限制（見 p3ValidateGroupBet） */
export function p3NormalizeBetCode(input: string | number | Array<string | number>): string | null {
  const digits = _parseDigits(input)
  if (!digits) return null
  return digits.join('')
}

/** 組彩注碼合法性檢查：3 碼不可全同（豹子沒有組彩意義，只有 1 種排列＝自己） */
export function p3ValidateGroupBet(digits: number[]): boolean {
  if (!Array.isArray(digits) || digits.length !== P3_DIGIT_COUNT) return false
  return !p3IsTriple(digits)
}

/** 正彩：逐位對應完全相同 */
export function p3IsExactMatch(bet: number[], drawn: number[]): boolean {
  if (!Array.isArray(bet) || !Array.isArray(drawn)) return false
  if (bet.length !== P3_DIGIT_COUNT || drawn.length !== P3_DIGIT_COUNT) return false
  return bet.every((d, i) => Number(d) === Number(drawn[i]))
}

/**
 * 組彩等級判定：先判斷 bet 是否為 drawn 的排列（數字重排後相同的多重集合），
 * 若是，再依 bet 本身的重複模式（3 碼互異→二獎；恰有 2 碼相同→三獎；3 碼全同→ null）回傳等級。
 * 不是排列（數字不同）回傳 null；bet 是豹子（沒有組彩意義）一律回傳 null。
 */
export function p3GroupTierOf(bet: number[], drawn: number[]): '二獎' | '三獎' | null {
  if (!Array.isArray(bet) || !Array.isArray(drawn)) return null
  if (bet.length !== P3_DIGIT_COUNT || drawn.length !== P3_DIGIT_COUNT) return null
  if (p3IsTriple(bet)) return null
  const sortedBet = [...bet].map(Number).sort((a, b) => a - b)
  const sortedDrawn = [...drawn].map(Number).sort((a, b) => a - b)
  const isPermutationMatch = sortedBet.every((d, i) => d === sortedDrawn[i])
  if (!isPermutationMatch) return null
  const uniqueCount = new Set(bet.map(Number)).size
  if (uniqueCount === 3) return '二獎'
  if (uniqueCount === 2) return '三獎'
  return null
}

/** 前二對彩：開獎前 2 碼（index 0、1）與投注前 2 碼逐位對應相同 */
export function p3IsFrontPairMatch(bet: number[], drawn: number[]): boolean {
  if (!Array.isArray(bet) || !Array.isArray(drawn)) return false
  if (bet.length !== P3_DIGIT_COUNT || drawn.length !== P3_DIGIT_COUNT) return false
  return Number(bet[0]) === Number(drawn[0]) && Number(bet[1]) === Number(drawn[1])
}

/** 後二對彩：開獎後 2 碼（index 1、2）與投注後 2 碼逐位對應相同 */
export function p3IsBackPairMatch(bet: number[], drawn: number[]): boolean {
  if (!Array.isArray(bet) || !Array.isArray(drawn)) return false
  if (bet.length !== P3_DIGIT_COUNT || drawn.length !== P3_DIGIT_COUNT) return false
  return Number(bet[1]) === Number(drawn[1]) && Number(bet[2]) === Number(drawn[2])
}
