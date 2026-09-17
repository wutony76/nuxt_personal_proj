/**
 * 威力彩（SUPERLOTTO）判定核心。
 *
 * ⚠️ 跟 DLT（大樂透）／D539（今彩539）一樣是「完全鏡射官方台彩」的玩法——本站不自建開獎、
 *   不自建賠率：開獎號與 10 個獎項的派彩金額完全鏡射官方威力彩（gameCode 5134）即時資料
 *   （見 openspec/changes/add-tw-lottery-suite/design.md Decision 1、2、4）。這支檔案只負責
 *   「一注（第一區 6 碼＋第二區 1 碼），對照官方兩區開獎號後屬於哪一個獎項」的純判定邏輯，
 *   不含任何賠率／RTP／彩池計算。
 *
 * ── 本次唯一「兩區選號」的玩法（design.md Decision 4）────────────────────────
 *   第一區（Zone A）從 01–38 選 6 個號碼、第二區（Zone B）從 01–08 選 1 個號碼，兩區各自
 *   獨立、互不相關。10 個獎項的對中條件皆為「第一區對中幾碼」×「第二區是否對中」的組合，
 *   判定模型與 DLT 的 `dltTierOf` 相似（查表映射），只是條件多一維（多了第二區）。
 *
 * ── 官方 API 實測結果（實作前已呼叫 gameCode 5134 驗證，不憑空假設）──────────────
 *   1. 期別格式：民國年 3 碼＋該年度序號 6 碼（例如 "115000074"），**與大樂透同格式**
 *      （原 design.md 標記為待驗證，實測確認一致）。
 *   2. 開獎號結構：官方 `lotNumber`（＝`drawNumberAppear`，開球順序）為 7 碼，前 6 碼為
 *      第一區、**最後 1 碼（index 6）為第二區**（與 DLT「6 一般號＋1 特別號」的排列同構）；
 *      官方另有 `drawNumberSize`（第一區排序後＋第二區），第二區同樣固定在最後一碼。
 *   3. 開獎頻率：每週一、四 20:30（實測 115000074=2026-09-14 週一、115000073=2026-09-10 週四）。
 *
 * ── 10 個獎項對照表（以官方公開機率＋組合數學核對確立，非照抄規劃描述）──────────
 *   母數＝C(38,6)×8＝22,085,448。各獎項對中條件（kA＝第一區對中數、B＝第二區是否對中）與
 *   官方公開機率完全吻合：
 *     頭獎 (kA=6, B✓) 1/22,085,448   二獎 (kA=6, B✗) 1/3,155,064
 *     三獎 (kA=5, B✓) 1/115,028      四獎 (kA=5, B✗) 1/16,433
 *     五獎 (kA=4, B✓) 1/2,968        六獎 (kA=4, B✗) 1/424
 *     七獎 (kA=3, B✓) 1/223          八獎 (kA=2, B✓) 1/41
 *     九獎 (kA=3, B✗) 1/32           普獎 (kA=0或1, B✓) 1/10.4
 *   ⚠️ 注意 八獎(kA=2,B✓) 與 九獎(kA=3,B✗) 的 kA 非單調，普獎涵蓋「第二區中＋第一區 0 或 1 碼」
 *   兩種情形——因此無法像 DLT 那樣用「kA + hasSpecial」自動查表，必須用下方 `superlottoTierOf`
 *   的明確映射，不可自行簡化成單調規則。
 */

export const SUPERLOTTO_ZONE_A_MIN = 1
export const SUPERLOTTO_ZONE_A_MAX = 38
export const SUPERLOTTO_ZONE_A_PICK = 6

export const SUPERLOTTO_ZONE_B_MIN = 1
export const SUPERLOTTO_ZONE_B_MAX = 8
export const SUPERLOTTO_ZONE_B_PICK = 1

/** C(38,6)×8，判定母數，只用來佐證 SUPERLOTTO_TIERS 的 ways 加總，不用於推導賠率 */
export const SUPERLOTTO_TOTAL_COMBOS = 22_085_448
/** 一次送單最多可含幾組獨立注碼（比照 DLT 的 A~E，每組各自兩區完整投注） */
export const SUPERLOTTO_MAX_SLOTS = 5
/** 每注固定金額（coin），比照官方每注 100 元定價，玩家不可調整（DLT/D539 是 50、M649/M539 是 25，此處不同） */
export const SUPERLOTTO_BET_AMOUNT = 100

