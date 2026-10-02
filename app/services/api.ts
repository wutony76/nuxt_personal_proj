// ⚠️ 刻意不 import { $fetch } from 'ofetch'——裸 ofetch 在 Node（SSR）環境下呼叫這裡
// 常見的相對路徑（例如 '/api/lottery/...'）會直接丟 "Failed to parse URL"（已實測確認）。
// 這裡改用 Nuxt 自動注入、有 SSR 情境感知能力的全域 $fetch（同一套 ofetch 底層實作，
// 呼叫方式與型別簽章完全相同，client 端行為不變），讓這個檔案的函式之後可以安全地被
// useAsyncData／useFetch 在 SSR 階段呼叫（見 add-ssr-lottery-hall-pools）。
import { LOTTERY } from '~/config/constants'

export type AuthUser = {
  id: string | number
  name: string
  email: string
}

export type BetRecord = {
  id: string
  gameId: number
  gameName: string
  betType: string
  number: string
  amount: number
  odds: number
  potentialPayout: number
  createdAt: string
  status?: 'accepted'
}

export type LotteryState = {
  balance: number
  recentBets: BetRecord[]
  totalBetAmount: number
  currentIssueBetAmount: number
  coin?: number
  currentBets?: number
  totalBets?: number
  analysis?: string
}

export type Lottery6hcRoadPlay = {
  id?: number
  num?: number | string
  label?: string
  countIssue?: number
  countShow?: number
  selected?: boolean
  colorY?: boolean
  animal?: string // 信用盤（6hc-cd）帶當年生肖
}

/** 快3 共用彩池狀態（K3-CD 與 K3-OF 讀到同一份，見 server/services/game/lottery/bg/k3Shared.ts） */
export type K3Pool = {
  issue: string
  base: number
  carry: number
  /** 該期已累積的抽水（官方盤路由才會帶） */
  issuePool?: number
  /** 可發放 = 該期抽水 + 累積滾存 */
  distributable: number
}

/** 快3 當期資訊：開獎為 3 顆骰子（openCode 長度 3） */
export type K3Current = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
  pool: K3Pool
}

/** 快3 玩家紀錄 */
export type K3UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: K3UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
  pool: K3Pool
}

export type K3UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** 信用盤：tie = 和局退還本金（大小單雙開出圍骰） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 信用盤才有：該注鎖定的賠率 */
  odds?: number
  /** 官方盤才有：命中分層名稱（頭獎／二獎／三獎） */
  tierName?: string
  jackpotAmount: number
}

/** PK10 共用彩池狀態（PK10-CD 與 PK10-OF 讀到同一份，見 server/services/game/lottery/bg/pk10Shared.ts） */
export type Pk10Pool = {
  issue: string
  base: number
  carry: number
  /** 該期已累積的抽水 */
  issuePool?: number
  /** 可發放 = 池底 + 該期抽水 × 0.8 + 累積滾存，再乘 0.55 */
  distributable: number
}

/**
 * PK10 當期資訊
 * ⚠️ openCode 長度固定 10，`openCode[i]` 是「第 i+1 名的車號」（不是第 i 台車的名次）
 */
export type Pk10Current = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; rank: number; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
  pool: Pk10Pool
}

/** PK10 玩家紀錄 */
export type Pk10UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: Pk10UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
  pool: Pk10Pool
}

export type Pk10UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** PK10 名次必分得出來，tie 只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 賠率制注單才有：該注鎖定的賠率（前三直選彩池為 0） */
  odds?: number
  /** 官方盤前三直選才有：命中分層名稱（頭獎／二獎／三獎） */
  tierName?: string
  /** 該注所屬分頁 */
  tabId?: number
  jackpotAmount: number
}

/** SSC 共用彩池狀態（SSC-CD 與 SSC-OF 讀到同一份，見 server/services/game/lottery/bg/sscShared.ts） */
export type SscPool = {
  issue: string
  base: number
  carry: number
  /** 該期已累積的抽水 */
  issuePool?: number
  /**
   * 可發放 = 池底 + 該期抽水 × 0.8 + 累積滾存，再乘 0.55
   * ⚠️ 時時彩兩個盤口都是固定賠率、沒有吃池的玩法，這個值純粹是看板的門面數字
   */
  distributable: number
}

/**
 * SSC 當期資訊
 * ⚠️ openCode 長度固定 5，`openCode[i]` 是第 i+1 顆球（萬／千／百／十／個位），
 *    號碼 0 ~ 9 且**可重複**（與 pk10 的名次排列不同）
 */
export type SscCurrent = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; ball: number; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
  pool: SscPool
}

/**
 * 爆池狀態（快3／PK10／時時彩／PC蛋蛋共用這個形狀）
 *
 * ⚠️ 與 `SscPool` 是兩個不同的池：SscPool 是官方盤的彩池分頁分層在吃的；
 *    這個是爆池，**信用盤與官方盤共吃一池**，開出爆池條件那期一次發放。
 * ⚠️ 同一個彩種的 `-cd/jackpot` 與 `-of/jackpot` 回的是同一份資料。
 * ⚠️ PC蛋蛋沒有官方盤、也沒有共用彩池，爆池是它唯一的池（只有 `/eggs/jackpot`）。
 * ⚠️ 快樂十分同上（只有 `/kl10/jackpot`）。
 */
export type CreditJackpotState = {
  issue: string
  /** 該期已累積的爆池抽水 */
  currentIssueJackpot: number
  /** 未發放的滾存 */
  carryJackpot: number
  /** 可發放 = 該期抽水 + 滾存 */
  distributable: number
  rakeRatio: number
  payoutRatio: number
  /** 低於此金額不發放 */
  minPool: number
  /** 爆池條件的文字說明 */
  hitLabel: string
  /** 爆池條件的發生機率（0 ~ 1） */
  hitRate: number
  lastHit: {
    issue: string
    openLabel: string
    pool: number
    payout: number
    winners: number
    orders: number
    createdAt: number
  } | null
}

/**
 * 彩池玩法（選號）狀態——PC蛋蛋／快樂十分專用，與上面的 CreditJackpotState（爆池）是兩個獨立的池
 * ⚠️ 同一套形狀比照 SscPool，但多帶 prizeTiers（依命中顆數分層派彩，靜態顯示用）
 */
export type PoolPlayState = {
  issue: string
  base: number
  carry: number
  issuePool: number
  distributable: number
  prizeTiers: Array<
    | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
    | { match: number; type: 'fixed'; amount: number; name: string }
  >
}

/**
 * 雙盤口彩種（k3/pk10/ssc/x5 的官方盤）共用彩池狀態——CD 與 OF 共用同一份，
 * 官方盤某個吃池分頁依此分層派彩。沒有 `prizeTiers`（分層比例定義在各彩種自己的
 * `*-of.ts`，不透過 API 對外露出），純供大廳跑馬燈這類「只要總額」的呼叫端用。
 */
export type SharedPoolState = {
  issue: string
  base: number
  carry: number
  issuePool: number
  distributable: number
}

/** SSC 玩家紀錄 */
export type SscUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: SscUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
  pool: SscPool
}

export type SscUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** 時時彩沒有真正的和局，tie 只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率（兩個盤口都有，時時彩全是固定賠率） */
  odds?: number
  /** 官方盤才有：中獎狀態文案（中獎／和局） */
  tierName?: string
  /** 該注所屬分頁 */
  tabId?: number
  jackpotAmount: number
}

/**
 * 11選5（X5）共用彩池狀態（X5-CD 與 X5-OF 讀到同一份，見 server/services/game/lottery/bg/x5Shared.ts）
 * ⚠️ 階段 1 只有信用盤（固定賠率、不吃池），這個值目前純粹是看板的門面數字；
 *    階段 2 的官方盤直選類才會真的從這個池分層派彩。
 */
export type X5Pool = {
  issue: string
  base: number
  carry: number
  /** 該期已累積的抽水 */
  issuePool?: number
  /** 可發放 = 池底 + 該期抽水 × 0.8 + 累積滾存，再乘 0.55 */
  distributable: number
}

/**
 * 11選5 當期資訊
 * ⚠️ openCode 長度固定 5，`openCode[i]` 是第 i+1 顆球，
 *    號碼 01 ~ 11（補零兩位字串）且**互不重複**（與 ssc 的可重複不同）。
 */
export type X5Current = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; ball: number; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
  pool: X5Pool
}

/** 11選5 玩家紀錄 */
export type X5UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: X5UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
  pool: X5Pool
}

export type X5UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** 11選5 沒有真正的和局，tie 只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率；官方盤的彩池分頁（後三直選）為 0，那邊走分層 */
  odds?: number
  /**
   * 官方盤才有：中獎狀態文案
   *   彩池分頁 → 分層名稱（頭獎／二獎／三獎）
   *   賠率分頁 → 中獎／和局
   */
  tierName?: string
  /** 該注所屬分頁 */
  tabId?: number
  /** 爆池加碼（開出「五球全單或全雙」那期才有值） */
  jackpotAmount: number
}

/**
 * PC蛋蛋（EGGS）當期資訊
 * ⚠️ 只有信用盤（來源本身無官方盤），不像 K3/SSC 有共用彩池，故沒有 pool 欄位。
 *    openCode 長度固定 3（0~9，可重複）。
 */
export type EggsCurrent = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
}

/** PC蛋蛋玩家紀錄 */
export type EggsUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: EggsUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type EggsUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** tie 只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率（含本金） */
  odds?: number
  /** 該注所屬分頁 */
  tabId?: number
  jackpotAmount: number
}

/**
 * 快樂十分（KL10）當期資訊
 * ⚠️ 只有信用盤（來源本身無官方盤），不像 K3/SSC 有共用彩池，故沒有 pool 欄位。
 *    openCode 長度固定 8（1~20，互不重複，補零兩位）。
 */
export type Kl10Current = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; ball: number; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
}

/** 快樂十分玩家紀錄 */
export type Kl10UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: Kl10UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type Kl10UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一注一個注碼（任選的複式已在下注時展開成多注） */
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** tie 只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率（含本金） */
  odds?: number
  /** 該注所屬分頁 */
  tabId?: number
  /** 爆池加碼（開出「奇偶一邊倒」那期才有值） */
  jackpotAmount: number
}

/**
 * 快樂8（KL8）當期資訊
 * ⚠️ 只有信用盤（來源本身無官方盤），不像 K3/SSC 有共用彩池，故沒有 pool 欄位。
 *    openCode 長度固定 20（1~80，互不重複，補零兩位）。
 *    快樂8沒有「第幾球」的位置概念，openCodePlay 也就沒有 kl10 的 ball 欄位。
 */
export type Kl8Current = {
  issue: string
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
}

/** 快樂8玩家紀錄 */
export type Kl8UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: Kl8UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type Kl8UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一注一個注碼（任選的複式已在下注時展開成多注；選號彩池玩法帶 3 個號碼） */
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** tie 只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率（含本金） */
  odds?: number
  /** 該注所屬分頁 */
  tabId?: number
  /** 爆池加碼（開出「奇偶一邊倒」那期才有值） */
  jackpotAmount: number
}

/**
 * 福彩3D（FC3D）當期資訊
 * ⚠️ 只有官方盤（來源本身無信用盤）；current 本身沒有 pool／jackpot 欄位，
 *    全站爆池／三星直選分層彩池另外走 jackpotFc3d／poolFc3d 兩支獨立 API。
 *    openCode 長度固定 3（百/十/個位，各自 0~9，可重複）。
 */
export type Fc3dCurrent = {
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
}

