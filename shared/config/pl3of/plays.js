/**
 * 排列3官方盤看板設定總表
 *
 * 玩法、分頁與注項順序照 bglottery `pl3/config_ssc.js`（lotteryId 1901，只有官方盤），
 * 分頁 id 直接沿用來源的 playId 方便對帳，文案改繁體。5 個玩法分頁：
 *   19110 定位膽      ← 百/十/個位各自 0~9 單選（單選分頁）
 *   19111 直選組選    ← 前二/後二 直選（位置對應）／組選（2 碼不分順序）
 *   19112 三星        ← 直選複式/單式/和值、組三/組六/組選和值
 *   19113 不定位      ← 一碼不定位／二碼不定位
 *   19114 大小單雙    ← 前二/後二 各位置的 大/小/單/雙
 *
 * ── 分頁型態（對應 pl3of/helpers.ts 的展開與驗證）──────────
 *   單選分頁（定位膽）—— groupList 就是注項清單，注碼＝name（百位0…）
 *   複式分頁（其餘）—— groupList 只是「該位置／該組可選的號碼或面」，
 *     注碼由 pl3ComboCodes() 依 combo.mode 展開，清單裡找不到，驗證改走 combo 規則：
 *       direct 位置直選（前二/後二/三星）→ 各位置選一組號碼，笛卡爾積
 *       group  組選（組選2/組三/組六、二碼不定位）→ 一組號碼取合法組合
 *       sides  大小單雙（前二/後二）→ 各位置選一組面，笛卡爾積
 *       each   逐項（和值、一碼不定位）→ 每個選號各自成一注
 *       input  三星直選單式 → 前端輸入框直接給注碼，不走展開函式
 *
 * ── quota 級距（比照 sscof/plays.js，依該分頁最大賠率量級分層）─
 *   賠率 <100 → item.max 10000／100~500 → 5000／>500 → 100；item.min 2、issue.max 500000。
 *
 * ⚠️ 賠率一律由 pl3-of.ts 依「公平賠率（母數÷命中數）× rtp」推算，本檔 odds／註解只是快照。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）—— Nitro 對 shared 下的檔案走 Node 原生 ESM
 *    解析、不認得 `#shared` 別名。本檔下方的 `_digits`/`_sums`/`_sides`/`_balls` 只是產生
 *    注項陣列的純函式（無任何 import），輸出結構與 sscof/plays.js 完全一致。
 * ⚠️ 來源 `191121113`（三星組選和值·組三）／`191121114`（·組六）在 config_ssc.js 是**空物件
 *    `{}`**（無 selectarea/alias、UI 打不到），已於提案階段與使用者確認**跳過不實作**，
 *    只做合併版 `191121112` 三星組選和值（見下方 sanxing 分頁）。
 */

/** 產生「該位置可選 0~9」的注項（複式分頁的號碼池） */
function _digits(tabId, pos) {
  return Array.from({ length: 10 }, (_, d) => ({
    playId: `${tabId}-${pos}-${d}`,
    name: String(d),
    value: d,
    digit: d
  }))
}

/** 產生定位膽的注項：name 即注碼（百位0…），單選分頁靠 name 驗證 */
function _balls(tabId, place, placeName) {
  return Array.from({ length: 10 }, (_, d) => ({
    playId: `${tabId}-${place}-${d}`,
    name: `${placeName}${d}`,
    value: d,
    digit: d,
    place,
    odds: 9.6 // 1 位固定、其餘兩位自由 → 100/1000（公平 10.000）
  }))
}

/** 產生和值注項（value 為和值，可到 27，超出號碼 0~9 範圍，故另存 value 不塞 digit） */
function _sums(tabId, min, max) {
  const list = []
  for (let s = min; s <= max; s++) list.push({ playId: `${tabId}-0-${s}`, name: String(s), value: s })
  return list
}

/** 產生大小單雙注項（每個位置一組面） */
function _sides(tabId, pos) {
  return ['大', '小', '單', '雙'].map((side) => ({ playId: `${tabId}-${pos}-${side}`, name: side, side }))
}

const _quota = (max) => ({ item: { min: 2, max }, issue: { max: 500000 } })
const _payout = { rtp: 0.96 }

