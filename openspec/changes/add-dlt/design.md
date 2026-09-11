## Context

大樂透沒有 `bglottery` 來源可查（不像 6HC/K3/PK10/SSC/11X5/EGGS/KL10/KL8/FC3D/PL3 都是移植既有玩法資料夾），
且經過反覆確認，本次**不是**「比照官方規則自建一套模擬玩法」，而是**直接鏡射官方大樂透的實際開獎與實際
派彩金額**：開獎號碼、8 個獎項的派彩金額，全部即時讀取台灣彩券官方資料，本站不自建 RNG、不自建賠率
公式、不自建彩池與摃龜滾存邏輯。

本專案已有可直接利用的官方資料來源（皆為 2026-08-28 規劃 `add-taiwan-lottery-hall` 時直接呼叫上游
驗證取得，**無官方文件保證**，上游改版需重新核對）：
- `server/api/lottery-tw/last-number.get.ts`：呼叫 `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LastNumber`，
  回傳各遊戲「最新一期」開獎號（`gameCode=5118` 為大樂透，欄位 `lotNumber`）。**無期別範圍參數**，
  只能拿到「目前最新的一期」。
- `server/api/lottery-tw/prize.get.ts?gameCode=5118&period=<period>`：呼叫
  `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result`，回傳指定期別的 8 個獎項明細
  （`jackpotAssign`/`secondAssign`/`thirdAssign`/`fourthAssign`/`fifthAssign`/`sixthAssign`/
  `seventhAssign`/`normalAssign`，每項含 `perPrize`/`winnerCount`）。**必須先知道 `period`**才能查。

⚠️ 重要修正：大樂透官方實際是 **8 個獎項**（頭獎／二獎／三獎／四獎／五獎／六獎／七獎／普獎），
不是先前版本誤植的 7 個——先前把「七獎」與「普獎」誤併成一個「普獎」，這次以 `prize.get.ts` 的
`GAME_DEFS[5118].tiers` 實際欄位為準（見 Decision 1 修正後的對照表）。

參考先例：
- 單一盤口分層架構：`kl10`／`kl8`
- 選號池 UI 互動：`kl10`／`kl8` 的 `base/BoardRenxuan.vue`
- UI 版面骨架與元件拆分順序：`K3-CD`（使用者明確要求本次 layout 先參照 K3-CD）
- 歷史開獎記錄：`LOTTERY_BASE.recordOpenCode`（`OpenCodeRecord[]`，每個彩種既有的「近期開獎」機制，
  本次直接沿用同一個欄位，只是餵進去的資料來源從「內部 RNG」換成「官方即時 API」）——
  ⚠️ **已依使用者指示複製成獨立一份**：`server/services/game/lottery/tw/base.ts`／`tw/orders.ts`
  （逐字複製自 `bg/base.ts`／`bg/orders.ts`，`tw/orders.ts` 把 `tiers` 欄位型別從 6hc 專屬的
  `CreditLianmaTier` 換成通用的 `Array<Record<string, unknown>>`，避免 tw 依賴 bg 的 shared
  config），bg／tw 兩個分類的彩票基底從此各自獨立維護，`DltClass` 繼承 `tw/base.ts` 的
  `LOTTERY_BASE`，不會 import 到 `bg/base.ts`。此檔案與 `tw/orders.ts` 已實際建立（非僅規劃）。

使用者在提案階段拍板數項調整（皆反映在下方 Decisions）：
1. 路由與分類全面獨立為 `tw`（Decision 0）
2. Config 命名不帶 `cd` 後綴（Decision 6）
3. 自動下注面板直接複製一份獨立版本（Decision 0 延伸）
4. **開獎號碼與 8 個獎項派彩金額完全鏡射官方即時資料**（Decision 2，本次最終定案，
   取代先前「不做彩池、固定倍率」與更早之前「彩池按中獎注額均分」的兩個舊版本）
5. 下注單位（每注固定 50 coin）與期別週期（每週二、五）比照官方公開規則（Decision 3）
6. **歷史開獎清單／冷熱號統計也比照官方資料**，但官方沒有「近N期列表」端點，改為本站自行
   逐期累積（Decision 4，新增）

