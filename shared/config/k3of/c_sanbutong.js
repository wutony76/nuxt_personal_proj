/**
 * 快3 官方盤看板設定：三不同號
 *
 * 分頁與玩法結構參照 pcv2_0223 的 conf_k3_og.js，文案改繁體。
 *
 * ⚠️ 這是「組合玩法」：沒有固定的注項清單 —— 使用者從 1~6 選點數，
 *    注碼由前端用 k3OfComboCodes() 展開成一注一注（標準 C(n,3)、膽拖 C(拖,3−膽)）。
 *    因此 groupList 只放 1~6 這 6 個「可選點數」，實際注碼在送單時才成形。
 * ⚠️ 賠率一律由 k3of.ts 依「公平賠率 × rtp」推算（每一注的賠率都相同），
 *    本檔的 odds 只是產生時的快照。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名。
 */
export default [
  {
    name: '三不同號',
    key: 'sanbutong',
    list: [
      {
        tabId: 50006,
        tabName: '標準',
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.97 },
        },
        // combo：一注 3 個不同點數，至少要選 3 個；注碼前綴 三不同
        combo: { mode: 'standard', pick: 3, prefix: '三不同' },
        tabGroup: [
          {
            groupName: '選 3 個以上不同點數',
            weight: 3,
            columns: 6,
            groupList: [
              { playId: '50006-1', name: '1', odds: 34.92, weight: 3, nums: [1] },
              { playId: '50006-2', name: '2', odds: 34.92, weight: 3, nums: [2] },
              { playId: '50006-3', name: '3', odds: 34.92, weight: 3, nums: [3] },
              { playId: '50006-4', name: '4', odds: 34.92, weight: 3, nums: [4] },
              { playId: '50006-5', name: '5', odds: 34.92, weight: 3, nums: [5] },
              { playId: '50006-6', name: '6', odds: 34.92, weight: 3, nums: [6] },
            ],
          },
        ],
      },
      {
        tabId: 50007,
        tabName: '膽拖',
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.97 },
        },
        // combo：膽碼必含（1 ~ 2 個），拖碼補滿 3 個
        combo: { mode: 'dantuo', pick: 3, prefix: '三不同', maxDan: 2 },
        tabGroup: [
          {
            groupName: '膽碼',
            groupTag: 'dan',
            weight: 3,
            columns: 6,
            groupList: [
              { playId: '50007-1-dan', name: '1', odds: 34.92, weight: 3, nums: [1], tag: 'dan' },
              { playId: '50007-2-dan', name: '2', odds: 34.92, weight: 3, nums: [2], tag: 'dan' },
              { playId: '50007-3-dan', name: '3', odds: 34.92, weight: 3, nums: [3], tag: 'dan' },
              { playId: '50007-4-dan', name: '4', odds: 34.92, weight: 3, nums: [4], tag: 'dan' },
              { playId: '50007-5-dan', name: '5', odds: 34.92, weight: 3, nums: [5], tag: 'dan' },
              { playId: '50007-6-dan', name: '6', odds: 34.92, weight: 3, nums: [6], tag: 'dan' },
            ],
          },
          {
            groupName: '拖碼',
            groupTag: 'tuo',
            weight: 3,
            columns: 6,
            groupList: [
              { playId: '50007-1-tuo', name: '1', odds: 34.92, weight: 3, nums: [1], tag: 'tuo' },
              { playId: '50007-2-tuo', name: '2', odds: 34.92, weight: 3, nums: [2], tag: 'tuo' },
              { playId: '50007-3-tuo', name: '3', odds: 34.92, weight: 3, nums: [3], tag: 'tuo' },
              { playId: '50007-4-tuo', name: '4', odds: 34.92, weight: 3, nums: [4], tag: 'tuo' },
              { playId: '50007-5-tuo', name: '5', odds: 34.92, weight: 3, nums: [5], tag: 'tuo' },
              { playId: '50007-6-tuo', name: '6', odds: 34.92, weight: 3, nums: [6], tag: 'tuo' },
            ],
          },
        ],
      },
    ],
  },
]
