/**
 * 39樂合彩（M539）判定核心。
 *
 * ⚠️ 跟 DLT（大樂透）／D539（今彩539）／M649（49樂合彩）一樣是「完全鏡射官方台彩」的玩法——
 *   本站不自建開獎、不自建賠率：開獎號碼與 3 個「合數」（二合／三合／四合）的派彩金額完全鏡射官方
 *   39樂合彩（gameCode 5120）即時資料（見 openspec/changes/add-tw-lottery-suite/design.md
 *   Decision 1、3）。
 *
 * ── 與 DLT/D539 最大的規則差異：不是「選 N 個號碼、依對中幾個分獎項」──────────
 *   39樂合彩是「玩家先選定要玩幾合（2/3/4），再從 01–39 選滿對應數量的號碼；開獎後檢查玩家
 *   選的號碼是否**全部**被開獎號碼包含（全中才中獎，沒有部分對中的獎項）」。因此判定是二元的
 *   中／不中（`isHit`），不需要 DLT 那種「對中幾個算第幾獎」的分級對照表；派彩金額＝該「合數」
 *   對應的官方 perPrize（二合＝m539TwoAssign／三合＝m539ThreeAssign／四合＝m539FourAssign），
 *   依玩家選的合數決定取哪個 tier，不是依對中幾個。
 *
 * ── 與 49樂合彩（M649）的差異：號碼池與依附主遊戲不同 ──────────────────────
 *   39樂合彩號碼池是 01–39（M649 是 01–49），開獎頻率跟隨今彩539（每天，週一至週六；
 *   M649 是跟隨大樂透、每週二、五），一期開 5 個號碼（M649 跟隨大樂透是 6 個）。判定邏輯完全一樣。
 *
 * ── 開獎號碼來源（官方 gameCode 5120 API）──────────────────────────────
 *   官方 `39M5Result`／`LastNumber` 對 gameCode 5120 回傳的 `lotNumber` 是 5 個號碼
 *   （＝當期今彩539 5 個號碼、無特別號），期別格式為民國年 3 碼＋該年度序號 6 碼
 *   （與今彩539同格式、同期號）。雖然規則描述是「跟隨今彩539開獎」，但官方 API 本身就分開提供
 *   gameCode 5120 自己的開獎號，本站直接查 5120、**不依賴今彩539 service**（見 design.md Decision 3）。
 */

export const M539_NUMBER_MIN = 1
export const M539_NUMBER_MAX = 39
/** 可選「幾合」：二合(2)／三合(3)／四合(4)，決定一注要選滿幾個號碼（全中才中獎） */
export const M539_PICK_OPTIONS = [2, 3, 4] as const
/** 一次送單最多可含幾組獨立注碼（比照 DLT/D539/M649 的 A~E，每組各自選定合數與號碼） */
export const M539_MAX_SLOTS = 5
/** 每注固定金額（coin），比照官方每注 25 元定價，玩家不可調整（DLT/D539 是 50，此處與 M649 相同） */
export const M539_BET_AMOUNT = 25
/**
 * 開獎號碼數：跟隨今彩539一期 5 個號碼、無特別號（官方 gameCode 5120 的 lotNumber 實測即回傳 5 碼）。
 * 結算判定「玩家選的號碼是否全部落在這 5 個號碼內」。
 */
export const M539_DRAW_COUNT = 5

/** 官方開獎日：每天（週一至週六，週日不開獎，跟今彩539同期）。0=週日、1=週一…6=週六 */
export const M539_DRAW_WEEKDAYS = [1, 2, 3, 4, 5, 6]
/** 投注截止時間（開獎當日，24 小時制） */
export const M539_CUTOFF_HOUR = 20
export const M539_CUTOFF_MINUTE = 0
/** 開獎時間（開獎當日，24 小時制） */
export const M539_DRAW_HOUR = 20
export const M539_DRAW_MINUTE = 30