## Goals / Non-Goals

**Goals:**
- 49 選 6（不重複）＋ 1 特別號的選號盤面與注單管理（自建 UI／下注流程）。
- 開獎號碼＝官方當期實際開出的號碼（讀 `last-number.get.ts`），MUST NOT 自建 RNG 產生開獎號。
- 8 個獎項的派彩金額＝官方當期實際 `perPrize`（讀 `prize.get.ts`），MUST NOT 套用賠率公式或 RTP。
- 下注單位（每注 50 coin）與開獎週期（每週二、五）比照官方公開規則。
- 近期開獎清單／冷熱號統計，比照本站既有 `recordOpenCode` 機制，逐期累積官方資料建立自己的歷史。
- 元件拆分與版面順序比照 `K3-CD`。
- 路由／元件／後端 service／`gameSlugs.js` 分類皆獨立為新分類 `tw`；自動下注面板獨立複製一份。

**Non-Goals:**
- 不做官方盤／信用盤雙盤口（使用者已拍板：單一模式）。
- 不做複式／包牌下注（一注固定 6 個號碼；複式留待後續變更）。
- **不自建賠率公式、不自建 RTP、不自建彩池／摃龜滾存**——這些官方本來就有的動態，本站用
  「即時讀取官方當下數值」取代，不自己模擬一套。
- **不做「官方歷史多期查詢」的回填**——本站的近期開獎/冷熱號統計只能從「本站上線後、逐期累積」
  開始算，無法回溯上線前的官方歷史（官方沒有提供對應端點，見 Decision 4）。
- 不修改既有 `useBgAutoActive.ts`／`BgAutoPanel.vue`。
- 不修改 `server/api/lottery-tw/{last-number,prize}.get.ts` 既有對外回應格式（僅視需要抽出
  可重用的 service function，供 `dlt.ts` 與既有前台頁面共用同一份邏輯）。

## Decisions

### 0. 路由與分類：獨立 `tw` 分類，不歸入既有 `BG_GAMES`；自動下注面板也獨立複製一份

使用者拍板路由為 `/lottery/tw/dlt`（不是 `bg` 系列的 `/lottery/bg/**`）。`shared/config/gameSlugs.js`
目前只有兩個分類陣列——`RETRO_GAMES`（小遊戲中心）與 `BG_GAMES`（皆移植自 `bglottery` 的彩票玩法）。
大樂透規則來自公開的真實台彩規則、不是移植自 `bglottery`，與 `BG_GAMES` 系列的來源性質本質不同，
因此新增第三個分類陣列 `TW_GAMES`，與既有兩者並列，`bg` 系列既有玩法完全不受影響：

```js
// shared/config/gameSlugs.js（新增，不動 BG_GAMES／RETRO_GAMES）
export const TW_GAMES = [
  { key: 'DLT', pageSlug: 'dlt' }
]
export function findTwByPageSlug(slug) {
  return TW_GAMES.find((g) => g.pageSlug === slug)
}
```

連動影響（皆為新增分支，不改既有 `bg`／`retro` 邏輯）：
- 頁面：`app/pages/lottery/tw/dlt.vue`（新資料夾 `tw/`）
- 元件：`app/components/lottery/tw/dlt/{base,block,block/footer}/**`
- 後端 service：`server/services/game/lottery/tw/dlt.ts`（新資料夾 `tw/`）
- `app/middleware/game-access.global.ts`：新增 `else if (to.path.startsWith('/lottery/tw/'))` 分支
  呼叫 `findTwByPageSlug`，判斷邏輯與既有 `bg` 分支一致，只是查表來源不同
- `server/services/admin/modules/poolAudit.ts`：**不需要新增登記**（本玩法沒有本站自建的彩池）

**自動下注面板**：使用者拍板「直接複製一組新的與 bg 分開」：

```
app/composables/useTwAutoActive.ts        （複製 useBgAutoActive.ts 的結構，LotteryType union 換成 tw 系列）
app/components/lottery/tw/TwAutoPanel.vue （複製 BgAutoPanel.vue 的結構，v-if 分支換成 tw 系列元件）
```

