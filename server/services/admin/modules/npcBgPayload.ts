/**
 * NPC 自動下注：15 款 BG 彩票盤口各自的「最小合法下注 payload」產生器。
 * 回 `null` 表示該盤口暫時還沒接（`npcAutoPlay.ts` 會直接跳過這次行動，不報錯）。
 * 跟真人玩家一樣呼叫 `Storage.games[key].playBets(payload, user)`（見
 * `server/api/lottery/bet.post.ts`），這裡只負責產生 payload，不重複驗證邏輯。
 *
 * 每個盤口固定用「單組、單注、非組合型」的最小合法下注（一個 playKey + selectTabId +
 * 一個 num/label），playKey／selectTabId／num（或 label）的合法值都是逐一讀對應盤口的
 * `#shared/config/**` 看板設定確認過的（見各 builder 上方註解），不是憑空亂填。
 */

type BgBetPayload = {
  amount: number
  groups: Array<{
    playKey: string
    selectTabId: number
    playList: Array<{ num?: number; label?: string; amount: number }>
  }>
}

type BgBetBuilder = (amount: number) => BgBetPayload

const BUILDERS: Record<string, BgBetBuilder> = {
  // 正碼特：開獎第一特碼（正一特，tabId 4000），猜中一個號碼 1~49（見 shared/config/6hc-cd.ts）
  'LHC-CD': (amount) => ({
    amount,
    groups: [{ playKey: 'zhengmate', selectTabId: 4000, playList: [{ num: 7, amount }] }]
  }),

  // 官方盤不驗證 playKey/selectTabId、也不驗證 num 範圍是否落在特定分頁，
  // 只要求 num 為正數（見 6hcOf.ts buildOrderRows → LOTTERY_BASE.normalizeBetCode），沿用信用盤的號碼即可
  'LHC-OF': (amount) => ({
    amount,
    groups: [{ playKey: 'zhengmate', selectTabId: 4000, playList: [{ num: 7, amount }] }]
  }),

  // 三軍/大小/點數分頁（tabId 40000）「總和」群組的兩面注「大」（見 shared/config/k3cd/c_sanjun.js，單注下限 2）
  'K3-CD': (amount) => ({
    amount,
    groups: [{ playKey: 'sanjun', selectTabId: 40000, playList: [{ label: '大', amount }] }]
  }),

  // 和值分頁（tabId 50000）「兩面」群組的兩面注「大」（見 shared/config/k3of/c_hezhi.js，單注下限 2）
  'K3-OF': (amount) => ({
    amount,
    groups: [{ playKey: 'hezhi', selectTabId: 50000, playList: [{ label: '大', amount }] }]
  }),

  // 定位膽分頁（tabId 14113）冠軍名次選 01 號車（見 shared/config/pk10cd/plays.js，單注下限 2）
  'PK10-CD': (amount) => ({
    amount,
    groups: [{ playKey: 'dingwei', selectTabId: 14113, playList: [{ label: '冠軍01', amount }] }]
  }),

  // 前一直選分頁（tabId 141101010）冠軍選 01 號車（見 shared/config/pk10of/plays.js，單注下限 2）
  'PK10-OF': (amount) => ({
    amount,
    groups: [{ playKey: 'qianyi', selectTabId: 141101010, playList: [{ label: '前一01', amount }] }]
  }),

  // 1-5球分頁（tabId 10110）第一球猜中單一數字 7（見 shared/config/ssccd/plays.js，單注下限 2）
  'SSC-CD': (amount) => ({
    amount,
    groups: [{ playKey: 'ball', selectTabId: 10110, playList: [{ label: '第一球7', amount }] }]
  }),

  // 定位膽分頁（tabId 101101010）第一球猜中單一數字 7（見 shared/config/sscof/plays.js，單注下限 2）
  'SSC-OF': (amount) => ({
    amount,
    groups: [{ playKey: 'dingwei', selectTabId: 101101010, playList: [{ label: '第一球7', amount }] }]
  }),

  // 1-5球分頁（tabId 112100）第一球猜中單一號碼 01（見 shared/config/x5cd/plays.js，單注下限 2）
  'X5-CD': (amount) => ({
    amount,
    groups: [{ playKey: 'ball', selectTabId: 112100, playList: [{ label: '第一球01', amount }] }]
  }),

  // 定位膽分頁（tabId 111131010）第一球猜中單一號碼 01（見 shared/config/x5of/plays.js，單注下限 2）
  'X5-OF': (amount) => ({
    amount,
    groups: [{ playKey: 'dingwei', selectTabId: 111131010, playList: [{ label: '第一球01', amount }] }]
  }),

  // 大小分頁（tabId 50000）兩面注「大」（見 shared/config/eggscd/plays.js，QUOTA_DEFAULT 單注下限 1）
  EGGS: (amount) => ({
    amount,
    groups: [{ playKey: 'daxiao', selectTabId: 50000, playList: [{ label: '大', amount }] }]
  }),

  // 正和分頁（tabId 1321010）第一球猜中單一號碼 01（見 shared/config/kl10cd/plays.js，單注下限 1）
  KL10: (amount) => ({
    amount,
    groups: [{ playKey: 'zhenghe', selectTabId: 1321010, playList: [{ label: '第一球01', amount }] }]
  }),

  // 兩面分頁（tabId 21211）兩面注「大」（見 shared/config/kl8cd/plays.js，QUOTA_DEFAULT 單注下限 1）
  KL8: (amount) => ({
    amount,
    groups: [{ playKey: 'liangmian', selectTabId: 21211, playList: [{ label: '大', amount }] }]
  }),

  // 定位膽分頁（tabId 181101010）百位猜中單一數字 0（見 shared/config/fc3dof/plays.js，單注下限 2）
  FC3D: (amount) => ({
    amount,
    groups: [{ playKey: 'dingwei', selectTabId: 181101010, playList: [{ label: '百位0', amount }] }]
  }),

  // 定位膽分頁（tabId 191101010）百位猜中單一數字 0（見 shared/config/pl3of/plays.js，單注下限 2）
  PL3: (amount) => ({
    amount,
    groups: [{ playKey: 'dingwei', selectTabId: 191101010, playList: [{ label: '百位0', amount }] }]
  })
}

export function buildBgBetPayload(key: string, amount: number): unknown | null {
  const builder = BUILDERS[key]
  return builder ? builder(amount) : null
}
