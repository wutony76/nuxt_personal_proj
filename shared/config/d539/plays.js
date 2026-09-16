/**
 * 今彩539看板設定總表。
 *
 * 今彩539只有一種注單形狀（5 個號碼一注），因此只宣告一個虛擬分頁（tabId: 1），
 * 底下 4 個「獎項」作為 groupList 項目，`playId` 直接沿用官方 `Daily539Result` 的欄位 key
 * （d539JackpotAssign／d539SecondAssign…，見 shared/config/d539.ts 的 D539_TIERS），
 * 供 Report.vue 顯示對獎表的「名稱／對中條件」用。
 *
 * ⚠️ 與 DLT 一樣：**不含 `odds` 欄位**——今彩539派彩金額完全鏡射官方，要等開獎結算後才知道，
 * 看板設定本身不記錄任何賠率快照（見 openspec/changes/add-tw-lottery-suite/design.md Decision 2）。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）—— Nitro 對 shared 下的檔案走 Node 原生 ESM
 *    解析、不認得 `#shared` 別名，只要設定檔內出現這類 import，伺端一載入就會炸。
 */
export default [
  {
    key: 'd539',
    name: '今彩539',
    list: [
      {
        tabId: 1,
        tabName: '今彩539',
        settings: {
          // item.min/max 固定 50（每注售價），issue.max 由 D539Class 依「上一次頭獎金額」
          // 動態算出（見 shared/config/d539.ts D539_QUOTA_FALLBACK_COIN），本檔不記錄。
          quota: { item: { min: 50, max: 50 } }
        },
        tabGroup: [
          {
            groupName: '獎項',
            groupList: [
              { playId: 'd539JackpotAssign', name: '頭獎', desc: '對中 5 個號碼' },
              { playId: 'd539SecondAssign', name: '二獎', desc: '對中 4 個號碼' },
              { playId: 'd539ThirdAssign', name: '三獎', desc: '對中 3 個號碼' },
              { playId: 'd539FourthAssign', name: '四獎', desc: '對中 2 個號碼' }
            ]
          }
        ]
      }
    ]
  }
]
