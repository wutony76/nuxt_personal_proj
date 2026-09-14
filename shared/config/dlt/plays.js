/**
 * 大樂透看板設定總表。
 *
 * 大樂透只有一種注單形狀（6 個號碼一注），因此只宣告一個虛擬分頁（tabId: 1），
 * 底下 8 個「獎項」作為 groupList 項目，`playId` 直接沿用官方 `Lotto649Result` 的欄位 key
 * （jackpotAssign／secondAssign…，見 shared/config/dlt.ts 的 DLT_TIERS），供 Report.vue
 * 顯示對獎表的「名稱／對中條件」用。
 *
 * ⚠️ 與其他彩種的看板設定最大的不同：**不含 `odds` 欄位**——大樂透派彩金額完全鏡射官方，
 * 要等開獎結算後才知道，看板設定本身不記錄任何賠率快照（見 openspec/changes/add-dlt/design.md
 * Decision 2、7）。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）—— Nitro 對 shared 下的檔案走 Node 原生 ESM
 *    解析、不認得 `#shared` 別名，只要設定檔內出現這類 import，伺端一載入就會炸。
 */
export default [
  {
    key: 'dlt',
    name: '大樂透',
    list: [
      {
        tabId: 1,
        tabName: '大樂透',
        settings: {
          // item.min/max 固定 50（每注售價），issue.max 由 DltClass 依「上一次真的有人中頭獎
          // 那期金額」動態算出（見 shared/config/dlt.ts DLT_QUOTA_FALLBACK_COIN），本檔不記錄。
          quota: { item: { min: 50, max: 50 } }
        },
        tabGroup: [
          {
            groupName: '獎項',
            groupList: [
              { playId: 'jackpotAssign', name: '頭獎', desc: '對中 6 個號碼' },
              { playId: 'secondAssign', name: '二獎', desc: '對中 5 個號碼＋特別號' },
              { playId: 'thirdAssign', name: '三獎', desc: '對中 5 個號碼' },
              { playId: 'fourthAssign', name: '四獎', desc: '對中 4 個號碼＋特別號' },
              { playId: 'fifthAssign', name: '五獎', desc: '對中 4 個號碼' },
              { playId: 'sixthAssign', name: '六獎', desc: '對中 3 個號碼＋特別號' },
              { playId: 'seventhAssign', name: '七獎', desc: '對中 3 個號碼' },
              { playId: 'normalAssign', name: '普獎', desc: '對中 2 個號碼＋特別號' }
            ]
          }
        ]
      }
    ]
  }
]
