import { $fetch } from 'ofetch'
import { LOTTERY } from '~/config/constants'

export type AuthUser = {
  id: string | number
  name: string
  email: string
}

export type LotteryGame = {
  id: number
  key: string
  name: string
  category: '6hc' | 'bg'
  minBet: number
  maxBet: number
  defaultOdds: number
  playTypes: string[]
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
export type RetroGameKey = 'snake' | 'racing' | 'tetriminos' | 'match3rush' | 'match3classic' | 'pong' | 'runner' | 'spaceShooter' | 'minesweeper' | 'pacman' | 'spaceInvaders' | 'solitaire' | 'typing' | 'breakout' | 'orbMatch' | 'battleship' | '2048' | 'flappy' | 'frogger' | 'connect4' | 'whackAMole' | 'lightsOut' | 'towerStack'

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

export type UserRole = 'admin' | 'user'

export type AdminAccessUser = {
  id: string
  name: string
  email: string
  role: UserRole
  coin: number
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
    me: () => $fetch<{ isAdmin: boolean; user: AuthUser }>('/api/admin/me'),
    roles: () =>
      $fetch<{ users: AdminAccessUser[]; admins: Array<{ id: string; name: string; email: string }> }>(
        '/api/admin/roles'
      ),
    setRole: (id: string, role: UserRole) =>
      $fetch<{ user: AdminAccessUser }>(`/api/admin/roles/${id}`, {
        method: 'PATCH',
        body: { role }
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
    currentInfo: (lotteryId: string | number) => {
      const normalizedLotteryId = Number(lotteryId)
      switch (normalizedLotteryId) {
        case LOTTERY['LHC-CD'].id:
          return $fetch<Lottery6hcCurrent>('/api/lottery/6hc-cd/current')
        case LOTTERY['LHC-OF'].id:
          return $fetch<Lottery6hcCurrent>('/api/lottery/6hc-of/current')
        case LOTTERY['K3-CD'].id:
          return $fetch<K3Current>('/api/lottery/k3-cd/current')
        case LOTTERY['K3-OF'].id:
          return $fetch<K3Current>('/api/lottery/k3-of/current')
        case LOTTERY['PK10-CD'].id:
          return $fetch<Pk10Current>('/api/lottery/pk10-cd/current')
        case LOTTERY['PK10-OF'].id:
          return $fetch<Pk10Current>('/api/lottery/pk10-of/current')
        case LOTTERY['SSC-CD'].id:
          return $fetch<SscCurrent>('/api/lottery/ssc-cd/current')
        case LOTTERY['SSC-OF'].id:
          return $fetch<SscCurrent>('/api/lottery/ssc-of/current')
        case LOTTERY['X5-CD'].id:
          return $fetch<X5Current>('/api/lottery/x5-cd/current')
        case LOTTERY['X5-OF'].id:
          return $fetch<X5Current>('/api/lottery/x5-of/current')
        case LOTTERY.EGGS.id:
          return $fetch<EggsCurrent>('/api/lottery/eggs/current')
        case LOTTERY.KL10.id:
          return $fetch<Kl10Current>('/api/lottery/kl10/current')
        case LOTTERY.KL8.id:
          return $fetch<Kl8Current>('/api/lottery/kl8/current')
        case LOTTERY.FC3D.id:
          return $fetch<Fc3dCurrent>('/api/lottery/fc3d/current')
        case LOTTERY.PL3.id:
          return $fetch<Pl3Current>('/api/lottery/pl3/current')
        default:
          return null
      }
    },
    current6hcOf: () => $fetch<Lottery6hcCurrent>('/api/lottery/6hc-of/current'),
    jackpot6hcOf: () => $fetch<{ issue: string; currentIssueJackpot: number; carryJackpot: number; jackpotBase: number; jackpotBaseSetAt: number }>('/api/lottery/6hc-of/jackpot'),
    jackpot6hcCd: () => $fetch<Lottery6hcCdJackpot>('/api/lottery/6hc-cd/jackpot'),
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
    jackpotK3Cd: () => $fetch<CreditJackpotState>('/api/lottery/k3-cd/jackpot'),
    jackpotK3Of: () => $fetch<CreditJackpotState>('/api/lottery/k3-of/jackpot'),
    /** 共用彩池（K3-CD 與 K3-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolK3Of: () => $fetch<SharedPoolState>('/api/lottery/k3-of/pool'),
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
    jackpotPk10Cd: () => $fetch<CreditJackpotState>('/api/lottery/pk10-cd/jackpot'),
    jackpotPk10Of: () => $fetch<CreditJackpotState>('/api/lottery/pk10-of/jackpot'),
    /** 共用彩池（PK10-CD 與 PK10-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolPk10Of: () => $fetch<SharedPoolState>('/api/lottery/pk10-of/pool'),
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
    jackpotSscCd: () => $fetch<CreditJackpotState>('/api/lottery/ssc-cd/jackpot'),
    jackpotSscOf: () => $fetch<CreditJackpotState>('/api/lottery/ssc-of/jackpot'),
    /** 共用彩池（SSC-CD 與 SSC-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolSscOf: () => $fetch<SharedPoolState>('/api/lottery/ssc-of/pool'),
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
    jackpotX5Cd: () => $fetch<CreditJackpotState>('/api/lottery/x5-cd/jackpot'),
    jackpotX5Of: () => $fetch<CreditJackpotState>('/api/lottery/x5-of/jackpot'),
    /** 共用彩池（X5-CD 與 X5-OF 共用同一份），與上面的爆池是兩個獨立的池 */
    poolX5Of: () => $fetch<SharedPoolState>('/api/lottery/x5-of/pool'),
    // ── PC蛋蛋（只有信用盤，來源本身無官方盤）──
    currentEggs: () => $fetch<EggsCurrent>('/api/lottery/eggs/current'),
    openCodeHistoryEggs: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/eggs/opencode-history'),
    userRecordEggs: () => $fetch<EggsUserRecordResponse>('/api/lottery/eggs/user-record'),
    claimOneIssueEggs: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/eggs/claim', { method: 'POST' }),
    /** 爆池（PC蛋蛋沒有官方盤共用彩池，這是它唯一的池） */
    jackpotEggs: () => $fetch<CreditJackpotState>('/api/lottery/eggs/jackpot'),
    /** 彩池玩法（選號）狀態，與上面的爆池是兩個獨立的池 */
    poolEggs: () => $fetch<PoolPlayState>('/api/lottery/eggs/pool'),
    // ── 快樂十分（只有信用盤，來源本身無官方盤）──
    currentKl10: () => $fetch<Kl10Current>('/api/lottery/kl10/current'),
    openCodeHistoryKl10: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/kl10/opencode-history'),
    userRecordKl10: () => $fetch<Kl10UserRecordResponse>('/api/lottery/kl10/user-record'),
    claimOneIssueKl10: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/kl10/claim', { method: 'POST' }),
    /** 爆池（快樂十分沒有官方盤共用彩池，這是它唯一的池） */
    jackpotKl10: () => $fetch<CreditJackpotState>('/api/lottery/kl10/jackpot'),
    /** 彩池玩法（選號）狀態，與上面的爆池是兩個獨立的池 */
    poolKl10: () => $fetch<PoolPlayState>('/api/lottery/kl10/pool'),
    // ── 快樂8（只有信用盤，來源本身無官方盤）──
    currentKl8: () => $fetch<Kl8Current>('/api/lottery/kl8/current'),
    openCodeHistoryKl8: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/kl8/opencode-history'),
    userRecordKl8: () => $fetch<Kl8UserRecordResponse>('/api/lottery/kl8/user-record'),
    claimOneIssueKl8: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/kl8/claim', { method: 'POST' }),
    /** 爆池（快樂8沒有官方盤共用彩池，這是它唯一的池） */
    jackpotKl8: () => $fetch<CreditJackpotState>('/api/lottery/kl8/jackpot'),
    /** 彩池玩法（選號）狀態，與上面的爆池是兩個獨立的池 */
    poolKl8: () => $fetch<PoolPlayState>('/api/lottery/kl8/pool'),
    // ── 福彩3D（只有官方盤，來源本身無信用盤；三星直選改吃分層彩池，全站另有開豹子爆池）──
    currentFc3d: () => $fetch<Fc3dCurrent>('/api/lottery/fc3d/current'),
    openCodeHistoryFc3d: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/fc3d/opencode-history'),
    userRecordFc3d: () => $fetch<Fc3dUserRecordResponse>('/api/lottery/fc3d/user-record'),
    claimOneIssueFc3d: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/fc3d/claim', { method: 'POST' }),
    /** 全站爆池（開出豹子觸發） */
    jackpotFc3d: () => $fetch<CreditJackpotState>('/api/lottery/fc3d/jackpot'),
    /** 三星直選分層彩池狀態，與上面的爆池是兩個獨立的池 */
    poolFc3d: () => $fetch<PoolPlayState>('/api/lottery/fc3d/pool'),
    // ── 排列3（只有官方盤，玩法結構與福彩3D相同，來源本身無信用盤）──
    currentPl3: () => $fetch<Pl3Current>('/api/lottery/pl3/current'),
    openCodeHistoryPl3: () => $fetch<LotteryOpenCodeHistoryResponse>('/api/lottery/pl3/opencode-history'),
    userRecordPl3: () => $fetch<Pl3UserRecordResponse>('/api/lottery/pl3/user-record'),
    claimOneIssuePl3: () =>
      $fetch<LotteryClaimOneIssueResponse>('/api/lottery/pl3/claim', { method: 'POST' }),
    /** 全站爆池（開出豹子觸發） */
    jackpotPl3: () => $fetch<CreditJackpotState>('/api/lottery/pl3/jackpot'),
    /** 三星直選分層彩池狀態，與上面的爆池是兩個獨立的池 */
    poolPl3: () => $fetch<PoolPlayState>('/api/lottery/pl3/pool'),
    games: () => $fetch<{ games: LotteryGame[] }>('/api/lottery/games'),
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
      $fetch<{ updatedAt: string; results: TaiwanLotteryResult[] }>('/api/taiwan-lottery/last-number'),
    prize: (gameCode: number, period: string) =>
      $fetch<TaiwanLotteryPrizeResponse>('/api/taiwan-lottery/prize', { query: { gameCode, period } })
  },
  games: {
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

      /** 各遊戲全站最高分一筆；混排依該遊戲最近遊玩時間取 5（需登入） */
      leaderboard: () => $fetch<RetroLeaderboardResponse>('/api/games/retro/leaderboard'),

      /** 公開端點，訪客不登入也能查詢——見 server/middleware/auth.ts 的 PUBLIC_GAME_PATHS */
      rates: () => $fetch<RetroGameRatesResponse>('/api/games/retro/rates'),
      /** 公開端點：PAC-MAN 開局要 fetch 這份固定樣板清單混入隨機生成池，見 PUBLIC_GAME_PATHS */
      pacmanMazeTemplates: () => $fetch<{ templates: MazeTemplate[] }>('/api/games/retro/pacman/maze-templates')
    }
  }
}
