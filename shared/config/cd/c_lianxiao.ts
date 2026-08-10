import { shengxiaoNumsOf } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing / c_banbo / c_yixiao / c_texiao 同為 .ts 看板設定（其餘為 c_xxx.js），
 *    因為需要 import 產生號碼。shared/ 下的 .js 由 Nitro 交給 Node 原生解析，
 *    不認得 #shared 別名，伺端一 import 就會炸
 *    "Package import specifier #shared/... is not defined"。
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
    name: '連肖',
    key: 'lianxiao',
    // 連肖：選 n 個生肖，看它們在當期 7 顆球（6 正碼 + 特別號）中的出現情況。
    //   連中   n 個全部出現才中
    //   連不中 n 個一個都沒出現才中
    //
    // ⚠️ 「連不中」不是「連中」的反面：
    //    連中的反面是「至少一個沒出現」，而連不中要求「全部都沒出現」，
    //    中間還夾著「部分出現」這塊（兩者機率相加 < 100%）。
    //    例：二肖 2×4 → 連中 20.52%、連不中 26.17%，其餘 53.31% 兩邊都不中。
    //
    // ⚠️ 結構與 c_lianma 同類：注項是玩家組出來的（C(12,n) 種組合），不可列舉，
    //    所以 tabGroup 只是「生肖選取池」，實際一注由 settings.combo.pick 個生肖組成。
    //
    // ⚠️ 賠率不能寫死在分頁上 —— 取決於所選生肖裡有沒有含「當年生肖」（它有 5 個號）：
    //      二肖連中    2×4 → 公平 4.87   ｜ 1×4+1×5 → 4.12     差 18.3%
    //      五肖連中    5×4 → 128.86      ｜ 4×4+1×5 → 105.94   差 21.6%
    //      二肖連不中  2×4 → 公平 3.82   ｜ 1×4+1×5 → 4.61     （方向相反）
    //      五肖連不中  5×4 → 55.04       ｜ 4×4+1×5 → 72.55
    //    注意連中與連不中的方向相反：含當年生肖會讓「連中」變容易、「連不中」變難。
    //    固定一個賠率會讓其中一種組合偏掉兩成，故改設 rtp，由
    //    creditLianxiaoOddsOf(所選生肖, 該期年份, match, rtp) 逐注推算後鎖進注單。
    //
    // 機率（容斥）：
    //   連中   P = Σ_{S⊆所選} (-1)^|S| × C(49 - Σk_S, 7) / C(49, 7)
    //   連不中 P = C(49 - Σk_全部, 7) / C(49, 7)
    // 兩者皆不設和局。
    list: [
      {
        tabId: 12000,
        tabName: '二肖連中',
        // 選 2 個生肖，2 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 2 個生肖，最多可選 5 個組複式（C(5,2) = 10 注）
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 5,
          },
          // 命中方向：hit = 所選生肖全部出現才中
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：4.00 ~ 4.73（公平 4.12 ~ 4.87）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '二肖連中',
            // 爆池分配權重：公平 4.12 ~ 4.87，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 2 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12000-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12000-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12000-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12000-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12000-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12000-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12000-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12000-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12000-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12000-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12000-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12000-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12001,
        tabName: '三肖連中',
        // 選 3 個生肖，3 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 3 個生肖，最多可選 6 個組複式（C(6,3) = 20 注）
          combo: {
            pick: 3,
            minPick: 3,
            maxPick: 6,
          },
          // 命中方向：hit = 所選生肖全部出現才中
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：10.11 ~ 12.05（公平 10.42 ~ 12.43）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '三肖連中',
            // 爆池分配權重：公平 10.42 ~ 12.43，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 3 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12001-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12001-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12001-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12001-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12001-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12001-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12001-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12001-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12001-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12001-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12001-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12001-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12002,
        tabName: '四肖連中',
        // 選 4 個生肖，4 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 4 個生肖，最多可選 7 個組複式（C(7,4) = 35 注）
          combo: {
            pick: 4,
            minPick: 4,
            maxPick: 7,
          },
          // 命中方向：hit = 所選生肖全部出現才中
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：29.29 ~ 35.25（公平 30.19 ~ 36.34）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '四肖連中',
            // 爆池分配權重：公平 30.19 ~ 36.34，≥ 20 → 3
            weight: 3,
            // 生肖池：注項由玩家自己組（選 4 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12002-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12002-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12002-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12002-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12002-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12002-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12002-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12002-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12002-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12002-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12002-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12002-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12003,
        tabName: '五肖連中',
        // 選 5 個生肖，5 個「全部」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 5 個生肖，最多可選 8 個組複式（C(8,5) = 56 注）
          combo: {
            pick: 5,
            minPick: 5,
            maxPick: 8,
          },
          // 命中方向：hit = 所選生肖全部出現才中
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：102.76 ~ 124.99（公平 105.94 ~ 128.86）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '五肖連中',
            // 爆池分配權重：公平 105.94 ~ 128.86，≥ 20 → 3
            weight: 3,
            // 生肖池：注項由玩家自己組（選 5 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12003-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12003-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12003-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12003-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12003-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12003-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12003-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12003-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12003-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12003-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12003-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12003-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12004,
        tabName: '二肖連不中',
        // 選 2 個生肖，2 個「一個都沒有」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 2 個生肖，最多可選 5 個組複式（C(5,2) = 10 注）
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 5,
          },
          // 命中方向：miss = 所選生肖一個都沒出現才中
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：3.71 ~ 4.47（公平 3.82 ~ 4.61）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '二肖連不中',
            // 爆池分配權重：公平 3.82 ~ 4.61，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 2 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12004-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12004-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12004-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12004-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12004-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12004-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12004-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12004-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12004-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12004-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12004-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12004-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12005,
        tabName: '三肖連不中',
        // 選 3 個生肖，3 個「一個都沒有」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 3 個生肖，最多可選 6 個組複式（C(6,3) = 20 注）
          combo: {
            pick: 3,
            minPick: 3,
            maxPick: 6,
          },
          // 命中方向：miss = 所選生肖一個都沒出現才中
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：8.09 ~ 9.98（公平 8.34 ~ 10.29）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '三肖連不中',
            // 爆池分配權重：公平 8.34 ~ 10.29，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 3 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12005-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12005-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12005-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12005-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12005-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12005-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12005-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12005-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12005-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12005-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12005-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12005-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12006,
        tabName: '四肖連不中',
        // 選 4 個生肖，4 個「一個都沒有」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 4 個生肖，最多可選 7 個組複式（C(7,4) = 35 注）
          combo: {
            pick: 4,
            minPick: 4,
            maxPick: 7,
          },
          // 命中方向：miss = 所選生肖一個都沒出現才中
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：19.50 ~ 24.76（公平 20.11 ~ 25.52）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '四肖連不中',
            // 爆池分配權重：公平 20.11 ~ 25.52，≥ 20 → 3
            weight: 3,
            // 生肖池：注項由玩家自己組（選 4 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12006-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12006-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12006-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12006-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12006-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12006-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12006-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12006-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12006-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12006-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12006-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12006-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 12007,
        tabName: '五肖連不中',
        // 選 5 個生肖，5 個「一個都沒有」出現在 7 顆球中才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 5 個生肖，最多可選 8 個組複式（C(8,5) = 56 注）
          combo: {
            pick: 5,
            minPick: 5,
            maxPick: 8,
          },
          // 命中方向：miss = 所選生肖一個都沒出現才中
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選的那幾個生肖」，見檔頭說明
          //    實際區間：53.39 ~ 70.37（公平 55.04 ~ 72.55）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '五肖連不中',
            // 爆池分配權重：公平 55.04 ~ 72.55，≥ 20 → 3
            weight: 3,
            // 生肖池：注項由玩家自己組（選 5 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '12007-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '12007-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '12007-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '12007-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '12007-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '12007-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '12007-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '12007-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '12007-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '12007-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '12007-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '12007-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
    ],
  },
]
