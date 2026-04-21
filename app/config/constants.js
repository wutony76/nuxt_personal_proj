// 定義 CONSTANTS
export const GAME_6HC_OF = {
  SINGLE: { key: 'SINGLE', name: '自選單式' , sort: 1 },
  DUPLEX: { key: 'DUPLEX', name: '自選複式' , sort: 2 },
  DANTUO: { key: 'DANTUO', name: '自選膽拖' , sort: 3 },
}

export const LOTTERY = {
  '6HC':{ id: 1001, key: '6HC', name: '六合彩', sort: 1 },
  'LHC-CD':{ id: 100100, key: 'LHC-CD', name: '六合彩(CD)', sort: 100 },
  'LHC-OF':{ id: 100101, key: 'LHC-OF', name: '六合彩(OF)', sort: 101 },

  'K3':{ id: 2001, key: 'K3', name: '快3', sort: 2 },
  'PK10':{ id: 3001, key: 'PK10', name: 'PK10', sort: 3 },
  'SSC':{ id: 4001, key: 'SSC', name: '時時彩', sort: 4 },
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

// CONTROLS ARG
export const FLAG = {
  OPEN: 1,
  CLOSE: 0,
}

// FUNC
export const GET_CONT = { 
  lotteryAll: () => {
    return Object.values(LOTTERY).sort((a, b) => a.sort - b.sort)
  },
  lotteryById: (id) => {
    return Object.values(LOTTERY).find((lottery) => lottery.id === id)
  },
  
}
