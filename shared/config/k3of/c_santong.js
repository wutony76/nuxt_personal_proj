/**
 * 快3 官方盤看板設定：三同號
 *
 * 分頁與玩法結構參照 pcv2_0223 的 conf_k3_og.js，文案改繁體。
 *
 * ⚠️ 賠率一律由 k3of.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是產生時的快照，
 *    判定與結算以 helpers 讀出的值為準。216 種結果可窮舉，機率為精確值。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名。
 * ⚠️ combo 分頁（三不同號／二不同號）沒有固定注項清單：注碼由使用者選的點數
 *    在前端用 k3OfComboCodes() 展開，這裡只描述選號規則。
 */
export default [
  {
    name: '三同號',
    key: 'santong',
    // 對應 pcv2 的玩法 1211110（通選／單選兩個分頁）
    list: [
      {
        tabId: 50001,
        tabName: '通選',
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.97 },
        },
        tabGroup: [
          {
            groupName: '三同號通選',
            weight: 3,
            columns: 1,
            groupList: [
              { playId: '50001-001', name: '三同通選', odds: 34.92, weight: 3 },  // 6/216 = 2.7778%（公平 36.000）
            ],
          },
        ],
      },
      {
        tabId: 50002,
        tabName: '單選',
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.97 },
        },
        tabGroup: [
          {
            groupName: '三同號單選',
            weight: 3,
            columns: 3,
            groupList: [
              { playId: '50001-101', name: '三同1', odds: 209.52, weight: 3, nums: [1, 1, 1] },  // 1/216 = 0.4630%（公平 216.000）
              { playId: '50001-102', name: '三同2', odds: 209.52, weight: 3, nums: [2, 2, 2] },  // 1/216 = 0.4630%（公平 216.000）
              { playId: '50001-103', name: '三同3', odds: 209.52, weight: 3, nums: [3, 3, 3] },  // 1/216 = 0.4630%（公平 216.000）
              { playId: '50001-104', name: '三同4', odds: 209.52, weight: 3, nums: [4, 4, 4] },  // 1/216 = 0.4630%（公平 216.000）
              { playId: '50001-105', name: '三同5', odds: 209.52, weight: 3, nums: [5, 5, 5] },  // 1/216 = 0.4630%（公平 216.000）
              { playId: '50001-106', name: '三同6', odds: 209.52, weight: 3, nums: [6, 6, 6] },  // 1/216 = 0.4630%（公平 216.000）
            ],
          },
        ],
      },
    ],
  },
]
