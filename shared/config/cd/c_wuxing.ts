import { wuxingNumsOf } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_banbo.ts 是僅有的 .ts 看板設定（其餘為 c_xxx.js），因為它們需要 import 才能產生號碼。
 *    shared/ 下的 .js 由 Nitro 交給 Node 原生解析，不認得 #shared 別名，
 *    伺端一 import 就會炸 "Package import specifier #shared/... is not defined"。
 *    .ts 會進打包流程，別名才解析得到（同 plays.ts 的註記）。
 */

/**
 * 取某個五行「當年」的號碼清單（供看板顯示用）
 *
 * ⚠️ 不可寫死號碼：五行對應號碼逐年輪轉（納音），2026 丙午年的水是 12 個號、
 *    2028 戊申年就變 10 個且號碼完全不同。寫死等於埋一顆兩年後才爆的雷。
 * ⚠️ 這裡取的是「今年」，只供看板／說明頁顯示。
 *    判定與賠率一律走 wuxingAll(該期年份) —— 跨年結算舊期時不能用今年的表。
 */
const numsOfWuxing = (name: string): string[] => wuxingNumsOf(name, new Date().getFullYear())

export default [
  {
    name: '五行',
    key: 'wuxing',
    list: [
      {
        tabId: 7000,
        tabName: '五行',
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // ⚠️ 五行不設 odds —— 各五行的號碼數逐年變動（8 ~ 12 個），
          //    寫死賠率會讓抽水率在不同年份差到兩成。改設回報率，實際賠率由
          //    creditWuxingOddsOf 以「rtp × 49 / 該年該五行號碼數」推算，
          //    下注時一樣鎖進注單，結算跨年也不受影響。
          payout: {
            rtp: 0.97, // 與七碼／連碼同一檔（特碼 98%、色波 94%~95%）
          },
        },
        tabGroup: [
          {
            groupName: '五行',
            // 爆池分配權重：公平賠率約 4.08 ~ 6.13，依既有分級（2.5 ~ 20 → 2）落在 2，
            // 與色波同級（色波公平賠率 2.88 ~ 3.06）
            weight: 2,
            // nums 為「當年」的號碼（動態產生，非寫死），僅供看板顯示；
            // 實際判定與賠率讀 wuxingAll(該期年份)，見 judgeCreditWuxingBet
            groupList: [
              { playId: '7000-001', name: '金', nums: numsOfWuxing('金') },
              { playId: '7000-002', name: '木', nums: numsOfWuxing('木') },
              { playId: '7000-003', name: '水', nums: numsOfWuxing('水') },
              { playId: '7000-004', name: '火', nums: numsOfWuxing('火') },
              { playId: '7000-005', name: '土', nums: numsOfWuxing('土') },
            ],
          },
        ],
      }
    ]
  }
]
