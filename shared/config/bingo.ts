/**
 * 賓果賓果（BINGO）判定核心。
 *
 * ⚠️ 跟 P3/P4 一樣是「開獎號碼鏡射官方台彩」的玩法，但賠率**不是**查官方 API（官方
 *   `gameCode 1102` 沒有中獎明細端點，`taiwanLotteryApi.ts` 的 `GAME_DEFS` 故意排除 1102），
 *   賠率表是使用者提供的官方公開固定金額，寫死常數，見
 *   openspec/changes/add-tw-lottery-suite/design.md Decision 6。
 *
 * ── 4 種下注類型，各自獨立計價、獨立判定、獨立派彩（同一次送單可混合多種類型）──────────
 *   1. 基本玩法（1~10 星）：選星數 N，從 01–80 選滿 N 個號碼，依「這 N 個號碼中有幾個落在
 *      開出的 20 個號碼裡」查 `BINGO_STAR_PAYOUT` 表。
 *   2. 超級獎號：選 1 個號碼，中獎條件是「所選號碼＝第 20 個開出的號碼（官方 lotSpecial）」，
 *      **不是**「有在 20 個開出號碼的集合裡」——這是最容易判斷錯的地方（見 `bingoSuperNumberHit`）。
 *   3. 猜大小：直接讀官方 `lotBigSmall` 欄位比對，官方回傳和局符號（`'－'`）時退款。
 *   4. 猜單雙：直接讀官方 `lotOddEven` 欄位比對，同樣和局退款。
 *
 * 每注基準金額皆為 `BINGO_BET_UNIT`（基本玩法／猜大小／猜單雙皆同價，星數不影響金額）；
 * 超級獎號是**獨立加購項目**，額外 +`BINGO_BET_UNIT`，不併入基本玩法金額。
 */

export const BINGO_NUMBER_MIN = 1
export const BINGO_NUMBER_MAX = 80
/** 每期開出的號碼數（第 20 個即超級獎號） */
export const BINGO_DRAWN_COUNT = 20
/** 超級獎號在開球順序中的 order（見 shared/config/bingo.ts 檔頭說明） */
export const BINGO_SUPER_NUMBER_ORDER = 20

/** 基本玩法可選星數範圍 */
export const BINGO_STAR_MIN = 1
export const BINGO_STAR_MAX = 10

/** 每注基準金額（基本玩法／猜大小／猜單雙皆同價）；超級獎號為獨立加購，另收一份同額 */
export const BINGO_BET_UNIT = 25

/** 官方公開固定賠率表：key＝選幾星，value＝{ 對中數: 獎金 }（0 表示「全部落空」的安慰獎，僅 8/9/10 星才有） */
export const BINGO_STAR_PAYOUT: Record<number, Record<number, number>> = {
  1: { 1: 50 },
  2: { 2: 75, 1: 25 },
  3: { 3: 500, 2: 50 },
  4: { 4: 1000, 3: 100, 2: 25 },
  5: { 5: 7500, 4: 500, 3: 50 },
  6: { 6: 25000, 5: 1000, 4: 200, 3: 25 },
  7: { 7: 80000, 6: 3000, 5: 300, 4: 50, 3: 25 },
  8: { 8: 500000, 7: 20000, 6: 1000, 5: 200, 4: 25, 0: 25 },
  9: { 9: 1000000, 8: 100000, 7: 3000, 6: 500, 5: 100, 4: 25, 0: 25 },
  10: { 10: 5000000, 9: 250000, 8: 25000, 7: 2500, 6: 250, 5: 25, 0: 25 }
}

/** 超級獎號固定獎金（獨立加購，中獎條件見 `bingoSuperNumberHit`） */
export const BINGO_SUPER_NUMBER_PRIZE = 1200
/** 猜大小固定獎金 */
export const BINGO_BIG_SMALL_PRIZE = 150
/** 猜單雙固定獎金 */
export const BINGO_ODD_EVEN_PRIZE = 150

/** 官方大小／單雙欄位的和局符號（見使用者實測驗證：官方回傳 `'－'` 代表和局） */
export const BINGO_TIE_SYMBOL = '－'

/** 一次送單最多可含幾組獨立注單（4 種類型混合計數，避免單次送單過大） */
export const BINGO_MAX_SLOTS = 10

export type BingoBetType = 'star' | 'super' | 'bigSmall' | 'oddEven'

export type BingoBetTypeDef = {
  key: BingoBetType
  label: string
  desc: string
}

export const BINGO_BET_TYPES: BingoBetTypeDef[] = [
  { key: 'star', label: '基本玩法', desc: '選星數（1~10）並選滿對應個數的號碼，依對中幾個查表得獎' },
  { key: 'super', label: '超級獎號', desc: '選 1 個號碼，猜中第 20 個開出的號碼（獨立加購，不含在基本玩法金額內）' },
  { key: 'bigSmall', label: '猜大小', desc: '猜 20 個開出號碼是「大」還是「小」，和局退款' },
  { key: 'oddEven', label: '猜單雙', desc: '猜 20 個開出號碼是「單」還是「雙」，和局退款' }
]

export type BingoBigSmallPick = '大' | '小'
export type BingoOddEvenPick = '單' | '雙'

/** 判定結果：中獎／未中／和局（退款，不算輸也不算贏） */
export type BingoJudgeResult = 'win' | 'lose' | 'push'

/** 一組下注（送單／結算共用的內部結構） */
export type BingoSlot =
  | { betType: 'star'; star: number; numbers: number[] }
  | { betType: 'super'; number: number }
  | { betType: 'bigSmall'; pick: BingoBigSmallPick }
  | { betType: 'oddEven'; pick: BingoOddEvenPick }

