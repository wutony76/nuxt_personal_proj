import { shengxiaoNumsOf } from '#shared/config/6hc-cd'

/**
 * ⚠️ 本檔與 c_wuxing / c_banbo / c_yixiao / c_texiao / c_lianxiao 同為 .ts 看板設定
 *    （其餘為 c_xxx.js），因為需要 import 產生號碼。
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
    name: '合肖',
    key: 'hexiao',
    // 合肖：選 n 個生肖組成一組，看「特別號的生肖」在不在這組裡面。
    //
    // ⚠️ 與連肖是完全不同的判定，別搞混：
    //     合肖 只看特別號一顆球，所選生肖是「或」的關係（任一命中即中）
    //     連肖 看 7 顆球，所選生肖是「且」的關係（全部出現才中）
    //    也因此合肖的中／不中是嚴格互補（特別號的生肖非在即不在），
    //    同一組生肖的「n肖中」與「n肖不中」機率相加恰為 100%；
    //    連肖則不是（中間夾著「部分出現」）。
    //
    // ⚠️ 結構與 c_lianma / c_lianxiao 同類：注項是玩家組出來的（C(12,n) 種組合），
    //    不可列舉，所以 tabGroup 只是「生肖選取池」，
    //    實際一注由 settings.combo.pick 個生肖組成。
    //
    // ⚠️ 賠率不能寫死在分頁上 —— 機率 = 所選生肖的號碼總數 / 49，
    //    而當年生肖有 5 個號（其餘 4 個），選到與否會讓總數差 1：
    //      二肖中  8/49 → 公平 6.125 ｜ 9/49  → 5.444
    //      六肖中 24/49 → 公平 2.042 ｜ 25/49 → 1.960
    //    故改設 rtp，由 creditHexiaoOddsOf(所選生肖, 該期年份, match, rtp)
    //    逐注推算後鎖進注單。
    //
    // 賠率公式：中 = rtp × 49 / Σ號碼數；不中 = rtp × 49 / (49 - Σ號碼數)
    // 兩者皆不設和局（49 已歸屬當年生肖，落在既有生肖內）。
    //
    // 備註：六肖中與六肖不中的賠率區間相同（1.90 ~ 1.98），
    //       因為 6 個生肖恰好覆蓋 24 或 25 個號，與其餘號碼數對稱。
    list: [
      {
        tabId: 13000,
        tabName: '二肖中',
        // 選 2 個生肖，特別號的生肖「屬於」這 2 個之一即中獎
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
          // 命中方向：hit = 特別號屬所選生肖之一
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：5.28 ~ 5.94（公平 5.444 ~ 6.125）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '二肖中',
            // 爆池分配權重：公平 5.444 ~ 6.125，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 2 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13000-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13000-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13000-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13000-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13000-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13000-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13000-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13000-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13000-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13000-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13000-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13000-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13001,
        tabName: '三肖中',
        // 選 3 個生肖，特別號的生肖「屬於」這 3 個之一即中獎
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
          // 命中方向：hit = 特別號屬所選生肖之一
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：3.66 ~ 3.96（公平 3.769 ~ 4.083）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '三肖中',
            // 爆池分配權重：公平 3.769 ~ 4.083，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 3 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13001-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13001-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13001-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13001-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13001-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13001-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13001-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13001-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13001-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13001-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13001-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13001-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13002,
        tabName: '四肖中',
        // 選 4 個生肖，特別號的生肖「屬於」這 4 個之一即中獎
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
          // 命中方向：hit = 特別號屬所選生肖之一
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：2.80 ~ 2.97（公平 2.882 ~ 3.063）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '四肖中',
            // 爆池分配權重：公平 2.882 ~ 3.063，落在 2.5 ~ 20 → 2
            weight: 2,
            // 生肖池：注項由玩家自己組（選 4 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13002-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13002-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13002-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13002-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13002-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13002-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13002-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13002-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13002-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13002-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13002-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13002-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13003,
        tabName: '五肖中',
        // 選 5 個生肖，特別號的生肖「屬於」這 5 個之一即中獎
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
          // 命中方向：hit = 特別號屬所選生肖之一
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：2.26 ~ 2.38（公平 2.333 ~ 2.450）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '五肖中',
            // 爆池分配權重：公平 2.333 ~ 2.450，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 5 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13003-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13003-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13003-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13003-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13003-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13003-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13003-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13003-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13003-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13003-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13003-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13003-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13004,
        tabName: '六肖中',
        // 選 6 個生肖，特別號的生肖「屬於」這 6 個之一即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 6 個生肖，最多可選 9 個組複式（C(9,6) = 84 注）
          combo: {
            pick: 6,
            minPick: 6,
            maxPick: 9,
          },
          // 命中方向：hit = 特別號屬所選生肖之一
          match: 'hit',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：1.90 ~ 1.98（公平 1.960 ~ 2.042）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '六肖中',
            // 爆池分配權重：公平 1.960 ~ 2.042，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 6 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13004-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13004-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13004-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13004-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13004-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13004-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13004-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13004-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13004-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13004-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13004-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13004-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13005,
        tabName: '二肖不中',
        // 選 2 個生肖，特別號的生肖「都不屬於」這 2 個才中獎
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
          // 命中方向：miss = 特別號都不屬所選生肖
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：1.16 ~ 1.19（公平 1.195 ~ 1.225）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '二肖不中',
            // 爆池分配權重：公平 1.195 ~ 1.225，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 2 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13005-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13005-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13005-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13005-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13005-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13005-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13005-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13005-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13005-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13005-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13005-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13005-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13006,
        tabName: '三肖不中',
        // 選 3 個生肖，特別號的生肖「都不屬於」這 3 個才中獎
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
          // 命中方向：miss = 特別號都不屬所選生肖
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：1.28 ~ 1.32（公平 1.324 ~ 1.361）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '三肖不中',
            // 爆池分配權重：公平 1.324 ~ 1.361，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 3 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13006-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13006-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13006-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13006-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13006-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13006-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13006-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13006-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13006-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13006-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13006-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13006-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13007,
        tabName: '四肖不中',
        // 選 4 個生肖，特別號的生肖「都不屬於」這 4 個才中獎
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
          // 命中方向：miss = 特別號都不屬所選生肖
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：1.44 ~ 1.49（公平 1.485 ~ 1.531）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '四肖不中',
            // 爆池分配權重：公平 1.485 ~ 1.531，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 4 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13007-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13007-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13007-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13007-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13007-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13007-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13007-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13007-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13007-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13007-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13007-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13007-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13008,
        tabName: '五肖不中',
        // 選 5 個生肖，特別號的生肖「都不屬於」這 5 個才中獎
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
          // 命中方向：miss = 特別號都不屬所選生肖
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：1.64 ~ 1.70（公平 1.690 ~ 1.750）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '五肖不中',
            // 爆池分配權重：公平 1.690 ~ 1.750，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 5 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13008-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13008-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13008-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13008-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13008-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13008-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13008-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13008-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13008-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13008-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13008-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13008-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
      {
        tabId: 13009,
        tabName: '六肖不中',
        // 選 6 個生肖，特別號的生肖「都不屬於」這 6 個才中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 6 個生肖，最多可選 9 個組複式（C(9,6) = 84 注）
          combo: {
            pick: 6,
            minPick: 6,
            maxPick: 9,
          },
          // 命中方向：miss = 特別號都不屬所選生肖
          match: 'miss',
          // ⚠️ 不設 odds —— 賠率取決於「所選生肖的號碼總數」，見檔頭說明
          //    實際區間：1.90 ~ 1.98（公平 1.960 ~ 2.042）
          payout: {
            rtp: 0.97,
          },
        },
        tabGroup: [
          {
            groupName: '六肖不中',
            // 爆池分配權重：公平 1.960 ~ 2.042，< 2.5 → 1
            weight: 1,
            // 生肖池：注項由玩家自己組（選 6 個），這裡只提供 12 生肖供看板選取
            groupList: [
              { playId: '13009-001', name: '鼠', nums: numsOfAnimal('鼠') },
              { playId: '13009-002', name: '牛', nums: numsOfAnimal('牛') },
              { playId: '13009-003', name: '虎', nums: numsOfAnimal('虎') },
              { playId: '13009-004', name: '兔', nums: numsOfAnimal('兔') },
              { playId: '13009-005', name: '龍', nums: numsOfAnimal('龍') },
              { playId: '13009-006', name: '蛇', nums: numsOfAnimal('蛇') },
              { playId: '13009-007', name: '馬', nums: numsOfAnimal('馬') },
              { playId: '13009-008', name: '羊', nums: numsOfAnimal('羊') },
              { playId: '13009-009', name: '猴', nums: numsOfAnimal('猴') },
              { playId: '13009-010', name: '雞', nums: numsOfAnimal('雞') },
              { playId: '13009-011', name: '狗', nums: numsOfAnimal('狗') },
              { playId: '13009-012', name: '豬', nums: numsOfAnimal('豬') },
            ],
          },
        ],
      },
    ],
  },
]