兩份檔案初期都只服務 `'dlt'` 一種玩法。⚠️ 這是刻意的取捨：兩份自動下注面板此後各自獨立維護，
`bg` 系列日後若修正自動下注邏輯，不會自動同步到 `tw` 系列，反之亦然。

### 1. 官方資料來源與 8 個獎項對中條件（機率僅供分類判定，不用於推導賠率）

開獎為 6 個一般號碼（1~49 不重複，記為 `W`）＋ 1 個特別號（自剩餘 43 號中另開，記為 `s`，`s ∉ W`）。
玩家一注 6 個號碼（記為 `T`），設 `k = |T ∩ W|`（對中一般號碼數），`hasS = 1 若 s ∈ T`。

依 `prize.get.ts` 的 `GAME_DEFS[5118].tiers`（官方實際欄位，8 項，非先前誤植的 7 項），
對應 `(k, hasS)` 如下：

| 官方欄位 key | 官方標籤 | 對中條件 | 對中組數 |
|---|---|---|---|
| `jackpotAssign` | 頭獎 | k=6 | `C(6,6)×C(42,0)=1` |
| `secondAssign` | 二獎 | k=5 且中特別號 | `C(6,5)×C(42,0)=6` |
| `thirdAssign` | 三獎 | k=5 不中特別號 | `C(6,5)×C(42,1)=252` |
| `fourthAssign` | 四獎 | k=4 且中特別號 | `C(6,4)×C(42,1)=630` |
| `fifthAssign` | 五獎 | k=4 不中特別號 | `C(6,4)×C(42,2)=12,915` |
| `sixthAssign` | 六獎 | k=3 且中特別號 | `C(6,3)×C(42,2)=17,220` |
| `seventhAssign` | 七獎 | k=3 不中特別號 | `C(6,3)×C(42,3)=229,600` |
| `normalAssign` | 普獎 | k=2 且中特別號 | `C(6,2)×C(42,3)=172,200` |
| （不中獎） | — | 其餘 | `13,983,816-432,824=13,550,992` |

⚠️ 對帳基準：8 獎項對中組數加總仍是 `432,824`（跟先前 7 項版本相同，只是拆法不同——原本誤把
`seventhAssign` 與 `normalAssign` 併成一個「普獎」），`432,824/13,983,816 ≈ 3.096%` 與「約 1/32
中一注」的公開常識數字一致。
⚠️ 這份機率表**只用來判定一注屬於哪個獎項**（`dltTierOf(bet, W, s)` 回傳官方欄位 key 之一或
`null`），**不用來計算賠率**——賠率／獎金完全來自 Decision 2 的官方即時資料，機率本身不影響
派彩金額一分一毫。

### 2. 開獎與派彩完全鏡射官方，MUST NOT 自建 RNG／賠率／彩池

這是本次最終拍板、也是與先前兩個舊版本（「彩池按中獎注額均分」→「固定倍率 × RTP」）最大的差異：

- **開獎號碼**：不自建 `dltRandomDraw()`。改為官方大樂透實際開獎後，呼叫
  `last-number.get.ts`（`gameCode=5118`）取得該期 `lotNumber`（6 個一般號＋1 特別號），
  直接當作本站這一期的開獎結果。
- **派彩金額**：不做「公平賠率 × RTP」。改為呼叫 `prize.get.ts?gameCode=5118&period=<period>`，
  取得該期 8 個獎項的 `perPrize`（官方當期實際、每注分配到的金額），玩家某注若判定屬於某獎項，
  派彩＝**該獎項當期的 `perPrize`**（1 官方金額單位＝1 coin，因為本站每注固定 50 coin，
  與官方每注 50 元的定價已經是 1:1 對應，`perPrize` 可以直接當作 coin 數字用，不需要再乘任何倍率）。
