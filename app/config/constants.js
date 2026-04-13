// 定義 CONSTANTS
export const GAME_6HC_OF = {
  SINGLE: { key: 'SINGLE', name: '自選單式' , sort: 1 },
  DUPLEX: { key: 'DUPLEX', name: '自選複式' , sort: 2 },
  DANTUO: { key: 'DANTUO', name: '自選膽拖' , sort: 3 },
}

export const LOTTERY = {
  '6HC':{ id: 1001, key: '6HC', name: '六合彩', sort: 1 },
  'K3':{ id: 2001, key: 'K3', name: '快3', sort: 2 },
  'PK10':{ id: 3001, key: 'PK10', name: 'PK10', sort: 3 },
  'SSC':{ id: 4001, key: 'SSC', name: '時時彩', sort: 4 },
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
