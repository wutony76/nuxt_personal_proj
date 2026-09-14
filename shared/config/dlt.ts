/**
 * 大樂透（DLT）判定核心。
 *
 * ⚠️ 這支檔案跟其他彩種的 `<game>.ts`／`<game>-cd.ts` 最大的不同：本站不自建開獎、不自建賠率——
 * 開獎號與 8 個獎項的派彩金額完全鏡射官方即時資料（見 openspec/changes/add-dlt/design.md
 * Decision 2）。這支檔案只負責「一注 6 個號碼，對照官方開獎號與特別號後屬於哪一個獎項」的
 * 純判定邏輯，不含任何賠率／RTP／彩池計算。
 *
 * 使用者拍板「這邊沒有 cd，直接 dlt 就好」——單一模式不需要 `-cd` 後綴（見 design.md Decision 6）。
 */

export const DLT_NUMBER_MIN = 1
export const DLT_NUMBER_MAX = 49
export const DLT_PICK_COUNT = 6
/** C(49,6)，判定母數，只用來佐證 DLT_TIERS 的 ways 加總，不用於推導賠率 */
export const DLT_TOTAL_COMBOS = 13_983_816
/** 一次送單最多可含幾組獨立注碼（比照官方紙本投注單 A~E，見 design.md Decision 8/9） */
export const DLT_MAX_SLOTS = 5
/** 每注固定金額（coin），比照官方每注 50 元定價，玩家不可調整（見 design.md Decision 3） */
export const DLT_BET_AMOUNT = 50

/** 官方開獎日：0=週日...2=週二、5=週五 */
export const DLT_DRAW_WEEKDAYS = [2, 5]
/** 投注截止時間（開獎當日，24 小時制） */
export const DLT_CUTOFF_HOUR = 20
export const DLT_CUTOFF_MINUTE = 0
/** 開獎時間（開獎當日，24 小時制） */
export const DLT_DRAW_HOUR = 20
export const DLT_DRAW_MINUTE = 30

/** 上線初期尚無「上一次真的有人中頭獎」的歷史紀錄時，單期額度上限的回退基準（見 Decision 3） */
export const DLT_QUOTA_FALLBACK_COIN = 80_000_000

/**
 * 8 個獎項的對中條件，`key`／`label` 直接沿用官方 `Lotto649Result` 的欄位命名
 * （見 server/api/lottery-tw/prize.get.ts 的 GAME_DEFS[5118].tiers，避免兩處各自定義同一份對照表）。
 * `hasSpecial: null` 代表「頭獎」不需要看特別號（k=6 時 6 個號碼已全部對中一般號，沒有名額再中特別號）。
 * `ways` 為對中組數（母數 DLT_TOTAL_COMBOS 之下），只用於文件對帳，不參與派彩計算。
 */
export type DltTierKey =
  | 'jackpotAssign'
  | 'secondAssign'
  | 'thirdAssign'
  | 'fourthAssign'
  | 'fifthAssign'
  | 'sixthAssign'
  | 'seventhAssign'
  | 'normalAssign'

export type DltTierDef = {
  key: DltTierKey
  label: string
  k: number
  hasSpecial: boolean | null
  ways: number
}

export const DLT_TIERS: DltTierDef[] = [
  { key: 'jackpotAssign', label: '頭獎', k: 6, hasSpecial: null, ways: 1 },
  { key: 'secondAssign', label: '二獎', k: 5, hasSpecial: true, ways: 6 },
  { key: 'thirdAssign', label: '三獎', k: 5, hasSpecial: false, ways: 252 },
  { key: 'fourthAssign', label: '四獎', k: 4, hasSpecial: true, ways: 630 },
  { key: 'fifthAssign', label: '五獎', k: 4, hasSpecial: false, ways: 12_915 },
  { key: 'sixthAssign', label: '六獎', k: 3, hasSpecial: true, ways: 17_220 },
  { key: 'seventhAssign', label: '七獎', k: 3, hasSpecial: false, ways: 229_600 },
  { key: 'normalAssign', label: '普獎', k: 2, hasSpecial: true, ways: 172_200 }
]

/**
 * 解析注碼字串成 6 個排序過的號碼（1~49、不重複），格式不符回傳 null。
 * 這是伺端結算與 quota 驗證的唯一判定入口，不接受任何其他格式。
 */
function _parseBet(betCode: string | number | Array<string | number>): number[] | null {
  const raw = Array.isArray(betCode)
    ? betCode
    : String(betCode ?? '').split(',')
  const numbers = raw.map((n) => Number(String(n).trim())).filter((n) => Number.isFinite(n))
  if (numbers.length !== DLT_PICK_COUNT) return null
  if (numbers.some((n) => !Number.isInteger(n) || n < DLT_NUMBER_MIN || n > DLT_NUMBER_MAX)) return null
  const unique = new Set(numbers)
  if (unique.size !== DLT_PICK_COUNT) return null
  return [...unique].sort((a, b) => a - b)
}

export type DltMatch = {
  k: number
  hasSpecial: boolean
}

/**
 * 依一組已知的官方開獎號（6 個一般號 + 1 特別號）判定一注的對中狀態。
 * @param betCode 玩家注碼（逗號分隔字串或數字陣列）
 * @param winningNumbers 官方當期 6 個一般號碼
 * @param special 官方當期特別號
 */
export function dltMatchOf(
  betCode: string | number | Array<string | number>,
  winningNumbers: Array<string | number>,
  special: string | number
): DltMatch | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const winSet = new Set(winningNumbers.map((n) => Number(n)))
  const specialNum = Number(special)
  const k = bet.filter((n) => winSet.has(n)).length
  const hasSpecial = bet.includes(specialNum)
  return { k, hasSpecial }
}

/**
 * 判定一注屬於官方 8 個獎項中的哪一個，回傳官方欄位 key；不中獎回傳 null。
 * 唯一判定入口，供伺端結算共用（見 design.md Decision 1、8）。
 */
export function dltTierOf(
  betCode: string | number | Array<string | number>,
  winningNumbers: Array<string | number>,
  special: string | number
): DltTierKey | null {
  const match = dltMatchOf(betCode, winningNumbers, special)
  if (!match) return null
  const { k, hasSpecial } = match

  if (k === 6) return 'jackpotAssign'
  const tier = DLT_TIERS.find((t) => t.k === k && t.hasSpecial === hasSpecial && t.key !== 'jackpotAssign')
  return tier?.key ?? null
}

/** 驗證注碼格式是否合法（6 個 1~49 不重複號碼），供 quota 驗證使用，不判斷是否中獎 */
export function dltHasValidBetCode(betCode: string | number | Array<string | number>): boolean {
  return _parseBet(betCode) !== null
}

/** 把驗證過的注碼正規化成統一的逗號分隔字串（例如 "01,07,15,22,33,49"），供下注與比對使用 */
export function dltNormalizeBetCode(betCode: string | number | Array<string | number>): string | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  return bet.map((n) => String(n).padStart(2, '0')).join(',')
}
