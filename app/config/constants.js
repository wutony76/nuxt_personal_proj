// 定義 CONSTANTS
export const GAME_6HC_OF = {
  SINGLE: { key: 'SINGLE', name: '自選單式' , sort: 1 },
  DUPLEX: { key: 'DUPLEX', name: '自選複式' , sort: 2 },
  DANTUO: { key: 'DANTUO', name: '自選膽拖' , sort: 3 },
}

export const LOTTERY = {
  '6HC':{ id: 1001, key: '6HC', name: '六合彩', sort: 1 },
  'LHC-CD':{ id: 100100, key: 'LHC-CD', name: '六合彩', sub:"CD", sort: 100 },
  'LHC-OF':{ id: 100101, key: 'LHC-OF', name: '六合彩', sub:'OF', sort: 101 },

  'K3':{ id: 2001, key: 'K3', name: '快3', sort: 2 },
  // 快3 的兩個盤口：CD/OF 共用開獎號與彩池（見 server/services/k3Shared.ts），
  // id 編碼比照 LHC-CD/LHC-OF（玩法 id ×100 + 盤口序號）
  'K3-CD':{ id: 200100, key: 'K3-CD', name: '快3', sub:'CD', sort: 200 },
  'K3-OF':{ id: 200101, key: 'K3-OF', name: '快3', sub:'OF', sort: 201 },

  'PK10':{ id: 3001, key: 'PK10', name: 'PK10', sort: 3 },
  // PK10 的兩個盤口：CD/OF 共用開獎號與彩池（見 server/services/pk10Shared.ts），
  // id 編碼比照 LHC-CD/LHC-OF、K3-CD/K3-OF（玩法 id ×100 + 盤口序號）
  'PK10-CD':{ id: 300100, key: 'PK10-CD', name: 'PK10', sub:'CD', sort: 300 },
  'PK10-OF':{ id: 300101, key: 'PK10-OF', name: 'PK10', sub:'OF', sort: 301 },

  'SSC':{ id: 4001, key: 'SSC', name: '時時彩', sort: 4 },
  // 時時彩的兩個盤口：SSC-CD 與 SSC-OF 共用開獎號與彩池（見 server/services/game/lottery/bg/sscShared.ts），
  // id 編碼比照 LHC-CD/LHC-OF、K3-CD/K3-OF、PK10-CD/PK10-OF（玩法 id ×100 + 盤口序號）
  'SSC-CD':{ id: 400100, key: 'SSC-CD', name: '時時彩', sub:'CD', sort: 400 },
  'SSC-OF':{ id: 400101, key: 'SSC-OF', name: '時時彩', sub:'OF', sort: 401 },

  // PC蛋蛋：來源（bglottery pceggs）只有信用模式、沒有官方盤，
  // 因此只登記單一鍵值（無 sub 欄位），這個鍵同時是大廳分組項與伺端 Storage.games 的實際 key，
  // 不像其他玩法要另外拆 CD/OF 兩個子項。
  'EGGS':{ id: 5001, key: 'EGGS', name: 'PC蛋蛋', sort: 5 },
} 

export const SORT = {
  DEFAULT: 'default',
  BET_COUNT_USER: 'bet_count_user',
  OPEN_COUNT_SYSTEM: 'open_count_system',
  GAP_ISSUE_SYSTEM: 'gap_issue_system',
}

export const STATUS_TIME = {
  PREPARE: '準備中',
  OPEN: '開盤中',
  PREPARE_CLOSE: '準備封盤',
  PREPARE_CLOSE_5: '準備封盤 5',
  PREPARE_CLOSE_4: '準備封盤 4',
  PREPARE_CLOSE_3: '準備封盤 3',
  PREPARE_CLOSE_2: '準備封盤 2',
  PREPARE_CLOSE_1: '準備封盤 1',
  CLOSED: '已封盤',
  PREPARE_OPEN: '準備開獎',
  OPENING: '正在開獎中',
  OPENED: '已開獎',
}

/**
 * 業務錯誤碼表
 *
 * `code` 是業務碼（回應 body 的 data.code），`httpStatus` 才是實際送出的 HTTP status。
 * ⚠️ 兩者不可混用：40001 這類業務碼不是合法 HTTP status，h3 會把它退成 500，
 * 而 500 又在 ofetch 預設的 retryStatusCodes 內 —— GET 請求會被自動重打一次
 * （例如未登入開 /login，/api/me 會連丟兩個 500）。
 * 伺端一律用 server/utils/error.ts 的 throwErrCode() 丟出，前端以 err.data?.data?.code 判讀。
 */
export const STATUS_ERR_CODE = {
  40001: { code: 40001, httpStatus: 401, message: '登入已過期', },
  40002: { code: 40002, httpStatus: 400, message: '帳號或密碼錯誤', },

  50001: { code: 50001, httpStatus: 400, message: '餘額不足', },
}

// CONTROLS ARG
export const FLAG = {
  OPEN: 1,
  CLOSE: 0,
}

// FUNC
export const GET_CONT = { 
  /**
   * 大廳的玩法清單：只回「玩法本身」，不含 CD / OF 盤口
   *
   * ⚠️ 以 sub 欄位判斷而非寫死 key 清單 —— 盤口一律帶 sub（'CD' / 'OF'），玩法本身沒有。
   *    原本寫死 ['LHC-CD','LHC-OF']，新增 K3-CD / K3-OF 後就漏掉，
   *    大廳把盤口也當成獨立玩法、各再 ×2 模式 → 出現重複的快3 卡。
   */
  lotteryAll: () => {
    return Object.values(LOTTERY).filter(item => !item.sub).sort((a, b) => a.sort - b.sort)
  },
  lotteryById: (id) => {
    return Object.values(LOTTERY).find((lottery) => lottery.id === id)
  },
  
}
