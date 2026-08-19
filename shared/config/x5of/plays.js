/**
 * 11選5 官方盤看板設定總表
 *
 * 玩法、分頁與注項順序全部照 bglottery 的
 * src/components/room/lotteryAll/11x5/config_11x5.js（8 個 playTab），
 * tabId 直接沿用來源的 playId 方便對帳：
 *   三碼      11110  前三／中三／後三 × 直選複式・直選單式・組選複式・組選單式・組選膽拖（15 分頁）
 *   二碼      11111  前二／後二 × 同上（10 分頁）
 *   不定位    11112  前三／中三／後三 一碼不定位（3 分頁）
 *   定位膽    11113  5 球位 × 號碼 01~11（1 分頁）
 *   任選複式  11114  任選一中一 ~ 任選八中五（8 分頁）
 *   任選單式  11115  同上（8 分頁）
 *   任選膽拖  11116  任選二 ~ 任選八（7 分頁）
 *   趣味玩法  11117  猜中位・定單雙（2 分頁）
 *
 * ── 四種選號型態（combo.mode）────────────────────────────
 *   direct  位置直選：每個球位選一組號碼，笛卡爾積展開（**要濾掉重複號碼**）
 *   group   組選：一組號碼取 size 個，不計順序
 *   any     任選：一組號碼取 size 個（N > 5 時中的仍是 5 碼）
 *   dantuo  膽拖：膽碼固定進每一注，拖碼補到 size 碼
 *   single  單式：注碼由 x5of/helpers 的 x5OfSingleCodes() **依 conf 全部列出**讓玩家直接選
 *           （來源是文字輸入框，本專案改成列出來選，不讓玩家手動輸入號碼串）
 *   combo = null 代表「單選分頁」：注項就在 groupList 裡（定位膽／不定位／趣味玩法）
 *
 * ⚠️ 單式分頁的 groupList 是**空的** —— 990 / 462 個注碼不寫進設定檔，
 *    由 helpers 依 combo 的 kind/section/size 即時列舉。空群組只是用來掛 weight。
 * ⚠️ 只有「後三直選」的兩個分頁（複式 111101410、單式 111101411）走**彩池分層**
 *    （combo.pool = true，見 shared/config/x5-of.ts 的 X5_OF_PRIZE_TIERS），
 *    其餘分頁一律固定賠率。彩池分頁的 odds 一律回 0。
 * ⚠️ 賠率一律由 x5-of.ts 依「公平賠率 × rtp」推算，本檔的 odds 只是產生時的快照。
 * ⚠️ weight 為爆池分配權重（官方盤與信用盤共吃一池），沿用 6hc 的理論賠率分級法
 *    （1/命中機率 ≥20→3、2.5~20→2、<2.5→1）。複式／膽拖／單式分頁的注碼不在清單裡，
 *    helpers 會退回該分頁第一個群組的 weight。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名。
 * ⚠️ 本檔由 scratchpad 的 gen-x5of.mjs 產生，改規則請改產生器後重跑，不要手改。
 */
