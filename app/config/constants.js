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

  // 11選5：X5-CD 與 X5-OF 共用開獎號與彩池（見 server/services/game/lottery/bg/x5Shared.ts），
  // id 編碼比照前面各玩法（玩法 id ×100 + 盤口序號）。
  // ⚠️ 代號用 X5 而不是 11X5 —— 「11x5」開頭是數字，不能當 JS/TS 識別字
  //    （同六合彩用 LHC 代稱的做法）；路由與資料夾名仍是 11x5-cd / 11x5-of。
  'X5':{ id: 6001, key: 'X5', name: '11選5', sort: 6 },
  'X5-CD':{ id: 600100, key: 'X5-CD', name: '11選5', sub:'CD', sort: 600 },
  'X5-OF':{ id: 600101, key: 'X5-OF', name: '11選5', sub:'OF', sort: 601 },

  // PC蛋蛋：來源（bglottery pceggs）只有信用模式、沒有官方盤，
  // 因此只登記單一鍵值（無 sub 欄位），這個鍵同時是大廳分組項與伺端 Storage.games 的實際 key，
  // 不像其他玩法要另外拆 CD/OF 兩個子項。
  'EGGS':{ id: 5001, key: 'EGGS', name: 'PC蛋蛋', sort: 5 },

  // 快樂十分：來源（bglottery kl10）只有信用模式、沒有官方盤，
  // 與 PC蛋蛋 一樣只登記單一鍵值（無 sub 欄位），這個鍵同時是大廳分組項與伺端 Storage.games 的 key
  'KL10':{ id: 7001, key: 'KL10', name: '快樂十分', sort: 7 },

  // 快樂8：來源（bglottery kl8）只有信用模式、沒有官方盤，
  // 與 PC蛋蛋／快樂十分 一樣只登記單一鍵值（無 sub 欄位）
  'KL8':{ id: 8001, key: 'KL8', name: '快樂8', sort: 8 },

  // 福彩3D：來源（bglottery fc3d）只有官方盤、沒有信用盤，是目前唯一「官方盤單盤口」的玩法，
  // 與 PC蛋蛋／快樂十分／快樂8 一樣只登記單一鍵值（無 sub 欄位），
  // 這個鍵同時是大廳分組項與伺端 Storage.games 的 key（下注沿用共用路由 /api/lottery/bet）。
  'FC3D':{ id: 9001, key: 'FC3D', name: '福彩3D', sort: 9 },

  // 排列3：來源（bglottery pl3）只有官方盤、沒有信用盤，玩法結構與福彩3D幾乎相同
  // （僅 playId 前綴／lotteryId 不同），但仍是完全獨立彩種，各自登記一組鍵值，
  // 與 FC3D／PC蛋蛋／快樂十分／快樂8 一樣只登記單一鍵值（無 sub 欄位）。
  'PL3':{ id: 10001, key: 'PL3', name: '排列3', sort: 10 },

  // 大樂透：唯一一款「完全鏡射官方台彩」的玩法（開獎號與 8 個獎項派彩金額皆即時讀取官方
  // API，不自建 RNG／賠率公式／彩池），分類獨立為 tw（見 openspec/changes/add-dlt/design.md
  // Decision 0），不屬於 bg 系列，只登記單一鍵值（無 sub 欄位）。
  // category: 'tw' 讓 GET_CONT.lotteryAll()（/lottery-hall 大廳清單）能把它濾掉——
  // 這裡跟其他 bg 系列共用同一份 LOTTERY 註冊表只是為了 id/key 查找方便，
  // 不代表它該出現在 bg 大廳的玩法清單裡（它有自己獨立的 /lottery-hall-taiwan 入口）。
  'DLT':{ id: 11001, key: 'DLT', name: '大樂透', sort: 11, category: 'tw' },

  // 今彩539：第二款「完全鏡射官方台彩」的玩法（tw 分類，開獎號與 4 個獎項派彩金額皆即時讀取
  // 官方 API，不自建 RNG／賠率公式／彩池，見 openspec/changes/add-tw-lottery-suite/design.md）。
  // 與大樂透唯二差異：01–39 選 5、無特別號；每天開獎（週一至週六，週日不開獎）。
  // 只登記單一鍵值（無 sub 欄位），category: 'tw' 讓它不出現在 bg 大廳（有獨立的 /lottery-hall-taiwan 入口）。
  'D539':{ id: 11003, key: 'D539', name: '今彩539', sort: 13, category: 'tw' },

  // 49樂合彩：第三款「完全鏡射官方台彩」的玩法（tw 分類）。玩法本質與 DLT/D539 不同——先選「幾合」
  // （二合/三合/四合），再從 01–49 選滿對應數量的號碼，全中才中獎；開獎跟隨大樂透（每週二五），
  // 開獎號與各合數派彩金額皆即時讀取官方 gameCode 1121 的 API，獨立於大樂透 service
  // （見 openspec/changes/add-tw-lottery-suite/design.md Decision 3）。每注 25 元。
  // 只登記單一鍵值（無 sub 欄位），category: 'tw' 讓它不出現在 bg 大廳（有獨立的 /lottery-hall-taiwan 入口）。
  'M649':{ id: 11004, key: 'M649', name: '49樂合彩', sort: 14, category: 'tw' },

  // 39樂合彩：第四款「完全鏡射官方台彩」的玩法（tw 分類）。玩法本質與 M649 相同——先選「幾合」
  // （二合/三合/四合），再從 01–39 選滿對應數量的號碼，全中才中獎；開獎跟隨今彩539（每天，週一至週六），
  // 開獎號與各合數派彩金額皆即時讀取官方 gameCode 5120 的 API，獨立於今彩539/49樂合彩 service
  // （見 openspec/changes/add-tw-lottery-suite/design.md Decision 3）。每注 25 元。
  // 只登記單一鍵值（無 sub 欄位），category: 'tw' 讓它不出現在 bg 大廳（有獨立的 /lottery-hall-taiwan 入口）。
  'M539':{ id: 11005, key: 'M539', name: '39樂合彩', sort: 15, category: 'tw' },
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
  // 大樂透專用：開獎時間已到，但官方尚未公布完整開獎號／獎金明細，需輪詢等待
  // （見 openspec/changes/add-dlt/design.md Decision 5），MUST NOT 誤判為 OPENED 或無人中獎。
  PENDING_SETTLEMENT: '結算中（等待官方資料）',
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
  40003: { code: 40003, httpStatus: 403, message: '無管理員權限', },

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
   * 大廳（/lottery-hall，bg 系列）的玩法清單：只回「bg 系列的玩法本身」，不含 CD / OF 盤口，
   * 也不含 tw 分類的玩法（目前只有 DLT——它有自己獨立的 /lottery-hall-taiwan 入口，
   * 不該出現在 bg 大廳，見 LOTTERY.DLT 的 category 註解）。
   *
   * ⚠️ 以 sub 欄位判斷而非寫死 key 清單 —— 盤口一律帶 sub（'CD' / 'OF'），玩法本身沒有。
   *    原本寫死 ['LHC-CD','LHC-OF']，新增 K3-CD / K3-OF 後就漏掉，
   *    大廳把盤口也當成獨立玩法、各再 ×2 模式 → 出現重複的快3 卡。
   */
  lotteryAll: () => {
    return Object.values(LOTTERY).filter(item => !item.sub && item.category !== 'tw').sort((a, b) => a.sort - b.sort)
  },
  lotteryById: (id) => {
    return Object.values(LOTTERY).find((lottery) => lottery.id === id)
  },
  
}