/** 官方開獎日：每週一、四（實測確認）。0=週日...1=週一...4=週四 */
export const SUPERLOTTO_DRAW_WEEKDAYS = [1, 4]
/** 投注截止時間（開獎當日，24 小時制） */
export const SUPERLOTTO_CUTOFF_HOUR = 20
export const SUPERLOTTO_CUTOFF_MINUTE = 0
/** 開獎時間（開獎當日，24 小時制） */
export const SUPERLOTTO_DRAW_HOUR = 20
export const SUPERLOTTO_DRAW_MINUTE = 30

/** 上線初期尚無「上一次頭獎金額」歷史紀錄時，單期額度上限的回退基準（比照官方威力彩頭獎量級 2 億） */
export const SUPERLOTTO_QUOTA_FALLBACK_COIN = 200_000_000

/**
 * 10 個獎項的對中條件，`key`／`label` 直接沿用官方 `SuperLotto638Result` 的欄位命名
 * （見 server/services/game/lottery/tw/taiwanLotteryApi.ts 的 GAME_DEFS[5134].tiers，避免兩處
 * 各自定義同一份對照表）。**陣列順序必須與 GAME_DEFS[5134].tiers 完全一致**——結算時以
 * 官方回傳 tiers 陣列的 index 對齊本表 index 取 perPrize（見 superlotto.ts `perPrizeOf`）。
 *
 * `kA` 為第一區需對中的碼數、`hasZoneB` 為第二區是否需對中；普獎（kA 0 或 1）以 `kA: -1` 標記，
 * 實際判定一律走 `superlottoTierOf`，本表的 kA/hasZoneB 僅供文件對帳與 UI 顯示。
 * `ways` 為對中組數（母數 SUPERLOTTO_TOTAL_COMBOS 之下），只用於文件對帳，不參與派彩計算。
 */
export type SuperlottoTierKey =
  | 'super638JackpotAssign'
  | 'super638SecondAssign'
  | 'super638ThirdAssign'
  | 'super638FourthAssign'
  | 'super638FifthAssign'
  | 'super638SixthAssign'
  | 'super638SeventhAssign'
  | 'super638EighthAssign'
  | 'super638NinthAssign'
  | 'super638NormalAssign'

export type SuperlottoTierDef = {
  key: SuperlottoTierKey
  label: string
  /** 第一區需對中碼數；普獎（0 或 1 皆可）以 -1 標記，實際判定走 superlottoTierOf */
  kA: number
  /** 第二區是否需對中 */
  hasZoneB: boolean
  desc: string
  ways: number
}

export const SUPERLOTTO_TIERS: SuperlottoTierDef[] = [
  { key: 'super638JackpotAssign', label: '頭獎', kA: 6, hasZoneB: true, desc: '第一區 6 碼＋第二區', ways: 1 },
  { key: 'super638SecondAssign', label: '二獎', kA: 6, hasZoneB: false, desc: '第一區 6 碼', ways: 7 },
  { key: 'super638ThirdAssign', label: '三獎', kA: 5, hasZoneB: true, desc: '第一區 5 碼＋第二區', ways: 192 },
  { key: 'super638FourthAssign', label: '四獎', kA: 5, hasZoneB: false, desc: '第一區 5 碼', ways: 1_344 },
  { key: 'super638FifthAssign', label: '五獎', kA: 4, hasZoneB: true, desc: '第一區 4 碼＋第二區', ways: 7_440 },
  { key: 'super638SixthAssign', label: '六獎', kA: 4, hasZoneB: false, desc: '第一區 4 碼', ways: 52_080 },
  { key: 'super638SeventhAssign', label: '七獎', kA: 3, hasZoneB: true, desc: '第一區 3 碼＋第二區', ways: 99_200 },
  { key: 'super638EighthAssign', label: '八獎', kA: 2, hasZoneB: true, desc: '第一區 2 碼＋第二區', ways: 539_400 },
  { key: 'super638NinthAssign', label: '九獎', kA: 3, hasZoneB: false, desc: '第一區 3 碼', ways: 694_400 },
  { key: 'super638NormalAssign', label: '普獎', kA: -1, hasZoneB: true, desc: '第一區 0 或 1 碼＋第二區', ways: 2_114_448 }
]

export type SuperlottoBet = { zoneA: number[]; zoneB: number }

/**
 * 把「第一區號碼陣列＋第二區號碼」驗證並正規化成 SuperlottoBet（第一區排序、皆去重、範圍檢查），
 * 格式不符回傳 null。這是下注時（quota 驗證）的唯一入口。
 */