- **沒有彩池、沒有摃龜滾存**：官方那邊「有人中獎會重新累積、沒人中會滾存」的動態，本站完全不用
  自己實作——因為本站每期都是直接讀官方「當期已經算好的最終結果」，官方那邊已經處理完滾存/累積，
  本站只是照抄那個最終數字。若某獎項當期官方 `winnerCount=0`（該獎項本期無人中），本站對應獎項
  當期也自然不會有任何一注符合中獎條件（因為判定用的是同一組真實開獎號），邏輯上不會出現
  「官方沒人中但本站有人中」這種矛盾情況，因此不需要額外處理「無人中獎時錢要去哪裡」的問題。

⚠️ `settleIssuePrize()` 因此不需要 `carry`／`issuePoolMap`／`minPool`／`rakeRatio`／RTP 等任何欄位，
全部替換成「呼叫官方 API 取得 8 個獎項的 `perPrize` → 逐注判定歸類 → 派彩＝對應 `perPrize`」。

### 3. 下注單位與期別週期：比照官方公開規則

| 項目 | 官方公開規則 | 本次採用 |
|---|---|---|
| 每注售價 | 新臺幣 50 元 | **每注固定 50 coin**，玩家不可調整金額 |
| 開獎頻率 | 每週二、五 | 沿用 |
| 投注截止時間 | 開獎當日 20:00 | 沿用 |
| 開獎時間 | 開獎當日 20:30（結果公告約 20:46） | 沿用 |

⚠️ 本站的「期別」建議**直接沿用官方回傳的 `period` 字串**（來自 `last-number.get.ts` 的
`period` 欄位），不要自己另外發明一套期別編碼再做映射——避免「本站期別」與「官方期別」對不上號
導致派彩金額（Decision 2）配錯期的風險。`settings.quota.item.min/max` 因此是固定值 50；
`settings.quota.issue.max`（單期最多送單注數）由使用者於 Open Questions 拍板。

### 4. 近期開獎清單／冷熱號：沿用 `LOTTERY_BASE.recordOpenCode`，本站自行逐期累積，不做官方歷史回填

官方 `last-number.get.ts` 只能查「最新一期」，沒有「近N期列表」端點；`prize.get.ts` 也必須先知道
單一 `period` 才能查，兩者都不支援「一次拿歷史區間資料」（`openspec/changes/add-taiwan-lottery-hall/design.md`
Non-Goals 已明確排除「歷史期別查詢」，Open Questions 也承認這是已知缺口，需要另外設計）。

因此本站採「自行逐期累積」策略，直接沿用其他彩種既有的 `LOTTERY_BASE.recordOpenCode: OpenCodeRecord[]`
機制（`server/services/game/lottery/bg/base.ts`）：**每次 `dlt.ts` 成功結算一期（Decision 5），
就把該期的官方開獎號（`issue` 用官方 `period`、`openCode` 用官方 6+1 號碼）push 進
`this.recordOpenCode`**，`History.vue`（近 5～10 期開獎）與 `Road.vue`（冷熱號：統計
`recordOpenCode` 裡每個號碼 1~49 出現次數）都只是對這個既有陣列做既有慣例的資料轉換，
不需要另外設計新的儲存機制或呼叫官方任何「歷史」API。

⚠️ 已知限制：本站上線初期 `recordOpenCode` 是空的，需要逐期（每週二、五各一期）累積才會有資料，
「近10期」要等 5 週才湊得齊；上線前的官方歷史（例如上線那週之前已經開過的期別）**不會**被回填，
`History.vue`／`Road.vue` 在資料不足 10 期時應正常顯示「目前僅有 N 期資料」，不是錯誤。

### 5. 結算流程：依賴外部官方 API，需要輪詢與 `pending-settlement` 狀態，不能一次性呼叫失敗就放棄

`server/api/lottery-tw/{last-number,prize}.get.ts` 目前是「使用者觸發即時呼叫上游、失敗就
丟 502」的薄封裝，寫死在 `defineEventHandler` 內、無法被其他 service import；且完全沒有快取/重試。
本次為 `dlt.ts` 的結算需求，需要：