/** 福彩3D玩家紀錄 */
export type Fc3dUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: Fc3dUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type Fc3dUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一注一個注碼（複式已在下注時展開成多注，例如「三星直選123」「大小單雙前二大單」） */
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** tie：官方盤沒有真正的和局，只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率（含本金）；三星直選吃彩池後為 0，改看 tierName/winAmount */
  odds?: number
  /** 該注所屬分頁 */
  tabId?: number
  /** 三星直選命中的分層名稱（頭獎／二獎／三獎），非三星直選注單為空字串 */
  tierName?: string
  /** 全站爆池加碼金額（未觸發或未參與分潤為 0） */
  jackpotAmount?: number
}

/**
 * 排列3（PL3）當期資訊
 * ⚠️ 玩法結構與福彩3D相同（同為官方盤單盤口、無信用盤、無彩池），型別結構完全比照 Fc3dCurrent。
 */
export type Pl3Current = {
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode: string[]
  openCodePlay: Array<{ num: number; label: string; index: number }>
  time: { start: string; end: string }
  startAt: number
  endAt: number
}

/**
 * 大樂透（DLT）當期資訊
 * ⚠️ 跟其他所有彩種最大的不同：`issue` 是本站內部佔位期別（`DLT-YYYYMMDD`），開獎前用來
 * 分組下注；`lastOpenCode` 才是官方真實開獎號與真實 period（見 server dlt.ts 檔頭註解）。
 * 下注當下不顯示獎金（`tiers` 只有名稱／對中條件，沒有 `perPrize`——要等開獎結算後才知道）。
 */
export type DltCurrent = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  popularNumbers: Array<{ betCode: number[]; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 大樂透玩家紀錄 */
export type DltUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: DltUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type DltUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一組 6 碼（逗號分隔已正規化，例如 "01,07,15,22,33,49"） */
  betCode: string[]
  /** 官方真實開獎號（結算前為空陣列） */
  openCode: string[]
  /** 命中的官方獎項 key（jackpotAssign／secondAssign…），未中或結算前為 null */
  tierKey: string | null
  /** 對應獎項中文名稱（頭獎／二獎…），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額＝官方當期該獎項實際 perPrize，未結算前為 0 */
  winAmount: number
}

/**
 * 威力彩（SUPERLOTTO）當期資訊
 * ⚠️ 與 DLT 同為「完全鏡射官方」的 tw 分類玩法（路由在 lottery-tw/superlotto），但本站唯一
 * 「兩區選號」的玩法：第一區 01–38 選 6、第二區 01–08 選 1。`issue` 對齊官方期別（民國年＋序號、
 * 與大樂透同格式，經官方 API 實測確認），`lastOpenCode` 為官方真實開獎號 7 碼（第一區排序後 6 碼
 * ＋第二區 1 碼，第二區固定最後一碼）。下注當下不顯示獎金（`tiers` 只有名稱／對中條件）。
 */
export type SuperlottoCurrent = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  /** 熱門選號：兩區結構（zoneA 6 碼＋zoneB 1 碼），本期無人下注時後端回傳隨機號碼 */
  popularNumbers: Array<{ zoneA: number[]; zoneB: number; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 威力彩玩家紀錄 */
export type SuperlottoUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: SuperlottoUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type SuperlottoUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一注一個注碼字串（"第一區6碼|第二區1碼"，例如 "01,05,12,20,30,38|03"） */
  betCode: string[]
  /** 官方真實開獎號 7 碼（結算前為空陣列，第一區排序後 6 碼＋第二區 1 碼） */
  openCode: string[]
  /** 命中的官方獎項 key（super638JackpotAssign…super638NormalAssign），未中或結算前為 null */
  tierKey: string | null
  /** 對應獎項中文名稱（頭獎／二獎…普獎），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額＝官方當期該獎項實際 perPrize，未結算前為 0 */
  winAmount: number
}

/**
 * 今彩539（D539）當期資訊
 * ⚠️ 與 DLT 同為「完全鏡射官方」的 tw 分類玩法（路由在 lottery-tw/d539）；`issue` 是對齊官方
 * 的當期期別（民國年＋序號），`lastOpenCode` 為官方真實開獎號（今彩539一期 5 碼、無特別號）。
 * 下注當下不顯示獎金（`tiers` 只有名稱／對中條件，沒有 `perPrize`——要等開獎結算後才知道）。
 */
export type D539Current = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  popularNumbers: Array<{ betCode: number[]; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 今彩539玩家紀錄 */
export type D539UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: D539UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type D539UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一組 5 碼（逗號分隔已正規化，例如 "01,07,15,22,33"） */
  betCode: string[]
  /** 官方真實開獎號（結算前為空陣列，今彩539一期 5 碼、無特別號） */
  openCode: string[]
  /** 命中的官方獎項 key（d539JackpotAssign／d539SecondAssign…），未中或結算前為 null */
  tierKey: string | null
  /** 對應獎項中文名稱（頭獎／二獎…），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額＝官方當期該獎項實際 perPrize，未結算前為 0 */
  winAmount: number
}

/**
 * 49樂合彩（M649）當期資訊
 * ⚠️ 與 DLT/D539 同為「完全鏡射官方」的 tw 分類玩法（路由在 lottery-tw/m649），但玩法本質不同：
 * 玩家選定「幾合」（2/3/4）並選滿對應數量的號碼，開獎號**全部**被開出才中獎（二元中/不中，
 * 見 shared/config/m649.ts 的 isHit），沒有 DLT 那種依對中幾碼分級的獎項。
 */
export type M649Current = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  popularNumbers: Array<{ betCode: number[]; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 49樂合彩玩家紀錄 */
export type M649UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: M649UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type M649UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一組 2~4 碼（逗號分隔已正規化，碼數＝玩家當初選的合數） */
  betCode: string[]
  /** 官方真實開獎號（結算前為空陣列，跟隨大樂透 6 碼） */
  openCode: string[]
  /** 命中的官方獎項 key（m649TwoAssign／m649ThreeAssign／m649FourAssign），未中或結算前為 null */
  tierKey: string | null
  /** 對應獎項中文名稱（二合／三合／四合），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額＝官方當期該合數實際 perPrize，未結算前為 0 */
  winAmount: number
}

/**
 * 39樂合彩（M539）當期資訊
 * ⚠️ 與 M649 同為「合數全中才中獎」的 tw 分類玩法（路由在 lottery-tw/m539），差異只在號碼池
 * （01–39 選 2/3/4）與依附主遊戲（跟隨今彩539、每天開獎、一期 5 碼）；獨立呼叫官方 gameCode 5120
 * 的 API，不依賴今彩539／49樂合彩的 service（見 shared/config/m539.ts 的 isHit、design.md Decision 3）。
 */
export type M539Current = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  popularNumbers: Array<{ betCode: number[]; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 39樂合彩玩家紀錄 */
export type M539UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: M539UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type M539UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一組 2~4 碼（逗號分隔已正規化，碼數＝玩家當初選的合數） */
  betCode: string[]
  /** 官方真實開獎號（結算前為空陣列，跟隨今彩539 5 碼） */
  openCode: string[]
  /** 命中的官方獎項 key（m539TwoAssign／m539ThreeAssign／m539FourAssign），未中或結算前為 null */
  tierKey: string | null
  /** 對應獎項中文名稱（二合／三合／四合），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額＝官方當期該合數實際 perPrize，未結算前為 0 */
  winAmount: number
}

/**
 * 3星彩（P3）當期資訊
 * ⚠️ 與 M649/M539 同為「完全鏡射官方」的 tw 分類玩法（路由在 lottery-tw/p3），但玩法本質不同：
 * 玩家選定下注方式（正彩／組彩／前二對彩／後二對彩）並填滿 3 位 0~9 數字（可重複），見
 * shared/config/p3.ts 的 P3_BET_TYPES；tiers 只包含官方正彩/組彩 3 個獎項，對彩固定 750 元
 * （P3_PAIR_PRIZE）不查官方 API、不在 tiers 內。
 */
export type P3Current = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  popularNumbers: Array<{ betType: string; digits: number[]; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 3星彩玩家紀錄 */
export type P3UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: P3UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type P3UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 下注方式：正彩(zhengcai)／組彩(zucai)／前二對彩(front-pair)／後二對彩(back-pair) */
  betType: string
  /** 3 位 0~9 數字組成的字串（例如 "123"），可重複 */
  betCode: string[]
  /** 官方真實開獎號（結算前為空陣列，3星彩一期 3 碼） */
  openCode: string[]
  /** 命中的結果 key（官方 lotto3DFirstAssign/SecondAssign/ThirdAssign，或對彩 front-pair/back-pair），未中或結算前為 null */
  tierKey: string | null
  /** 對應中文名稱（頭獎／二獎／三獎／前二對彩／後二對彩），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額，未結算前為 0 */
  winAmount: number
}

/**
 * 4星彩（P4）當期資訊
 * ⚠️ 與 P3 同為「完全鏡射官方」的 tw 分類玩法（路由在 lottery-tw/p4），玩家選定下注方式
 * （正彩／組彩，官方沒有對彩）並填滿 4 位 0~9 數字（可重複），見 shared/config/p4.ts 的
 * P4_BET_TYPES；tiers 只包含官方正彩/組彩 3 個獎項。
 */
export type P4Current = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  quotaIssueMaxCoin: number
  quotaIssueMaxBets: number
  lastOpenCode: { issue: string; openCode: string[] } | null
  popularNumbers: Array<{ betType: string; digits: number[]; count: number }>
  tiers: Array<{ key: string; label: string; desc: string | null }>
}

/** 4星彩玩家紀錄 */
export type P4UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: P4UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type P4UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 下注方式：正彩(zhengcai)／組彩(zucai)，官方 4星彩沒有對彩 */
  betType: string
  /** 4 位 0~9 數字組成的字串（例如 "1234"），可重複 */
  betCode: string[]
  /** 官方真實開獎號（結算前為空陣列，4星彩一期 4 碼） */
  openCode: string[]
  /** 命中的結果 key（官方 lotto4DFirstAssign/SecondAssign/ThirdAssign），未中或結算前為 null */
  tierKey: string | null
  /** 對應中文名稱（頭獎／二獎／三獎），未中或結算前為空字串 */
  tierLabel: string
  winStatus: 'pending' | 'win' | 'lose'
  /** 派彩金額，未結算前為 0 */
  winAmount: number
}

/**
 * 賓果賓果（BINGO）當期資訊
 * ⚠️ 架構跟其他 7 款玩法差異最大（tw 分類，路由在 lottery-tw/bingo）：每 5 分鐘連續開一期，
 * 沒有「星期幾開獎」的日曆概念；4 種投注類型（基本玩法／超級獎號／猜大小／猜單雙）皆為官方
 * 公開固定賠率（見 shared/config/bingo.ts），不像 P3/P4 有 tiers（官方沒有中獎明細端點）。
 */
export type BingoCurrent = {
  issue: string
  currentStatus: string
  cutoffAt: number
  drawAt: number
  countdown: string
  lastOpenCode: { issue: string; openCode: string[]; superNumber: string; lotBigSmall: string; lotOddEven: string } | null
  popularNumbers: Array<{ star: number; numbers: number[]; count: number }>
  betTypes: Array<{ key: string; label: string; desc: string }>
}

