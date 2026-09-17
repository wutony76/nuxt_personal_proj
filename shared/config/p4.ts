/**
 * 4星彩（P4）判定核心。
 *
 * ⚠️ 跟 DLT（大樂透）／D539（今彩539）／M649（49樂合彩）／P3（3星彩）一樣是「完全鏡射官方台彩」
 *   的玩法——開獎號碼與各獎項派彩金額完全鏡射官方 4星彩（gameCode 2109）即時資料
 *   （見 openspec/changes/add-tw-lottery-suite/design.md Decision 5）。
 *
 * 依 design.md「tw 分類不依賴 bg 分類 shared config」的既有慣例（比照 DLT `tw/orders.ts` 逐字複製、
 * 不跨分類 import），本檔獨立重寫一份，只保留 4星彩需要的「正彩」「組彩」2 種判定。
 *
 * ── 2 種下注方式（每注固定 25 元，4 位數字 0~9、可重複）──────────────────
 *   正彩：投注 4 位數字與開獎號碼「逐位對應」完全相同才中獎 → 官方 lotto4DFirstAssign（頭獎）
 *   組彩：投注數字與開獎號碼「數字相同、順序不同」也算中獎。官方只留 2 個組彩獎項欄位
 *     （二獎／三獎），但 4 位數字的重複模式比 3 位複雜（4 碼全異／恰一對相同其餘相異／兩對相同／
 *     三同一異／四同）。本站延伸 P3「投注數字是否有重複」的二元分級原則，把官方沒有逐模式對應
 *     金額的部分全部併入同一個「三獎」：
 *       4 碼互異（排列數 24，unique count = 4）→ 官方 lotto4DSecondAssign（二獎）
 *       4 碼有任何重複（unique count ≤ 3，含一對相同／兩對相同／三同一異）→ 官方
 *         lotto4DThirdAssign（三獎）
 *       4 碼全同（豹子，排列數 1＝自己，unique count = 1）沒有組彩意義，下組彩注時應拒絕
 *         （見 p4ValidateGroupBet）
 *     ⚠️ 這是延伸自 P3 判定原則的假設，不是從 design.md 或官方文件直接得到的規則——官方是否真的
 *     對每種重複模式各自訂不同金額，目前無法從既有 API（只暴露 2 個組彩欄位）得知。
 *
 *   4星彩官方規則沒有「對彩」（P3 才有），本檔不含對彩判定。
 */

export const P4_DIGIT_MIN = 0
export const P4_DIGIT_MAX = 9
export const P4_DIGIT_COUNT = 4
/** 每注固定金額（coin），正彩／組彩皆同一價，玩家不可調整 */
export const P4_BET_AMOUNT = 25
/** 一次送單最多可含幾組獨立注碼（比照 M649/M539/P3 的 A~E） */
export const P4_MAX_SLOTS = 5

/** 官方開獎日：每天開獎（週一至週六），跟今彩539／3星彩一樣是每天版本 */
export const P4_DRAW_WEEKDAYS = [1, 2, 3, 4, 5, 6]
/** 投注截止時間（開獎當日，24 小時制） */
export const P4_CUTOFF_HOUR = 20
export const P4_CUTOFF_MINUTE = 0
/** 開獎時間（開獎當日，24 小時制） */
export const P4_DRAW_HOUR = 20
export const P4_DRAW_MINUTE = 30

/** 上線初期尚無「上一次頭獎（正彩）金額」歷史紀錄時，單期額度上限的回退基準 */
export const P4_QUOTA_FALLBACK_COIN = 500_000

/**
 * 3 個官方獎項，`key`／`label` 直接沿用官方 `4DResult` 的欄位命名
 * （見 server/services/game/lottery/tw/taiwanLotteryApi.ts 的 GAME_DEFS[2109].tiers，
 * 避免兩處各自定義同一份對照表）。
 */
export type P4TierKey = 'lotto4DFirstAssign' | 'lotto4DSecondAssign' | 'lotto4DThirdAssign'

export type P4TierDef = {
  key: P4TierKey
  label: string
}

export const P4_TIERS: P4TierDef[] = [
  { key: 'lotto4DFirstAssign', label: '頭獎' },
  { key: 'lotto4DSecondAssign', label: '二獎' },
  { key: 'lotto4DThirdAssign', label: '三獎' }
]