/** 上線初期尚無「上一次四合（最高獎項）金額」歷史紀錄時，單期額度上限的回退基準 */
export const M539_QUOTA_FALLBACK_COIN = 2_000_000

/**
 * 3 個「合數」對應的官方獎項，`key`／`label` 直接沿用官方 `39M5Result` 的欄位命名
 * （見 server/services/game/lottery/tw/taiwanLotteryApi.ts 的 GAME_DEFS[5120].tiers，
 * 避免兩處各自定義同一份對照表）。`pick` 為該合數需選滿幾個號碼（全中才中獎）。
 */
export type M539TierKey = 'm539TwoAssign' | 'm539ThreeAssign' | 'm539FourAssign'

export type M539TierDef = {
  key: M539TierKey
  label: string
  pick: number
}

export const M539_TIERS: M539TierDef[] = [
  { key: 'm539TwoAssign', label: '二合', pick: 2 },
  { key: 'm539ThreeAssign', label: '三合', pick: 3 },
  { key: 'm539FourAssign', label: '四合', pick: 4 }
]

/**
 * 解析注碼字串成 2/3/4 個排序過的號碼（1~39、不重複），格式不符回傳 null。
 * 這是伺端結算與 quota 驗證的唯一判定入口，不接受任何其他格式。
 */
function _parseBet(betCode: string | number | Array<string | number>): number[] | null {
  const raw = Array.isArray(betCode)
    ? betCode
    : String(betCode ?? '').split(',')
  const numbers = raw.map((n) => Number(String(n).trim())).filter((n) => Number.isFinite(n))
  if (!(M539_PICK_OPTIONS as readonly number[]).includes(numbers.length)) return null
  if (numbers.some((n) => !Number.isInteger(n) || n < M539_NUMBER_MIN || n > M539_NUMBER_MAX)) return null
  const unique = new Set(numbers)
  if (unique.size !== numbers.length) return null
  return [...unique].sort((a, b) => a - b)
}

/**
 * 樂合彩的判定核心：玩家選的號碼是否「全部」被開獎號碼包含（全中才中獎，見 design.md Decision 3）。
 * 不是「對中幾個算第幾獎」，而是二元的中／不中。
 * @param selected 玩家選的 2/3/4 個號碼
 * @param drawn 官方當期開出的號碼（39樂合彩＝今彩539 5 個號碼）
 */
export function isHit(selected: Array<number | string>, drawn: Array<number | string>): boolean {
  if (!Array.isArray(selected) || !Array.isArray(drawn)) return false
  if (selected.length === 0) return false
  const drawnSet = new Set(drawn.map((n) => Number(n)))
  return selected.every((n) => drawnSet.has(Number(n)))
}

/** 依「合數」（選幾個號碼）對應官方獎項 key：2→二合／3→三合／4→四合；非法合數回傳 null */
export function m539TierKeyOf(pickCount: number): M539TierKey | null {
  return M539_TIERS.find((t) => t.pick === Number(pickCount))?.key ?? null
}

/** 取注碼的合數（號碼個數，2/3/4）；格式不合法回傳 null */
export function m539PickCountOf(betCode: string | number | Array<string | number>): number | null {
  const bet = _parseBet(betCode)
  return bet ? bet.length : null
}

/** 驗證注碼格式是否合法（2/3/4 個 1~39 不重複號碼），供 quota 驗證使用，不判斷是否中獎 */
export function m539HasValidBetCode(betCode: string | number | Array<string | number>): boolean {
  return _parseBet(betCode) !== null
}

/** 把驗證過的注碼正規化成統一的逗號分隔字串（例如 "07,22,39"），供下注與比對使用 */
export function m539NormalizeBetCode(betCode: string | number | Array<string | number>): string | null {
  const bet = _parseBet(betCode)
  if (!bet) return null
  return bet.map((n) => String(n).padStart(2, '0')).join(',')
}
