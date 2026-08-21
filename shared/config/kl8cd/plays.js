/**
 * 快樂8（KL8）看板設定總表
 *
 * 玩法、分頁與注項順序全部照 bglottery 的
 * src/components/room/lotteryAll/kl8/allTraditional/{renxuan,liangmian}/config*.js，
 * playId 也沿用那邊的編號方便對帳（格式 `${tabId}-${來源playId}`）：
 *   2121010~2121016  任選    ← 來源 playTabId 21210，任一中一 ~ 任七中七
 *   21211            兩面    ← 來源 playTabId 21211，和值 8 面 + 上下盤 3 + 奇偶盤 3 + 五行 5
 *
 * ⚠️ 來源 config **只有 playId、沒有名稱也沒有賠率** —— 原專案的 playName / maxPrize 是
 *    伺端 LotteryPlayOdds 回傳後由 play_script.js 的 mergeCreditData() 併進本地 layout 的。
 *    本檔的名稱即注碼（betCode），判定規則與門檻依據見 openspec/changes/add-kl8/design.md。
 * ⚠️ 任選一個分頁只有**一個**注項（就是分頁本身）—— 一注的注碼是「分頁名 + 逗號分隔號碼」
 *    （例 `任三中三03,07,15`），號碼池由前端依 1~80 動態產生（與來源 UI 相同）。
 *    因此 helpers 的注項查找對任選走「前綴比對」，見 kl8cd/helpers.ts。
 * ⚠️ 上下盤與奇偶盤在來源**各有一個叫「和盤」的注項**，注碼必須唯一，
 *    故改名為 `上下和` / `奇偶和`（看板顯示同字串，避免畫面與注單不同名）。
 * ⚠️ 賠率一律由 kl8-cd.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是產生時的快照，
 *    判定與結算以 helpers 讀出的值為準。註解的機率為精確值：
 *    任選母數 C(80,N)、和值／上下盤／奇偶盤／五行母數 C(80,20)=3,535,316,142,212,174,320。
 * ⚠️ weight 為爆池分配權重，沿用 6hc 的理論賠率分級法（1/命中機率 ≥20→3、2.5~20→2、<2.5→1）。
 *    群組層為預設值、注項層可覆寫；明確給 0 代表「排除在爆池外」，與「沒設定」
 *    （退回 KL8_JACKPOT_SETTINGS.weightFallback）是兩件不同的事。
 *    本彩種的爆池條件（奇偶一邊倒）不對應任何單一注項，所以沒有任何注項需要 weight: 0。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名，
 *    只要出現 `#shared/...` 的 import，伺端一載入就會炸。
 * ⚠️ 選號彩池玩法（KL8_POOL_PLAY_KEY）不進本檔看板網格，設定在 kl8-cd.ts。
 */

const QUOTA_DEFAULT = {
  item: { min: 1, max: 99999 },
  issue: { max: 0 },
}

/**
 * 任選的限額
 * ⚠️ 單期上限不是 0（不限）—— 任選是複式玩法，一次可展開到 C(8,2)=28 注、
 *    C(8,4)=70 注，單注限額擋不住總額，靠這個單期上限收口。
 */
const QUOTA_RENXUAN = {
  item: { min: 1, max: 99999 },
  issue: { max: 500000 },
}

const PAYOUT_DEFAULT = { rtp: 0.97 }