/** 2 種下注方式：正彩／組彩，各自獨立成一組注單（不是複式）；4星彩官方沒有對彩 */
export type P4BetType = 'zhengcai' | 'zucai'

export type P4BetTypeDef = {
  key: P4BetType
  label: string
  desc: string
}

export const P4_BET_TYPES: P4BetTypeDef[] = [
  { key: 'zhengcai', label: '正彩', desc: '投注 4 位數字與開獎號碼逐位對應完全相同才中獎（頭獎）' },
  { key: 'zucai', label: '組彩', desc: '投注數字與開獎號碼相同、不計順序即中獎（二獎或三獎），豹子（4 碼全同）不可下組彩' }
]

/** 把注碼（字串或陣列）解析成 4 個 0~9 的數字；可重複，格式不符回 null。伺端結算與 quota 驗證的唯一判定入口 */
function _parseDigits(input: string | number | Array<string | number>): number[] | null {
  const raw = Array.isArray(input) ? input : String(input ?? '').split('')
  if (raw.length !== P4_DIGIT_COUNT) return null
  const digits = raw.map((d) => Number(String(d).trim()))
  if (digits.some((n) => !Number.isInteger(n) || n < P4_DIGIT_MIN || n > P4_DIGIT_MAX)) return null
  return digits
}

/** 把注碼／開獎號正規化成 4 個數字陣列；格式不符回 null（號碼可重複，不檢查唯一性） */
export function p4DigitsOf(input: string | number | Array<string | number>): number[] | null {
  return _parseDigits(input)
}

/** 豹子判定（四碼相同，如 0000 / 5555 / 9999） */
export function p4IsQuadruple(digits: number[]): boolean {
  const nums = (Array.isArray(digits) ? digits : []).map((n) => Number(n))
  if (nums.length !== P4_DIGIT_COUNT) return false
  return nums.every((n) => n === nums[0])
}

/** 驗證＋正規化注碼成字串（例如 "1234"），格式不符回 null；不檢查組彩豹子限制（見 p4ValidateGroupBet） */
export function p4NormalizeBetCode(input: string | number | Array<string | number>): string | null {
  const digits = _parseDigits(input)
  if (!digits) return null
  return digits.join('')
}

/** 組彩注碼合法性檢查：4 碼不可全同（豹子沒有組彩意義，只有 1 種排列＝自己） */
export function p4ValidateGroupBet(digits: number[]): boolean {
  if (!Array.isArray(digits) || digits.length !== P4_DIGIT_COUNT) return false
  return !p4IsQuadruple(digits)
}

/** 正彩：逐位對應完全相同 */
export function p4IsExactMatch(bet: number[], drawn: number[]): boolean {
  if (!Array.isArray(bet) || !Array.isArray(drawn)) return false
  if (bet.length !== P4_DIGIT_COUNT || drawn.length !== P4_DIGIT_COUNT) return false
  return bet.every((d, i) => Number(d) === Number(drawn[i]))
}

/**
 * 組彩等級判定：先判斷 bet 是否為 drawn 的排列（數字重排後相同的多重集合），
 * 若是，再依 bet 本身的重複模式分級：
 *   4 碼互異（unique count = 4）→ 二獎
 *   有任何重複（unique count ≤ 3，含一對相同／兩對相同／三同一異）→ 三獎（見檔頭「不同重複模式
 *   全部併入同一個三獎」的假設說明）
 *   4 碼全同（豹子）沒有組彩意義，一律回傳 null
 * 不是排列（數字不同）回傳 null。
 */
export function p4GroupTierOf(bet: number[], drawn: number[]): '二獎' | '三獎' | null {
  if (!Array.isArray(bet) || !Array.isArray(drawn)) return null
  if (bet.length !== P4_DIGIT_COUNT || drawn.length !== P4_DIGIT_COUNT) return null
  if (p4IsQuadruple(bet)) return null
  const sortedBet = [...bet].map(Number).sort((a, b) => a - b)
  const sortedDrawn = [...drawn].map(Number).sort((a, b) => a - b)
  const isPermutationMatch = sortedBet.every((d, i) => d === sortedDrawn[i])
  if (!isPermutationMatch) return null
  const uniqueCount = new Set(bet.map(Number)).size
  if (uniqueCount === P4_DIGIT_COUNT) return '二獎'
  return '三獎'
}