/** 內部開獎結果結構：一期只產生一份，4 種投注類型皆讀同一份（見 design.md Decision 6 強制規範） */
export type BingoDraw = {
  issue: string
  /** order: 1~20，即開球順序；第 20 個（`order===20`）即超級獎號 */
  numbers: Array<{ number: number; order: number }>
  /** 官方欄位原值：'大'|'小'|'－' */
  lotBigSmall: string
  /** 官方欄位原值：'單'|'雙'|'－' */
  lotOddEven: string
}

/** 星數合法性檢查（1~10） */
export function bingoIsValidStar(star: number): boolean {
  return Number.isInteger(star) && star >= BINGO_STAR_MIN && star <= BINGO_STAR_MAX
}

/** 單一號碼合法性檢查（01–80） */
export function bingoIsValidNumber(num: number): boolean {
  return Number.isInteger(num) && num >= BINGO_NUMBER_MIN && num <= BINGO_NUMBER_MAX
}

/** 正規化＋驗證一組基本玩法選號：星數需在 1~10、選號數需等於星數、號碼需在 01–80 且不重複 */
export function bingoValidateStarNumbers(star: number, numbers: number[]): number[] | null {
  if (!bingoIsValidStar(star)) return null
  if (!Array.isArray(numbers) || numbers.length !== star) return null
  const normalized = numbers.map((n) => Number(n))
  if (normalized.some((n) => !bingoIsValidNumber(n))) return null
  const unique = new Set(normalized)
  if (unique.size !== normalized.length) return null
  return [...normalized].sort((a, b) => a - b)
}

/** 基本玩法查表：選 star 星、對中 hitCount 個 → 獎金；查無對應對中數（沒中獎）回傳 0 */
export function bingoStarPrize(star: number, hitCount: number): number {
  const table = BINGO_STAR_PAYOUT[star]
  if (!table) return 0
  return Number(table[hitCount] ?? 0)
}

/** 統計選號中有幾個落在開出號碼集合裡（基本玩法對中數判定） */
export function bingoCountHits(numbers: number[], drawnSet: Set<number>): number {
  return numbers.reduce((count, n) => count + (drawnSet.has(Number(n)) ? 1 : 0), 0)
}

/**
 * 超級獎號判定：所選號碼必須「＝第 20 個開出的號碼」，不是「有在 20 個開出號碼的集合裡」。
 * ⚠️ 呼叫端務必傳入 `superNumber`（`draw.numbers.find(n => n.order === 20)!.number`），
 *   不可用 `.includes()` 誤判成集合判定（見 design.md Decision 6 的地雷提醒）。
 */
export function bingoSuperNumberHit(picked: number, superNumber: number): boolean {
  return Number(picked) === Number(superNumber)
}

/** 猜大小判定：官方欄位為和局符號時回傳 'push'（退款），否則依是否相符回傳 win/lose */
export function bingoJudgeBigSmall(pick: BingoBigSmallPick, official: string): BingoJudgeResult {
  if (!official || official === BINGO_TIE_SYMBOL) return 'push'
  return pick === official ? 'win' : 'lose'
}

/** 猜單雙判定：官方欄位為和局符號時回傳 'push'（退款），否則依是否相符回傳 win/lose */
export function bingoJudgeOddEven(pick: BingoOddEvenPick, official: string): BingoJudgeResult {
  if (!official || official === BINGO_TIE_SYMBOL) return 'push'
  return pick === official ? 'win' : 'lose'
}

/** 依開出號碼（含 order）取出超級獎號；找不到 order===20 時退而求其次取陣列最後一個（防禦性寫法，正常不會走到） */
export function bingoSuperNumberOf(draw: Pick<BingoDraw, 'numbers'>): number {
  const found = draw.numbers.find((n) => Number(n.order) === BINGO_SUPER_NUMBER_ORDER)
  if (found) return Number(found.number)
  const last = draw.numbers[draw.numbers.length - 1]
  return last ? Number(last.number) : 0
}

/** 把一組 BingoSlot 編碼成 orders 儲存用的單一字串（betCode[0]），供結算／顯示還原 */
export function bingoEncodeSlot(slot: BingoSlot): string {
  if (slot.betType === 'star') return `${slot.star}|${[...slot.numbers].map(Number).sort((a, b) => a - b).join(',')}`
  if (slot.betType === 'super') return String(slot.number)
  return slot.pick
}

/** 把 orders 儲存的字串還原成可判定的結構；格式不符回傳 null（結算時應視為不中獎、不派彩） */
export function bingoDecodeSlot(betType: BingoBetType, code: string): BingoSlot | null {
  if (betType === 'star') {
    const [starRaw, numsRaw] = String(code ?? '').split('|')
    const star = Number(starRaw)
    const numbers = String(numsRaw ?? '').split(',').filter(Boolean).map(Number)
    if (!bingoIsValidStar(star) || numbers.length !== star) return null
    return { betType: 'star', star, numbers }
  }
  if (betType === 'super') {
    const number = Number(code)
    if (!bingoIsValidNumber(number)) return null
    return { betType: 'super', number }
  }
  if (betType === 'bigSmall') {
    if (code !== '大' && code !== '小') return null
    return { betType: 'bigSmall', pick: code }
  }
  if (betType === 'oddEven') {
    if (code !== '單' && code !== '雙') return null
    return { betType: 'oddEven', pick: code }
  }
  return null
}
