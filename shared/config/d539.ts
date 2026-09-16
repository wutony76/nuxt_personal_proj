/**
 * 今彩539（D539）判定核心。
 *
 * ⚠️ 跟 DLT（大樂透）一樣是「完全鏡射官方台彩」的玩法——本站不自建開獎、不自建賠率：
 *   開獎號與 4 個獎項的派彩金額完全鏡射官方今彩539（gameCode 1197）即時資料
 *   （見 openspec/changes/add-tw-lottery-suite/design.md Decision 1、2）。這支檔案只負責
 *   「一注 5 個號碼，對照官方開獎號後屬於哪一個獎項」的純判定邏輯，不含任何賠率／RTP／彩池計算。
 *
 * 與 DLT 最大的規則差異：號碼池 01–39、每注選 5 個、**沒有特別號**（DLT 是 49 選 6＋1 特別號），
 * 因此判定函式比 DLT 的 dltTierOf 更單純，只看「對中幾碼」，不需要判斷特別號。
 * 對中 5 碼＝頭獎、4 碼＝二獎、3 碼＝三獎、2 碼＝四獎，對中 0~1 碼不中獎（官方今彩539規則）。
 */

export const D539_NUMBER_MIN = 1
export const D539_NUMBER_MAX = 39
export const D539_PICK_COUNT = 5
/** C(39,5)，判定母數，只用來佐證 D539_TIERS 的 ways 加總，不用於推導賠率 */
export const D539_TOTAL_COMBOS = 575_757
/** 一次送單最多可含幾組獨立注碼（比照 DLT 的 A~E，見 design.md Decision 1） */
export const D539_MAX_SLOTS = 5
/** 每注固定金額（coin），比照官方每注 50 元定價，玩家不可調整 */
export const D539_BET_AMOUNT = 50

/** 官方開獎日：每天開獎（週一至週六），唯一不開獎的是週日（0）。1=週一...6=週六 */
export const D539_DRAW_WEEKDAYS = [1, 2, 3, 4, 5, 6]
/** 投注截止時間（開獎當日，24 小時制） */
export const D539_CUTOFF_HOUR = 20
export const D539_CUTOFF_MINUTE = 0
/** 開獎時間（開獎當日，24 小時制） */
export const D539_DRAW_HOUR = 20
export const D539_DRAW_MINUTE = 30

/** 上線初期尚無「上一次頭獎金額」歷史紀錄時，單期額度上限的回退基準（比照官方今彩539頭獎量級） */
export const D539_QUOTA_FALLBACK_COIN = 8_000_000

/**
 * 4 個獎項的對中條件，`key`／`label` 直接沿用官方 `Daily539Result` 的欄位命名
 * （見 server/services/game/lottery/tw/taiwanLotteryApi.ts 的 GAME_DEFS[1197].tiers，
 * 避免兩處各自定義同一份對照表）。今彩539無特別號，`k` 即為「需對中幾碼」。
 * `ways` 為對中組數（母數 D539_TOTAL_COMBOS 之下），只用於文件對帳，不參與派彩計算。
 */
export type D539TierKey =
  | 'd539JackpotAssign'
  | 'd539SecondAssign'
  | 'd539ThirdAssign'
  | 'd539FourthAssign'

export type D539TierDef = {
  key: D539TierKey
  label: string
  k: number
  ways: number
}

export const D539_TIERS: D539TierDef[] = [
  { key: 'd539JackpotAssign', label: '頭獎', k: 5, ways: 1 },
  { key: 'd539SecondAssign', label: '二獎', k: 4, ways: 170 },
  { key: 'd539ThirdAssign', label: '三獎', k: 3, ways: 5_610 },
  { key: 'd539FourthAssign', label: '四獎', k: 2, ways: 59_840 }
]

/**
 * 解析注碼字串成 5 個排序過的號碼（1~39、不重複），格式不符回傳 null。
 * 這是伺端結算與 quota 驗證的唯一判定入口，不接受任何其他格式。
 */
function _parseBet(betCode: string | number | Array<string | number>): number[] | null {
  const raw = Array.isArray(betCode)
    ? betCode
    : String(betCode ?? '').split(',')
  const numbers = raw.map((n) => Number(String(n).trim())).filter((n) => Number.isFinite(n))
  if (numbers.length !== D539_PICK_COUNT) return null
  if (numbers.some((n) => !Number.isInteger(n) || n < D539_NUMBER_MIN || n > D539_NUMBER_MAX)) return null
  const unique = new Set(numbers)
  if (unique.size !== D539_PICK_COUNT) return null
  return [...unique].sort((a, b) => a - b)
}

export type D539Match = {
  k: number
}

/**
 * 依一組已知的官方開獎號（5 個號碼）判定一注的對中狀態。
 * @param betCode 玩家注碼（逗號分隔字串或數字陣列）
 * @param winningNumbers 官方當期 5 個開獎號碼
 */
export function d539MatchOf(
  betCode: string | number | Array<string | number>,
  winningNumbers: Array<string | number>
): D539Match | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  const winSet = new Set(winningNumbers.map((n) => Number(n)))
  const k = bet.filter((n) => winSet.has(n)).length
  return { k }
}

/**
 * 判定一注屬於官方 4 個獎項中的哪一個，回傳官方欄位 key；不中獎（對中 0~1 碼）回傳 null。
 * 唯一判定入口，供伺端結算共用。
 */
export function d539TierOf(
  betCode: string | number | Array<string | number>,
  winningNumbers: Array<string | number>
): D539TierKey | null {
  const match = d539MatchOf(betCode, winningNumbers)
  if (!match) return null
  const tier = D539_TIERS.find((t) => t.k === match.k)
  return tier?.key ?? null
}

/** 驗證注碼格式是否合法（5 個 1~39 不重複號碼），供 quota 驗證使用，不判斷是否中獎 */
export function d539HasValidBetCode(betCode: string | number | Array<string | number>): boolean {
  return _parseBet(betCode) !== null
}

/** 把驗證過的注碼正規化成統一的逗號分隔字串（例如 "01,07,15,22,33"），供下注與比對使用 */
export function d539NormalizeBetCode(betCode: string | number | Array<string | number>): string | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  return bet.map((n) => String(n).padStart(2, '0')).join(',')
}