export default [
  {
    name: '定位膽',
    key: 'dingwei',
    // 來源 playId 19110（定位胆）
    list: [
      {
        tabId: 191101010,
        tabName: '定位膽',
        settings: { quota: _quota(10000), payout: _payout },
        // 單選分頁：每個 name（百位0…）就是一注，命中對應位置數字（公平 10.000，odds 9.60）
        tabGroup: [
          { groupName: '百位', pos: 0, weight: 2, columns: 5, groupList: _balls(191101010, 0, '百位') },
          { groupName: '十位', pos: 1, weight: 2, columns: 5, groupList: _balls(191101010, 1, '十位') },
          { groupName: '個位', pos: 2, weight: 2, columns: 5, groupList: _balls(191101010, 2, '個位') }
        ]
      }
    ]
  },
  {
    name: '直選組選',
    key: 'zhixuan',
    // 來源 playId 19111（前二/后二 直选/组选）
    list: [
      {
        tabId: 191111010,
        tabName: '前二直選',
        settings: { quota: _quota(10000), payout: _payout },
        // 前二直選12 —— 1/100（公平 100.000），odds 96.00
        combo: { mode: 'direct', section: '前二', positions: 2, minPick: 1, prefix: '前二直選' },
        tabGroup: [
          { groupName: '百位', pos: 0, weight: 2, columns: 5, groupList: _digits(191111010, 0) },
          { groupName: '十位', pos: 1, weight: 2, columns: 5, groupList: _digits(191111010, 1) }
        ]
      },
      {
        tabId: 191111011,
        tabName: '後二直選',
        settings: { quota: _quota(10000), payout: _payout },
        // 後二直選12 —— 1/100（公平 100.000），odds 96.00
        combo: { mode: 'direct', section: '後二', positions: 2, minPick: 1, prefix: '後二直選' },
        tabGroup: [
          { groupName: '十位', pos: 0, weight: 2, columns: 5, groupList: _digits(191111011, 0) },
          { groupName: '個位', pos: 1, weight: 2, columns: 5, groupList: _digits(191111011, 1) }
        ]
      },
      {
        tabId: 191111110,
        tabName: '前二組選',
        settings: { quota: _quota(10000), payout: _payout },
        // 前二組選12 —— 2/100（公平 50.000），odds 48.00（百/十為所選 2 碼之任一排列）
        combo: { mode: 'group', group: 'group2', minPick: 2, prefix: '前二組選' },
        tabGroup: [
          { groupName: '組選', pos: 0, weight: 2, columns: 5, groupList: _digits(191111110, 0) }
        ]
      },
      {
        tabId: 191111111,
        tabName: '後二組選',
        settings: { quota: _quota(10000), payout: _payout },
        // 後二組選12 —— 2/100（公平 50.000），odds 48.00（十/個為所選 2 碼之任一排列）
        combo: { mode: 'group', group: 'group2', minPick: 2, prefix: '後二組選' },
        tabGroup: [
          { groupName: '組選', pos: 0, weight: 2, columns: 5, groupList: _digits(191111111, 0) }
        ]
      }
    ]
  },
  {
    name: '三星',
    key: 'sanxing',
    // 來源 playId 19112（三星 直选/组选/和值）
    list: [
      {
        tabId: 191121010,
        tabName: '三星直選複式',
        settings: { quota: _quota(100), payout: _payout },
        // 三星直選123 —— 1/1000（公平 1000.000），odds 960.00
        combo: { mode: 'direct', section: '三星', positions: 3, minPick: 1, prefix: '三星直選' },
        tabGroup: [
          { groupName: '百位', pos: 0, weight: 2, columns: 5, groupList: _digits(191121010, 0) },
          { groupName: '十位', pos: 1, weight: 2, columns: 5, groupList: _digits(191121010, 1) },
          { groupName: '個位', pos: 2, weight: 2, columns: 5, groupList: _digits(191121010, 2) }
        ]
      },
      {
        tabId: 191121011,
        tabName: '三星直選單式',
        settings: { quota: _quota(100), payout: _payout },
        // 與三星直選複式同判定（1/1000，odds 960.00），差別只在前端用輸入框貼注碼，不走展開函式
        combo: { mode: 'input', positions: 3, minPick: 1, prefix: '三星直選' },
        tabGroup: []
      },
      {
        tabId: 191121012,
        tabName: '三星直選和值',
        // 和值極值（和值 0/27 → 1/1000，odds 960.00）落在 >500 級距，故 item.max 100
        settings: { quota: _quota(100), payout: _payout },
        // 三碼總和＝所選值 0~27（命中查 ZXHZ 表，母數 1000）；每個和值各自成一注
        combo: { mode: 'each', minPick: 1, prefix: '三星直選和值' },
        tabGroup: [
          { groupName: '和值', pos: 0, weight: 2, columns: 7, groupList: _sums(191121012, 0, 27) }
        ]
      },
      {
        tabId: 191121110,
        tabName: '三星組三',
        settings: { quota: _quota(5000), payout: _payout },
        // 三星組三 {A,A,B} —— 3/1000（公平 333.333），odds 319.99；合法性比照 algorithm.js _ZUSDScheck
        combo: { mode: 'group', group: 'group3', minPick: 2, prefix: '三星組三' },
        tabGroup: [
          { groupName: '組三', pos: 0, weight: 2, columns: 5, groupList: _digits(191121110, 0) }
        ]
      },
      {
        tabId: 191121111,
        tabName: '三星組六',
        settings: { quota: _quota(5000), payout: _payout },
        // 三星組六 {A,B,C} —— 6/1000（公平 166.667），odds 159.99；合法性比照 algorithm.js _ZULDScheck
        combo: { mode: 'group', group: 'group6', minPick: 3, prefix: '三星組六' },
        tabGroup: [
          { groupName: '組六', pos: 0, weight: 2, columns: 5, groupList: _digits(191121111, 0) }
        ]
      },
      {
        tabId: 191121112,
        tabName: '三星組選和值',
        // 和值極值（和值 1/26 → 3/1000，odds 319.99）落在 100~500 級距，故 item.max 5000
        settings: { quota: _quota(5000), payout: _payout },
        // 三碼總和＝所選值 1~26 且非豹子（命中查 ZUSHZ 排列數表，母數 1000）；每個和值各自成一注
        // ⚠️ 來源 191121113（組三和值）／191121114（組六和值）為空物件 {}，已確認跳過，只做本合併版
        combo: { mode: 'each', minPick: 1, prefix: '三星組選和值' },
        tabGroup: [
          { groupName: '和值', pos: 0, weight: 2, columns: 7, groupList: _sums(191121112, 1, 26) }
        ]
      }
    ]
  },
  {
    name: '不定位',
    key: 'budingwei',
    // 來源 playId 19113（不定位）
    list: [
      {
        tabId: 191131010,
        tabName: '一碼不定位',
        settings: { quota: _quota(10000), payout: _payout },
        // 所選數字出現在三位任一位 —— 271/1000（公平 3.690），odds 3.54；每個號碼各自成一注
        combo: { mode: 'each', minPick: 1, prefix: '一碼不定位' },
        tabGroup: [
          { groupName: '不定位', pos: 0, weight: 2, columns: 5, groupList: _digits(191131010, 0) }
        ]
      },
      {
        tabId: 191131011,
        tabName: '二碼不定位',
        settings: { quota: _quota(10000), payout: _payout },
        // 所選 2 碼各自出現在某一位 —— 54/1000（公平 18.519），odds 17.78；取 2 碼互異 C(n,2)
        combo: { mode: 'group', group: 'group2', minPick: 2, prefix: '二碼不定位' },
        tabGroup: [
          { groupName: '不定位', pos: 0, weight: 2, columns: 5, groupList: _digits(191131011, 0) }
        ]
      }
    ]
  },
  {
    name: '大小單雙',
    key: 'daxiao',
    // 來源 playId 19114（大小单双 前二/后二）
    list: [
      {
        tabId: 191141010,
        tabName: '前二',
        settings: { quota: _quota(10000), payout: _payout },
        // 前二大小單雙 大大 —— 25/100（公平 4.000），odds 3.84（百/十各一個面）
        combo: { mode: 'sides', section: '前二', positions: 2, minPick: 1, prefix: '大小單雙前二' },
        tabGroup: [
          { groupName: '百位', pos: 0, weight: 2, columns: 4, groupList: _sides(191141010, 0) },
          { groupName: '十位', pos: 1, weight: 2, columns: 4, groupList: _sides(191141010, 1) }
        ]
      },
      {
        tabId: 191141011,
        tabName: '後二',
        settings: { quota: _quota(10000), payout: _payout },
        // 後二大小單雙 大大 —— 25/100（公平 4.000），odds 3.84（十/個各一個面）
        combo: { mode: 'sides', section: '後二', positions: 2, minPick: 1, prefix: '大小單雙後二' },
        tabGroup: [
          { groupName: '十位', pos: 0, weight: 2, columns: 4, groupList: _sides(191141011, 0) },
          { groupName: '個位', pos: 1, weight: 2, columns: 4, groupList: _sides(191141011, 1) }
        ]
      }
    ]
  }
]
