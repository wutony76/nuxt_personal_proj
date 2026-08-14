/**
 * 快3 看板設定：圍骰 / 全骰
 *
 * 分頁與群組結構參照 pcv2_0223 的 conf_k3_cd.js（三軍/大小/點數、圍骰/全骰、長牌/短牌），
 * 讓投注畫面與操作方式一致；文案改繁體。
 *
 * ⚠️ 賠率一律由 k3-cd.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是產生時的快照，
 *    判定與結算以 helpers 讀出的值為準。216 種結果可窮舉，機率為精確值。
 * ⚠️ nums 僅供畫面渲染骰子點（長牌／短牌），判定一律看 name（注碼）。
 */
export default [
  {
    name: '圍骰/全骰',
    key: 'weitou',
    // 對應 pcv2 的分頁 122102 —— 它把「圍骰」與「全骰」併成同一個 4 欄格呈現，
    // 這裡用兩個 group 但都設 columns: 4，視覺上等同併排。
    list: [
      {
        tabId: 40001,
        tabName: '圍骰/全骰',
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.97 },
        },
        tabGroup: [
          {
            groupName: '圍骰',
            weight: 3,
            // pcv2 的版面：本群組一列排 4 個注項
            columns: 4,
            groupList: [
              { playId: '40001-001', name: '圍111', odds: 209.52, weight: 3, nums: [1, 1, 1] }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '40001-002', name: '圍222', odds: 209.52, weight: 3, nums: [2, 2, 2] }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '40001-003', name: '圍333', odds: 209.52, weight: 3, nums: [3, 3, 3] }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '40001-004', name: '圍444', odds: 209.52, weight: 3, nums: [4, 4, 4] }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '40001-005', name: '圍555', odds: 209.52, weight: 3, nums: [5, 5, 5] }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '40001-006', name: '圍666', odds: 209.52, weight: 3, nums: [6, 6, 6] }, // 1/216 = 0.4630%（公平 216.000）
            ],
          },
          {
            groupName: '全骰',
            weight: 3,
            // pcv2 的版面：本群組一列排 4 個注項
            columns: 4,
            groupList: [
              { playId: '40001-100', name: '圍骰全', odds: 34.92, weight: 3 }, // 6/216 = 2.7778%（公平 36.000）
            ],
          },
        ],
      },
    ],
  },
]