export default [
  {
    name: '三碼',
    key: 'sanma',
    // 來源 playTab 11110（三碼）：前三／中三／後三 × 直選複式・直選單式・組選複式・組選單式・組選膽拖
    list: [
      {
        tabId: 111101010,
        tabName: '前三直選複式',
        // 樣本注碼 前三直選010203 // 1/990 = 0.1010%（公平 990.000）　賠率 950.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', prefix: '前三直選', section: '前三', positions: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '第一位',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第二位',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第三位',
            pos: 2,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101011,
        tabName: '前三直選單式',
        // 樣本注碼 前三直選010203 // 1/990 = 0.1010%（公平 990.000）　賠率 950.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'direct', prefix: '前三直選', section: '前三', positions: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111101110,
        tabName: '前三組選複式',
        // 樣本注碼 前三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'group', prefix: '前三組選', section: '前三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '複式',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 3,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101111,
        tabName: '前三組選單式',
        // 樣本注碼 前三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'group', prefix: '前三組選', section: '前三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111101112,
        tabName: '前三組選膽拖',
        // 樣本注碼 前三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '前三組選', section: '前三', size: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101210,
        tabName: '中三直選複式',
        // 樣本注碼 中三直選010203 // 1/990 = 0.1010%（公平 990.000）　賠率 950.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', prefix: '中三直選', section: '中三', positions: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '第二位',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第三位',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第四位',
            pos: 2,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101211,
        tabName: '中三直選單式',
        // 樣本注碼 中三直選010203 // 1/990 = 0.1010%（公平 990.000）　賠率 950.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'direct', prefix: '中三直選', section: '中三', positions: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111101310,
        tabName: '中三組選複式',
        // 樣本注碼 中三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'group', prefix: '中三組選', section: '中三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '複式',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 3,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101311,
        tabName: '中三組選單式',
        // 樣本注碼 中三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'group', prefix: '中三組選', section: '中三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111101312,
        tabName: '中三組選膽拖',
        // 樣本注碼 中三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '中三組選', section: '中三', size: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101410,
        tabName: '後三直選複式',
        // 樣本注碼 後三直選010203 // 1/990 = 0.1010%（公平 990.000）　⚠️ 本分頁走彩池分層，不吃固定賠率
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', prefix: '後三直選', section: '後三', positions: 3, minPick: 1, pool: true },
        tabGroup: [
          {
            groupName: '第三位',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第四位',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第五位',
            pos: 2,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101411,
        tabName: '後三直選單式',
        // 樣本注碼 後三直選010203 // 1/990 = 0.1010%（公平 990.000）　⚠️ 本分頁走彩池分層，不吃固定賠率
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'direct', prefix: '後三直選', section: '後三', positions: 3, minPick: 1, pool: true },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111101510,
        tabName: '後三組選複式',
        // 樣本注碼 後三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'group', prefix: '後三組選', section: '後三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '複式',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 3,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111101511,
        tabName: '後三組選單式',
        // 樣本注碼 後三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'group', prefix: '後三組選', section: '後三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111101512,
        tabName: '後三組選膽拖',
        // 樣本注碼 後三組選010203 // 6/990 = 0.6061%（公平 165.000）　賠率 158.4
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '後三組選', section: '後三', size: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '二碼',
    key: 'erma',
    // 來源 playTab 11111（二碼）：前二／後二 × 直選複式・直選單式・組選複式・組選單式・組選膽拖
    list: [
      {
        tabId: 111111010,
        tabName: '前二直選複式',
        // 樣本注碼 前二直選0102 // 1/110 = 0.9091%（公平 110.000）　賠率 105.6
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', prefix: '前二直選', section: '前二', positions: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '第一位',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第二位',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111111011,
        tabName: '前二直選單式',
        // 樣本注碼 前二直選0102 // 1/110 = 0.9091%（公平 110.000）　賠率 105.6
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'direct', prefix: '前二直選', section: '前二', positions: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111111110,
        tabName: '前二組選複式',
        // 樣本注碼 前二組選0102 // 2/110 = 1.8182%（公平 55.000）　賠率 52.8
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'group', prefix: '前二組選', section: '前二', size: 2, minPick: 2 },
        tabGroup: [
          {
            groupName: '複式',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 2,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111111111,
        tabName: '前二組選單式',
        // 樣本注碼 前二組選0102 // 2/110 = 1.8182%（公平 55.000）　賠率 52.8
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'group', prefix: '前二組選', section: '前二', size: 2, minPick: 2 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111111112,
        tabName: '前二組選膽拖',
        // 樣本注碼 前二組選0102 // 2/110 = 1.8182%（公平 55.000）　賠率 52.8
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '前二組選', section: '前二', size: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111111210,
        tabName: '後二直選複式',
        // 樣本注碼 後二直選0102 // 1/110 = 0.9091%（公平 110.000）　賠率 105.6
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'direct', prefix: '後二直選', section: '後二', positions: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '第四位',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '第五位',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111111211,
        tabName: '後二直選單式',
        // 樣本注碼 後二直選0102 // 1/110 = 0.9091%（公平 110.000）　賠率 105.6
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'direct', prefix: '後二直選', section: '後二', positions: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111111310,
        tabName: '後二組選複式',
        // 樣本注碼 後二組選0102 // 2/110 = 1.8182%（公平 55.000）　賠率 52.8
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'group', prefix: '後二組選', section: '後二', size: 2, minPick: 2 },
        tabGroup: [
          {
            groupName: '複式',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 2,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111111311,
        tabName: '後二組選單式',
        // 樣本注碼 後二組選0102 // 2/110 = 1.8182%（公平 55.000）　賠率 52.8
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'group', prefix: '後二組選', section: '後二', size: 2, minPick: 2 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111111312,
        tabName: '後二組選膽拖',
        // 樣本注碼 後二組選0102 // 2/110 = 1.8182%（公平 55.000）　賠率 52.8
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '後二組選', section: '後二', size: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '不定位',
    key: 'budingwei',
    // 來源 playTab 11112（不定位）：一碼不定位，該號出現在該區段任一位置即中
    list: [
      {
        tabId: 111121010,
        tabName: '前三一碼不定位',
        // 樣本注碼 前三不定位01 // 3/11 = 27.2727%（公平 3.667）　賠率 3.51
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '前三不定位',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '前三不定位01' },
              { digit: 2, name: '前三不定位02' },
              { digit: 3, name: '前三不定位03' },
              { digit: 4, name: '前三不定位04' },
              { digit: 5, name: '前三不定位05' },
              { digit: 6, name: '前三不定位06' },
              { digit: 7, name: '前三不定位07' },
              { digit: 8, name: '前三不定位08' },
              { digit: 9, name: '前三不定位09' },
              { digit: 10, name: '前三不定位10' },
              { digit: 11, name: '前三不定位11' },
            ],
          }
        ],
      },
      {
        tabId: 111121011,
        tabName: '中三一碼不定位',
        // 樣本注碼 中三不定位01 // 3/11 = 27.2727%（公平 3.667）　賠率 3.51
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '中三不定位',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '中三不定位01' },
              { digit: 2, name: '中三不定位02' },
              { digit: 3, name: '中三不定位03' },
              { digit: 4, name: '中三不定位04' },
              { digit: 5, name: '中三不定位05' },
              { digit: 6, name: '中三不定位06' },
              { digit: 7, name: '中三不定位07' },
              { digit: 8, name: '中三不定位08' },
              { digit: 9, name: '中三不定位09' },
              { digit: 10, name: '中三不定位10' },
              { digit: 11, name: '中三不定位11' },
            ],
          }
        ],
      },
      {
        tabId: 111121012,
        tabName: '後三一碼不定位',
        // 樣本注碼 後三不定位01 // 3/11 = 27.2727%（公平 3.667）　賠率 3.51
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '後三不定位',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '後三不定位01' },
              { digit: 2, name: '後三不定位02' },
              { digit: 3, name: '後三不定位03' },
              { digit: 4, name: '後三不定位04' },
              { digit: 5, name: '後三不定位05' },
              { digit: 6, name: '後三不定位06' },
              { digit: 7, name: '後三不定位07' },
              { digit: 8, name: '後三不定位08' },
              { digit: 9, name: '後三不定位09' },
              { digit: 10, name: '後三不定位10' },
              { digit: 11, name: '後三不定位11' },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '定位膽',
    key: 'dingwei',
    // 來源 playTab 11113（定位膽）：5 個球位各自押號碼，注碼與信用盤同一套寫法
    list: [
      {
        tabId: 111131010,
        tabName: '定位膽',
        // 樣本注碼 第一球01 // 1/11 = 9.0909%（公平 11.000）　賠率 10.55
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '第一球',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '第一球01' },
              { digit: 2, name: '第一球02' },
              { digit: 3, name: '第一球03' },
              { digit: 4, name: '第一球04' },
              { digit: 5, name: '第一球05' },
              { digit: 6, name: '第一球06' },
              { digit: 7, name: '第一球07' },
              { digit: 8, name: '第一球08' },
              { digit: 9, name: '第一球09' },
              { digit: 10, name: '第一球10' },
              { digit: 11, name: '第一球11' },
            ],
          },
          {
            groupName: '第二球',
            pos: 1,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '第二球01' },
              { digit: 2, name: '第二球02' },
              { digit: 3, name: '第二球03' },
              { digit: 4, name: '第二球04' },
              { digit: 5, name: '第二球05' },
              { digit: 6, name: '第二球06' },
              { digit: 7, name: '第二球07' },
              { digit: 8, name: '第二球08' },
              { digit: 9, name: '第二球09' },
              { digit: 10, name: '第二球10' },
              { digit: 11, name: '第二球11' },
            ],
          },
          {
            groupName: '第三球',
            pos: 2,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '第三球01' },
              { digit: 2, name: '第三球02' },
              { digit: 3, name: '第三球03' },
              { digit: 4, name: '第三球04' },
              { digit: 5, name: '第三球05' },
              { digit: 6, name: '第三球06' },
              { digit: 7, name: '第三球07' },
              { digit: 8, name: '第三球08' },
              { digit: 9, name: '第三球09' },
              { digit: 10, name: '第三球10' },
              { digit: 11, name: '第三球11' },
            ],
          },
          {
            groupName: '第四球',
            pos: 3,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '第四球01' },
              { digit: 2, name: '第四球02' },
              { digit: 3, name: '第四球03' },
              { digit: 4, name: '第四球04' },
              { digit: 5, name: '第四球05' },
              { digit: 6, name: '第四球06' },
              { digit: 7, name: '第四球07' },
              { digit: 8, name: '第四球08' },
              { digit: 9, name: '第四球09' },
              { digit: 10, name: '第四球10' },
              { digit: 11, name: '第四球11' },
            ],
          },
          {
            groupName: '第五球',
            pos: 4,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '第五球01' },
              { digit: 2, name: '第五球02' },
              { digit: 3, name: '第五球03' },
              { digit: 4, name: '第五球04' },
              { digit: 5, name: '第五球05' },
              { digit: 6, name: '第五球06' },
              { digit: 7, name: '第五球07' },
              { digit: 8, name: '第五球08' },
              { digit: 9, name: '第五球09' },
              { digit: 10, name: '第五球10' },
              { digit: 11, name: '第五球11' },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '任選複式',
    key: 'renxuanfu',
    // 來源 playTab 11114（任選複式）：選 ≥ N 碼，展開成 C(已選, N) 注
    list: [
      {
        tabId: 111141010,
        tabName: '任選一中一',
        // 樣本注碼 任選一中一01 // 5/11 = 45.4545%（公平 2.200）　賠率 2.11
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選一中一', size: 1, minPick: 1 },
        tabGroup: [
          {
            groupName: '任選一中一',
            pos: 0,
            weight: 1,
            columns: 6,
            minPick: 1,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141011,
        tabName: '任選二中二',
        // 樣本注碼 任選二中二0102 // 10/55 = 18.1818%（公平 5.500）　賠率 5.27
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選二中二', size: 2, minPick: 2 },
        tabGroup: [
          {
            groupName: '任選二中二',
            pos: 0,
            weight: 2,
            columns: 6,
            minPick: 2,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141012,
        tabName: '任選三中三',
        // 樣本注碼 任選三中三010203 // 10/165 = 6.0606%（公平 16.500）　賠率 15.84
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選三中三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '任選三中三',
            pos: 0,
            weight: 2,
            columns: 6,
            minPick: 3,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141013,
        tabName: '任選四中四',
        // 樣本注碼 任選四中四01020304 // 5/330 = 1.5152%（公平 66.000）　賠率 63.36
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選四中四', size: 4, minPick: 4 },
        tabGroup: [
          {
            groupName: '任選四中四',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 4,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141014,
        tabName: '任選五中五',
        // 樣本注碼 任選五中五0102030405 // 1/462 = 0.2165%（公平 462.000）　賠率 443.52
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選五中五', size: 5, minPick: 5 },
        tabGroup: [
          {
            groupName: '任選五中五',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 5,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141015,
        tabName: '任選六中五',
        // 樣本注碼 任選六中五010203040506 // 6/462 = 1.2987%（公平 77.000）　賠率 73.92
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選六中五', size: 6, minPick: 6 },
        tabGroup: [
          {
            groupName: '任選六中五',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141016,
        tabName: '任選七中五',
        // 樣本注碼 任選七中五01020304050607 // 15/330 = 4.5455%（公平 22.000）　賠率 21.11
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選七中五', size: 7, minPick: 7 },
        tabGroup: [
          {
            groupName: '任選七中五',
            pos: 0,
            weight: 3,
            columns: 6,
            minPick: 7,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111141017,
        tabName: '任選八中五',
        // 樣本注碼 任選八中五0102030405060708 // 20/165 = 12.1212%（公平 8.250）　賠率 7.92
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'any', prefix: '任選八中五', size: 8, minPick: 8 },
        tabGroup: [
          {
            groupName: '任選八中五',
            pos: 0,
            weight: 2,
            columns: 6,
            minPick: 8,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '任選單式',
    key: 'renxuandan',
    // 來源 playTab 11115（任選單式）：注碼由 conf 全部列出讓玩家直接選，不用手動輸入號碼串
    list: [
      {
        tabId: 111151010,
        tabName: '任選一中一',
        // 樣本注碼 任選一中一01 // 5/11 = 45.4545%（公平 2.200）　賠率 2.11
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選一中一', size: 1, minPick: 1 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 1,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151011,
        tabName: '任選二中二',
        // 樣本注碼 任選二中二0102 // 10/55 = 18.1818%（公平 5.500）　賠率 5.27
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選二中二', size: 2, minPick: 2 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 2,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151012,
        tabName: '任選三中三',
        // 樣本注碼 任選三中三010203 // 10/165 = 6.0606%（公平 16.500）　賠率 15.84
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選三中三', size: 3, minPick: 3 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 2,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151013,
        tabName: '任選四中四',
        // 樣本注碼 任選四中四01020304 // 5/330 = 1.5152%（公平 66.000）　賠率 63.36
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選四中四', size: 4, minPick: 4 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151014,
        tabName: '任選五中五',
        // 樣本注碼 任選五中五0102030405 // 1/462 = 0.2165%（公平 462.000）　賠率 443.52
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選五中五', size: 5, minPick: 5 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151015,
        tabName: '任選六中五',
        // 樣本注碼 任選六中五010203040506 // 6/462 = 1.2987%（公平 77.000）　賠率 73.92
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選六中五', size: 6, minPick: 6 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151016,
        tabName: '任選七中五',
        // 樣本注碼 任選七中五01020304050607 // 15/330 = 4.5455%（公平 22.000）　賠率 21.11
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選七中五', size: 7, minPick: 7 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 3,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      },
      {
        tabId: 111151017,
        tabName: '任選八中五',
        // 樣本注碼 任選八中五0102030405060708 // 20/165 = 12.1212%（公平 8.250）　賠率 7.92
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'single', kind: 'any', prefix: '任選八中五', size: 8, minPick: 8 },
        tabGroup: [
          {
            groupName: '注碼',
            pos: 0,
            weight: 2,
            columns: 6,
            // 單式：注碼由 helpers 的 x5OfSingleCodes() 依 combo 列舉，不寫進設定檔
            groupList: [],
          }
        ],
      }
    ],
  },
  {
    name: '任選膽拖',
    key: 'renxuandt',
    // 來源 playTab 11116（任選膽拖）：膽碼固定進每一注，拖碼補到 N 碼；注數 C(拖, N−膽)
    list: [
      {
        tabId: 111161010,
        tabName: '任選二中二',
        // 樣本注碼 任選二中二0102 // 10/55 = 18.1818%（公平 5.500）　賠率 5.27
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選二中二', size: 2, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111161011,
        tabName: '任選三中三',
        // 樣本注碼 任選三中三010203 // 10/165 = 6.0606%（公平 16.500）　賠率 15.84
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選三中三', size: 3, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111161012,
        tabName: '任選四中四',
        // 樣本注碼 任選四中四01020304 // 5/330 = 1.5152%（公平 66.000）　賠率 63.36
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選四中四', size: 4, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111161013,
        tabName: '任選五中五',
        // 樣本注碼 任選五中五0102030405 // 1/462 = 0.2165%（公平 462.000）　賠率 443.52
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選五中五', size: 5, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111161014,
        tabName: '任選六中五',
        // 樣本注碼 任選六中五010203040506 // 6/462 = 1.2987%（公平 77.000）　賠率 73.92
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選六中五', size: 6, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111161015,
        tabName: '任選七中五',
        // 樣本注碼 任選七中五01020304050607 // 15/330 = 4.5455%（公平 22.000）　賠率 21.11
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選七中五', size: 7, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 3,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      },
      {
        tabId: 111161016,
        tabName: '任選八中五',
        // 樣本注碼 任選八中五0102030405060708 // 20/165 = 12.1212%（公平 8.250）　賠率 7.92
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        combo: { mode: 'dantuo', prefix: '任選八中五', size: 8, minPick: 1 },
        tabGroup: [
          {
            groupName: '膽碼',
            pos: 0,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          },
          {
            groupName: '拖碼',
            pos: 1,
            weight: 2,
            columns: 6,
            groupList: [
              { digit: 1, name: '01' },
              { digit: 2, name: '02' },
              { digit: 3, name: '03' },
              { digit: 4, name: '04' },
              { digit: 5, name: '05' },
              { digit: 6, name: '06' },
              { digit: 7, name: '07' },
              { digit: 8, name: '08' },
              { digit: 9, name: '09' },
              { digit: 10, name: '10' },
              { digit: 11, name: '11' },
            ],
          }
        ],
      }
    ],
  },
  {
    name: '趣味玩法',
    key: 'quwei',
    // 來源 playTab 11117（趣味玩法）：猜中位（5 碼排序後的中位數）、定單雙（5 碼中的單數個數）
    list: [
      {
        tabId: 111171017,
        tabName: '猜中位',
        // 樣本注碼 猜中位06 // 100/462 = 21.6450%（公平 4.620）　賠率 4.43
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '猜中位',
            pos: 0,
            weight: 2,
            columns: 7,
            groupList: [
              { digit: 3, name: '猜中位03' },
              { digit: 4, name: '猜中位04' },
              { digit: 5, name: '猜中位05' },
              { digit: 6, name: '猜中位06' },
              { digit: 7, name: '猜中位07' },
              { digit: 8, name: '猜中位08' },
              { digit: 9, name: '猜中位09' },
            ],
          }
        ],
      },
      {
        tabId: 111171010,
        tabName: '定單雙',
        // 樣本注碼 定單雙三單二雙 // 200/462 = 43.2900%（公平 2.310）　賠率 2.21
        settings: {
          quota: {
            item: { min: 2, max: 10000 },
            issue: { max: 1000000 },
          },
          payout: { rtp: 0.96 },
        },
        tabGroup: [
          {
            groupName: '定單雙',
            pos: 0,
            weight: 2,
            columns: 3,
            groupList: [
              { name: '定單雙五雙零單' },
              { name: '定單雙四雙一單' },
              { name: '定單雙三雙二單' },
              { name: '定單雙三單二雙' },
              { name: '定單雙四單一雙' },
              { name: '定單雙五單零雙' },
            ],
          }
        ],
      }
    ],
  }
]
