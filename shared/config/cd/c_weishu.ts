import { weishuAll } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing / c_banbo / c_yixiao / c_texiao / c_hexiao / c_lianxiao 同為 .ts 看板設定
 *    （其餘為 c_xxx.js），因為需要 import 產生號碼。
 *    shared/ 下的 .js 由 Nitro 交給 Node 原生解析，不認得 #shared 別名，
 *    伺端一 import 就會炸 "Package import specifier #shared/... is not defined"。
 */

/**
 * 取某尾數的號碼清單（供看板顯示用）
 *
 * ⚠️ 與生肖／五行不同：尾數分布固定（0尾 4 個號、其餘 9 個尾各 5 個號），不隨年份輪轉，
 *    直接查 weishuAll 即可，不需要年份參數。
 */
const numsOfWei = (tail: string): string[] => weishuAll[tail] ?? []

export default [
  {
    name: '尾數',
    key: 'weishu',
    // 尾數：選一個尾（0 ~ 9），以特別號的尾數（個位數）結算（只看第 7 顆球），性質同一肖／特肖。
    //
    // 每個尾 5 個號，僅 0 尾 4 個號（合計 49 個號），因此兩個分頁的賠率不同：
    //   尾數中   中獎面 4 ~ 5 個號   → 賠率約 11.88（0尾）／9.51（其餘）
    //   尾數不中 中獎面 44 ~ 45 個號 → 賠率約 1.06（0尾）／1.08（其餘）
    // 兩者都不設和局：49 屬 9 尾，落在既有注項內。
    //
    // ⚠️ 尾數分布固定不隨年份輪轉（與生肖不同），賠率理論上可以像半波一樣寫死在注項上，
    //    但仍改設 rtp、由 creditWeishuOddsOf 以「rtp × 49 / 中獎面號碼數」推算，
    //    與一肖／特肖同一套公式，方便日後統一調整回報率。
    list: [
      {
        tabId: 15000,
        tabName: '尾數中',
        // 選一個尾，開出的特別號尾數屬該尾即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 命中方向：hit = 特別號尾數屬該尾即中、miss = 不屬該尾才中
          match: 'hit',
          // ⚠️ 不設 odds —— 統一走 creditWeishuOddsOf 以「rtp × 49 / 中獎面號碼數」推算，
          //    下注時鎖進注單
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '尾數中',
            // 爆池分配權重：公平賠率 9.8 ~ 12.25，依既有分級（2.5 ~ 20 → 2）落在 2
            weight: 2,
            // nums 為該尾的號碼（由 weishuAll 產生，非寫死），供看板顯示
            groupList: [
              { playId: '15000-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '15000-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '15000-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '15000-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '15000-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '15000-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '15000-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '15000-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '15000-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '15000-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
      {
        tabId: 15001,
        tabName: '尾數不中',
        // 選一個尾，開出的特別號尾數「不屬」該尾才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          match: 'miss',
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '尾數不中',
            // 爆池分配權重：公平賠率 1.09 ~ 1.11，依既有分級（< 2.5 → 1）落在 1
            weight: 1,
            groupList: [
              { playId: '15001-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '15001-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '15001-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '15001-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '15001-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '15001-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '15001-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '15001-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '15001-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '15001-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
    ],
  },
]
