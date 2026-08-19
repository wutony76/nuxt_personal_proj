/**
 * 時時彩官方盤看板設定總表
 *
 * 玩法、分頁與注項順序全部照 pcv2_0223 的 app/config/bg/conf_sc_og.js（依 sort 排序），
 * 分頁 id 直接沿用那邊的 playTypeId 方便對帳，文案改繁體。本輪只做核心 11 個 playType，
 * 未做的清單見 openspec/reference/ssc-of-todo.md：
 *   101101010 定位膽      ← pcv2 定位胆        5 個球位 × 0~9（單選分頁）
 *   101111110 後二直選    ← pcv2 后二直选·复式  十/個位各選一組，笛卡爾積展開
 *   101111310 後二組選    ← pcv2 后二组选·复式  取 2 碼互異，不計順序
 *   101141010 後三直選    ← pcv2 后三直选·复式  百/十/個位各選一組
 *   101141110 後三組三    ← pcv2 后三组选·组三  取 2 碼（AAB／ABB 都算中）
 *   101141111 後三組六    ← pcv2 后三组选·组六  取 3 碼互異
 *   101161010 五星直選    ← pcv2 五星直选·复式  5 個位置各選一組
 *   101181010 大小單雙後二／101181011 後三／101181012 前二／101181013 前三
 *
 * ── 兩套派彩並存 ────────────────────────────────────────
 *   後三直選（combo.pool = true）→ 吃共用彩池，依命中位數分層（SSC_OF_PRIZE_TIERS）
 *   其餘 10 個分頁                → 固定賠率，由 sscof.ts 依「公平賠率 × rtp」推算
 *   ⚠️ 後三直選 1/1000 配固定賠率不好看，分層之後猜中 2 位也有獎。
 *
 * ── 兩種分頁型態 ────────────────────────────────────────
 *   單選分頁（定位膽）—— groupList 就是注項清單，注碼＝name（第一球0…）
 *   複式分頁（其餘 10 個）—— groupList 只是「該位置／該組可選的號碼」，
 *                          注碼由 sscof/helpers.ts 的 sscOfComboCodes() 展開，
 *                          清單裡找不到，所以驗證改走 combo 規則（見 sscOfHasBetCode）
 *
 * ⚠️ 五星直選全選會展開成 100,000 注，SSC_OF_MAX_COMBO（2000）會直接擋掉整筆。
 * ⚠️ 賠率一律由 sscof.ts 依「公平賠率 × rtp」推算，本檔的 odds／註解只是產生時的快照。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名。
 * ⚠️ pcv2 的「單式」（貼注碼字串）、和值／跨度／包胆本專案未實作，只做「複式」。
 */