export default [
  {
    key: 'renxuan',
    name: '任選',
    list: [
      {
        tabId: 2121010,
        tabName: '任一中一',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 1, max: 80, pick: 1 } },
        tabGroup: [
          {
            groupName: '任一中一 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 2,
            columns: 1,
            groupList: [
              { playId: '2121010-212101010', name: '任一中一', odds: 3.88, weight: 2 }, // 20/80 = 25.0000%（公平 4.000）
            ],
          },
        ],
      },
      {
        tabId: 2121011,
        tabName: '任二中二',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 2, max: 8, pick: 2 } },
        tabGroup: [
          {
            groupName: '任二中二 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 2,
            columns: 1,
            groupList: [
              { playId: '2121011-212101110', name: '任二中二', odds: 16.13, weight: 2 }, // 190/3160 = 6.0127%（公平 16.632）
            ],
          },
        ],
      },
      {
        tabId: 2121012,
        tabName: '任三中三',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 3, max: 8, pick: 3 } },
        tabGroup: [
          {
            groupName: '任三中三 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 3,
            columns: 1,
            groupList: [
              { playId: '2121012-212101210', name: '任三中三', odds: 69.9, weight: 3 }, // 1140/82160 = 1.3875%（公平 72.070）
            ],
          },
        ],
      },
      {
        tabId: 2121013,
        tabName: '任四中四',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 4, max: 8, pick: 4 } },
        tabGroup: [
          {
            groupName: '任四中四 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 3,
            columns: 1,
            groupList: [
              { playId: '2121013-212101310', name: '任四中四', odds: 316.64, weight: 3 }, // 4845/1581580 = 0.3063%（公平 326.436）
            ],
          },
        ],
      },
      {
        tabId: 2121014,
        tabName: '任五中五',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 5, max: 8, pick: 5 } },
        tabGroup: [
          {
            groupName: '任五中五 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 3,
            columns: 1,
            groupList: [
              { playId: '2121014-212101410', name: '任五中五', odds: 1504.05, weight: 3 }, // 15504/24040016 = 0.0645%（公平 1550.569）
            ],
          },
        ],
      },
      {
        tabId: 2121015,
        tabName: '任六中六',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 6, max: 8, pick: 6 } },
        tabGroup: [
          {
            groupName: '任六中六 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 3,
            columns: 1,
            groupList: [
              { playId: '2121015-212101510', name: '任六中六', odds: 7520.25, weight: 3 }, // 38760/300500200 = 0.0129%（公平 7752.843）
            ],
          },
        ],
      },
      {
        tabId: 2121016,
        tabName: '任七中七',
        settings: { quota: QUOTA_RENXUAN, payout: PAYOUT_DEFAULT, chosen: { min: 7, max: 8, pick: 7 } },
        tabGroup: [
          {
            groupName: '任七中七 · 號碼 01~80',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 3,
            columns: 1,
            groupList: [
              { playId: '2121016-212101610', name: '任七中七', odds: 39749.93, weight: 3 }, // 77520/3176716400 = 0.0024%（公平 40979.314）
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'liangmian',
    name: '兩面',
    list: [
      {
        tabId: 21211,
        tabName: '兩面',
        settings: { quota: QUOTA_DEFAULT, payout: PAYOUT_DEFAULT },
        tabGroup: [
          {
            groupName: '和值（20 球總和 210~1410）',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 1,
            columns: 4,
            groupList: [
              { playId: '21211-212111010', name: '大', odds: 1.93, weight: 1 }, // 1775429452873567459/3535316142212174320 = 50.2198%（公平 1.991）
              { playId: '21211-212111011', name: '小', odds: 1.94, weight: 1 }, // 1759886689338606861/3535316142212174320 = 49.7802%（公平 2.009）
              { playId: '21211-212111012', name: '單', odds: 1.94, weight: 1 }, // 1767658070682256896/3535316142212174320 = 50.0000%（公平 2.000）
              { playId: '21211-212111013', name: '雙', odds: 1.93, weight: 1 }, // 1767658071529917424/3535316142212174320 = 50.0000%（公平 2.000）
              { playId: '21211-212111014', name: '大單', odds: 3.88, weight: 2 }, // 883829035341128448/3535316142212174320 = 25.0000%（公平 4.000）
              { playId: '21211-212111015', name: '大雙', odds: 3.84, weight: 2 }, // 891600417532439011/3535316142212174320 = 25.2198%（公平 3.965）
              { playId: '21211-212111016', name: '小單', odds: 3.88, weight: 2 }, // 883829035341128448/3535316142212174320 = 25.0000%（公平 4.000）
              { playId: '21211-212111017', name: '小雙', odds: 3.91, weight: 2 }, // 876057653997478413/3535316142212174320 = 24.7802%（公平 4.036）
            ],
          },
          {
            groupName: '上下盤（1~40 個數 vs 41~80 個數）',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 2,
            columns: 3,
            groupList: [
              { playId: '21211-212111110', name: '上盤', odds: 2.43, weight: 2 }, // 1408393885741467768/3535316142212174320 = 39.8378%（公平 2.510）
              { playId: '21211-212111111', name: '上下和', odds: 4.77, weight: 2 }, // 718528370729238784/3535316142212174320 = 20.3243%（公平 4.920）
              { playId: '21211-212111112', name: '下盤', odds: 2.43, weight: 2 }, // 1408393885741467768/3535316142212174320 = 39.8378%（公平 2.510）
            ],
          },
          {
            groupName: '奇偶盤（奇數個數 vs 偶數個數）',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 2,
            columns: 3,
            groupList: [
              { playId: '21211-212111210', name: '奇盤', odds: 2.43, weight: 2 }, // 1408393885741467768/3535316142212174320 = 39.8378%（公平 2.510）
              { playId: '21211-212111211', name: '奇偶和', odds: 4.77, weight: 2 }, // 718528370729238784/3535316142212174320 = 20.3243%（公平 4.920）
              { playId: '21211-212111212', name: '偶盤', odds: 2.43, weight: 2 }, // 1408393885741467768/3535316142212174320 = 39.8378%（公平 2.510）
            ],
          },
          {
            groupName: '五行（20 球總和依等機率五等分：金≤734／木735~787／水788~833／火834~886／土≥887）',
            // 爆池分配的群組層預設；下方注項各自覆寫
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '21211-212111310', name: '金', odds: 4.79, weight: 2 }, // 715028644513458407/3535316142212174320 = 20.2253%（公平 4.944）
              { playId: '21211-212111311', name: '木', odds: 4.85, weight: 2 }, // 706409746774059404/3535316142212174320 = 19.9815%（公平 5.005）
              { playId: '21211-212111312', name: '水', odds: 4.84, weight: 2 }, // 707498481989430938/3535316142212174320 = 20.0123%（公平 4.997）
              { playId: '21211-212111313', name: '火', odds: 4.88, weight: 2 }, // 702343720783761798/3535316142212174320 = 19.8665%（公平 5.034）
              { playId: '21211-212111314', name: '土', odds: 4.87, weight: 2 }, // 704035548151463773/3535316142212174320 = 19.9144%（公平 5.022）
            ],
          },
        ],
      },
    ],
  },
]
