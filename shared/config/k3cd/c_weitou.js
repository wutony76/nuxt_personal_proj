/**
 * 快3 看板設定：圍骰（豹子）
 *
 * ⚠️ 賠率一律由 k3-cd.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是「產生時的快照」，
 *    供畫面直接顯示與注單鎖定；判定與結算仍以 helpers 讀出的值為準。
 */
export default [
  {
    name: '圍骰',
    key: 'weitou',
    // 圍骰 = 三顆同點。指定圍骰押特定點數（1/216）、圍骰全押任意圍骰（6/216）。
    // ⚠️ 圍骰會讓大小單雙判和局，但圍骰本身的注項照常輸贏。
    list: [
      {
        tabId: 33000,
        tabName: '圍骰',
        settings: {
          quota: {
            item: { min: 10, max: 1000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.97 },
        },
        tabGroup: [
          {
            groupName: '指定圍骰',
            weight: 3,
            groupList: [
              { playId: '33000-001', name: '圍111', odds: 209.52, weight: 3 }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '33000-002', name: '圍222', odds: 209.52, weight: 3 }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '33000-003', name: '圍333', odds: 209.52, weight: 3 }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '33000-004', name: '圍444', odds: 209.52, weight: 3 }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '33000-005', name: '圍555', odds: 209.52, weight: 3 }, // 1/216 = 0.4630%（公平 216.000）
              { playId: '33000-006', name: '圍666', odds: 209.52, weight: 3 }, // 1/216 = 0.4630%（公平 216.000）
            ],
          },
          {
            groupName: '圍骰全',
            weight: 3,
            groupList: [
              { playId: '33000-100', name: '圍骰全', odds: 34.92, weight: 3 }, // 6/216 = 2.7778%（公平 36.000）
            ],
          },
        ],
      },
    ],
  },
]
