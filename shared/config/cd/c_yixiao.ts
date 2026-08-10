import { shengxiaoNumsOf } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing.ts / c_banbo.ts 同為 .ts 看板設定（其餘為 c_xxx.js），因為需要 import 產生號碼。
 *    shared/ 下的 .js 由 Nitro 交給 Node 原生解析，不認得 #shared 別名，
 *    伺端一 import 就會炸 "Package import specifier #shared/... is not defined"。
 */

/**
 * 取某生肖「當年」的號碼清單（供看板顯示用）
 *
 * ⚠️ 不可寫死號碼：生肖對應號碼逐年輪轉（01 給當年生肖再往回推、49 也歸當年生肖），
 *    2026 馬年的馬是 01 13 25 37 49，2027 羊年的馬就變成 02 14 26 38。
 * ⚠️ 這裡取的是「今年」，只供看板／說明頁顯示。
 *    判定與賠率一律走 shengxiaoNumsOf(生肖, 該期年份) —— 跨年結算舊期不能用今年的表。
 */
const numsOfAnimal = (name: string): string[] => shengxiaoNumsOf(name, new Date().getFullYear())

export default [
  {
    name: '一肖',
    key: 'yixiao',
    // 一肖：選一個生肖，以特別號所屬生肖結算。
    //
    // 每個生肖 4 個號、當年生肖 5 個號（49 併入），合計 49 個號。
    // 因此兩個分頁的賠率差距很大，且都會隨年份變動：
    //   一肖中   中獎面 4 ~ 5 個號   → 賠率約 11.88 / 9.51
    //   一肖不中 中獎面 44 ~ 45 個號 → 賠率約 1.06 / 1.08
    // 兩者都不設和局：49 已歸屬當年生肖，落在既有注項內。
    list: [
      {
        tabId: 10000,
        tabName: '一肖中',
        // 選一個生肖，開出的特別號屬該生肖即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 命中方向：hit = 特別號屬該生肖即中、miss = 不屬該生肖才中
          match: 'hit',
          // ⚠️ 不設 odds —— 生肖號碼數逐年變動（當年生肖 5 個、其餘 4 個），
          //    寫死賠率換年就會偏。實際賠率由 creditYixiaoOddsOf 以
          //    「rtp × 49 / 中獎面號碼數」推算，下注時鎖進注單。
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '一肖中',
            // 爆池分配權重：公平賠率 9.8 ~ 12.25，依既有分級（2.5 ~ 20 → 2）落在 2
            weight: 2,
            // nums 為「當年」該生肖的號碼（動態產生，非寫死），供看板顯示
            groupList: [
              { playId: '10000-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '10000-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '10000-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '10000-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '10000-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '10000-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '10000-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '10000-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '10000-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '10000-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '10000-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '10000-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 10001,
        tabName: '一肖不中',
        // 選一個生肖，開出的特別號「不屬」該生肖才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 命中方向：hit = 特別號屬該生肖即中、miss = 不屬該生肖才中
          match: 'miss',
          // ⚠️ 不設 odds —— 生肖號碼數逐年變動（當年生肖 5 個、其餘 4 個），
          //    寫死賠率換年就會偏。實際賠率由 creditYixiaoOddsOf 以
          //    「rtp × 49 / 中獎面號碼數」推算，下注時鎖進注單。
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '一肖不中',
            // 爆池分配權重：公平賠率 1.09 ~ 1.11，依既有分級（< 2.5 → 1）落在 1
            weight: 1,
            // nums 為「當年」該生肖的號碼（動態產生，非寫死），供看板顯示
            groupList: [
              { playId: '10001-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '10001-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '10001-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '10001-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '10001-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '10001-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '10001-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '10001-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '10001-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '10001-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '10001-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '10001-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
    ],
  },
]
