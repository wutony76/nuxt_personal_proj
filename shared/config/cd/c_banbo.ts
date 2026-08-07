import { banboNumsOf } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing.ts 是僅有的 .ts 看板設定（其餘為 c_xxx.js），因為它們需要 import 才能產生號碼。
 *    shared/ 下的 .js 由 Nitro 交給 Node 原生解析，不認得 #shared 別名，
 *    伺端一 import 就會炸 "Package import specifier #shared/... is not defined"。
 *    .ts 會進打包流程，別名才解析得到（同 plays.ts 的註記）。
 */

/**
 * 取某個半波注項涵蓋的號碼（色波 ∩ 大小／單雙）
 *
 * 號碼由 LHC_COLORS 算出、不在此寫死，確保與 shared/config/6hc-cd.ts 永遠同步。
 * 色波分布固定（紅 17 / 藍 16 / 綠 16），不像五行逐年輪轉，故不需要年份參數。
 */
const numsOfBanbo = (name: string): string[] => banboNumsOf(name)

export default [
  {
    name: '半波',
    key: 'banbo',
    // 半波：色波 × 大小／單雙的交集，以特別號結算。
    // 例：紅大 = 特別號同時是紅波且 ≥ 25；紅單 = 紅波且為單數。
    //
    // 色波的號碼分布是固定的（紅 17 / 藍 16 / 綠 16），不像五行逐年輪轉，
    // 所以不需要年份參數；但仍以 banboNumsOf() 產生而非寫死，
    // 確保與 shared/config/6hc-cd.ts 的 LHC_COLORS 永遠同步。
    //
    // 賠率取理論值（49 / 該注項號碼數）×0.97，與七碼／連碼同一檔。
    // 各注項號碼數不同（7 ~ 10），所以賠率逐項不同，不能整組共用一個值。
    // 不設和局：49 屬綠波、且為單、為大，落在既有注項內，無需另立和局規則。
    list: [
      {
        tabId: 8000,
        tabName: '半波',
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          }
        },
        tabGroup: [
          {
            groupName: '半波',
            // 爆池分配權重：理論賠率 4.9 ~ 7.0，依既有分級（2.5 ~ 20 → 2）落在 2，與色波同級
            weight: 2,
            // 註解為該注項的號碼數與理論賠率（49 / 號碼數），供調賠率時參照
            groupList: [
              { playId: '8000-001', name: '紅大', odds: 6.79, nums: numsOfBanbo('紅大') }, //  7 個（7.000）
              { playId: '8000-002', name: '紅小', odds: 4.75, nums: numsOfBanbo('紅小') }, // 10 個（4.900）
              { playId: '8000-003', name: '紅單', odds: 5.94, nums: numsOfBanbo('紅單') }, //  8 個（6.125）
              { playId: '8000-004', name: '紅雙', odds: 5.28, nums: numsOfBanbo('紅雙') }, //  9 個（5.444）

              { playId: '8000-005', name: '綠大', odds: 5.28, nums: numsOfBanbo('綠大') }, //  9 個（5.444）
              { playId: '8000-006', name: '綠小', odds: 6.79, nums: numsOfBanbo('綠小') }, //  7 個（7.000）
              { playId: '8000-007', name: '綠單', odds: 5.28, nums: numsOfBanbo('綠單') }, //  9 個（5.444）
              { playId: '8000-008', name: '綠雙', odds: 6.79, nums: numsOfBanbo('綠雙') }, //  7 個（7.000）

              { playId: '8000-009', name: '藍大', odds: 5.28, nums: numsOfBanbo('藍大') }, //  9 個（5.444）
              { playId: '8000-010', name: '藍小', odds: 6.79, nums: numsOfBanbo('藍小') }, //  7 個（7.000）
              { playId: '8000-011', name: '藍單', odds: 5.94, nums: numsOfBanbo('藍單') }, //  8 個（6.125）
              { playId: '8000-012', name: '藍雙', odds: 5.94, nums: numsOfBanbo('藍雙') }, //  8 個（6.125）
            ],
          },
        ],
      }
    ]
  }
]