export default [
  {
    name: '定位膽',
    key: 'dingwei',
    // 對應 pcv2 的 playId 10110（定位胆），sort 1
    list: [
      {
        tabId: 101101010,
        tabName: '定位膽',
        // 對應 pcv2 的 playTabId 101101010（定位胆）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '第一球',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101101010-0-0', name: '第一球0', odds: 9.6, weight: 2, ball: 0, digit: 0 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-1', name: '第一球1', odds: 9.6, weight: 2, ball: 0, digit: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-2', name: '第一球2', odds: 9.6, weight: 2, ball: 0, digit: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-3', name: '第一球3', odds: 9.6, weight: 2, ball: 0, digit: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-4', name: '第一球4', odds: 9.6, weight: 2, ball: 0, digit: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-5', name: '第一球5', odds: 9.6, weight: 2, ball: 0, digit: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-6', name: '第一球6', odds: 9.6, weight: 2, ball: 0, digit: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-7', name: '第一球7', odds: 9.6, weight: 2, ball: 0, digit: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-8', name: '第一球8', odds: 9.6, weight: 2, ball: 0, digit: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-0-9', name: '第一球9', odds: 9.6, weight: 2, ball: 0, digit: 9 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第二球',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101101010-1-0', name: '第二球0', odds: 9.6, weight: 2, ball: 1, digit: 0 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-1', name: '第二球1', odds: 9.6, weight: 2, ball: 1, digit: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-2', name: '第二球2', odds: 9.6, weight: 2, ball: 1, digit: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-3', name: '第二球3', odds: 9.6, weight: 2, ball: 1, digit: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-4', name: '第二球4', odds: 9.6, weight: 2, ball: 1, digit: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-5', name: '第二球5', odds: 9.6, weight: 2, ball: 1, digit: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-6', name: '第二球6', odds: 9.6, weight: 2, ball: 1, digit: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-7', name: '第二球7', odds: 9.6, weight: 2, ball: 1, digit: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-8', name: '第二球8', odds: 9.6, weight: 2, ball: 1, digit: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-1-9', name: '第二球9', odds: 9.6, weight: 2, ball: 1, digit: 9 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第三球',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101101010-2-0', name: '第三球0', odds: 9.6, weight: 2, ball: 2, digit: 0 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-1', name: '第三球1', odds: 9.6, weight: 2, ball: 2, digit: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-2', name: '第三球2', odds: 9.6, weight: 2, ball: 2, digit: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-3', name: '第三球3', odds: 9.6, weight: 2, ball: 2, digit: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-4', name: '第三球4', odds: 9.6, weight: 2, ball: 2, digit: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-5', name: '第三球5', odds: 9.6, weight: 2, ball: 2, digit: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-6', name: '第三球6', odds: 9.6, weight: 2, ball: 2, digit: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-7', name: '第三球7', odds: 9.6, weight: 2, ball: 2, digit: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-8', name: '第三球8', odds: 9.6, weight: 2, ball: 2, digit: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-2-9', name: '第三球9', odds: 9.6, weight: 2, ball: 2, digit: 9 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第四球',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101101010-3-0', name: '第四球0', odds: 9.6, weight: 2, ball: 3, digit: 0 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-1', name: '第四球1', odds: 9.6, weight: 2, ball: 3, digit: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-2', name: '第四球2', odds: 9.6, weight: 2, ball: 3, digit: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-3', name: '第四球3', odds: 9.6, weight: 2, ball: 3, digit: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-4', name: '第四球4', odds: 9.6, weight: 2, ball: 3, digit: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-5', name: '第四球5', odds: 9.6, weight: 2, ball: 3, digit: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-6', name: '第四球6', odds: 9.6, weight: 2, ball: 3, digit: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-7', name: '第四球7', odds: 9.6, weight: 2, ball: 3, digit: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-8', name: '第四球8', odds: 9.6, weight: 2, ball: 3, digit: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-3-9', name: '第四球9', odds: 9.6, weight: 2, ball: 3, digit: 9 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          },
          {
            groupName: '第五球',
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101101010-4-0', name: '第五球0', odds: 9.6, weight: 2, ball: 4, digit: 0 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-1', name: '第五球1', odds: 9.6, weight: 2, ball: 4, digit: 1 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-2', name: '第五球2', odds: 9.6, weight: 2, ball: 4, digit: 2 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-3', name: '第五球3', odds: 9.6, weight: 2, ball: 4, digit: 3 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-4', name: '第五球4', odds: 9.6, weight: 2, ball: 4, digit: 4 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-5', name: '第五球5', odds: 9.6, weight: 2, ball: 4, digit: 5 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-6', name: '第五球6', odds: 9.6, weight: 2, ball: 4, digit: 6 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-7', name: '第五球7', odds: 9.6, weight: 2, ball: 4, digit: 7 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-8', name: '第五球8', odds: 9.6, weight: 2, ball: 4, digit: 8 }, // 1/10 = 10.0000%（公平 10.000）
              { playId: '101101010-4-9', name: '第五球9', odds: 9.6, weight: 2, ball: 4, digit: 9 }, // 1/10 = 10.0000%（公平 10.000）
            ],
          }
        ],
      }
    ],
  },
  {
    name: '二星',
    key: 'erxing',
    // 對應 pcv2 的 playId 10111（二星），sort 2
    list: [
      {
        tabId: 101111110,
        tabName: '後二直選',
        // 對應 pcv2 的 playTabId 101111110 / playTypeId 101111110（后二直选·复式）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 後二直選12 —— 1/100 = 1.0000%（公平 100.000），odds 96
        combo: { mode: 'direct', section: '後二', positions: 2, minPick: 1, prefix: '後二直選', pool: false },
        tabGroup: [
          {
            groupName: '十位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101111110-0-0', name: '0', digit: 0 },
              { playId: '101111110-0-1', name: '1', digit: 1 },
              { playId: '101111110-0-2', name: '2', digit: 2 },
              { playId: '101111110-0-3', name: '3', digit: 3 },
              { playId: '101111110-0-4', name: '4', digit: 4 },
              { playId: '101111110-0-5', name: '5', digit: 5 },
              { playId: '101111110-0-6', name: '6', digit: 6 },
              { playId: '101111110-0-7', name: '7', digit: 7 },
              { playId: '101111110-0-8', name: '8', digit: 8 },
              { playId: '101111110-0-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '個位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101111110-1-0', name: '0', digit: 0 },
              { playId: '101111110-1-1', name: '1', digit: 1 },
              { playId: '101111110-1-2', name: '2', digit: 2 },
              { playId: '101111110-1-3', name: '3', digit: 3 },
              { playId: '101111110-1-4', name: '4', digit: 4 },
              { playId: '101111110-1-5', name: '5', digit: 5 },
              { playId: '101111110-1-6', name: '6', digit: 6 },
              { playId: '101111110-1-7', name: '7', digit: 7 },
              { playId: '101111110-1-8', name: '8', digit: 8 },
              { playId: '101111110-1-9', name: '9', digit: 9 },
            ],
          }
        ],
      },
      {
        tabId: 101111310,
        tabName: '後二組選',
        // 對應 pcv2 的 playTabId 101111310 / playTypeId 101111310（后二组选·复式）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 後二組選12 —— 2/100 = 2.0000%（公平 50.000），odds 48
        combo: { mode: 'group', group: 'group2', minPick: 2, prefix: '後二組選', pool: false },
        tabGroup: [
          {
            groupName: '組選',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101111310-0-0', name: '0', digit: 0 },
              { playId: '101111310-0-1', name: '1', digit: 1 },
              { playId: '101111310-0-2', name: '2', digit: 2 },
              { playId: '101111310-0-3', name: '3', digit: 3 },
              { playId: '101111310-0-4', name: '4', digit: 4 },
              { playId: '101111310-0-5', name: '5', digit: 5 },
              { playId: '101111310-0-6', name: '6', digit: 6 },
              { playId: '101111310-0-7', name: '7', digit: 7 },
              { playId: '101111310-0-8', name: '8', digit: 8 },
              { playId: '101111310-0-9', name: '9', digit: 9 },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '後三',
    key: 'housan',
    // 對應 pcv2 的 playId 10114（后三），sort 3
    list: [
      {
        tabId: 101141010,
        tabName: '後三直選',
        // 對應 pcv2 的 playTabId 101141010 / playTypeId 101141010（后三直选·复式）
        settings: {
          quota: {
            item: { min: 2, max: 5000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // ★ 彩池分層：不吃固定賠率，依命中位數從共用彩池分配（SSC_OF_PRIZE_TIERS）
        //   命中 3 → 1/1000（0.1000%）／命中 2 → 27/1000（2.7000%）／命中 1 → 243/1000（24.3000%）
        combo: { mode: 'direct', section: '後三', positions: 3, minPick: 1, prefix: '後三直選', pool: true },
        tabGroup: [
          {
            groupName: '百位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101141010-0-0', name: '0', digit: 0 },
              { playId: '101141010-0-1', name: '1', digit: 1 },
              { playId: '101141010-0-2', name: '2', digit: 2 },
              { playId: '101141010-0-3', name: '3', digit: 3 },
              { playId: '101141010-0-4', name: '4', digit: 4 },
              { playId: '101141010-0-5', name: '5', digit: 5 },
              { playId: '101141010-0-6', name: '6', digit: 6 },
              { playId: '101141010-0-7', name: '7', digit: 7 },
              { playId: '101141010-0-8', name: '8', digit: 8 },
              { playId: '101141010-0-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '十位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101141010-1-0', name: '0', digit: 0 },
              { playId: '101141010-1-1', name: '1', digit: 1 },
              { playId: '101141010-1-2', name: '2', digit: 2 },
              { playId: '101141010-1-3', name: '3', digit: 3 },
              { playId: '101141010-1-4', name: '4', digit: 4 },
              { playId: '101141010-1-5', name: '5', digit: 5 },
              { playId: '101141010-1-6', name: '6', digit: 6 },
              { playId: '101141010-1-7', name: '7', digit: 7 },
              { playId: '101141010-1-8', name: '8', digit: 8 },
              { playId: '101141010-1-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '個位',
            // 該群組對應第 3 個位置（複式展開時的索引）
            pos: 2,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101141010-2-0', name: '0', digit: 0 },
              { playId: '101141010-2-1', name: '1', digit: 1 },
              { playId: '101141010-2-2', name: '2', digit: 2 },
              { playId: '101141010-2-3', name: '3', digit: 3 },
              { playId: '101141010-2-4', name: '4', digit: 4 },
              { playId: '101141010-2-5', name: '5', digit: 5 },
              { playId: '101141010-2-6', name: '6', digit: 6 },
              { playId: '101141010-2-7', name: '7', digit: 7 },
              { playId: '101141010-2-8', name: '8', digit: 8 },
              { playId: '101141010-2-9', name: '9', digit: 9 },
            ],
          }
        ],
      },
      {
        tabId: 101141110,
        tabName: '後三組三',
        // 對應 pcv2 的 playTabId 101141110 / playTypeId 101141110（后三组选·组三）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 後三組三12 —— 6/1000 = 0.6000%（公平 166.667）（AAB 與 ABB 都算中），odds 160
        combo: { mode: 'group', group: 'group3', minPick: 2, prefix: '後三組三', pool: false },
        tabGroup: [
          {
            groupName: '組三',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101141110-0-0', name: '0', digit: 0 },
              { playId: '101141110-0-1', name: '1', digit: 1 },
              { playId: '101141110-0-2', name: '2', digit: 2 },
              { playId: '101141110-0-3', name: '3', digit: 3 },
              { playId: '101141110-0-4', name: '4', digit: 4 },
              { playId: '101141110-0-5', name: '5', digit: 5 },
              { playId: '101141110-0-6', name: '6', digit: 6 },
              { playId: '101141110-0-7', name: '7', digit: 7 },
              { playId: '101141110-0-8', name: '8', digit: 8 },
              { playId: '101141110-0-9', name: '9', digit: 9 },
            ],
          }
        ],
      },
      {
        tabId: 101141111,
        tabName: '後三組六',
        // 對應 pcv2 的 playTabId 101141110 / playTypeId 101141111（后三组选·组六）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 後三組六123 —— 6/1000 = 0.6000%（公平 166.667），odds 160
        combo: { mode: 'group', group: 'group6', minPick: 3, prefix: '後三組六', pool: false },
        tabGroup: [
          {
            groupName: '組六',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101141111-0-0', name: '0', digit: 0 },
              { playId: '101141111-0-1', name: '1', digit: 1 },
              { playId: '101141111-0-2', name: '2', digit: 2 },
              { playId: '101141111-0-3', name: '3', digit: 3 },
              { playId: '101141111-0-4', name: '4', digit: 4 },
              { playId: '101141111-0-5', name: '5', digit: 5 },
              { playId: '101141111-0-6', name: '6', digit: 6 },
              { playId: '101141111-0-7', name: '7', digit: 7 },
              { playId: '101141111-0-8', name: '8', digit: 8 },
              { playId: '101141111-0-9', name: '9', digit: 9 },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '五星',
    key: 'wuxing',
    // 對應 pcv2 的 playId 10116（五星），sort 4
    list: [
      {
        tabId: 101161010,
        tabName: '五星直選',
        // 對應 pcv2 的 playTabId 101161010 / playTypeId 101161010（五星直选·复式）
        settings: {
          quota: {
            item: { min: 2, max: 100 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 五星直選01234 —— 1/100000 = 0.0010%（公平 100000.000），odds 96000
        combo: { mode: 'direct', section: '五星', positions: 5, minPick: 1, prefix: '五星直選', pool: false },
        tabGroup: [
          {
            groupName: '萬位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101161010-0-0', name: '0', digit: 0 },
              { playId: '101161010-0-1', name: '1', digit: 1 },
              { playId: '101161010-0-2', name: '2', digit: 2 },
              { playId: '101161010-0-3', name: '3', digit: 3 },
              { playId: '101161010-0-4', name: '4', digit: 4 },
              { playId: '101161010-0-5', name: '5', digit: 5 },
              { playId: '101161010-0-6', name: '6', digit: 6 },
              { playId: '101161010-0-7', name: '7', digit: 7 },
              { playId: '101161010-0-8', name: '8', digit: 8 },
              { playId: '101161010-0-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '千位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101161010-1-0', name: '0', digit: 0 },
              { playId: '101161010-1-1', name: '1', digit: 1 },
              { playId: '101161010-1-2', name: '2', digit: 2 },
              { playId: '101161010-1-3', name: '3', digit: 3 },
              { playId: '101161010-1-4', name: '4', digit: 4 },
              { playId: '101161010-1-5', name: '5', digit: 5 },
              { playId: '101161010-1-6', name: '6', digit: 6 },
              { playId: '101161010-1-7', name: '7', digit: 7 },
              { playId: '101161010-1-8', name: '8', digit: 8 },
              { playId: '101161010-1-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '百位',
            // 該群組對應第 3 個位置（複式展開時的索引）
            pos: 2,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101161010-2-0', name: '0', digit: 0 },
              { playId: '101161010-2-1', name: '1', digit: 1 },
              { playId: '101161010-2-2', name: '2', digit: 2 },
              { playId: '101161010-2-3', name: '3', digit: 3 },
              { playId: '101161010-2-4', name: '4', digit: 4 },
              { playId: '101161010-2-5', name: '5', digit: 5 },
              { playId: '101161010-2-6', name: '6', digit: 6 },
              { playId: '101161010-2-7', name: '7', digit: 7 },
              { playId: '101161010-2-8', name: '8', digit: 8 },
              { playId: '101161010-2-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '十位',
            // 該群組對應第 4 個位置（複式展開時的索引）
            pos: 3,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101161010-3-0', name: '0', digit: 0 },
              { playId: '101161010-3-1', name: '1', digit: 1 },
              { playId: '101161010-3-2', name: '2', digit: 2 },
              { playId: '101161010-3-3', name: '3', digit: 3 },
              { playId: '101161010-3-4', name: '4', digit: 4 },
              { playId: '101161010-3-5', name: '5', digit: 5 },
              { playId: '101161010-3-6', name: '6', digit: 6 },
              { playId: '101161010-3-7', name: '7', digit: 7 },
              { playId: '101161010-3-8', name: '8', digit: 8 },
              { playId: '101161010-3-9', name: '9', digit: 9 },
            ],
          },
          {
            groupName: '個位',
            // 該群組對應第 5 個位置（複式展開時的索引）
            pos: 4,
            weight: 2,
            columns: 5,
            groupList: [
              { playId: '101161010-4-0', name: '0', digit: 0 },
              { playId: '101161010-4-1', name: '1', digit: 1 },
              { playId: '101161010-4-2', name: '2', digit: 2 },
              { playId: '101161010-4-3', name: '3', digit: 3 },
              { playId: '101161010-4-4', name: '4', digit: 4 },
              { playId: '101161010-4-5', name: '5', digit: 5 },
              { playId: '101161010-4-6', name: '6', digit: 6 },
              { playId: '101161010-4-7', name: '7', digit: 7 },
              { playId: '101161010-4-8', name: '8', digit: 8 },
              { playId: '101161010-4-9', name: '9', digit: 9 },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '大小單雙',
    key: 'daxiao',
    // 對應 pcv2 的 playId 10118（大小单双），sort 5
    list: [
      {
        tabId: 101181010,
        tabName: '後二',
        // 對應 pcv2 的 playTabId 101181010 / playTypeId 101181010（大小单双·后二）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 大小單雙後二大大 —— 25/100 = 25.0000%（公平 4.000），odds 3.84
        combo: { mode: 'sides', section: '後二', positions: 2, minPick: 1, prefix: '大小單雙後二', pool: false },
        tabGroup: [
          {
            groupName: '十位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181010-0-大', name: '大', side: '大' },
              { playId: '101181010-0-小', name: '小', side: '小' },
              { playId: '101181010-0-單', name: '單', side: '單' },
              { playId: '101181010-0-雙', name: '雙', side: '雙' },
            ],
          },
          {
            groupName: '個位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181010-1-大', name: '大', side: '大' },
              { playId: '101181010-1-小', name: '小', side: '小' },
              { playId: '101181010-1-單', name: '單', side: '單' },
              { playId: '101181010-1-雙', name: '雙', side: '雙' },
            ],
          }
        ],
      },
      {
        tabId: 101181011,
        tabName: '後三',
        // 對應 pcv2 的 playTabId 101181010 / playTypeId 101181011（大小单双·后三）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 大小單雙後三大大大 —— 125/1000 = 12.5000%（公平 8.000），odds 7.68
        combo: { mode: 'sides', section: '後三', positions: 3, minPick: 1, prefix: '大小單雙後三', pool: false },
        tabGroup: [
          {
            groupName: '百位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181011-0-大', name: '大', side: '大' },
              { playId: '101181011-0-小', name: '小', side: '小' },
              { playId: '101181011-0-單', name: '單', side: '單' },
              { playId: '101181011-0-雙', name: '雙', side: '雙' },
            ],
          },
          {
            groupName: '十位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181011-1-大', name: '大', side: '大' },
              { playId: '101181011-1-小', name: '小', side: '小' },
              { playId: '101181011-1-單', name: '單', side: '單' },
              { playId: '101181011-1-雙', name: '雙', side: '雙' },
            ],
          },
          {
            groupName: '個位',
            // 該群組對應第 3 個位置（複式展開時的索引）
            pos: 2,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181011-2-大', name: '大', side: '大' },
              { playId: '101181011-2-小', name: '小', side: '小' },
              { playId: '101181011-2-單', name: '單', side: '單' },
              { playId: '101181011-2-雙', name: '雙', side: '雙' },
            ],
          }
        ],
      },
      {
        tabId: 101181012,
        tabName: '前二',
        // 對應 pcv2 的 playTabId 101181010 / playTypeId 101181012（大小单双·前二）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 大小單雙前二大大 —— 25/100 = 25.0000%（公平 4.000），odds 3.84
        combo: { mode: 'sides', section: '前二', positions: 2, minPick: 1, prefix: '大小單雙前二', pool: false },
        tabGroup: [
          {
            groupName: '萬位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181012-0-大', name: '大', side: '大' },
              { playId: '101181012-0-小', name: '小', side: '小' },
              { playId: '101181012-0-單', name: '單', side: '單' },
              { playId: '101181012-0-雙', name: '雙', side: '雙' },
            ],
          },
          {
            groupName: '千位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181012-1-大', name: '大', side: '大' },
              { playId: '101181012-1-小', name: '小', side: '小' },
              { playId: '101181012-1-單', name: '單', side: '單' },
              { playId: '101181012-1-雙', name: '雙', side: '雙' },
            ],
          }
        ],
      },
      {
        tabId: 101181013,
        tabName: '前三',
        // 對應 pcv2 的 playTabId 101181010 / playTypeId 101181013（大小单双·前三）
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 500000 },
          },
          payout: { rtp: 0.96 },
        },
        // 大小單雙前三大大大 —— 125/1000 = 12.5000%（公平 8.000），odds 7.68
        combo: { mode: 'sides', section: '前三', positions: 3, minPick: 1, prefix: '大小單雙前三', pool: false },
        tabGroup: [
          {
            groupName: '萬位',
            // 該群組對應第 1 個位置（複式展開時的索引）
            pos: 0,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181013-0-大', name: '大', side: '大' },
              { playId: '101181013-0-小', name: '小', side: '小' },
              { playId: '101181013-0-單', name: '單', side: '單' },
              { playId: '101181013-0-雙', name: '雙', side: '雙' },
            ],
          },
          {
            groupName: '千位',
            // 該群組對應第 2 個位置（複式展開時的索引）
            pos: 1,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181013-1-大', name: '大', side: '大' },
              { playId: '101181013-1-小', name: '小', side: '小' },
              { playId: '101181013-1-單', name: '單', side: '單' },
              { playId: '101181013-1-雙', name: '雙', side: '雙' },
            ],
          },
          {
            groupName: '百位',
            // 該群組對應第 3 個位置（複式展開時的索引）
            pos: 2,
            weight: 2,
            columns: 4,
            groupList: [
              { playId: '101181013-2-大', name: '大', side: '大' },
              { playId: '101181013-2-小', name: '小', side: '小' },
              { playId: '101181013-2-單', name: '單', side: '單' },
              { playId: '101181013-2-雙', name: '雙', side: '雙' },
            ],
          }
        ],
      }
    ],
  },
]
