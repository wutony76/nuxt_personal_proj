import { weishuAll } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing / c_banbo / c_yixiao / c_texiao / c_hexiao / c_lianxiao / c_weishu 同為
 *    .ts 看板設定（其餘為 c_xxx.js），因為需要 import 產生號碼。
 *    shared/ 下的 .js 由 Nitro 交給 Node 原生解析，不認得 #shared 別名，
 *    伺端一 import 就會炸 "Package import specifier #shared/... is not defined"。
 */

/** 取某尾數的號碼清單（供看板選取池顯示用；尾數分布固定，不需年份參數） */
const numsOfWei = (tail: string): string[] => weishuAll[tail] ?? []

export default [
  {
    name: '連尾',
    key: 'lianwei',
    // 連尾：選 n 個尾數，看它們在當期 7 顆球（6 正碼 + 特別號）中的出現情況 —— 與連肖同類，
    // 差別只在號碼分組依據（尾數固定分布，不隨年份變動）：
    //   連中   n 個尾數全部出現才中
    //   連不中 n 個尾數一個都沒出現才中
    //
    // ⚠️ 「連不中」不是「連中」的反面：
    //    連中的反面是「至少一個沒出現」，而連不中要求「全部都沒出現」，
    //    中間還夾著「部分出現」這塊（兩者機率相加 < 100%），與連肖同一套道理。
    //
    // ⚠️ 結構與 c_lianxiao 同類：注項是玩家組出來的（C(10,n) 種組合），不可列舉，
    //    所以 tabGroup 只是「尾數選取池」，實際一注由 settings.combo.pick 個尾數組成。
    //
    // ⚠️ 賠率不能寫死在分頁上 —— 取決於所選尾數裡有沒有含「0尾」
    //    （0尾只有 4 個號，其餘 9 尾各 5 個號）：
    //      二尾連中    5+5 → 公平 3.49   ｜ 4+5   → 4.12    差 18.2%
    //      三尾連中    5×3 → 公平 7.34   ｜ 4+5×2 → 8.74    差 19.1%
    //      四尾連中    5×4 → 公平 17.37  ｜ 4+5×3 → 20.87   差 20.2%
    //      二尾連不中  5+5 → 公平 5.58   ｜ 4+5   → 4.61    （方向相反）
    //      三尾連不中  5×3 → 公平 15.97  ｜ 4+5×2 → 12.77
    //      四尾連不中  5×4 → 公平 55.04  ｜ 4+5×3 → 42.20
    //    固定一個賠率會讓其中一種組合偏掉兩成，故改設 rtp，由
    //    creditLianweiOddsOf(所選尾數, match, rtp) 逐注推算後鎖進注單。
    //
    // 機率（容斥，公式同連肖，只是號碼數改讀 weishuAll）：
    //   連中   P = Σ_{S⊆所選} (-1)^|S| × C(49 - Σk_S, 7) / C(49, 7)
    //   連不中 P = C(49 - Σk_全部, 7) / C(49, 7)
    // 兩者皆不設和局。
    list: [
      {
        tabId: 14000,
        tabName: '二尾連中',
        // 選 2 個尾數，2 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 2 個尾數，最多可選 5 個組複式（C(5,2) = 10 注）
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 5,
          },
          // 命中方向：hit = 所選尾數全部出現才中
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個尾數」，見檔頭說明
          //    實際區間：3.38 ~ 4.00（公平 3.49 ~ 4.12）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '二尾連中',
            // 爆池分配權重：公平 3.49 ~ 4.12，落在 2.5 ~ 20 → 2
            weight: 2,
            // 尾數池：注項由玩家自己組（選 2 個），這裡只提供 0 ~ 9 尾供看板選取
            groupList: [
              { playId: '14000-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '14000-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '14000-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '14000-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '14000-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '14000-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '14000-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '14000-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '14000-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '14000-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
      {
        tabId: 14001,
        tabName: '三尾連中',
        // 選 3 個尾數，3 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: {
              max: 1000,
            },
            issue: {
              max: 1000000,
            },
          },
          // 選號規格：一注固定 3 個尾數，最多可選 6 個組複式（C(6,3) = 20 注）
          combo: {
            pick: 3,
            minPick: 3,
            maxPick: 6,
          },
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個尾數」，見檔頭說明
          //    實際區間：7.12 ~ 8.48（公平 7.34 ~ 8.74）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '三尾連中',
            // 爆池分配權重：公平 7.34 ~ 8.74，落在 2.5 ~ 20 → 2
            weight: 2,
            groupList: [
              { playId: '14001-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '14001-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '14001-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '14001-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '14001-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '14001-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '14001-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '14001-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '14001-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '14001-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
      {
        tabId: 14002,
        tabName: '四尾連中',
        // 選 4 個尾數，4 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: {
              max: 1000,
            },
            issue: {
              max: 1000000,
            },
          },
          // 選號規格：一注固定 4 個尾數，最多可選 7 個組複式（C(7,4) = 35 注）
          combo: {
            pick: 4,
            minPick: 4,
            maxPick: 7,
          },
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個尾數」，見檔頭說明
          //    實際區間：16.85 ~ 20.25（公平 17.37 ~ 20.87）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '四尾連中',
            // 爆池分配權重：公平 17.37 ~ 20.87，橫跨 20 門檻但多數落在 20 以下 → 2
            weight: 2,
            groupList: [
              { playId: '14002-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '14002-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '14002-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '14002-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '14002-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '14002-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '14002-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '14002-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '14002-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '14002-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
      {
        tabId: 14003,
        tabName: '二尾連不中',
        // 選 2 個尾數，2 個「全部都不出現」在 7 顆球中才中獎
        settings: {
          quota: {
            item: {
              max: 1000,
            },
            issue: {
              max: 1000000,
            },
          },
          // 選號規格：一注固定 2 個尾數，最多可選 5 個組複式（C(5,2) = 10 注）
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 5,
          },
          // 命中方向：miss = 所選尾數都不出現才中
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個尾數」，見檔頭說明
          //    實際區間：4.47 ~ 5.42（公平 4.61 ~ 5.58）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '二尾連不中',
            // 爆池分配權重：公平 4.61 ~ 5.58，落在 2.5 ~ 20 → 2
            weight: 2,
            groupList: [
              { playId: '14003-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '14003-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '14003-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '14003-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '14003-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '14003-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '14003-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '14003-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '14003-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '14003-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
      {
        tabId: 14004,
        tabName: '三尾連不中',
        // 選 3 個尾數，3 個「全部都不出現」在 7 顆球中才中獎
        settings: {
          quota: {
            item: {
              max: 1000,
            },
            issue: {
              max: 1000000,
            },
          },
          // 選號規格：一注固定 3 個尾數，最多可選 6 個組複式（C(6,3) = 20 注）
          combo: {
            pick: 3,
            minPick: 3,
            maxPick: 6,
          },
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個尾數」，見檔頭說明
          //    實際區間：12.39 ~ 15.49（公平 12.77 ~ 15.97）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '三尾連不中',
            // 爆池分配權重：公平 12.77 ~ 15.97，落在 2.5 ~ 20 → 2
            weight: 2,
            groupList: [
              { playId: '14004-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '14004-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '14004-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '14004-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '14004-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '14004-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '14004-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '14004-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '14004-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '14004-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
      {
        tabId: 14005,
        tabName: '四尾連不中',
        // 選 4 個尾數，4 個「全部都不出現」在 7 顆球中才中獎
        settings: {
          quota: {
            item: {
              max: 1000,
            },
            issue: {
              max: 1000000,
            },
          },
          // 選號規格：一注固定 4 個尾數，最多可選 7 個組複式（C(7,4) = 35 注）
          combo: {
            pick: 4,
            minPick: 4,
            maxPick: 7,
          },
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個尾數」，見檔頭說明
          //    實際區間：40.93 ~ 53.39（公平 42.20 ~ 55.04）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '四尾連不中',
            // 爆池分配權重：公平 42.20 ~ 55.04，≥ 20 → 3
            weight: 3,
            groupList: [
              { playId: '14005-001', name: '0尾', nums: numsOfWei('0尾') },
              { playId: '14005-002', name: '1尾', nums: numsOfWei('1尾') },
              { playId: '14005-003', name: '2尾', nums: numsOfWei('2尾') },
              { playId: '14005-004', name: '3尾', nums: numsOfWei('3尾') },
              { playId: '14005-005', name: '4尾', nums: numsOfWei('4尾') },
              { playId: '14005-006', name: '5尾', nums: numsOfWei('5尾') },
              { playId: '14005-007', name: '6尾', nums: numsOfWei('6尾') },
              { playId: '14005-008', name: '7尾', nums: numsOfWei('7尾') },
              { playId: '14005-009', name: '8尾', nums: numsOfWei('8尾') },
              { playId: '14005-010', name: '9尾', nums: numsOfWei('9尾') },
            ],
          },
        ],
      },
    ],
  },
]