- 把兩支既有端點的核心邏輯抽出成可重用的 service function（例如
  `fetchTaiwanLotteryLastNumber()`、`fetchTaiwanLotteryPrize(gameCode, period)`），
  讓既有前台頁面（`lottery-hall-taiwan.vue`）與新的 `dlt.ts` 共用同一份實作，
  **不改變**這兩支既有 API 路由對外的回應格式與行為。
- `dlt.ts` 在開獎時間（20:30）後才開始嘗試結算：先呼叫 `fetchTaiwanLotteryLastNumber()`
  確認官方 `period` 已經更新到本期、且 `lotNumber` 有值；再呼叫 `fetchTaiwanLotteryPrize()`
  確認 8 個獎項的 `perPrize` 都已經到位（官方公布「中獎號碼」與「中獎明細/獎金」很可能不是
  同一時間點，獎金明細通常會晚一些）。
- 只要任一項還沒到位，該期維持 `pending-settlement` 狀態（**不是**「本期無人中獎」），
  之後（例如每隔幾分鐘）重試，直到兩者都到位才真正結算派彩、並把結果 push 進
  `recordOpenCode`（Decision 4）。
- 已成功結算的期別要標記，避免重試迴圈重複結算（比照既有各彩種「已結算期別不重複結算」的慣例）。

### 6. Config 檔案結構：不帶 `cd` 後綴，單一核心檔 + 看板設定層

使用者拍板「這邊沒有 cd，直接 dlt 就好」——大樂透只有單一模式，不需要沿用 `kl10-cd.ts`／`kl8-cd.ts`
這類「因為要跟机率核心檔區分、或呼應 CD/OF 命名慣例」才加的 `-cd` 後綴。本次結構簡化為：

```
shared/config/dlt.ts          8 獎項對中條件的判定邏輯（單一檔案，不拆 dlt-cd.ts；不含賠率公式）
shared/config/dlt/plays.js    看板設定：單一虛擬分頁，8 個獎項作為 groupList（純 JS，禁止 import）
shared/config/dlt/helpers.ts  設定讀取層：findDltPlay/Tab、dltQuotaOf、dltHasBetCode
```

`dlt.ts` 內容涵蓋：
- 機率常數：`DLT_NUMBER_MIN/MAX`(1/49)、`DLT_PICK_COUNT`(6)、`DLT_TOTAL_COMBOS`(13,983,816)
- 判定：`_parseBet`、`dltTierOf(bet, W, s)`（回傳官方獎項 key 之一或 `null`）
- 獎項常數：`DLT_TIERS`（8 個獎項的 `{ key, label, k, hasSpecial, ways }` 定義，`key`／`label`
  直接沿用 `prize.get.ts` 的 `GAME_DEFS[5118].tiers`，避免兩處各自定義同一份對照表）

### 7. 看板設定層：單一虛擬分頁，非傳統多分頁網格；不含賠率快照

`dlt/plays.js` 只需宣告一個虛擬分頁（`tabId: 1`、`tabName: '大樂透'`），其下 8 個「獎項」作為
`groupList` 項目（供 `Report.vue` 顯示對獎表的「名稱／對中條件」用）。與其他玩法不同的是
**不含 `odds` 快照**——因為派彩金額要等官方結算後才知道（Decision 2），下注當下不顯示賠率／獎金。
下注額度（`settings.quota`）沿用既有 `item.min/max`／`issue.max` 結構，`item.min/max` 固定為 50。

### 8. 注碼格式：每注固定 6 個號碼（不重複、1~49），一次送單可含 A~E 最多 5 注，伺端唯一判定入口

```
大樂透  01,07,15,22,33,49        （逗號分隔恰好 6 個號碼，範圍 1~49，不重複，由小到大排序後比對）
```

`dlt.ts` 的 `_parseBet()` 驗證：個數＝6、範圍 1~49、無重複；`dltTierOf(bet, W, s)`
回傳 8 個官方獎項 key 之一或 `null`（不中獎），為唯一判定入口，供伺端結算共用。