/** 賓果賓果玩家紀錄 */
export type BingoUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: BingoUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type BingoUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 下注類型：star（基本玩法）／super（超級獎號）／bigSmall（猜大小）／oddEven（猜單雙） */
  betType: string
  /** 顯示用注碼摘要（例如 "5 星｜03,12,44,60,77"／"42"／"大"／"單"） */
  betLabel: string
  /** 原始選號（星數玩法：選的 N 個號碼；超級獎號：長度 1 的陣列；大小/單雙無號碼，為空陣列） */
  numbers: number[]
  /** 官方開出的 20 個號碼（依開球順序），結算前為空陣列 */
  openCode: string[]
  /** 官方超級獎號（第 20 個開出的號碼），結算前為空字串 */
  superNumber: string
  /** push＝和局退款（猜大小／猜單雙專屬），不算輸也不算贏 */
  winStatus: 'pending' | 'win' | 'lose' | 'push'
  /** 派彩金額或退款金額，未結算前為 0 */
  winAmount: number
}

/** 賓果賓果開獎歷史單期資料，比通用的 `LotteryOpenCodeHistoryItem` 多帶超級獎號／大小/單雙欄位 */
export type BingoOpenCodeHistoryItem = LotteryOpenCodeHistoryItem & {
  superNumber: string
  lotBigSmall: string
  lotOddEven: string
}

export type BingoOpenCodeHistoryResponse = {
  history: BingoOpenCodeHistoryItem[]
}

/** 排列3玩家紀錄 */
export type Pl3UserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: Pl3UserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
}

export type Pl3UserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  /** 一注一個注碼（複式已在下注時展開成多注，例如「三星直選123」「大小單雙前二大單」） */
  betCode: string[]
  openCode: string[]
  matchCount: number
  /** tie：官方盤沒有真正的和局，只在注碼無法辨識時出現（退還本金） */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 該注鎖定的賠率（含本金）；三星直選吃彩池後為 0，改看 tierName/winAmount */
  odds?: number
  /** 該注所屬分頁 */
  tabId?: number
  /** 三星直選命中的分層名稱（頭獎／二獎／三獎），非三星直選注單為空字串 */
  tierName?: string
  /** 全站爆池加碼金額（未觸發或未參與分潤為 0） */
  jackpotAmount?: number
}

/** 信用盤（6hc-cd）獎池狀態：含可發放累積池、發放參數與最近一次爆池紀錄 */
export type Lottery6hcCdJackpot = {
  issue: string
  currentIssueJackpot: number
  carryJackpot: number
  jackpotBase: number
  jackpotBaseSetAt: number
  /** 可發放累積池 = 當期抽水 + 累積滾存（不含展示用池底） */
  distributable?: number
  rakeRatio?: number
  hitNumber?: number
  payoutRatio?: number
  minPool?: number
  lastHit?: {
    issue: string
    specialCode: string
    pool: number
    payout: number
    winners: number
    orders: number
    createdAt: number
  } | null
}

export type Lottery6hcCurrent = {
  issueCurrent: string
  issueLatest: string
  currentStatus: string
  countdown: string
  statusEndAt: number
  openCode: string[]
  openingCode?: string[]
  openCodePlay: Array<{
    num?: string | number
    label?: string | number
    countIssue?: number
    countShow?: number
    animal?: string
  }>
  jackpot?: {
    issue: string
    currentIssueJackpot: number
    carryJackpot: number
    jackpotBase: number
    jackpotBaseSetAt: number
  }
}

export type TaiwanLotteryResult = {
  gameCode: number
  gameName: string
  en: string
  period?: string
  lotNumber: Array<string | number>
  /** 賓果賓果（gameCode 1102）專屬欄位，其餘遊戲沒有 */
  lotSpecial?: string
  lotBigSmall?: string
  lotOddEven?: string
}

export type TaiwanLotteryPrizeTier = {
  label: string
  winnerCount: number
  perPrize: number
  multiple?: string
  bonus?: string
}

export type TaiwanLotteryPrizeResponse = {
  gameCode: number
  period: string
  tiers: TaiwanLotteryPrizeTier[]
}

export type LotteryBetPayload = {
  lottery?: { id?: number; key?: string }
  groups?: Array<Record<string, unknown>>
  amount: number
  gameId?: number
  betType?: string
  number?: string
  /**
   * tw 選號玩法用：A~E 最多 5 組各自獨立投注，不是複式。
   *   - 大樂透（DLT）／今彩539（D539）：每組 `{ numbers }`（單一號碼池）
   *   - 威力彩（SUPERLOTTO）：每組 `{ zoneA, zoneB }`（兩區選號，見 SuperlottoCurrent 註解）
   *   - 3星彩（P3）：每組 `{ betType, digits }`（下注方式＋3 位 0~9 數字，見 P3Current 註解）
   *   - 賓果賓果（BINGO）：每組 `{ betType, star?, numbers?, number?, pick? }`（4 種投注類型混合，
   *     見 BingoCurrent 註解／shared/config/bingo.ts 的 BingoSlot）
   */
  slots?: Array<{
    numbers?: number[]
    zoneA?: number[]
    zoneB?: number | null
    betType?: string
    digits?: number[]
    star?: number
    number?: number
    pick?: string
  }>
}

export type LotteryBetOrder = {
  order_id: string
  issue: string
  user_id: string
  bet_time: number
  coin: number
  bet_count?: number
  bet_code: string[]
  dan_code?: string[]
  tuo_code?: string[]
  status: 'pending' | 'success' | 'settled'
}

export type LotteryBetResponse = {
  message: string
  coin: number
  orderId: string
  orders: LotteryBetOrder[]
}

