/**
 * PK10 官方盤看板設定總表
 *
 * 玩法、分頁與注項順序全部照 pcv2_0223 的 app/config/bg/conf_pk10_og.js，
 * 分頁 id 也直接沿用那邊的 playTabId 方便對帳，文案改繁體：
 *   141101010 前一直選  ← pcv2 前一（14110）    冠軍選車號
 *   141111011 前二直選  ← pcv2 前二（14111）    冠軍 + 亞軍複式
 *   141121011 前三直選  ← pcv2 前三（14112）    冠軍 + 亞軍 + 季軍複式 ★ 彩池分層
 *   141131010 定位膽    ← pcv2 定位胆（14113）  10 個名次各選車號
 *
 * ── 兩套派彩並存 ────────────────────────────────────────
 *   前三直選（combo.pool = true）→ 吃共用彩池，依命中名次數分層（PK10_OF_PRIZE_TIERS）
 *   其餘三個玩法                 → 固定賠率，由 pk10of.ts 依「公平賠率 × rtp」推算
 *   ⚠️ 前三 1/720 配固定賠率不好看，分層之後猜中 2 個名次也有獎。
 *
 * ── combo 分頁沒有固定注項清單 ──────────────────────────
 *   前二／前三是複式：groupList 只是「該名次可以選的車號」，
 *   實際注碼由 pk10DirectCombos() 展開（前二 → 前二05-03、前三 → codes 陣列）。
 *   pos 欄位標記該群組對應第幾個名次（0 起算）。
 *
 * ⚠️ 賠率一律由 pk10of.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是產生時的快照。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西），理由同 pk10cd/plays.js。
 * ⚠️ pcv2 的「單式」（貼注碼字串）模式本專案未實作，只做「複式」。
 */