⚠️ 一次送單 SHALL 可包含 1~5 組**各自獨立**的注碼（比照官方紙本投注單的 A~E 五個注格，見
Decision 9），每組各自固定 50 coin、各自獨立判定與派彩，彼此互不影響（例如 A 組中頭獎、
B 組不中，兩組互不稀釋）。**這不是「複式」**——複式是「選超過 6 個號碼，系統自動展開成
`C(k,6)` 種組合」，Non-Goals 排除的是這種自動展開；A~E 是「玩家自己手動填 1~5 組各自完整的
6 碼」，每組都是一次獨立、完整的判定與派彩，不涉及任何組合展開邏輯，因此伺端只需要把
「一次送單」處理成「1~5 筆獨立注單」即可，沿用既有下注 API 本來就支援的「一次送單多筆注單」
能力，不需要新的判定或派彩機制。

### 9. 投注區還原官方紙本投注單：7×7 號碼方格 ＋ A~E 五組注格 ＋ 電腦選號

使用者拍板「投注區想要更還原實際上官方投注單的方式」，還原範圍明確為：
1. **號碼方格**：1~49 排成 7×7 方格供圈選（視覺上比照紙本投注單的方格排版，**不是** `kl10`／`kl8`
   那種「號碼池」風格的選號元件）。
2. **A~E 五組注格**：同一次送單最多可填 5 組，每組各自一個 7×7 方格、各自選滿 6 個號碼、
   各自固定 50 coin（見 Decision 8）。
3. **電腦選號**：每一組（A~E）旁各自有一個「電腦選號」勾選/按鈕，勾選後該組由系統隨機選出
   6 個號碼（等機率，不重複），玩家仍可在勾選後手動改選推翻機選結果。

**明確排除**（使用者已確認本次不還原）：
- **期數**（連續購買未來 N 期）：不做，本次每次送單僅對應「下一個即將開獎的官方期別」一期。
- **倍數**（同一組號碼加倍下注）：不做，每組固定 50 coin，不提供倍數輸入。

`base/Board.vue`（單一 7×7 方格 + 已選 6 碼預覽 + 機選/清空，對應一組 A~E 注格的重複渲染單位）
與 `block/Controls.vue`（新增「新增一組（最多 5 組）」／「刪除某一組」的操作，取代原本單一組的
送出/清空/機選）需要重新設計互動：

```
BetSlip（送單前狀態，比照官方紙本投注單的欄位結構）
├─ slots: Array<{ id: 'A'|'B'|'C'|'D'|'E', numbers: number[], isQuickPick: boolean }>
│    每組 numbers 最多 6 個（未選滿不可送出該組）、isQuickPick 控制該組是否由系統代選
├─ 最少 1 組、最多 5 組（少於 1 組不可送單；超過 5 組由 UI 阻擋，不送出第 6 組）
└─ 總金額 = 已選滿的組數 × 50（即時顯示，比照官方投注單「總計金額」欄）
```

⚠️ `useDlt.ts` 的 `state` 需要從「單一組 6 碼」改為「`slots` 陣列（1~5 組）」，`actions.submit()`
一次送單時把每組各自組成一筆獨立注單（`betCode` 各自為該組的 6 碼字串），伺端沿用既有「一次
送單可含多筆注單」的能力逐筆驗證與派彩，不需要新的批次邏輯。
⚠️ 電腦選號的隨機邏輯放在前端（純 UI 便利功能，比照其他玩法既有的「機選」按鈕），伺端仍然只認
最終送出的 6 碼組合，不會知道也不需要知道某組是玩家手動選的還是電腦選的。

### 10. Layout / 元件拆分：比照 `K3-CD` 的 block 清單，目錄結構比照 `kl10`（單盤口不分 cd/of）

依 `openspec/project.md` 的分層標準，大樂透只有一個盤口，元件平鋪在
`app/components/lottery/tw/dlt/{base,block,block/footer}/`（`tw` 分類，見 Decision 0），
但 **block 清單與呈現順序照抄 `K3-CD`**：

