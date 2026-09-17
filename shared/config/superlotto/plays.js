/**
 * 威力彩看板設定總表。
 *
 * 威力彩只有一種注單形狀（第一區 6 碼＋第二區 1 碼一注），因此只宣告一個虛擬分頁（tabId: 1），
 * 底下 10 個「獎項」作為 groupList 項目，`playId` 直接沿用官方 `SuperLotto638Result` 的欄位 key
 * （super638JackpotAssign／super638SecondAssign…，見 shared/config/superlotto.ts 的
 * SUPERLOTTO_TIERS），供 Report.vue／DialogRule.vue 顯示對獎表的「名稱／對中條件」用。
 *
 * ⚠️ 與其他彩種的看板設定最大的不同：**不含 `odds` 欄位**——威力彩派彩金額完全鏡射官方，
 * 要等開獎結算後才知道，看板設定本身不記錄任何賠率快照（比照 dlt/plays.js）。
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）—— Nitro 對 shared 下的檔案走 Node 原生 ESM
 *    解析、不認得 `#shared` 別名，只要設定檔內出現這類 import，伺端一載入就會炸。
 */
export default [
  {
    key: 'superlotto',
    name: '威力彩',
    list: [
      {
        tabId: 1,
        tabName: '威力彩',
        settings: {
          // item.min/max 固定 100（每注售價），issue.max 由 SuperlottoClass 依「上一次頭獎金額」
          // 動態算出（見 shared/config/superlotto.ts SUPERLOTTO_QUOTA_FALLBACK_COIN），本檔不記錄。
          quota: { item: { min: 100, max: 100 } }
        },
        tabGroup: [
          {
            groupName: '獎項',
            groupList: [
              { playId: 'super638JackpotAssign', name: '頭獎', desc: '第一區 6 碼＋第二區' },
              { playId: 'super638SecondAssign', name: '二獎', desc: '第一區 6 碼' },
              { playId: 'super638ThirdAssign', name: '三獎', desc: '第一區 5 碼＋第二區' },
              { playId: 'super638FourthAssign', name: '四獎', desc: '第一區 5 碼' },
              { playId: 'super638FifthAssign', name: '五獎', desc: '第一區 4 碼＋第二區' },
              { playId: 'super638SixthAssign', name: '六獎', desc: '第一區 4 碼' },
              { playId: 'super638SeventhAssign', name: '七獎', desc: '第一區 3 碼＋第二區' },
              { playId: 'super638EighthAssign', name: '八獎', desc: '第一區 2 碼＋第二區' },
              { playId: 'super638NinthAssign', name: '九獎', desc: '第一區 3 碼' },
              { playId: 'super638NormalAssign', name: '普獎', desc: '第一區 0 或 1 碼＋第二區' }
            ]
          }
        ]
      }
    ]
  }
]
