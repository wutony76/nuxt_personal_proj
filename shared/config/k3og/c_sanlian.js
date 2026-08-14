/**
 * 快3 官方盤看板設定：三連號
 *
 * 分頁與玩法結構參照 pcv2_0223 的 conf_k3_og.js，文案改繁體。
 *
 * ⚠️ 賠率一律由 k3og.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是產生時的快照，
 *    判定與結算以 helpers 讀出的值為準。216 種結果可窮舉，機率為精確值。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名。
 * ⚠️ combo 分頁（三不同號／二不同號）沒有固定注項清單：注碼由使用者選的點數
 *    在前端用 k3OgComboCodes() 展開，這裡只描述選號規則。
 */
export default [
  {
    name: '三連號',
    key: 'sanlian',
    // 對應 pcv2 的玩法 1211310。連號只有 123／234／345／456 四組，故只有通選
    list: [
      {
        tabId: 50003,
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
            groupName: '三連號通選',
            weight: 2,
            columns: 1,
            groupList: [
              { playId: '50003-001', name: '三連通選', odds: 8.73, weight: 2 },  // 24/216 = 11.1111%（公平 9.000）
            ],
          },
        ],
      },
    ],
  },
]