| K3-CD 對應檔案 | 大樂透版本 | 差異點 |
|---|---|---|
| `block/Header.vue` | `block/Header.vue` | 顯示期別（＝官方 `period`）／倒數（天/時/分）／上期開獎（官方 6 號＋特別號，來自 `recordOpenCode`）；不顯示預告獎金（Decision 2 已知限制） |
| （K3-CD 無選號盤，是表格看板） | `base/Board.vue`（新增） | 1~49 號碼宮格選號 + 已選 6 碼即時預覽 + 機選/清空，比照 `kl10`／`kl8` 的 `BoardRenxuan.vue` 選號池模式；下注金額固定 50，不提供輸入框 |
| `block/CurrItems.vue` | `block/CurrItems.vue` | 待送出注單列表 |
| `block/Controls.vue` | `block/Controls.vue` | 送出／清空／機選 |
| `block/Report.vue` | `block/Report.vue` | 8 獎項對獎表；下注時只顯示「獎項名稱／對中條件」，開獎結算後才補上該期實際 `perPrize`（Decision 2） |
| `block/History.vue` | `block/History.vue` | 近期開獎（讀 `recordOpenCode`，筆數依上線時間而定，見 Decision 4 已知限制） |
| `block/Road.vue` | `block/Road.vue` | 冷熱號（統計 `recordOpenCode` 內各號碼 1~49 出現次數，同樣受限於 Decision 4） |
| `block/DialogShell.vue`／`DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue` | 同名沿用 | `DialogRule.vue` 說明「開獎號碼與獎金皆鏡射官方大樂透實際結果，非本站自訂」與「下注當下不顯示獎金，結算後才公布」 |
| `block/footer/Chat.vue`／`footer/Auto.vue` | 同名沿用，但掛在獨立的 `TwAutoPanel.vue`（見 Decision 0） | `Auto.vue` 的「自動下注」＝自動用同一組（或每期機選）6 碼下注 |

⚠️ 若之後真的需要複式／包牌（Non-Goal 之外的擴充），`base/Board.vue` 的複式展開邏輯應比照
`kl10`／`kl8` 的「前端展開成多注、伺端一注一注驗」模式，不在本次範圍內先行預留特殊欄位。

## Risks / Trade-offs

- **[Risk]** 本玩法的開獎與結算完全依賴外部官方 API（`api.taiwanlottery.com`），這兩支端點
  沒有官方文件保證、也沒有 SLA。若官方改版欄位名稱（例如 `jackpotAssign` 改名）、延遲公布、
  或暫時不可用，本站的結算會卡住或算錯。
  → **Mitigation**：`pending-settlement` 狀態＋輪詢重試（Decision 5）；欄位名稱直接沿用
  `prize.get.ts` 既有的 `GAME_DEFS[5118]` 常數（同一份設定，不重複定義），上游若改版兩處
  会同時發現、同時修。
- **[Risk]** 官方「開獎前的預告累積獎金」（新聞常見「本期上看 2 億」）目前抓不到，玩家下注時
  看不到本期實際獎金會是多少，要等結算後才知道。
  → **Mitigation**：`DialogRule.vue`／`Report.vue` 需清楚說明「獎金於開獎結算後依官方實際
  分配金額公布」，管理玩家預期。
  → 若使用者事後希望能顯示「預告獎金」，需要先確認官方是否有其他公開端點/頁面可查，
  屬於獨立的後續調查與變更，不在本次範圍內。
- **[Risk]** 「近10期」「冷熱號」需要本站自行逐期累積（Decision 4），上線初期資料不足、
  也無法回填上線前的官方歷史。
  → **Mitigation**：這是官方端點本身的限制（無歷史查詢 API），非本站技術缺陷；UI 需正常處理
  「資料筆數不足」的情境，不當成錯誤。
- **[Risk]** 期別若不直接沿用官方 `period` 字串、而是自己另外編碼，容易在「本站期別 ↔ 官方期別」
  的映射上出錯，導致派彩金額配錯期。
  → **Mitigation**：Decision 3 已拍板直接沿用官方 `period` 本身當作本站 `issue`，不做額外映射。
- **[Risk]** 選號盤面（49 選 6）比 K3-CD 的「表格式固定注項」互動更接近 `kl10`／`kl8`。
  → **Mitigation**：已在 Decision 10 明確拆分「版面骨架／清單順序照抄 K3-CD」與
  「選號互動模型照抄 kl10/kl8 的 BoardRenxuan」。