function _parseZones(
  zoneARaw: Array<number | string> | undefined,
  zoneBRaw: number | string | undefined | null
): SuperlottoBet | null {
  const zoneA = (Array.isArray(zoneARaw) ? zoneARaw : [])
    .map((n) => Number(String(n).trim()))
    .filter((n) => Number.isFinite(n))
  if (zoneA.length !== SUPERLOTTO_ZONE_A_PICK) return null
  if (zoneA.some((n) => !Number.isInteger(n) || n < SUPERLOTTO_ZONE_A_MIN || n > SUPERLOTTO_ZONE_A_MAX)) return null
  if (new Set(zoneA).size !== SUPERLOTTO_ZONE_A_PICK) return null

  const zoneB = Number(String(zoneBRaw ?? '').trim())
  if (!Number.isInteger(zoneB) || zoneB < SUPERLOTTO_ZONE_B_MIN || zoneB > SUPERLOTTO_ZONE_B_MAX) return null

  return { zoneA: [...zoneA].sort((a, b) => a - b), zoneB }
}

/**
 * 解析注碼字串（例如 "01,05,12,20,30,38|03"，第一區 6 碼逗號分隔／`|`／第二區 1 碼）成
 * SuperlottoBet，格式不符回傳 null。這是伺端結算比對的唯一入口，不接受任何其他格式。
 */
function _parseBetCode(betCode: string | Array<string | number>): SuperlottoBet | null {
  const str = Array.isArray(betCode) ? String(betCode[0] ?? '') : String(betCode ?? '')
  const parts = str.split('|')
  if (parts.length !== 2) return null
  const zoneA = String(parts[0] ?? '').split(',')
  return _parseZones(zoneA, parts[1])
}

export type SuperlottoMatch = {
  /** 第一區對中碼數（0~6） */
  kA: number
  /** 第二區是否對中 */
  hitB: boolean
}

/**
 * 依一組已知的官方兩區開獎號判定一注的對中狀態。
 * @param betCode 玩家注碼字串（"第一區6碼|第二區1碼"）
 * @param winningZoneA 官方當期第一區 6 個開獎號
 * @param winningZoneB 官方當期第二區號碼
 */
export function superlottoMatchOf(
  betCode: string | Array<string | number>,
  winningZoneA: Array<string | number>,
  winningZoneB: string | number
): SuperlottoMatch | null {
  const bet = _parseBetCode(betCode)
  if (!bet) return null
  const winASet = new Set(winningZoneA.map((n) => Number(n)))
  const kA = bet.zoneA.filter((n) => winASet.has(n)).length
  const hitB = bet.zoneB === Number(winningZoneB)
  return { kA, hitB }
}

/**
 * 判定一注屬於官方 10 個獎項中的哪一個，回傳官方欄位 key；不中獎回傳 null。
 * 唯一判定入口，供伺端結算共用（見 design.md Decision 4）。
 *
 * ⚠️ 明確映射、不可簡化：八獎(kA=2,B✓) 與 九獎(kA=3,B✗) 的 kA 非單調，普獎涵蓋 kA 0 或 1，
 * 用單一「kA + hasZoneB 查表」會判錯（例如把「僅中第二區、第一區全空」漏判成不中獎）。
 */
export function superlottoTierOf(
  betCode: string | Array<string | number>,
  winningZoneA: Array<string | number>,
  winningZoneB: string | number
): SuperlottoTierKey | null {
  const match = superlottoMatchOf(betCode, winningZoneA, winningZoneB)
  if (!match) return null
  const { kA, hitB } = match

  if (kA === 6) return hitB ? 'super638JackpotAssign' : 'super638SecondAssign'
  if (kA === 5) return hitB ? 'super638ThirdAssign' : 'super638FourthAssign'
  if (kA === 4) return hitB ? 'super638FifthAssign' : 'super638SixthAssign'
  if (kA === 3) return hitB ? 'super638SeventhAssign' : 'super638NinthAssign'
  if (kA === 2) return hitB ? 'super638EighthAssign' : null
  // kA 為 0 或 1：只有第二區對中才有普獎，否則不中獎
  return hitB ? 'super638NormalAssign' : null
}

/** 驗證「第一區號碼陣列＋第二區號碼」格式是否合法，供 quota 驗證使用，不判斷是否中獎 */
export function superlottoHasValidBet(
  zoneA: Array<number | string> | undefined,
  zoneB: number | string | undefined | null
): boolean {
  return _parseZones(zoneA, zoneB) !== null
}

/**
 * 把「第一區號碼陣列＋第二區號碼」正規化成統一的注碼字串
 * （例如 "01,05,12,20,30,38|03"），供下注建單與結算比對使用；格式不符回傳 null。
 */
export function superlottoNormalizeBet(
  zoneA: Array<number | string> | undefined,
  zoneB: number | string | undefined | null
): string | null {
  const bet = _parseZones(zoneA, zoneB)
  if (!bet) return null
  const aStr = bet.zoneA.map((n) => String(n).padStart(2, '0')).join(',')
  return `${aStr}|${String(bet.zoneB).padStart(2, '0')}`
}
