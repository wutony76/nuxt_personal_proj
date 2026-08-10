import { shengxiaoNumsOf } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing / c_banbo / c_yixiao 同為 .ts 看板設定（其餘為 c_xxx.js），因為需要 import 產生號碼。
 *    shared/ 下的 .js 由 Nitro 交給 Node 原生解析，不認得 #shared 別名，
 *    伺端一 import 就會炸 "Package import specifier #shared/... is not defined"。
 */

/**
 * 取某生肖「當年」的號碼清單（供看板顯示用）
 *
 * ⚠️ 不可寫死：生肖號碼逐年輪轉，當年生肖有 5 個號、其餘 11 個各 4 個，
 *    且是哪一個有 5 個每年都不同。判定與賠率一律走 shengxiaoNumsOf(生肖, 該期年份)。
 */
const numsOfAnimal = (name: string): string[] => shengxiaoNumsOf(name, new Date().getFullYear())

export default [
  {
    name: '特肖',
    key: 'texiao',
    // 特肖：選一個生肖，開出的「特別號」所屬生肖即中獎（只看第 7 顆球）。
    //
    // ⚠️ 與「一肖」的差別：
    //     特肖 只看特別號     → 中獎面 4 ~ 5 個號、賠率 11.88 / 9.51
    //     一肖 看 7 顆球任一   → 中獎面大得多、賠率約 2.06 / 1.75
    //    目前 judgeCreditYixiaoBet 是以特別號判定，實際等同特肖 —— 見檔案下方 TODO。
    //
    // 賠率不寫死（生肖號碼數逐年變動），由 rtp × 49 / 該生肖號碼數 推算：
    //   4 個號 → 11.88（公平 12.25）　5 個號 → 9.51（公平 9.80）
    // 不設和局：49 已歸屬當年生肖，落在既有注項內。
    list: [
      {
        tabId: 11000,
        tabName: '特肖',
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 命中方向：hit = 特別號屬該生肖即中
          match: 'hit',
          // ⚠️ 不設 odds —— 由 creditYixiaoOddsOf 以「rtp × 49 / 該生肖號碼數」推算
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '特肖',
            // 爆池分配權重：公平賠率 9.8 ~ 12.25，依既有分級（2.5 ~ 20 → 2）落在 2
            weight: 2,
            // nums 為「當年」該生肖的號碼（動態產生，非寫死），供看板顯示
            groupList: [
              { playId: '11000-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '11000-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '11000-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '11000-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '11000-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '11000-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '11000-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '11000-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '11000-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '11000-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '11000-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '11000-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
    ],
  },
]
