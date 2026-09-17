/**
 * 39樂合彩看板設定總表。
 *
 * 39樂合彩的注單形狀依「合數」而不同（二合 2 碼／三合 3 碼／四合 4 碼一注），這裡宣告一個
 * 虛擬分頁（tabId: 1），底下 3 個「合數」作為 groupList 項目，`playId` 直接沿用官方
 * `49M6Result` 的欄位 key（m539TwoAssign／m539ThreeAssign／m539FourAssign，見
 * shared/config/m539.ts 的 M539_TIERS），供 Report.vue 顯示玩法對照表的「名稱／對中條件」用。
 *
 * ⚠️ 與 DLT/D539 一樣：**不含 `odds` 欄位**——39樂合彩派彩金額完全鏡射官方，要等開獎結算後
 * 才知道，看板設定本身不記錄任何賠率快照（見 openspec/changes/add-tw-lottery-suite/design.md）。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）—— Nitro 對 shared 下的檔案走 Node 原生 ESM
 *    解析、不認得 `#shared` 別名，只要設定檔內出現這類 import，伺端一載入就會炸。
 */
export default [
  {
    key: 'm539',
    name: '39樂合彩',
    list: [
      {
        tabId: 1,
        tabName: '39樂合彩',
        settings: {
          // item.min/max 固定 25（每注售價），issue.max 由 M539Class 依「上一次四合（最高獎項）
          // 金額」動態算出（見 shared/config/m539.ts M539_QUOTA_FALLBACK_COIN），本檔不記錄。
          quota: { item: { min: 25, max: 25 } }
        },
        tabGroup: [
          {
            groupName: '玩法',
            groupList: [
              { playId: 'm539TwoAssign', name: '二合', desc: '選 2 個號碼，全部開出即中獎' },
              { playId: 'm539ThreeAssign', name: '三合', desc: '選 3 個號碼，全部開出即中獎' },
              { playId: 'm539FourAssign', name: '四合', desc: '選 4 個號碼，全部開出即中獎' }
            ]
          }
        ]
      }
    ]
  }
]