export type LotteryUserBalanceChange = {
  id: string
  issue: string
  type: 'bet' | 'claim'
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

export type LotteryUserBetHistory = {
  orderId: string
  issue: string
  betTime: number
  coin: number
  betCount?: number
  betCode: string[]
  danCode?: string[]
  tuoCode?: string[]
  openCode: string[]
  matchCount: number
  specialMatch?: boolean
  /** 信用盤（6hc-cd）：tie = 和局退還本金 */
  winStatus: 'pending' | 'win' | 'lose' | 'tie'
  winAmount: number
  /** 信用盤（6hc-cd）該注賠率（含本金） */
  odds?: number
  /** 信用盤（6hc-cd）爆池加碼金額 */
  jackpotAmount?: number
}

export type LotteryClaimableIssue = {
  issue: string
  amount: number
  openCode: string[]
  createdAt: number
}

export type LotteryUserRecordResponse = {
  balanceChanges: LotteryUserBalanceChange[]
  betHistory: LotteryUserBetHistory[]
  claimableIssues: LotteryClaimableIssue[]
  jackpot: {
    issue: string
    currentIssueJackpot: number
    carryJackpot: number
  }
}

export type LotteryClaimOneIssueResponse = {
  ok: boolean
  message: string
  issue: string
  amount: number
  coin: number
}

export type LotteryOpenCodeHistoryItem = {
  issue: string
  openCode: string[]
  time: {
    start: string
    end: string
  }
  startAt: number
  endAt: number
  status: 'opened' | 'pending'
}

export type LotteryOpenCodeHistoryResponse = {
  history: LotteryOpenCodeHistoryItem[]
}

// ── 遊戲中心 · 遊戲紀錄（game-hall 小遊戲，非彩票）──
export type RetroGameKey = 'snake' | 'racing' | 'tetriminos' | 'match3rush' | 'match3classic' | 'pong' | 'runner' | 'spaceShooter' | 'minesweeper' | 'pacman' | 'spaceInvaders' | 'solitaire' | 'typing' | 'breakout' | 'orbMatch' | 'battleship' | '2048' | 'flappy' | 'frogger' | 'connect4' | 'whackAMole' | 'lightsOut' | 'towerStack' | 'arkanoid' | 'towerDefense' | 'pinball' | 'colorMatch' | 'maze' | 'bubbleShooter' | 'cutTheRope'

export type GameHistoryRecord = {
  id: string
  gameKey: RetroGameKey
  gameName: string
  score: number
  level?: number
  meta?: Record<string, unknown>
  playedAt: string
}

export type GameHistoryRecordPayload = {
  score: number
  level?: number
  meta?: Record<string, unknown>
}

export type GameHistoryListResponse = {
  records: GameHistoryRecord[]
}

export type GameHistorySettleResponse = {
  record: GameHistoryRecord | null
  coinReward: number
  coinCapped: boolean
  newCoinBalance: number
}

export type RetroLeaderboardEntry = {
  rank: number
  gameKey: RetroGameKey
  gameName: string
  score: number
  userId: string
  userName: string
  playedAt: string
}

export type RetroLeaderboardResponse = {
  entries: RetroLeaderboardEntry[]
}

export type RetroGameRateInfo = {
  key: RetroGameKey
  name: string
  coinRate: number
  coinCapPerRun: number
  coinDailyCap: number
}

export type MazeTemplate = { id: string; name: string; rows: string[] }

export type RetroGameRatesResponse = {
  rates: RetroGameRateInfo[]
}

export type BgPoolReseedEvent = {
  id: string
  lotteryKey: string
  lotteryName: string
  issue: string
  before: number
  after: number
  timestamp: number
  timeStr: string
}

export type BgFloorOverpayEvent = {
  id: string
  lotteryKey: string
  lotteryName: string
  issue: string
  overpay: number
  timestamp: number
  timeStr: string
}

export type BgPoolAuditSummary = {
  key: string
  name: string
  reseedCount: number
  totalOverpay: number
}

export type BgPoolAuditResponse = {
  reseed: BgPoolReseedEvent[]
  overpay: BgFloorOverpayEvent[]
  summary: BgPoolAuditSummary[]
  stats: { reseedCount: number; overpayCount: number; totalOverpay: number }
}

export type BgReportSummaryGameItem = {
  key: string
  name: string
  sales: number
  orders: number
  ratio: number
}

export type BgReportSummaryDailyItem = {
  day: string
  sales: number
}

export type BgReportSummaryTwTotal = {
  totalSales: number
  totalOrders: number
  dailySales: BgReportSummaryDailyItem[]
  gameRanking: BgReportSummaryGameItem[]
}

export type BgReportSummaryBucket = {
  totalSales: number
  totalOrders: number
  commission: number
  dailySales: BgReportSummaryDailyItem[]
  gameRanking: BgReportSummaryGameItem[]
  playRanking: BgReportSummaryGameItem[]
  twTotal: BgReportSummaryTwTotal
}

export type BgReportSummary = BgReportSummaryBucket & {
  month: string
  /** 僅 NPC 角色會員的同形狀統計；上方欄位是全部會員（含 NPC）合計 */
  npc: BgReportSummaryBucket
  dataNote: string
}

export type FcoinSummaryDailyItem = {
  day: string
  bet: number
  reward: number
}

export type FcoinSummaryGameItem = {
  name: string
  category: 'toys' | 'retro'
  bet: number
  reward: number
  net: number
  count: number
}

export type FcoinSummaryBucket = {
  totalBet: number
  totalReward: number
  netFlow: number
  dailyFlow: FcoinSummaryDailyItem[]
  perGame: FcoinSummaryGameItem[]
}

export type FcoinSummary = FcoinSummaryBucket & {
  month: string
  /** 僅 NPC 角色會員的同形狀統計；上方欄位是全部會員（含 NPC）合計 */
  npc: FcoinSummaryBucket
  dataNote: string
}

export type TwLotteryPayoutGameItem = {
  key: string
  name: string
  amount: number
  count: number
}

export type TwLotteryPayoutRecordItem = {
  time: number
  timeStr: string
  issue: string
  key: string
  name: string
  amount: number
  isNpc: boolean
}

export type TwLotteryPayoutNpcBucket = {
  totalPayout: number
  totalCount: number
  perGame: TwLotteryPayoutGameItem[]
}

export type TwLotteryPayoutSummary = {
  month: string
  totalPayout: number
  totalCount: number
  perGame: TwLotteryPayoutGameItem[]
  records: TwLotteryPayoutRecordItem[]
  /** 僅 NPC 角色會員的同形狀統計；上方欄位是全部會員（含 NPC）合計 */
  npc: TwLotteryPayoutNpcBucket
  dataNote: string
}

export type MemberRankItem = {
  key: string
  name: string
  players: number
  ratio: number
}

export type MemberCategorySummary = {
  totalPlayers: number
  gameRanking: MemberRankItem[]
}

export type MemberSummary = {
  month: string
  bg: MemberCategorySummary
  tw: MemberCategorySummary
  game: MemberCategorySummary
  /** 僅 NPC 角色會員的同形狀統計；上方欄位是全部會員（含 NPC）合計 */
  npc: {
    bg: MemberCategorySummary
    tw: MemberCategorySummary
    game: MemberCategorySummary
  }
  dataNote: string
}

export type ChatScheduleRepeat = 'daily' | 'once' | 'interval'

export type ChatSchedule = {
  id: string
  text: string
  hour: number
  minute: number
  repeat: ChatScheduleRepeat
  /** 僅 interval：間隔秒數 */
  intervalSeconds?: number
  /** 是否啟用；新增預設 true */
  enabled: boolean
  createdBy: string
  /** 建立者顯示名，觸發時組成「管理者: {name}」 */
  createdByName: string
  createdAt: number
  lastFiredKey?: string
  lastFiredAt?: number
}

/** 角色 id，如 'admin'／'user'／'npc' 或自訂角色 id */
export type UserRole = string

export type AdminAccessUser = {
  id: string
  name: string
  email: string
  role: UserRole
  coin: number
}

/** 角色定義（見 server/services/admin/modules/roleDefs.ts） */
export type RoleDef = {
  id: string
  name: string
  builtin: boolean
  testMode: boolean
  npcMode: boolean
  /** 唯讀模式：開啟後指派此角色的帳號不需要在白名單內也能瀏覽後台，但打不了任何寫入端點 */
  demoMode: boolean
  dailyCoinReward: {
    enabled: boolean
    amount: number
  }
}

/** 角色遊戲權限分類：'bg'（BG 彩票）／'retro'（遊戲中心） */
export type GameCategory = 'bg' | 'retro' | 'tw'

/** 角色遊戲權限項目（見 server/services/admin/modules/roleGamePerms.ts） */
export type RoleGamePerm = {
  category: GameCategory
  key: string
  name: string
  enabled: boolean
}

/** NPC 自動遊玩四分類：bg／retro／tw／toys 皆已支援 */
export type NpcGameCategory = GameCategory | 'toys'

/** NPC 自動遊玩可勾選的遊戲項目（全站共用清單，實際勾選狀態是每個 NPC 會員各自的，見 NpcMemberRow.allowedGames） */
export type NpcGameItem = {
  category: NpcGameCategory
  key: string
  name: string
  supported: boolean
}

/**
 * NPC 自動遊玩全域排程參數（排程間隔、經典遊戲模擬分數區間、玩法權重與 BG 單注金額
 * 區間的全域預設值）。玩法權重／單注金額：NPC 會員沒自訂過就套用這裡的全域值，
 * 自訂過就固定用自己的值（見 NpcMemberRow）。
 */
export type NpcSchedule = {
  tickIntervalSec: number
  retroScoreMinPct: number
  retroScoreMaxPct: number
  bgWeight: number
  retroWeight: number
  twWeight: number
  toysWeight: number
  bgBetAmountMin: number
  bgBetAmountMax: number
}

/** NPC 自動遊玩時段（24 小時分 5 段），每個 NPC 可複選允許遊玩的時段 */
export type NpcTimeSlot = {
  id: string
  label: string
  startHour: number
  endHour: number
}

/** NPC 會員列表列（每日花費上限/自動儲值/經典遊戲模擬分數區間/玩法權重/BG 單注金額區間/允許遊玩時段/遊戲頻率與隨機延遲/今日已花費/這個 NPC 自己勾選的遊戲，皆各自獨立） */
export type NpcMemberRow = {
  id: string
  name: string
  email: string
  coin: number
  dailyMaxSpend: number
  topUpAmount: number
  retroScoreMinPct: number
  retroScoreMaxPct: number
  bgWeight: number
  retroWeight: number
  twWeight: number
  toysWeight: number
  bgBetAmountMin: number
  bgBetAmountMax: number
  /** NpcTimeSlot.id 陣列 */
  activeTimeSlots: string[]
  /** 遊戲頻率：兩次行動至少間隔幾秒 */
  actionIntervalSec: number
  /** 間隔到了之後，幾 % 機率再加一段隨機延遲 */
  actionJitterChancePct: number
  /** 隨機延遲的秒數上限 */
  actionJitterMaxSec: number
  spentToday: number
  /** composite key `${category}:${key}` */
  allowedGames: string[]
}

/** NPC 測試執行 — 單款遊戲結果 */
export type NpcTestPlayResultItem = {
  compositeKey: string
  category: NpcGameCategory
  key: string
  name: string
  status: 'ok' | 'skipped' | 'error'
  note: string
}

/** NPC 活動日誌單筆紀錄 */
export type NpcActivityLogEntry = {
  id: string
  memberId: string
  memberName: string
  type: string
  amount: number
  before: number
  after: number
  note: string
  issue: string
  createdAt: number
}

/** 保存下來的「遊戲勾選」範本，可套用到任一 NPC（快選） */
export type NpcGamePreset = {
  id: string
  name: string
  /** composite key `${category}:${key}` 陣列 */
  allowedGames: string[]
  createdAt: number
}

export type NpcSettings = {
  enabled: boolean
  schedule: NpcSchedule
  games: NpcGameItem[]
  timeSlots: NpcTimeSlot[]
  gamePresets: NpcGamePreset[]
  /** 「自動新增 NPC 會員」用的單字庫 */
  nameWords: string[]
  members: NpcMemberRow[]
}

/** 後台會員登入紀錄 */
export type AdminMemberLoginRecord = {
  id: string
  userId: string
  email: string
  ip: string
  userAgent: string
  createdAt: number
}

/** 後台會員 F幣變動列（跨彩種／遊戲彙總） */
export type AdminMemberBalanceChange = {
  id: string
  source: string
  sourceLabel: string
  issue: string
  type: string
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

export type ToyCatalogItem = {
  slug: string
  name: string
  kind: string
  mark: string
  blurb: string
  status: 'open' | 'soon'
  path: string | null
}

export type ToyCatalogResponse = {
  items: ToyCatalogItem[]
  betChips: number[]
  maxPotMultiplier: number
  flipMs: number
  luckyDraw: {
    cells: number
    rewards: Array<{ id: string; label: string; weight: number; multiplier: number }>
  }
  enabled: boolean
}

export type ToyShopOddsItem = {
  slug: string
  name: string
  multiplier: number
  /** 額外未中獎機率（0~100 的百分比） */
  difficulty: number
  enabled: boolean
}

export type ToyShopSettings = {
  enabled: boolean
  odds: ToyShopOddsItem[]
}

export type ToyLuckyDrawView = {
  status: 'idle' | 'result'
  result: { rewardId: string; label: string; multiplier: number; cellIndex: number } | null
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canContinue: boolean
  canClaim: boolean
  gameKey: string | null
}

export type ToyLuckyDrawRollPayload = {
  action: 'start' | 'continue' | 'claim'
  bet?: number
  cellIndex?: number
}

export type ToyCardsChoice = 'high' | 'low' | 'same'

export type ToyCardsView = {
  status: 'idle' | 'result'
  rank: number | null
  nextRank: number | null
  choice: ToyCardsChoice | null
  correct: boolean | null
  multiplier: number
  streak: number
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canGuess: boolean
  canClaim: boolean
  gameKey: string | null
}

export type ToyCardsRollPayload = {
  action: 'start' | 'guess' | 'claim'
  bet?: number
  choice?: ToyCardsChoice
}

export type ToySodaView = {
  status: 'idle' | 'result'
  busted: boolean | null
  step: number
  prize: number
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canContinue: boolean
  canClaim: boolean
  gameKey: string | null
}

export type ToySodaRollPayload = {
  action: 'start' | 'continue' | 'claim'
  bet?: number
}

export type ToyBambooTarget = 'm10' | 'm20' | 'm30' | 'm40' | 'm50'

export type ToyBambooView = {
  status: 'idle' | 'result'
  height: number | null
  target: ToyBambooTarget | null
  hit: boolean | null
  multiplier: number
  reward: number
  balance: number
  gameKey: string | null
  blocked: boolean
}

export type ToyGummyColor = 'red' | 'yellow' | 'blue' | 'green'

export type ToyGummyView = {
  status: 'idle' | 'result'
  color: ToyGummyColor | null
  guess: ToyGummyColor | null
  correct: boolean | null
  history: ToyGummyColor[]
  multiplier: number
  streak: number
  unclaimed: number
  reward: number
  balance: number
  claimed: boolean
  canGuess: boolean
  canClaim: boolean
  gameKey: string | null
}

export type ToyGummyRollPayload = {
  action: 'start' | 'guess' | 'claim'
  bet?: number
  guess?: ToyGummyColor
}

export type ToyBigPigKind = 'tie' | 'gold' | 'pair' | 'win' | 'tiny' | 'lose'

export type ToyBigPigView = {
  status: 'idle' | 'result'
  player: [number, number] | null
  npc: [number, number] | null
  kind: ToyBigPigKind | null
  multiplier: number
  reward: number
  balance: number
  gameKey: string | null
  blocked: boolean
}

export type ToyWhistleChoice = 'short' | 'mid' | 'long'

export type ToyWhistleView = {
  status: 'idle' | 'result'
  player: ToyWhistleChoice | null
  npc: ToyWhistleChoice | null
  outcome: 'win' | 'tie' | 'lose' | null
  multiplier: number
  reward: number
  history: ToyWhistleChoice[]
  balance: number
  gameKey: string | null
  blocked: boolean
}

/** 柑仔店櫥仔（尪仔標、抽抽樂等玩具）自己的下注／結算紀錄，見 walletBalanceService.listByTypes */
export type ToyHistoryRecord = {
  id: string
  issue: string
  type: 'toy-bet' | 'toy-reward'
  amount: number
  before: number
  after: number
  createdAt: number
  note: string
}

export type ToyPogCard = { id: string; rank: number; kind: 'number' | 'king' | 'shield' | 'swap' | 'bomb' }

export type ToyPogView = {
  status: 'idle' | 'result'
  hand: ToyPogCard[]
  npcCount: number
  last: { player: ToyPogCard; npc: ToyPogCard; result: 'player' | 'npc' | 'cancel' | 'tie' } | null
  playerWins: number
  npcWins: number
  reward: number
  multiplier: number
  balance: number
  settled: boolean
  canPlay: boolean
  gameKey: string | null
  blocked: boolean
}

/**
 * 各彩種「當期資訊」的 fetch 函式 Registry。
 *
 * 新增彩種只需在此加一行，不需動 `api.lottery.currentInfo` 的主體。
 * key = LOTTERY[xxx].id（number）
 */
export type AnyCurrent =
  | Lottery6hcCurrent
  | K3Current
  | Pk10Current
  | SscCurrent
  | X5Current
  | EggsCurrent
  | Kl10Current
  | Kl8Current
  | Fc3dCurrent
  | Pl3Current
  | DltCurrent
  | SuperlottoCurrent
  | D539Current
  | M649Current
  | M539Current
  | P3Current
  | P4Current
  | BingoCurrent

const LOTTERY_CURRENT_REGISTRY: Record<number, () => Promise<AnyCurrent>> = {
  [LOTTERY['LHC-CD'].id]: () => $fetch<Lottery6hcCurrent>('/api/lottery/6hc-cd/current'),
  [LOTTERY['LHC-OF'].id]: () => $fetch<Lottery6hcCurrent>('/api/lottery/6hc-of/current'),
  [LOTTERY['K3-CD'].id]: () => $fetch<K3Current>('/api/lottery/k3-cd/current'),
  [LOTTERY['K3-OF'].id]: () => $fetch<K3Current>('/api/lottery/k3-of/current'),
  [LOTTERY['PK10-CD'].id]: () => $fetch<Pk10Current>('/api/lottery/pk10-cd/current'),
  [LOTTERY['PK10-OF'].id]: () => $fetch<Pk10Current>('/api/lottery/pk10-of/current'),
  [LOTTERY['SSC-CD'].id]: () => $fetch<SscCurrent>('/api/lottery/ssc-cd/current'),
  [LOTTERY['SSC-OF'].id]: () => $fetch<SscCurrent>('/api/lottery/ssc-of/current'),
  [LOTTERY['X5-CD'].id]: () => $fetch<X5Current>('/api/lottery/x5-cd/current'),
  [LOTTERY['X5-OF'].id]: () => $fetch<X5Current>('/api/lottery/x5-of/current'),
  [LOTTERY.EGGS.id]: () => $fetch<EggsCurrent>('/api/lottery/eggs/current'),
  [LOTTERY.KL10.id]: () => $fetch<Kl10Current>('/api/lottery/kl10/current'),
  [LOTTERY.KL8.id]: () => $fetch<Kl8Current>('/api/lottery/kl8/current'),
  [LOTTERY.FC3D.id]: () => $fetch<Fc3dCurrent>('/api/lottery/fc3d/current'),
  [LOTTERY.PL3.id]: () => $fetch<Pl3Current>('/api/lottery/pl3/current'),
  [LOTTERY.DLT.id]: () => $fetch<DltCurrent>('/api/lottery-tw/dlt/current'),
  [LOTTERY.SUPERLOTTO.id]: () => $fetch<SuperlottoCurrent>('/api/lottery-tw/superlotto/current'),
  [LOTTERY.D539.id]: () => $fetch<D539Current>('/api/lottery-tw/d539/current'),
  [LOTTERY.M649.id]: () => $fetch<M649Current>('/api/lottery-tw/m649/current'),
  [LOTTERY.M539.id]: () => $fetch<M539Current>('/api/lottery-tw/m539/current'),
  [LOTTERY.P3.id]: () => $fetch<P3Current>('/api/lottery-tw/p3/current'),
  [LOTTERY.P4.id]: () => $fetch<P4Current>('/api/lottery-tw/p4/current'),
  [LOTTERY.BINGO.id]: () => $fetch<BingoCurrent>('/api/lottery-tw/bingo/current'),
}

export const api = {
  system: {
    servTime: () => $fetch<{ serverTime: number }>('/api/servTime')
  },
  auth: {
    me: () => $fetch<{ user: AuthUser }>('/api/me'),
    login: (payload: { email: string; password: string }) =>
      $fetch<{ user: AuthUser }>('/api/login', {
        method: 'POST',
        body: payload
      }),
    logout: () =>
      $fetch('/api/logout', {
        method: 'POST'
      })
  },
  admin: {
    me: () => $fetch<{ isAdmin: boolean; isDemo: boolean; user: AuthUser }>('/api/admin/me'),
    roles: () =>
      $fetch<{ users: AdminAccessUser[]; admins: Array<{ id: string; name: string; email: string }> }>(
        '/api/admin/roles'
      ),
    setRole: (id: string, role: UserRole) =>
      $fetch<{ user: AdminAccessUser }>(`/api/admin/roles/${id}`, {
        method: 'PATCH',
        body: { role }
      }),
    roleDefs: () => $fetch<{ roles: RoleDef[] }>('/api/admin/role-defs'),
    createRoleDef: (name: string) =>
      $fetch<{ role: RoleDef }>('/api/admin/role-defs', {
        method: 'POST',
        body: { name }
      }),
    deleteRoleDef: (id: string) =>
      $fetch<{ ok: boolean }>(`/api/admin/role-defs/${id}`, {
        method: 'DELETE'
      }),
    setRoleSettings: (id: string, patch: {
      testMode?: boolean
      npcMode?: boolean
      demoMode?: boolean
      dailyCoinReward?: { enabled?: boolean; amount?: number }
    }) =>
      $fetch<{ role: RoleDef }>(`/api/admin/role-defs/${id}/settings`, {
        method: 'PATCH',
        body: patch
      }),
    /** 遊戲管理總閘：兩分類全部項目的全域開關狀態（見 /admin/roles「遊戲列表」） */
    gameCatalog: () => $fetch<{ games: RoleGamePerm[] }>('/api/admin/games'),
    /** 切換遊戲管理總閘：關閉後不分角色全站都看不到 */
    setGameEnabled: (category: GameCategory, key: string, enabled: boolean) =>
      $fetch<{ games: RoleGamePerm[] }>('/api/admin/games', {
        method: 'PATCH',
        body: { category, key, enabled }
      }),
    roleGames: (roleId: string) =>
      $fetch<{ games: RoleGamePerm[] }>(`/api/admin/role-defs/${roleId}/games`),
    setRoleGame: (roleId: string, category: GameCategory, key: string, enabled: boolean) =>
      $fetch<{ games: RoleGamePerm[] }>(`/api/admin/role-defs/${roleId}/games`, {
        method: 'PATCH',
        body: { category, key, enabled }
      }),
    createMember: (payload: { name: string; email: string; password: string; role?: UserRole }) =>
      $fetch<{ user: AdminAccessUser }>('/api/admin/members', {
        method: 'POST',
        body: payload
      }),
    setMemberPassword: (id: string, password: string) =>
      $fetch<{ user: AdminAccessUser }>(`/api/admin/members/${id}`, {
        method: 'PATCH',
        body: { password }
      }),
    setMemberEmail: (id: string, email: string) =>
      $fetch<{ user: AdminAccessUser }>(`/api/admin/members/${id}`, {
        method: 'PATCH',
        body: { email }
      }),
    adjustMemberCoin: (id: string, coinDelta: number) =>
      $fetch<{ user: AdminAccessUser }>(`/api/admin/members/${id}`, {
        method: 'PATCH',
        body: { coinDelta }
      }),
    memberBalanceChanges: (id: string) =>
      $fetch<{ changes: AdminMemberBalanceChange[] }>(`/api/admin/members/${id}/balance-changes`),
    memberLoginHistory: (id: string) =>
      $fetch<{ logins: AdminMemberLoginRecord[] }>(`/api/admin/members/${id}/login-history`),
    games: {
      updateRetroRates: (key: RetroGameKey, payload: { coinRate: number; coinCapPerRun: number; coinDailyCap: number }) =>
        $fetch<RetroGameRateInfo>(`/api/admin/games/retro/${key}/rates`, { method: 'PUT', body: payload }),
      addMazeTemplate: (payload: { name: string; rows: string[] }) =>
        $fetch<{ template: MazeTemplate }>('/api/admin/games/pacman/maze-templates', { method: 'POST', body: payload }),
      removeMazeTemplate: (id: string) =>
        $fetch<{ ok: boolean }>(`/api/admin/games/pacman/maze-templates/${id}`, { method: 'DELETE' }),
      /** 玩家遊戲紀錄與 coin 兌換查詢，見 design.md Decision 5 */
      playerHistory: (userId: string) =>
        $fetch<{ records: GameHistoryRecord[]; balanceChanges: Array<{ id: string; gameKey: string; amount: number; note: string; createdAt: number }> }>(
          '/api/admin/games/history',
          { query: { userId } }
        )
    },
    bgLottery: {
      poolAudit: (params?: { lotteryKey?: string; range?: '7d' | '30d' | 'all' }) =>
        $fetch<BgPoolAuditResponse>('/api/admin/bg-lottery/pool-audit', { query: params })
    },
    toyShop: {
      settings: () => $fetch<ToyShopSettings>('/api/admin/toy-shop/settings'),
      setEnabled: (enabled: boolean) =>
        $fetch<{ enabled: boolean }>('/api/admin/toy-shop/settings', { method: 'PATCH', body: { enabled } }),
      setOdds: (slug: string, input: { multiplier: number; difficulty: number }) =>
        $fetch<ToyShopOddsItem>(`/api/admin/toy-shop/odds/${slug}`, { method: 'PUT', body: input }),
      setGameEnabled: (slug: string, enabled: boolean) =>
        $fetch<ToyShopOddsItem>(`/api/admin/toy-shop/games/${slug}`, { method: 'PATCH', body: { enabled } })
    },
    npc: {
      settings: () => $fetch<NpcSettings>('/api/admin/npc/settings'),
      updateSettings: (input: { enabled?: boolean; schedule?: Partial<NpcSchedule> }) =>
        $fetch<{ enabled: boolean; schedule: NpcSchedule }>('/api/admin/npc/settings', { method: 'PATCH', body: input }),
      setMemberSetting: (userId: string, input: {
        dailyMaxSpend?: number
        topUpAmount?: number
        retroScoreMinPct?: number
        retroScoreMaxPct?: number
        bgWeight?: number
        retroWeight?: number
        twWeight?: number
        toysWeight?: number
        bgBetAmountMin?: number
        bgBetAmountMax?: number
        activeTimeSlots?: string[]
        actionIntervalSec?: number
        actionJitterChancePct?: number
        actionJitterMaxSec?: number
      }) =>
        $fetch<{
          dailyMaxSpend: number
          topUpAmount: number
          retroScoreMinPct: number
          retroScoreMaxPct: number
          bgWeight: number
          retroWeight: number
          twWeight: number
          toysWeight: number
          bgBetAmountMin: number
          bgBetAmountMax: number
          activeTimeSlots: string[]
          actionIntervalSec: number
          actionJitterChancePct: number
          actionJitterMaxSec: number
        }>(`/api/admin/npc/members/${userId}/settings`, { method: 'PATCH', body: input }),
      setMemberGameAllowed: (userId: string, category: NpcGameCategory, key: string, allowed: boolean) =>
        $fetch<{ allowedGames: string[] }>(`/api/admin/npc/members/${userId}/games/${category}/${key}`, { method: 'PUT', body: { allowed } }),
      setMemberGamesBulk: (userId: string, category: NpcGameCategory, allowed: boolean) =>
        $fetch<{ allowedGames: string[] }>(`/api/admin/npc/members/${userId}/games/bulk`, { method: 'PUT', body: { category, allowed } }),
      saveGamePreset: (name: string, allowedGames: string[]) =>
        $fetch<NpcGamePreset>('/api/admin/npc/game-presets', { method: 'POST', body: { name, allowedGames } }),
      deleteGamePreset: (id: string) =>
        $fetch<{ ok: boolean }>(`/api/admin/npc/game-presets/${id}`, { method: 'DELETE' }),
      applyGamePreset: (userId: string, presetId: string) =>
        $fetch<{ allowedGames: string[] }>(`/api/admin/npc/members/${userId}/games/apply-preset`, { method: 'PUT', body: { presetId } }),
      setNameWords: (words: string[]) =>
        $fetch<{ nameWords: string[] }>('/api/admin/npc/name-words', { method: 'PATCH', body: { words } }),
      autoCreateMember: () =>
        $fetch<{ user: AdminAccessUser }>('/api/admin/npc/members/auto-create', { method: 'POST' }),
      /**
       * 查詢所有 NPC 活動日誌
       * @param params.memberId 篩選特定 NPC（可選）
       * @param params.types 逗號分隔的異動類型（可選）
       * @param params.cursor 分頁 cursor（可選）
       * @returns { entries: NpcActivityLogEntry[], nextCursor: string | null }
       */
      /**
       * 對指定 NPC 的全部勾選遊戲各測試執行一局
       * @param userId NPC 會員 id
       * @returns { results: NpcTestPlayResultItem[] }
       */
      testPlayAll: (userId: string) =>
        $fetch<{ results: NpcTestPlayResultItem[] }>(`/api/admin/npc/members/${userId}/test-play`, { method: 'POST' }),
      listActivityLog: (params?: { memberId?: string; types?: string; cursor?: string }) => {
        const query = new URLSearchParams()
        if (params?.memberId) query.set('memberId', params.memberId)
        if (params?.types) query.set('types', params.types)
        if (params?.cursor) query.set('cursor', params.cursor)
        const qs = query.toString()
        return $fetch<{ entries: NpcActivityLogEntry[]; nextCursor: string | null }>(
          `/api/admin/npc/activity-log${qs ? `?${qs}` : ''}`
        )
      }
    },
    reports: {
      /**
       * BG 彩票月度統計
       * @param month YYYY-MM
       */
      bgSummary: (month: string) =>
        $fetch<BgReportSummary>('/api/admin/reports/bg-summary', { query: { month } }),
      fCoinSummary: (month: string) =>
        $fetch<FcoinSummary>('/api/admin/reports/fcoin-summary', { query: { month } }),
      /**
       * 台彩鏡射玩法（彩運來）中獎派彩月報
       * @param month YYYY-MM
       */
      twLotteryPayout: (month: string) =>
        $fetch<TwLotteryPayoutSummary>('/api/admin/reports/tw-lottery-payout', { query: { month } }),
      /**
       * 會員月度玩法人數分佈（BG／TW／GAME 三分類，各玩法不重複人數排行）
       * @param month YYYY-MM
       */
      memberSummary: (month: string) =>
        $fetch<MemberSummary>('/api/admin/reports/members', { query: { month } }),
    },
    chat: {
      listSchedules: () => $fetch<{ schedules: ChatSchedule[] }>('/api/admin/chat/schedules'),
      addSchedule: (payload: {
        text: string
        repeat: ChatScheduleRepeat
        time?: string
        intervalSeconds?: number
      }) =>
        $fetch<{ schedule: ChatSchedule }>('/api/admin/chat/schedules', { method: 'POST', body: payload }),
      removeSchedule: (id: string) =>
        $fetch<{ ok: boolean }>(`/api/admin/chat/schedules/${id}`, { method: 'DELETE' }),
      setScheduleEnabled: (id: string, enabled: boolean) =>
        $fetch<{ schedule: ChatSchedule }>(`/api/admin/chat/schedules/${id}`, {
          method: 'PATCH',
          body: { enabled }
        })
    }
  },
  lottery: {
    /**
     * 依彩種 id 取當期資訊，找不到對應彩種回傳 null。
     * 新增彩種請在 `LOTTERY_CURRENT_REGISTRY` 加一行，不要改這裡。
     * @param lotteryId LOTTERY[xxx].id
     * @returns Promise<AnyCurrent> | null
     */
    currentInfo: (lotteryId: string | number): Promise<AnyCurrent> | null => {
      const fn = LOTTERY_CURRENT_REGISTRY[Number(lotteryId)]
      return fn ? fn() : null
    },
    current6hcCd: () => $fetch<Lottery6hcCurrent>('/api/lottery/6hc-cd/current'),
    current6hcOf: () => $fetch<Lottery6hcCurrent>('/api/lottery/6hc-of/current'),
    jackpot6hcOf: () => $fetch<{ issue: string; currentIssueJackpot: number; carryJackpot: number; jackpotBase: number; jackpotBaseSetAt: number }>('/api/lottery/6hc-of/jackpot', { timeout: 3000 }),
    jackpot6hcCd: () => $fetch<Lottery6hcCdJackpot>('/api/lottery/6hc-cd/jackpot', { timeout: 3000 }),
    road6hcOf: () => $fetch<{ plays: Lottery6hcRoadPlay[] }>('/api/lottery/6hc-of/road'),
    road6hcCd: () => $fetch<{ plays: Lottery6hcRoadPlay[] }>('/api/lottery/6hc-cd/road'),
    openCodeHistory6hcOf: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/6hc-of/opencode-history'),
    openCodeHistory6hcCd: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/6hc-cd/opencode-history'),
    userRecord6hcOf: () => $fetch<LotteryUserRecordResponse>('/api/lottery/6hc-of/user-record'),
    userRecord6hcCd: () => $fetch<LotteryUserRecordResponse>('/api/lottery/6hc-cd/user-record'),
    claimOneIssue6hcOf: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/6hc-of/claim', {
        method: 'POST'
      }),
    claimOneIssue6hcCd: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/6hc-cd/claim', {
        method: 'POST'
      }),
    // ── 快3（K3-CD / K3-OF 共用開獎號與彩池，兩支 current 回的 pool 是同一份）──
    currentK3Cd: () => $fetch<K3Current>('/api/lottery/k3-cd/current'),
    currentK3Of: () => $fetch<K3Current>('/api/lottery/k3-of/current'),
    openCodeHistoryK3Cd: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/k3-cd/opencode-history'),
    openCodeHistoryK3Of: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/k3-of/opencode-history'),
    userRecordK3Cd: () => $fetch<K3UserRecordResponse>('/api/lottery/k3-cd/user-record'),
    userRecordK3Of: () => $fetch<K3UserRecordResponse>('/api/lottery/k3-of/user-record'),
    claimOneIssueK3Cd: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/k3-cd/claim', { method: 'POST' }),
    claimOneIssueK3Of: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/k3-of/claim', { method: 'POST' }),
    /** 信用盤爆池（與 current 回的 pool 是兩個不同的池） */
    jackpotK3Cd: () => $fetch<CreditJackpotState>('/api/lottery/k3-cd/jackpot', { timeout: 3000 }),
    jackpotK3Of: () => $fetch<CreditJackpotState>('/api/lottery/k3-of/jackpot', { timeout: 3000 }),
    /** 共用彩池（K3-CD 與 K3-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolK3Of: () => $fetch<SharedPoolState>('/api/lottery/k3-of/pool', { timeout: 3000 }),
    // ── PK10（PK10-CD / PK10-OF 共用開獎號與彩池，兩支 current 回的 pool 是同一份）──
    currentPk10Cd: () => $fetch<Pk10Current>('/api/lottery/pk10-cd/current'),
    currentPk10Of: () => $fetch<Pk10Current>('/api/lottery/pk10-of/current'),
    openCodeHistoryPk10Cd: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/pk10-cd/opencode-history'),
    openCodeHistoryPk10Of: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/pk10-of/opencode-history'),
    userRecordPk10Cd: () => $fetch<Pk10UserRecordResponse>('/api/lottery/pk10-cd/user-record'),
    userRecordPk10Of: () => $fetch<Pk10UserRecordResponse>('/api/lottery/pk10-of/user-record'),
    claimOneIssuePk10Cd: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/pk10-cd/claim', { method: 'POST' }),
    claimOneIssuePk10Of: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/pk10-of/claim', { method: 'POST' }),
    /** 信用盤爆池（與 current 回的 pool 是兩個不同的池） */
    jackpotPk10Cd: () => $fetch<CreditJackpotState>('/api/lottery/pk10-cd/jackpot', { timeout: 3000 }),
    jackpotPk10Of: () => $fetch<CreditJackpotState>('/api/lottery/pk10-of/jackpot', { timeout: 3000 }),
    /** 共用彩池（PK10-CD 與 PK10-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolPk10Of: () => $fetch<SharedPoolState>('/api/lottery/pk10-of/pool', { timeout: 3000 }),
    // ── 時時彩（SSC-CD / SSC-OF 共用開獎號與彩池，兩支 current 回的 pool 是同一份）──
    currentSscCd: () => $fetch<SscCurrent>('/api/lottery/ssc-cd/current'),
    currentSscOf: () => $fetch<SscCurrent>('/api/lottery/ssc-of/current'),
    openCodeHistorySscCd: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/ssc-cd/opencode-history'),
    openCodeHistorySscOf: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/ssc-of/opencode-history'),
    userRecordSscCd: () => $fetch<SscUserRecordResponse>('/api/lottery/ssc-cd/user-record'),
    userRecordSscOf: () => $fetch<SscUserRecordResponse>('/api/lottery/ssc-of/user-record'),
    claimOneIssueSscCd: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/ssc-cd/claim', { method: 'POST' }),
    claimOneIssueSscOf: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/ssc-of/claim', { method: 'POST' }),
    /** 信用盤爆池（與 current 回的 pool 是兩個不同的池） */
    jackpotSscCd: () => $fetch<CreditJackpotState>('/api/lottery/ssc-cd/jackpot', { timeout: 3000 }),
    jackpotSscOf: () => $fetch<CreditJackpotState>('/api/lottery/ssc-of/jackpot', { timeout: 3000 }),
    /** 共用彩池（SSC-CD 與 SSC-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolSscOf: () => $fetch<SharedPoolState>('/api/lottery/ssc-of/pool', { timeout: 3000 }),
    // ── 11選5（X5-CD / X5-OF 共用開獎號與彩池，兩支 current 回的 pool 是同一份）──
    currentX5Cd: () => $fetch<X5Current>('/api/lottery/x5-cd/current'),
    currentX5Of: () => $fetch<X5Current>('/api/lottery/x5-of/current'),
    openCodeHistoryX5Cd: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/x5-cd/opencode-history'),
    openCodeHistoryX5Of: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/x5-of/opencode-history'),
    userRecordX5Cd: () => $fetch<X5UserRecordResponse>('/api/lottery/x5-cd/user-record'),
    userRecordX5Of: () => $fetch<X5UserRecordResponse>('/api/lottery/x5-of/user-record'),
    claimOneIssueX5Cd: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/x5-cd/claim', { method: 'POST' }),
    claimOneIssueX5Of: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/x5-of/claim', { method: 'POST' }),
    /** 爆池（與 current 回的 pool 是兩個不同的池；兩個盤口共吃這一池，兩支路由回同一份） */
    jackpotX5Cd: () => $fetch<CreditJackpotState>('/api/lottery/x5-cd/jackpot', { timeout: 3000 }),
    jackpotX5Of: () => $fetch<CreditJackpotState>('/api/lottery/x5-of/jackpot', { timeout: 3000 }),
    /** 共用彩池（X5-CD 與 X5-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolX5Of: () => $fetch<SharedPoolState>('/api/lottery/x5-of/pool', { timeout: 3000 }),
    // ── PC蛋蛋（只有信用盤，來源本身無官方盤）──
    currentEggs: () => $fetch<EggsCurrent>('/api/lottery/eggs/current'),
    openCodeHistoryEggs: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/eggs/opencode-history'),
    userRecordEggs: () => $fetch<EggsUserRecordResponse>('/api/lottery/eggs/user-record'),
    claimOneIssueEggs: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/eggs/claim', { method: 'POST' }),
    /** 爆池（PC蛋蛋沒有官方盤共用彩池，這是它唯一的池） */
    jackpotEggs: () => $fetch<CreditJackpotState>('/api/lottery/eggs/jackpot', { timeout: 3000 }),
    /** 彩池玩法（選號）狀態，與上面的爆池是兩個獨立的池 */
    poolEggs: () => $fetch<PoolPlayState>('/api/lottery/eggs/pool', { timeout: 3000 }),
    // ── 快樂十分（只有信用盤，來源本身無官方盤）──
    currentKl10: () => $fetch<Kl10Current>('/api/lottery/kl10/current'),
    openCodeHistoryKl10: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/kl10/opencode-history'),
    userRecordKl10: () => $fetch<Kl10UserRecordResponse>('/api/lottery/kl10/user-record'),
    claimOneIssueKl10: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/kl10/claim', { method: 'POST' }),
    /** 爆池（快樂十分沒有官方盤共用彩池，這是它唯一的池） */
    jackpotKl10: () => $fetch<CreditJackpotState>('/api/lottery/kl10/jackpot', { timeout: 3000 }),
    /** 彩池玩法（選號）狀態，與上面的爆池是兩個獨立的池 */
    poolKl10: () => $fetch<PoolPlayState>('/api/lottery/kl10/pool', { timeout: 3000 }),
    // ── 快樂8（只有信用盤，來源本身無官方盤）──
    currentKl8: () => $fetch<Kl8Current>('/api/lottery/kl8/current'),
    openCodeHistoryKl8: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/kl8/opencode-history'),
    userRecordKl8: () => $fetch<Kl8UserRecordResponse>('/api/lottery/kl8/user-record'),
    claimOneIssueKl8: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/kl8/claim', { method: 'POST' }),
    /** 爆池（快樂8沒有官方盤共用彩池，這是它唯一的池） */
    jackpotKl8: () => $fetch<CreditJackpotState>('/api/lottery/kl8/jackpot', { timeout: 3000 }),
    /** 彩池玩法（選號）狀態，與上面的爆池是兩個獨立的池 */
    poolKl8: () => $fetch<PoolPlayState>('/api/lottery/kl8/pool', { timeout: 3000 }),
    // ── 福彩3D（只有官方盤，來源本身無信用盤；三星直選改吃分層彩池，全站另有開豹子爆池）──
    currentFc3d: () => $fetch<Fc3dCurrent>('/api/lottery/fc3d/current'),
    openCodeHistoryFc3d: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/fc3d/opencode-history'),
    userRecordFc3d: () => $fetch<Fc3dUserRecordResponse>('/api/lottery/fc3d/user-record'),
    claimOneIssueFc3d: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/fc3d/claim', { method: 'POST' }),
    /** 全站爆池（開出豹子觸發） */
    jackpotFc3d: () => $fetch<CreditJackpotState>('/api/lottery/fc3d/jackpot', { timeout: 3000 }),
    /** 三星直選分層彩池狀態，與上面的爆池是兩個獨立的池 */
    poolFc3d: () => $fetch<PoolPlayState>('/api/lottery/fc3d/pool', { timeout: 3000 }),
    // ── 排列3（只有官方盤，玩法結構與福彩3D相同，來源本身無信用盤）──
    currentPl3: () => $fetch<Pl3Current>('/api/lottery/pl3/current'),
    openCodeHistoryPl3: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/pl3/opencode-history'),
    userRecordPl3: () => $fetch<Pl3UserRecordResponse>('/api/lottery/pl3/user-record'),
    claimOneIssuePl3: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/pl3/claim', { method: 'POST' }),
    /** 全站爆池（開出豹子觸發） */
    jackpotPl3: () => $fetch<CreditJackpotState>('/api/lottery/pl3/jackpot', { timeout: 3000 }),
    /** 三星直選分層彩池狀態，與上面的爆池是兩個獨立的池 */
    poolPl3: () => $fetch<PoolPlayState>('/api/lottery/pl3/pool', { timeout: 3000 }),
    // ── 大樂透（DLT，tw 分類、完全鏡射官方，路由在 lottery-tw/dlt 而非 lottery/**）──
    currentDlt: () => $fetch<DltCurrent>('/api/lottery-tw/dlt/current'),
    openCodeHistoryDlt: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/dlt/opencode-history'),
    userRecordDlt: () => $fetch<DltUserRecordResponse>('/api/lottery-tw/dlt/user-record'),
    claimOneIssueDlt: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/dlt/claim', { method: 'POST' }),
    // ── 威力彩（SUPERLOTTO，tw 分類、完全鏡射官方，路由在 lottery-tw/superlotto；兩區選號、
    //    第一區 01–38 選 6＋第二區 01–08 選 1，開獎號 7 碼）──
    currentSuperlotto: () => $fetch<SuperlottoCurrent>('/api/lottery-tw/superlotto/current'),
    openCodeHistorySuperlotto: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/superlotto/opencode-history'),
    userRecordSuperlotto: () => $fetch<SuperlottoUserRecordResponse>('/api/lottery-tw/superlotto/user-record'),
    claimOneIssueSuperlotto: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/superlotto/claim', { method: 'POST' }),
    // ── 今彩539（D539，tw 分類、完全鏡射官方，路由在 lottery-tw/d539；一期 5 碼、無特別號）──
    currentD539: () => $fetch<D539Current>('/api/lottery-tw/d539/current'),
    openCodeHistoryD539: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/d539/opencode-history'),
    userRecordD539: () => $fetch<D539UserRecordResponse>('/api/lottery-tw/d539/user-record'),
    claimOneIssueD539: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/d539/claim', { method: 'POST' }),
    // ── 49樂合彩（M649，tw 分類、完全鏡射官方，路由在 lottery-tw/m649；跟隨大樂透開獎號，
    //    但獨立呼叫官方 API，不依賴 DLT 的 service 或內部狀態）──
    currentM649: () => $fetch<M649Current>('/api/lottery-tw/m649/current'),
    openCodeHistoryM649: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/m649/opencode-history'),
    userRecordM649: () => $fetch<M649UserRecordResponse>('/api/lottery-tw/m649/user-record'),
    claimOneIssueM649: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/m649/claim', { method: 'POST' }),
    // ── 39樂合彩（M539，tw 分類、完全鏡射官方，路由在 lottery-tw/m539；跟隨今彩539開獎號，
    //    但獨立呼叫官方 gameCode 5120 的 API，不依賴 D539／M649 的 service 或內部狀態）──
    currentM539: () => $fetch<M539Current>('/api/lottery-tw/m539/current'),
    openCodeHistoryM539: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/m539/opencode-history'),
    userRecordM539: () => $fetch<M539UserRecordResponse>('/api/lottery-tw/m539/user-record'),
    claimOneIssueM539: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/m539/claim', { method: 'POST' }),
    // ── 3星彩（P3，tw 分類、完全鏡射官方，路由在 lottery-tw/p3；正彩/組彩鏡射官方 gameCode 2108
    //    API，前二/後二對彩為本站新增的固定獎金規則，不查官方，見 add-tw-lottery-suite/design.md Decision 5）──
    currentP3: () => $fetch<P3Current>('/api/lottery-tw/p3/current'),
    openCodeHistoryP3: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/p3/opencode-history'),
    userRecordP3: () => $fetch<P3UserRecordResponse>('/api/lottery-tw/p3/user-record'),
    claimOneIssueP3: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/p3/claim', { method: 'POST' }),
    // ── 4星彩（P4，tw 分類、完全鏡射官方，路由在 lottery-tw/p4；正彩/組彩鏡射官方 gameCode 2109
    //    API，官方沒有對彩玩法，見 add-tw-lottery-suite/design.md Decision 5）──
    currentP4: () => $fetch<P4Current>('/api/lottery-tw/p4/current'),
    openCodeHistoryP4: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery-tw/p4/opencode-history'),
    userRecordP4: () => $fetch<P4UserRecordResponse>('/api/lottery-tw/p4/user-record'),
    claimOneIssueP4: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/p4/claim', { method: 'POST' }),
    // ── 賓果賓果（BINGO，tw 分類、開獎號碼鏡射官方 gameCode 1102，賠率為官方公開固定金額，
    //    見 add-tw-lottery-suite/design.md Decision 6；架構跟其餘 7 款玩法差異最大，每 5 分鐘
    //    連續開一期）──
    currentBingo: () => $fetch<BingoCurrent>('/api/lottery-tw/bingo/current'),
    openCodeHistoryBingo: () => $fetch<BingoOpenCodeHistoryResponse>('/api/lottery-tw/bingo/opencode-history'),
    userRecordBingo: () => $fetch<BingoUserRecordResponse>('/api/lottery-tw/bingo/user-record'),
    claimOneIssueBingo: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery-tw/bingo/claim', { method: 'POST' }),
    userInfo: (lottery?: string) =>
      $fetch<LotteryState>('/api/lottery/userInfo', lottery ? { query: { lottery } } : undefined),
    bet: (payload: LotteryBetPayload) =>
      $fetch<LotteryBetResponse>('/api/lottery/bet', {
        method: 'POST',
        body: payload
      })
  },
  taiwanLottery: {
    lastNumber: () =>
      $fetch<{ updatedAt: string; results: TaiwanLotteryResult[] }>('/api/lottery-tw/last-number'),
    prize: (gameCode: number, period: string) =>
      $fetch<TaiwanLotteryPrizeResponse>('/api/lottery-tw/prize', { query: { gameCode, period } })
  },
  games: {
    /** 目前登入者的角色被關閉的遊戲／盤口（見 add-role-game-perms） */
    access: () => $fetch<{ disabled: Array<{ category: GameCategory; key: string }> }>('/api/games/access'),
    toys: {
      catalog: () => $fetch<ToyCatalogResponse>('/api/games/toys/catalog'),
      pool: () => $fetch<ToyLuckyDrawView>('/api/games/toys/pool'),
      rollLuckyDraw: (payload: ToyLuckyDrawRollPayload) =>
        $fetch<ToyLuckyDrawView>('/api/games/toys/lucky-draw/roll', { method: 'POST', body: payload }),
      cardsState: () => $fetch<ToyCardsView>('/api/games/toys/cards/state'),
      rollCards: (payload: ToyCardsRollPayload) =>
        $fetch<ToyCardsView>('/api/games/toys/cards/roll', { method: 'POST', body: payload }),
      sodaState: () => $fetch<ToySodaView>('/api/games/toys/soda-whistle/state'),
      rollSoda: (payload: ToySodaRollPayload) =>
        $fetch<ToySodaView>('/api/games/toys/soda-whistle/roll', { method: 'POST', body: payload }),
      bambooState: () => $fetch<ToyBambooView>('/api/games/toys/bamboo-copter/state'),
      rollBamboo: (payload: { bet: number; target: ToyBambooTarget }) =>
        $fetch<ToyBambooView>('/api/games/toys/bamboo-copter/roll', { method: 'POST', body: payload }),
      gummyState: () => $fetch<ToyGummyView>('/api/games/toys/gummy/state'),
      rollGummy: (payload: ToyGummyRollPayload) =>
        $fetch<ToyGummyView>('/api/games/toys/gummy/roll', { method: 'POST', body: payload }),
      bigPigState: () => $fetch<ToyBigPigView>('/api/games/toys/big-pig/state'),
      rollBigPig: (payload: { bet: number }) =>
        $fetch<ToyBigPigView>('/api/games/toys/big-pig/roll', { method: 'POST', body: payload }),
      whistleState: () => $fetch<ToyWhistleView>('/api/games/toys/whistle-candy/state'),
      rollWhistle: (payload: { bet: number; choice: ToyWhistleChoice }) =>
        $fetch<ToyWhistleView>('/api/games/toys/whistle-candy/roll', { method: 'POST', body: payload }),
      pogState: () => $fetch<ToyPogView>('/api/games/toys/pog/state'),
      rollPog: (payload: { action: 'start' | 'play'; bet?: number; cardId?: string }) =>
        $fetch<ToyPogView>('/api/games/toys/pog/roll', { method: 'POST', body: payload }),
      history: () => $fetch<{ records: ToyHistoryRecord[] }>('/api/games/toys/history')
    },
    retro: {
      historySnake: () => $fetch<GameHistoryListResponse>('/api/games/retro/snake/history'),
      recordSnake: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/snake/history', { method: 'POST', body: payload }),
      clearSnake: () => $fetch<{ ok: boolean }>('/api/games/retro/snake/history', { method: 'DELETE' }),

      historyRacing: () => $fetch<GameHistoryListResponse>('/api/games/retro/racing/history'),
      recordRacing: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/racing/history', { method: 'POST', body: payload }),
      clearRacing: () => $fetch<{ ok: boolean }>('/api/games/retro/racing/history', { method: 'DELETE' }),

      historyTetriminos: () => $fetch<GameHistoryListResponse>('/api/games/retro/tetriminos/history'),
      recordTetriminos: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/tetriminos/history', { method: 'POST', body: payload }),
      clearTetriminos: () => $fetch<{ ok: boolean }>('/api/games/retro/tetriminos/history', { method: 'DELETE' }),

      historyMatch3Rush: () => $fetch<GameHistoryListResponse>('/api/games/retro/match3rush/history'),
      recordMatch3Rush: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/match3rush/history', { method: 'POST', body: payload }),
      clearMatch3Rush: () => $fetch<{ ok: boolean }>('/api/games/retro/match3rush/history', { method: 'DELETE' }),

      historyMatch3Classic: () => $fetch<GameHistoryListResponse>('/api/games/retro/match3classic/history'),
      recordMatch3Classic: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/match3classic/history', { method: 'POST', body: payload }),
      clearMatch3Classic: () => $fetch<{ ok: boolean }>('/api/games/retro/match3classic/history', { method: 'DELETE' }),

      historyPong: () => $fetch<GameHistoryListResponse>('/api/games/retro/pong/history'),
      recordPong: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/pong/history', { method: 'POST', body: payload }),
      clearPong: () => $fetch<{ ok: boolean }>('/api/games/retro/pong/history', { method: 'DELETE' }),

      historyRunner: () => $fetch<GameHistoryListResponse>('/api/games/retro/runner/history'),
      recordRunner: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/runner/history', { method: 'POST', body: payload }),
      clearRunner: () => $fetch<{ ok: boolean }>('/api/games/retro/runner/history', { method: 'DELETE' }),

      historySpaceShooter: () => $fetch<GameHistoryListResponse>('/api/games/retro/space-shooter/history'),
      recordSpaceShooter: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/space-shooter/history', { method: 'POST', body: payload }),
      clearSpaceShooter: () => $fetch<{ ok: boolean }>('/api/games/retro/space-shooter/history', { method: 'DELETE' }),

      historyMinesweeper: () => $fetch<GameHistoryListResponse>('/api/games/retro/minesweeper/history'),
      recordMinesweeper: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/minesweeper/history', { method: 'POST', body: payload }),
      clearMinesweeper: () => $fetch<{ ok: boolean }>('/api/games/retro/minesweeper/history', { method: 'DELETE' }),

      historyPacMan: () => $fetch<GameHistoryListResponse>('/api/games/retro/pac-man/history'),
      recordPacMan: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/pac-man/history', { method: 'POST', body: payload }),
      clearPacMan: () => $fetch<{ ok: boolean }>('/api/games/retro/pac-man/history', { method: 'DELETE' }),

      historySpaceInvaders: () => $fetch<GameHistoryListResponse>('/api/games/retro/space-invaders/history'),
      recordSpaceInvaders: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/space-invaders/history', { method: 'POST', body: payload }),
      clearSpaceInvaders: () => $fetch<{ ok: boolean }>('/api/games/retro/space-invaders/history', { method: 'DELETE' }),

      historySolitaire: () => $fetch<GameHistoryListResponse>('/api/games/retro/solitaire/history'),
      recordSolitaire: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/solitaire/history', { method: 'POST', body: payload }),
      clearSolitaire: () => $fetch<{ ok: boolean }>('/api/games/retro/solitaire/history', { method: 'DELETE' }),

      historyTyping: () => $fetch<GameHistoryListResponse>('/api/games/retro/typing/history'),
      recordTyping: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/typing/history', { method: 'POST', body: payload }),
      clearTyping: () => $fetch<{ ok: boolean }>('/api/games/retro/typing/history', { method: 'DELETE' }),

      historyBreakout: () => $fetch<GameHistoryListResponse>('/api/games/retro/breakout/history'),
      recordBreakout: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/breakout/history', { method: 'POST', body: payload }),
      clearBreakout: () => $fetch<{ ok: boolean }>('/api/games/retro/breakout/history', { method: 'DELETE' }),

      historyOrbMatch: () => $fetch<GameHistoryListResponse>('/api/games/retro/orb-match/history'),
      recordOrbMatch: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/orb-match/history', { method: 'POST', body: payload }),
      clearOrbMatch: () => $fetch<{ ok: boolean }>('/api/games/retro/orb-match/history', { method: 'DELETE' }),

      historyBattleship: () => $fetch<GameHistoryListResponse>('/api/games/retro/battleship/history'),
      recordBattleship: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/battleship/history', { method: 'POST', body: payload }),
      clearBattleship: () => $fetch<{ ok: boolean }>('/api/games/retro/battleship/history', { method: 'DELETE' }),

      history2048: () => $fetch<GameHistoryListResponse>('/api/games/retro/2048/history'),
      record2048: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/2048/history', { method: 'POST', body: payload }),
      clear2048: () => $fetch<{ ok: boolean }>('/api/games/retro/2048/history', { method: 'DELETE' }),

      historyFlappy: () => $fetch<GameHistoryListResponse>('/api/games/retro/flappy/history'),
      recordFlappy: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/flappy/history', { method: 'POST', body: payload }),
      clearFlappy: () => $fetch<{ ok: boolean }>('/api/games/retro/flappy/history', { method: 'DELETE' }),

      historyFrogger: () => $fetch<GameHistoryListResponse>('/api/games/retro/frogger/history'),
      recordFrogger: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/frogger/history', { method: 'POST', body: payload }),
      clearFrogger: () => $fetch<{ ok: boolean }>('/api/games/retro/frogger/history', { method: 'DELETE' }),

      historyConnect4: () => $fetch<GameHistoryListResponse>('/api/games/retro/connect4/history'),
      recordConnect4: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/connect4/history', { method: 'POST', body: payload }),
      clearConnect4: () => $fetch<{ ok: boolean }>('/api/games/retro/connect4/history', { method: 'DELETE' }),

      historyWhackAMole: () => $fetch<GameHistoryListResponse>('/api/games/retro/whack-a-mole/history'),
      recordWhackAMole: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/whack-a-mole/history', { method: 'POST', body: payload }),
      clearWhackAMole: () => $fetch<{ ok: boolean }>('/api/games/retro/whack-a-mole/history', { method: 'DELETE' }),

      historyLightsOut: () => $fetch<GameHistoryListResponse>('/api/games/retro/lightsOut/history'),
      recordLightsOut: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/lightsOut/history', { method: 'POST', body: payload }),
      clearLightsOut: () => $fetch<{ ok: boolean }>('/api/games/retro/lightsOut/history', { method: 'DELETE' }),

      historyTowerStack: () => $fetch<GameHistoryListResponse>('/api/games/retro/tower-stack/history'),
      recordTowerStack: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/tower-stack/history', { method: 'POST', body: payload }),
      clearTowerStack: () => $fetch<{ ok: boolean }>('/api/games/retro/tower-stack/history', { method: 'DELETE' }),

      historyArkanoid: () => $fetch<GameHistoryListResponse>('/api/games/retro/arkanoid/history'),
      recordArkanoid: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/arkanoid/history', { method: 'POST', body: payload }),
      clearArkanoid: () => $fetch<{ ok: boolean }>('/api/games/retro/arkanoid/history', { method: 'DELETE' }),

      historyTowerDefense: () => $fetch<GameHistoryListResponse>('/api/games/retro/tower-defense/history'),
      recordTowerDefense: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/tower-defense/history', { method: 'POST', body: payload }),
      clearTowerDefense: () => $fetch<{ ok: boolean }>('/api/games/retro/tower-defense/history', { method: 'DELETE' }),

      historyPinball: () => $fetch<GameHistoryListResponse>('/api/games/retro/pinball/history'),
      recordPinball: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/pinball/history', { method: 'POST', body: payload }),
      clearPinball: () => $fetch<{ ok: boolean }>('/api/games/retro/pinball/history', { method: 'DELETE' }),

      historyColorMatch: () => $fetch<GameHistoryListResponse>('/api/games/retro/color-match/history'),
      recordColorMatch: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/color-match/history', { method: 'POST', body: payload }),
      clearColorMatch: () => $fetch<{ ok: boolean }>('/api/games/retro/color-match/history', { method: 'DELETE' }),

      historyMaze: () => $fetch<GameHistoryListResponse>('/api/games/retro/maze/history'),
      recordMaze: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/maze/history', { method: 'POST', body: payload }),
      clearMaze: () => $fetch<{ ok: boolean }>('/api/games/retro/maze/history', { method: 'DELETE' }),

      historyBubbleShooter: () => $fetch<GameHistoryListResponse>('/api/games/retro/bubble-shooter/history'),
      recordBubbleShooter: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/bubble-shooter/history', { method: 'POST', body: payload }),
      clearBubbleShooter: () => $fetch<{ ok: boolean }>('/api/games/retro/bubble-shooter/history', { method: 'DELETE' }),

      historyCutTheRope: () => $fetch<GameHistoryListResponse>('/api/games/retro/cut-the-rope/history'),
      recordCutTheRope: (payload: GameHistoryRecordPayload) =>
        $fetch<GameHistorySettleResponse>('/api/games/retro/cut-the-rope/history', { method: 'POST', body: payload }),
      clearCutTheRope: () => $fetch<{ ok: boolean }>('/api/games/retro/cut-the-rope/history', { method: 'DELETE' }),

      /** 各遊戲全站最高分一筆；混排依該遊戲最近遊玩時間取 5（需登入） */
      leaderboard: () => $fetch<RetroLeaderboardResponse>('/api/games/retro/leaderboard'),

      /** 公開端點，訪客不登入也能查詢——見 server/middleware/auth.ts 的 PUBLIC_GAME_PATHS */
      rates: () => $fetch<RetroGameRatesResponse>('/api/games/retro/rates'),
      /** 公開端點：PAC-MAN 開局要 fetch 這份固定樣板清單混入隨機生成池，見 PUBLIC_GAME_PATHS */
      pacmanMazeTemplates: () => $fetch<{ templates: MazeTemplate[] }>('/api/games/retro/pacman/maze-templates')
    }
  }
}