- **[Risk]** 自動下注面板獨立複製一份（`TwAutoPanel.vue`）後，未來若 `bg` 系列的自動下注邏輯
  修正，`tw` 這份不會同步跟到。
  → **Mitigation**：使用者明確拍板此取捨，非本次新增的技術債。

## Migration Plan

全新彩種，無既有資料需要遷移。步驟：
1. 重構 `server/api/lottery-tw/{last-number,prize}.get.ts`：抽出可重用的 service function
   （`fetchTaiwanLotteryLastNumber()`／`fetchTaiwanLotteryPrize(gameCode, period)`），既有兩支路由
   改為呼叫這兩個 function，**回應格式不變**（驗證 `lottery-hall-taiwan.vue` 行為不受影響）
2. `shared/config/dlt.ts`（8 獎項對中條件的分類邏輯：`DLT_TOTAL_COMBOS=13_983_816`、`DLT_TIERS`、
   `dltTierOf()`）→ node 對帳腳本窮舉或組合數公式二次驗證，確認對中組數加總與機率表一致
3. `shared/config/dlt/{plays.js,helpers.ts}`（單一虛擬分頁看板設定，僅列獎項名稱/條件，
   不含賠率快照——賠率要等結算後才知道）
4. `server/services/game/lottery/tw/dlt.ts`：繼承 `tw/base.ts`（已建立，見上）的 `LOTTERY_BASE`——
   `validateBetQuota`（固定 50）、
   依日曆判斷下一個開獎日與鎖單時間、`settleIssuePrize`（呼叫官方 API、`pending-settlement`
   輪詢、8 獎項分類派彩、push 進 `recordOpenCode`）、`server/services/storage.ts` 註冊
5. 4 支 API（`current`/`opencode-history`/`claim`/`user-record`，無 `jackpot`）
6. `app/composables/useDlt.ts`、`app/components/lottery/tw/dlt/**`（依 Decision 10 對照表建置）
7. `app/composables/useTwAutoActive.ts`、`app/components/lottery/tw/TwAutoPanel.vue`
8. `app/pages/lottery/tw/dlt.vue`；`constants.js`／`gameSlugs.js`（新增 `TW_GAMES`／`findTwByPageSlug`）／
   `lottery-hall.vue`／`game-access.global.ts`（新增 `/lottery/tw/` 分支）全站接線
9. 端到端驗證：登入 → 選 6 碼送單 → 等待官方真實開獎（或用測試路由模擬官方回應）→
   驗證 `pending-settlement` → 官方資料到位後正確結算 8 個獎項派彩 → `recordOpenCode` 正確累積 →
   大廳卡片與路由確認
10. 中止時可直接刪除新增檔案，並回退 `constants.js`／`storage.ts`／`api.ts`／`lottery-hall.vue`／
    `gameSlugs.js`／`game-access.global.ts` 的追加段落；`lottery-tw/{last-number,prize}.get.ts`
    的重構若需回退，比對重構前後回應格式一致即可安全還原

## Open Questions

下注額度、期別週期、獎項對中條件與派彩來源已依 Decision 2/3 拍板（開獎與獎金完全鏡射官方，
每注固定 50 coin；每週二、五 20:00 鎖單、20:30 開獎）。以下事項仍需使用者於實作前拍板或確認：

1. **單期最多送單注數**（`settings.quota.issue.max`）：官方對此無硬性規定，需要使用者給一個
   本站合理預設。
2. **結算輪詢頻率／逾時**：官方開獎後多久重試一次確認 `perPrize` 到位、最長重試多久後要不要
   通知管理員（例如超過某個時數還沒到位，可能是官方端真的延遲或本站呼叫邏輯有問題）。
3. **複式／包牌**：本次明確排除（Non-Goal），確認是否列為下一個變更的待辦項目。
4. **「近10期」在上線初期不足 10 期時的 UI 呈現方式**：顯示「僅有 N 期」文字，或先隱藏
   `Road.vue` 冷熱號區塊直到累積滿一定期數，兩種都合理，需使用者選一個。