export default [
  {
    name: '前一直選',
    key: 'qianyi',
    // pcv2 的 sort 1
    list: [
      {
        tabId: 141101010,
        tabName: '前一直選',
        // 對應 pcv2 的 playTabId 141101010（前一直选）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '冠軍',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141101010-01', name: '前一01', odds: 9.6, weight: 2, car: 1 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 01 號車
              { playId: '141101010-02', name: '前一02', odds: 9.6, weight: 2, car: 2 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 02 號車
              { playId: '141101010-03', name: '前一03', odds: 9.6, weight: 2, car: 3 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 03 號車
              { playId: '141101010-04', name: '前一04', odds: 9.6, weight: 2, car: 4 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 04 號車
              { playId: '141101010-05', name: '前一05', odds: 9.6, weight: 2, car: 5 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 05 號車
              { playId: '141101010-06', name: '前一06', odds: 9.6, weight: 2, car: 6 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 06 號車
              { playId: '141101010-07', name: '前一07', odds: 9.6, weight: 2, car: 7 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 07 號車
              { playId: '141101010-08', name: '前一08', odds: 9.6, weight: 2, car: 8 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 08 號車
              { playId: '141101010-09', name: '前一09', odds: 9.6, weight: 2, car: 9 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 09 號車
              { playId: '141101010-10', name: '前一10', odds: 9.6, weight: 2, car: 10 }, // 1/10 = 10.0000%（公平 10.000） 冠軍開出 10 號車
            ],
          }
        ],
      }
    ],
  },
  {
    name: '前二直選',
    key: 'qianer',
    // pcv2 的 sort 2
    list: [
      {
        tabId: 141111011,
        tabName: '前二直選',
        // 對應 pcv2 的 playTabId 141111011（前二直选·复式）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', positions: 2, prefix: '前二', pool: false },
        tabGroup: [
          {
            groupName: '冠軍',
            // 該群組對應第 1 個名次（複式展開時的位置索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141111011-0-01', name: '01', car: 1 },
              { playId: '141111011-0-02', name: '02', car: 2 },
              { playId: '141111011-0-03', name: '03', car: 3 },
              { playId: '141111011-0-04', name: '04', car: 4 },
              { playId: '141111011-0-05', name: '05', car: 5 },
              { playId: '141111011-0-06', name: '06', car: 6 },
              { playId: '141111011-0-07', name: '07', car: 7 },
              { playId: '141111011-0-08', name: '08', car: 8 },
              { playId: '141111011-0-09', name: '09', car: 9 },
              { playId: '141111011-0-10', name: '10', car: 10 },
            ],
          },
          {
            groupName: '亞軍',
            // 該群組對應第 2 個名次（複式展開時的位置索引）
            pos: 1,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141111011-1-01', name: '01', car: 1 },
              { playId: '141111011-1-02', name: '02', car: 2 },
              { playId: '141111011-1-03', name: '03', car: 3 },
              { playId: '141111011-1-04', name: '04', car: 4 },
              { playId: '141111011-1-05', name: '05', car: 5 },
              { playId: '141111011-1-06', name: '06', car: 6 },
              { playId: '141111011-1-07', name: '07', car: 7 },
              { playId: '141111011-1-08', name: '08', car: 8 },
              { playId: '141111011-1-09', name: '09', car: 9 },
              { playId: '141111011-1-10', name: '10', car: 10 },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '前三直選',
    key: 'qiansan',
    // pcv2 的 sort 3
    list: [
      {
        tabId: 141121011,
        tabName: '前三直選',
        // 對應 pcv2 的 playTabId 141121011（前三直选·复式）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', positions: 3, prefix: '前三', pool: true },
        tabGroup: [
          {
            groupName: '冠軍',
            // 該群組對應第 1 個名次（複式展開時的位置索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141121011-0-01', name: '01', car: 1 },
              { playId: '141121011-0-02', name: '02', car: 2 },
              { playId: '141121011-0-03', name: '03', car: 3 },
              { playId: '141121011-0-04', name: '04', car: 4 },
              { playId: '141121011-0-05', name: '05', car: 5 },
              { playId: '141121011-0-06', name: '06', car: 6 },
              { playId: '141121011-0-07', name: '07', car: 7 },
              { playId: '141121011-0-08', name: '08', car: 8 },
              { playId: '141121011-0-09', name: '09', car: 9 },
              { playId: '141121011-0-10', name: '10', car: 10 },
            ],
          },
          {
            groupName: '亞軍',
            // 該群組對應第 2 個名次（複式展開時的位置索引）
            pos: 1,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141121011-1-01', name: '01', car: 1 },
              { playId: '141121011-1-02', name: '02', car: 2 },
              { playId: '141121011-1-03', name: '03', car: 3 },
              { playId: '141121011-1-04', name: '04', car: 4 },
              { playId: '141121011-1-05', name: '05', car: 5 },
              { playId: '141121011-1-06', name: '06', car: 6 },
              { playId: '141121011-1-07', name: '07', car: 7 },
              { playId: '141121011-1-08', name: '08', car: 8 },
              { playId: '141121011-1-09', name: '09', car: 9 },
              { playId: '141121011-1-10', name: '10', car: 10 },
            ],
          },
          {
            groupName: '季軍',
            // 該群組對應第 3 個名次（複式展開時的位置索引）
            pos: 2,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141121011-2-01', name: '01', car: 1 },
              { playId: '141121011-2-02', name: '02', car: 2 },
              { playId: '141121011-2-03', name: '03', car: 3 },
              { playId: '141121011-2-04', name: '04', car: 4 },
              { playId: '141121011-2-05', name: '05', car: 5 },
              { playId: '141121011-2-06', name: '06', car: 6 },
              { playId: '141121011-2-07', name: '07', car: 7 },
              { playId: '141121011-2-08', name: '08', car: 8 },
              { playId: '141121011-2-09', name: '09', car: 9 },
              { playId: '141121011-2-10', name: '10', car: 10 },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '定位膽',
    key: 'dingwei',
    // pcv2 的 sort 4
    list: [
      {
        tabId: 141131010,
        tabName: '定位膽',
        // 對應 pcv2 的 playTabId 141131010（定位胆）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '冠軍',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-1-01', name: '冠軍01', odds: 9.6, weight: 2, car: 1, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-02', name: '冠軍02', odds: 9.6, weight: 2, car: 2, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-03', name: '冠軍03', odds: 9.6, weight: 2, car: 3, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-04', name: '冠軍04', odds: 9.6, weight: 2, car: 4, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-05', name: '冠軍05', odds: 9.6, weight: 2, car: 5, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-06', name: '冠軍06', odds: 9.6, weight: 2, car: 6, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-07', name: '冠軍07', odds: 9.6, weight: 2, car: 7, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-08', name: '冠軍08', odds: 9.6, weight: 2, car: 8, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-09', name: '冠軍09', odds: 9.6, weight: 2, car: 9, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-1-10', name: '冠軍10', odds: 9.6, weight: 2, car: 10, rank: 1 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '亞軍',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-2-01', name: '亞軍01', odds: 9.6, weight: 2, car: 1, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-02', name: '亞軍02', odds: 9.6, weight: 2, car: 2, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-03', name: '亞軍03', odds: 9.6, weight: 2, car: 3, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-04', name: '亞軍04', odds: 9.6, weight: 2, car: 4, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-05', name: '亞軍05', odds: 9.6, weight: 2, car: 5, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-06', name: '亞軍06', odds: 9.6, weight: 2, car: 6, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-07', name: '亞軍07', odds: 9.6, weight: 2, car: 7, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-08', name: '亞軍08', odds: 9.6, weight: 2, car: 8, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-09', name: '亞軍09', odds: 9.6, weight: 2, car: 9, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-2-10', name: '亞軍10', odds: 9.6, weight: 2, car: 10, rank: 2 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第三名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-3-01', name: '第三名01', odds: 9.6, weight: 2, car: 1, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-02', name: '第三名02', odds: 9.6, weight: 2, car: 2, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-03', name: '第三名03', odds: 9.6, weight: 2, car: 3, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-04', name: '第三名04', odds: 9.6, weight: 2, car: 4, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-05', name: '第三名05', odds: 9.6, weight: 2, car: 5, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-06', name: '第三名06', odds: 9.6, weight: 2, car: 6, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-07', name: '第三名07', odds: 9.6, weight: 2, car: 7, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-08', name: '第三名08', odds: 9.6, weight: 2, car: 8, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-09', name: '第三名09', odds: 9.6, weight: 2, car: 9, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-3-10', name: '第三名10', odds: 9.6, weight: 2, car: 10, rank: 3 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第四名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-4-01', name: '第四名01', odds: 9.6, weight: 2, car: 1, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-02', name: '第四名02', odds: 9.6, weight: 2, car: 2, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-03', name: '第四名03', odds: 9.6, weight: 2, car: 3, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-04', name: '第四名04', odds: 9.6, weight: 2, car: 4, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-05', name: '第四名05', odds: 9.6, weight: 2, car: 5, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-06', name: '第四名06', odds: 9.6, weight: 2, car: 6, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-07', name: '第四名07', odds: 9.6, weight: 2, car: 7, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-08', name: '第四名08', odds: 9.6, weight: 2, car: 8, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-09', name: '第四名09', odds: 9.6, weight: 2, car: 9, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-4-10', name: '第四名10', odds: 9.6, weight: 2, car: 10, rank: 4 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第五名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-5-01', name: '第五名01', odds: 9.6, weight: 2, car: 1, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-02', name: '第五名02', odds: 9.6, weight: 2, car: 2, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-03', name: '第五名03', odds: 9.6, weight: 2, car: 3, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-04', name: '第五名04', odds: 9.6, weight: 2, car: 4, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-05', name: '第五名05', odds: 9.6, weight: 2, car: 5, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-06', name: '第五名06', odds: 9.6, weight: 2, car: 6, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-07', name: '第五名07', odds: 9.6, weight: 2, car: 7, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-08', name: '第五名08', odds: 9.6, weight: 2, car: 8, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-09', name: '第五名09', odds: 9.6, weight: 2, car: 9, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-5-10', name: '第五名10', odds: 9.6, weight: 2, car: 10, rank: 5 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第六名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-6-01', name: '第六名01', odds: 9.6, weight: 2, car: 1, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-02', name: '第六名02', odds: 9.6, weight: 2, car: 2, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-03', name: '第六名03', odds: 9.6, weight: 2, car: 3, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-04', name: '第六名04', odds: 9.6, weight: 2, car: 4, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-05', name: '第六名05', odds: 9.6, weight: 2, car: 5, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-06', name: '第六名06', odds: 9.6, weight: 2, car: 6, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-07', name: '第六名07', odds: 9.6, weight: 2, car: 7, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-08', name: '第六名08', odds: 9.6, weight: 2, car: 8, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-09', name: '第六名09', odds: 9.6, weight: 2, car: 9, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-6-10', name: '第六名10', odds: 9.6, weight: 2, car: 10, rank: 6 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第七名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-7-01', name: '第七名01', odds: 9.6, weight: 2, car: 1, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-02', name: '第七名02', odds: 9.6, weight: 2, car: 2, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-03', name: '第七名03', odds: 9.6, weight: 2, car: 3, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-04', name: '第七名04', odds: 9.6, weight: 2, car: 4, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-05', name: '第七名05', odds: 9.6, weight: 2, car: 5, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-06', name: '第七名06', odds: 9.6, weight: 2, car: 6, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-07', name: '第七名07', odds: 9.6, weight: 2, car: 7, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-08', name: '第七名08', odds: 9.6, weight: 2, car: 8, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-09', name: '第七名09', odds: 9.6, weight: 2, car: 9, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-7-10', name: '第七名10', odds: 9.6, weight: 2, car: 10, rank: 7 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第八名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-8-01', name: '第八名01', odds: 9.6, weight: 2, car: 1, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-02', name: '第八名02', odds: 9.6, weight: 2, car: 2, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-03', name: '第八名03', odds: 9.6, weight: 2, car: 3, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-04', name: '第八名04', odds: 9.6, weight: 2, car: 4, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-05', name: '第八名05', odds: 9.6, weight: 2, car: 5, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-06', name: '第八名06', odds: 9.6, weight: 2, car: 6, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-07', name: '第八名07', odds: 9.6, weight: 2, car: 7, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-08', name: '第八名08', odds: 9.6, weight: 2, car: 8, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-09', name: '第八名09', odds: 9.6, weight: 2, car: 9, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-8-10', name: '第八名10', odds: 9.6, weight: 2, car: 10, rank: 8 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第九名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-9-01', name: '第九名01', odds: 9.6, weight: 2, car: 1, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-02', name: '第九名02', odds: 9.6, weight: 2, car: 2, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-03', name: '第九名03', odds: 9.6, weight: 2, car: 3, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-04', name: '第九名04', odds: 9.6, weight: 2, car: 4, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-05', name: '第九名05', odds: 9.6, weight: 2, car: 5, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-06', name: '第九名06', odds: 9.6, weight: 2, car: 6, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-07', name: '第九名07', odds: 9.6, weight: 2, car: 7, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-08', name: '第九名08', odds: 9.6, weight: 2, car: 8, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-09', name: '第九名09', odds: 9.6, weight: 2, car: 9, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-9-10', name: '第九名10', odds: 9.6, weight: 2, car: 10, rank: 9 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第十名',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '141131010-10-01', name: '第十名01', odds: 9.6, weight: 2, car: 1, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-02', name: '第十名02', odds: 9.6, weight: 2, car: 2, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-03', name: '第十名03', odds: 9.6, weight: 2, car: 3, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-04', name: '第十名04', odds: 9.6, weight: 2, car: 4, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-05', name: '第十名05', odds: 9.6, weight: 2, car: 5, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-06', name: '第十名06', odds: 9.6, weight: 2, car: 6, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-07', name: '第十名07', odds: 9.6, weight: 2, car: 7, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-08', name: '第十名08', odds: 9.6, weight: 2, car: 8, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-09', name: '第十名09', odds: 9.6, weight: 2, car: 9, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '141131010-10-10', name: '第十名10', odds: 9.6, weight: 2, car: 10, rank: 10 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          }
        ],
      }
    ],
  },
]
