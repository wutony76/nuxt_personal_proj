## Context

`add-dlt` 已經把「完全鏡射官方台灣彩券」這件事在架構上驗證過一次：官方期別 bootstrap、
`pending-settlement` 狀態、逐期回填歷史（`recordOpenCode`）、`TW_GAMES`/`roleGamePerms`/
`bet.post.ts` 的分類分派通用化。`add-taiwan-lottery-hall` 則已經把 8 款玩法（大樂透以外）的
官方 gameCode／查詢端點／獎項欄位都在 `taiwanLotteryApi.ts` 對照好（`TAIWAN_LOTTERY_GAMES`／
`GAME_DEFS`），這兩份既有成果是本次規劃的基礎，本次**不重新核對官方 API**，只規劃「怎麼把
既有的官方資料層接到新的下注玩法上」。

參考先例：
- 官方鏡射架構、期別 bootstrap、`pending-settlement`：`dlt.ts`（本次 7 款玩法比照複製此模式）
- 分類通用化：`add-dlt` Decision 0 已把 `TW_GAMES`/`roleGamePerms`/`bet.post.ts` 都設計成
  「新增陣列條目即可、不用改分派邏輯」，本次直接沿用，見 Decision 0
- 位數選號（正彩／組彩）判定邏輯：本站既有 `pl3`（排列3）／`fc3d`（福彩3D）
- 多玩法/多注區共存的下注面板配置：本站既有 `kl8`（快樂8）

⚠️ 賓果賓果（gameCode `1102`）官方 `LastNumber`／`prize` 系列 API 沒有中獎明細端點，但
使用者已提供官方公開的完整固定賠率表（基本玩法 1~10 星、超級獎號、猜大小、猜單雙），
本次改採「開獎號碼鏡射官方 API、賠率表寫死官方公開固定金額」的方式納入範圍，見 Decision 6。

## Goals / Non-Goals

**Goals:**
- 7 款玩法（威力彩、今彩539、49樂合彩、39樂合彩、3星彩、4星彩、賓果賓果）皆可選號、
  下注、依官方資料結算。
- 開獎號碼皆鏡射官方即時資料；獎項派彩金額 6 款鏡射官方即時 API，賓果賓果因官方無明細
  端點改用官方公開固定賠率表（寫死常數），皆不自建賠率公式。
- 39樂合彩／49樂合彩各自獨立呼叫官方 API，不依賴主遊戲（今彩539／大樂透）的內部狀態。
- 3星彩／4星彩判定邏輯重用 `pl3`/`fc3d` 既有的位數比對演算法，只置換開獎號碼來源。
- 元件拆分沿用 DLT／K3-CD 的 block 清單，不重新設計版面骨架。

**Non-Goals:**
- 不做信用盤／官方盤雙盤口、不做複式／包牌（沿用 DLT 已拍板原則）。
- 不修改 `taiwanLotteryApi.ts` 既有的 `GAME_DEFS`／`TAIWAN_LOTTERY_GAMES`。
- 不修改既有 DLT 任何行為。
- 賓果賓果不做彩池／不做動態賠率（賠率為固定金額，不因中獎人數多寡調整）。

## Decisions

### 0. 分類與全站接線：沿用 `add-dlt` 已通用化的路徑，只新增陣列條目

`add-dlt` Decision 0 已經把以下三處改成「資料驅動、非硬編碼」：

- `shared/config/gameSlugs.js` 的 `TW_GAMES`：陣列本身就是唯一的登記點，`roleGamePerms.ts`
  的 `_catalog()`、`server/api/admin/{games,role-defs/[id]/games}.patch.ts` 的
  `VALID_CATEGORIES`、`bet.post.ts` 的 `category` 反查，全部都是「讀 `TW_GAMES` 陣列」而非
  寫死玩法清單。
- `app/middleware/game-access.global.ts` 的 `/lottery/tw/` 分支呼叫 `findTwByPageSlug(slug)`，
  查表邏輯不管陣列裡有幾個玩法都一樣。

**因此本次新增 7 款玩法，這三處完全不用修改邏輯，只需要在 `TW_GAMES`／`LOTTERY` 各自新增
7 個條目**：

```js
// shared/config/gameSlugs.js（只新增陣列項目）
export const TW_GAMES = [
  { key: 'DLT', pageSlug: 'dlt' },
  { key: 'SUPERLOTTO', pageSlug: 'superlotto' },   // 威力彩
  { key: 'D539', pageSlug: 'd539' },                // 今彩539
  { key: 'M649', pageSlug: 'm649' },                // 49樂合彩
  { key: 'M539', pageSlug: 'm539' },                // 39樂合彩
  { key: 'P3', pageSlug: 'p3' },                    // 3星彩
  { key: 'P4', pageSlug: 'p4' },                    // 4星彩
  { key: 'BINGO', pageSlug: 'bingo' }               // 賓果賓果
]
```

```js
// app/config/constants.js（只新增條目，皆帶 category:'tw'，比照 LOTTERY.DLT）
'SUPERLOTTO': { id: 11002, key: 'SUPERLOTTO', name: '威力彩', sort: 12, category: 'tw' },
'D539': { id: 11003, key: 'D539', name: '今彩539', sort: 13, category: 'tw' },
'M649': { id: 11004, key: 'M649', name: '49樂合彩', sort: 14, category: 'tw' },
'M539': { id: 11005, key: 'M539', name: '39樂合彩', sort: 15, category: 'tw' },
'P3': { id: 11006, key: 'P3', name: '3星彩', sort: 16, category: 'tw' },
'P4': { id: 11007, key: 'P4', name: '4星彩', sort: 17, category: 'tw' },
'BINGO': { id: 11008, key: 'BINGO', name: '賓果賓果', sort: 18, category: 'tw' }
```

`id` 僅為草案示意，實際數值需在 Tasks 階段確認不與既有 `LOTTERY` id 衝突。`key` 命名對齊
`taiwanLotteryApi.ts` 的 `TAIWAN_LOTTERY_GAMES.en` 縮寫精神（可讀、不與既有 `bg` 系列 key
撞名），非官方強制規則，Tasks 階段可依團隊習慣微調。

`server/services/storage.ts` 只需要 `import` 新 service class 並 `new` 一份加入既有陣列
（比照第 31/143 行 `DltClass` 的既有寫法），不動其他既有註冊。

### 1. 各玩法官方對照表（沿用 `taiwanLotteryApi.ts` 既有資料，不重新核對）

| 玩法 | gameCode | 查詢端點 | 獎項數 | 選號規則 | 每注 | 開獎頻率 |
|---|---|---|---|---|---|---|
| 威力彩 | 5134 | SuperLotto638Result | 10（頭獎～九獎＋普獎） | 第一區 01–38 選 6，第二區 01–08 選 1 | 100 coin | 每週一、四 20:30 |
| 今彩539 | 1197 | Daily539Result | 4（頭獎～四獎） | 01–39 選 5，無特別號 | 50 coin | 每天（週一至週六）20:30 |
| 49樂合彩 | 1121 | 49M6Result | 3（二合／三合／四合） | 01–49 選 2/3/4 個號碼，全中才算 | 25 coin | 每週二、五 20:30（跟大樂透同期） |
| 39樂合彩 | 5120 | 39M5Result | 3（二合／三合／四合） | 01–39 選 2/3/4 個號碼，全中才算 | 25 coin | 每天（週一至週六）20:30（跟今彩539同期） |
| 3星彩 | 2108 | 3DResult | 3（頭獎／二獎／三獎） | 000–999 三位數字，正彩／組彩／對彩 | 25 coin | 每天（週一至週六）20:30 |
| 4星彩 | 2109 | 4DResult | 3（頭獎／二獎／三獎） | 0000–9999 四位數字，正彩／組彩 | 25 coin | 每天（週一至週六）20:30 |
| 賓果賓果 | 1102 | ⚠️ 無官方明細端點 | 4 類（見 Decision 6） | 01–80 開 20 號，選 1–10 個號碼＋超級獎號／大小／單雙 | 25 coin（超級獎號額外加購 +25） | 每 5 分鐘一期 |

「獎項數」「查詢端點」直接取自 `taiwanLotteryApi.ts` 的 `GAME_DEFS`，「每注」「開獎頻率」
取自 `lottery-hall-taiwan.vue` 的 `GAME_META`（`add-taiwan-lottery-hall` 已核對過的公開規則）。

### 2. 期別 bootstrap 與輪詢頻率：依開獎頻率分兩組，不是所有玩法都套用 DLT 的參數

DLT 的期別 bootstrap（`_bootstrapOfficialPeriod`）與輪詢頻率是針對「每週 2 期」設計的
（失敗重試 5 秒一次，因為距離下次開獎還有好幾天，重試成本低）。本次玩法依開獎頻率分兩組：

- **每週 2 期**（威力彩、49樂合彩）：直接沿用 DLT 現成的 bootstrap／輪詢參數與流程，
  只換 gameCode／期別位數規則（威力彩官方期別格式需在 Tasks 階段實際呼叫驗證，不可假設
  跟大樂透同格式）。
- **每天 1 期（週一至週六）**（今彩539、39樂合彩、3星彩、4星彩）：開獎頻率是 DLT 的 3 倍，
  bootstrap 重試間隔可以沿用 5 秒（失敗重試成本不變），但**期別推進的判斷時間窗**需要
  重新設計——DLT 判斷「下一期」只需要分辨「今天是不是週二/五」，這組玩法需要判斷「今天
  是不是週日」（唯一不開獎的日子），邏輯簡單但不可直接複製 DLT 的 `_nextOfficialPeriod()`
  硬編碼星期判斷，需要參數化「開獎星期清單」。
- **每 5 分鐘 1 期**（賓果賓果）：完全不同量級，不沿用上述兩組的參數，獨立設計輪詢與
  期別推進邏輯，詳見 Decision 6。

建議把 `_nextOfficialPeriod()`／`_prevOfficialPeriods()` 抽成**可帶「開獎星期清單」參數**
的共用 helper（例如搬到 `tw/base.ts` 或新的 `tw/officialPeriod.ts`），DLT 與本次每週/每天
開獎的 6 款玩法共用同一份邏輯、只傳不同的星期清單，而不是每個 service 各自複製貼上一份
幾乎相同的日期運算（賓果賓果的每 5 分鐘輪詢邏輯量級不同，不套用此 helper，見 Decision 6）。
這是本次唯一建議「回頭重構 DLT」的地方，且是**向下相容**的抽取（DLT 呼叫端寫法不變，只是
實作搬到共用檔案），不改變 DLT 現有行為。

### 3. 39樂合彩／49樂合彩：各自獨立呼叫官方 API，不依賴主遊戲的內部狀態

樂合彩的規則是「跟隨大樂透／今彩539的開獎號碼」，但這只是**官方規則的描述**，不代表本站
的兩個 service 之間需要有程式碼層級的依賴。確認依據：`taiwanLotteryApi.ts` 的
`TAIWAN_LOTTERY_GAMES` 把 `1121`（49樂合彩）／`5120`（39樂合彩）列為獨立 gameCode，
`fetchTaiwanLotteryLastNumber()` 的 `lastNumberList` 會回傳這兩個 gameCode 各自的
`lotNumber` 條目（內容雖然等同主遊戲的開獎號，但官方 API 本身就分開提供，不需要本站自己
去「借」DLT 或今彩539 的開獎結果）。

**因此 49樂合彩／39樂合彩的 service 直接呼叫 `fetchTaiwanLotteryLastNumberOf(1121)` /
`fetchTaiwanLotteryLastNumberOf(5120)` 取得自己的開獎號，`fetchTaiwanLotteryPrize(1121, period)`
/ `fetchTaiwanLotteryPrize(5120, period)` 取得自己的獎項明細**，跟 DLT／今彩539 的 service
之間沒有 import 關係、沒有執行順序要求，可以並行開發、獨立測試。

判定邏輯與 DLT 的「k 個對中」模型不同：樂合彩是「玩家選定 N 個號碼（N∈{2,3,4}），開獎號中
**全部包含**這 N 個號碼才中獎」，不是部分對中也有獎——UI 上需要讓玩家先選「玩幾合」
（決定 N），再從號碼池選滿 N 個，比 DLT 的判定簡單（二元：中／不中），沒有「對中幾個算
第幾獎」的分級判斷，`shared/config/{m649,m539}.ts` 只需要一個
`isHit(selected: number[], drawn: number[]): boolean`（`selected.every(n => drawn.includes(n))`），
不需要 DLT 那種完整的獎項對照表函式。

### 4. 威力彩：兩區選號盤面

威力彩第一區（01–38 選 6）與第二區（01–08 選 1）需要各自獨立的選號狀態，`Board.vue` 內部
需要兩個子網格：

- 沿用 DLT `base/Board.vue` 的號碼格 UI（`.dlt-board-cell` 樣式），但拆成
  `<div class="zone-a">`（01–38，7×6 排列可對齊 DLT 既有的 10 欄網格邏輯微調）與
  `<div class="zone-b">`（01–08，單排）兩個獨立區塊。
- `useSuperlotto.ts` 的 slot 資料結構需要 `{ zoneA: number[], zoneB: number | null }`，
  不能沿用 DLT `DltSlot { numbers: number[] }` 的單一號碼陣列；`toggleNumber(slotId, zone, num)`
  多帶一個 `zone` 參數區分操作哪一區。
- 10 個獎項（頭獎～九獎＋普獎）的對中條件皆為「第一區對中數」×「第二區是否對中」的組合，
  判定函式結構與 DLT 的 `dltTierOf` 相似（都是查表映射），只是條件多一維（多了第二區），
  可以直接參考 DLT 現有函式的寫法延伸，不需要重新設計判定模型。

### 5. 3星彩／4星彩：重用 `pl3`/`fc3d` 的位數判定邏輯，只換開獎號碼來源

3星彩／4星彩本質上是「本站已經做過的玩法」（`pl3`＝排列3、`fc3d`＝福彩3D，兩者皆已有完整的
正彩／組彩位數比對判定邏輯與對應 UI），差異只在於：`pl3`/`fc3d` 的開獎號碼是**本站自建
RNG**，而本次 3星彩／4星彩要改成**讀官方 `fetchTaiwanLotteryLastNumberOf(2108/2109)`**。

**因此本次不重新設計判定演算法**，實作策略是：
- UI／盤面元件（數字選號 wheel/dial、正彩/組彩切換 tab）直接參考 `pl3`/`fc3d` 既有元件
  結構，改用 DLT 的柑仔店主題配色（比照 DLT 對 K3-CD 版面骨架「借結構、換主題」的做法）。
- 判定邏輯（`isExactMatch`／`isGroupMatch` 之類的既有 helper）從 `pl3`/`fc3d` 的
  `shared/config/` 找對應函式，改成 `shared/config/{p3,p4}.ts` 內重新 export 或複製一份
  （比照 DLT `tw/orders.ts` 逐字複製、避免跨分類互相 import 的既有慣例，不讓 `tw` 依賴
  `bg` 的 shared config）。
- **3星彩「對彩」規則（使用者已提供，`pl3`/`fc3d` 沒有等價規則，需新增）**：每注基本
  投注金額 25 元，分「前二對彩」與「後二對彩」兩種，皆為投注 3 位數字（例如 `123`）：
  - **前二對彩**：開獎結果前 2 碼與投注號碼前 2 碼**順序相同**才算中獎，獎金 750 元
    （25 元 × 30 倍）。
  - **後二對彩**：開獎結果後 2 碼與投注號碼後 2 碼**順序相同**才算中獎，獎金 750 元。
  - **前二／後二對彩各自獨立判定**，若投注 `123`、開獎也是 `123`，前二碼 `12` 相同
    （中前二對彩 750 元）**且**後二碼 `23` 相同（中後二對彩 750 元），**兩項獎金同時
    計算**，合計 1,500 元，**不可**因為三碼完全相同就只算一次。
  - `shared/config/p3.ts` 需要新增 `isFrontPairMatch(bet, drawn): boolean`／
    `isBackPairMatch(bet, drawn): boolean` 兩個獨立判定函式，`bingoStarPrize` 式的單一
    判定函式模式在這裡不適用（因為兩者可以同時成立、需要各自累加派彩，不是查表選一個
    結果）。4星彩官方規則沒有「對彩」，`p4.ts` 不需要這個模式。

### 6. 賓果賓果：開獎號鏡射官方 API，賠率表改用官方公開固定金額（使用者提供）

`taiwanLotteryApi.ts` 的 `GAME_DEFS` 明確排除 `1102`（賓果賓果），代表官方
`LastNumber`／`prize` 系列端點只有開獎號碼、沒有中獎明細，本站無法「即時查詢」賠率。但
使用者已提供官方公開的完整固定賠率表（非本站自訂），因此改採「開獎號碼一樣呼叫
`fetchTaiwanLotteryLastNumberOf(1102)` 鏡射官方即時資料，賠率表直接寫死這份官方公開的
固定金額常數」——這仍然是「照抄官方資料」，只是資料來源從 API 查詢換成常數表（因為官方
根本沒開放這部分查詢），不是本站自己發明賠率。

**4 種投注類型（`shared/config/bingo.ts`）：**

1. **基本玩法（1~10 星）**：玩家選擇星數 N（1~10）並從 01–80 選滿 N 個號碼，依「開出的 20
   個號碼中對中幾個」查表得獎金：

   ```ts
   // key：選幾星；value：{ 對中數: 獎金 }（0 表示「全部落空」，僅 8/9/10 星才有這個安慰獎）
   export const BINGO_STAR_PAYOUT: Record<number, Record<number, number>> = {
     1: { 1: 50 },
     2: { 2: 75, 1: 25 },
     3: { 3: 500, 2: 50 },
     4: { 4: 1000, 3: 100, 2: 25 },
     5: { 5: 7500, 4: 500, 3: 50 },
     6: { 6: 25000, 5: 1000, 4: 200, 3: 25 },
     7: { 7: 80000, 6: 3000, 5: 300, 4: 50, 3: 25 },
     8: { 8: 500000, 7: 20000, 6: 1000, 5: 200, 4: 25, 0: 25 },
     9: { 9: 1000000, 8: 100000, 7: 3000, 6: 500, 5: 100, 4: 25, 0: 25 },
     10: { 10: 5000000, 9: 250000, 8: 25000, 7: 2500, 6: 250, 5: 25, 0: 25 }
   }
   ```

   判定函式 `bingoStarPrize(star: number, hitCount: number): number` 直接查表，查無對應
   對中數回傳 `0`（例如選 5 星只對中 1 個，表中沒有這個 key，代表沒中獎）。

2. **超級獎號**：選 1 個號碼（01–80），中獎條件是「所選號碼＝第 20 個開出的號碼」——這是
   **依開獎順序判定，不是判定是否在 20 個開出號碼的集合裡**，固定獎金 1,200（額外加購
   注別，見下方「每注基準金額」）。

3. **猜大小**：判定 20 個開獎號碼中「01–40 的數量」與「41–80 的數量」，01–40 數量 ≥13 個
   → 開「小」；41–80 數量 ≥13 個 → 開「大」；固定獎金 150。

4. **猜單雙**：判定 20 個開獎號碼中單數／雙數各自數量，單數 ≥13 → 開「單」；雙數 ≥13 →
   開「雙」；固定獎金 150。

   **和局處理（猜大小／猜單雙皆適用）**：20 個號碼理論上可能兩邊都不到 13 個（例如
   12/8），此時「大小」或「單雙」都不成立。裁定為**和局，注碼原額退還**（不算輸也不算贏），
   `shared/config/bingo.ts` 的判定函式需回傳明確的第三種結果（例如 `'push'`），
   `bingo.ts` service 的結算流程需要特別處理這個分支（退款而非派彩 0），比照一般博弈規則
   的 push 慣例，並在 `DialogRule.vue` 向玩家說明。

**開獎資料結構：必須保留原始開獎順序（使用者已提供規範，取代先前的「待驗證」標記）**

賓果賓果每期產生 20 個不重複號碼，開獎存在第 1~20 球的原始順序，其中**第 20 個開出的
號碼＝該期超級獎號**。本站內部資料結構統一存成：

```ts
{
  issue: string,
  numbers: Array<{ number: number; order: number }>  // order: 1~20，即開球順序
}
```

超級獎號取值方式：`numbers.find(n => n.order === 20)!.number`。**強制規範**：
- **不可**只儲存「排序後的 20 個號碼」（純數字陣列），必須保留每個號碼對應的 `order`。
- **不可假設** `fetchTaiwanLotteryLastNumberOf(1102)` 回傳的 `lotNumber` 陣列最後一個
  元素就是超級獎號——這是未經驗證的假設，若官方實際回傳的是排序後陣列，直接取
  `lotNumber[19]` 會判定錯誤。
- **實作時第一步優先確認**：官方 API 回應內容是否已經有獨立的 `superNumber`／「超級獎號」
  欄位可以直接讀取；只有在確認官方文件或 Tasks 階段實測結果證實陣列順序**就是**原始
  開獎順序時，才能退而求其次用 `numbers[19]`／`lotNumber[19]` 取代。此為 Tasks 階段
  第一個要做的驗證項目，優先於其他實作。

**同一份開獎結果供 4 種投注類型共用**：一個期號只產生一份開獎結果
（`{ issue, numbers }`），基本玩法（1~10 星）、超級獎號、猜大小、猜單雙皆讀取同一份，
`bingo.ts` **不得**為每種投注類型各自產生獨立的開獎結果或各自呼叫一次官方 API。

**輪詢頻率與期別 bootstrap（獨立於 Decision 2 的兩組參數）**：賓果賓果每 5 分鐘開一期，
不可沿用 DLT 每週 2 期的重試/輪詢參數。建議以「官方回傳的當期截止時間／下一期開始時間」
直接排程下一次查詢（`setTimeout` 對齊到下一個 5 分鐘整點附近再查詢），而不是用固定
interval 頻繁輪詢官方 API；期別格式（是否為民國年＋序號，序號如何在一天內累加到很大的
數字）需在 Tasks 階段實際呼叫驗證，不可假設跟 DLT 同格式。

**UI／下注面板**：賓果賓果需要在同一個頁面同時容納 4 種投注類型（星數選號、超級獎號、
大小、單雙），比 DLT／樂合彩／星彩的單一投注類型複雜，建議參考本站既有 `kl8`（快樂8）
「同一玩法下多種下注區塊並存」的既有版面配置模式，`Board.vue` 依 tab 或並排區塊切換
4 種投注類型，各自獨立送單、各自獨立判定與派彩（同一次送單可以同時包含多種類型，
彼此互不影響，比照 DLT「A~E 各自獨立注單」的精神）。

**每注基準金額（使用者已提供，取代先前的「待確認」標記）**：`BET_UNIT = 25`（新台幣 25
元／注），基本玩法（1~10 星，星數不影響投注金額）、猜大小、猜單雙皆為 25 元／注；
**超級獎號是獨立加購項目**，額外 +25 元／注，不是包含在基本玩法的 25 元裡——若玩家同時
下「基本玩法」與「超級獎號」，總投注金額為 50 元（兩者分開計費、分開判定、分開派彩）。
`shared/config/bingo.ts` 需要把「基本玩法／猜大小／猜單雙」與「超級獎號」設計成兩個
獨立的下注項目（各自的金額欄位），不能合併成同一筆訂單的單一金額。

### 7. `TwAutoPanel.vue`／`useTwAutoActive.ts`：擴充 v-if 分支，不重寫既有 `dlt` 分支

`TwAutoPanel.vue` 目前 `v-if="lotteryType === 'dlt'"` 只服務一種玩法。本次比照該檔案既有
註解「未來若有更多 tw 系列玩法，直接在這裡的 v-if 鏈加分支」的預留設計，新增：

```html
<DltAuto v-if="lotteryType === 'dlt'" />
<SuperlottoAuto v-if="lotteryType === 'superlotto'" />
<D539Auto v-if="lotteryType === 'd539'" />
<BingoAuto v-if="lotteryType === 'bingo'" />
<!-- ...其餘玩法比照 -->
<DltChat v-if="lotteryType === 'dlt'" />
<!-- Chat.vue 皆為薄 wrapper（<template><ChatPanel /></template>），7 款玩法可共用同一份
     wrapper 元件（例如統一叫 TwChat.vue），不需要每個玩法各自複製一份幾乎相同的檔案；
     v-if 分支改成 v-if="lotteryType !== undefined"（所有 tw 玩法皆顯示同一個聊天室），
     取代現在逐一玩法各自 v-if 的寫法 -->
```

`useTwAutoActive.ts` 的 `LotteryType` union 需要從 `'dlt'` 擴充為
`'dlt' | 'superlotto' | 'd539' | 'm649' | 'm539' | 'p3' | 'p4' | 'bingo'`。`Auto.vue`
（自動下注）因為每款玩法的下注邏輯／選號規則不同（DLT 選 6、威力彩兩區、樂合彩選 2/3/4、
星彩選數字、賓果賓果多種投注類型），**無法**像 `Chat.vue` 一樣共用一份，需要各自實作
（呼應 proposal.md Open Question 3，已拍板採納「7 款玩法 Chat 共用、Auto 各自獨立」這個
折衷方案，而非兩者都共用或都獨立）。

## 開放問題彙整（同步 proposal.md Open Questions，全數已解決，本文件定稿）

1. ~~賓果賓果要不要做、怎麼做？~~ 已拍板：開獎號鏡射官方 API、賠率表寫死官方公開固定
   金額（使用者提供），納入本次範圍（見 Decision 6）。
2. ~~3星彩「對彩」的官方規則細節？~~ 已提供：前二／後二對彩各自獨立判定、可同時中獎，
   各 750 元（見 Decision 5）。
3. ~~`Auto.vue` 各自獨立、`Chat.vue` 共用——此折衷方案是否採納？~~ 已拍板採納（見 Decision 7）。
4. ~~賓果賓果的「每注」基準金額？~~ 已提供：`BET_UNIT = 25`，超級獎號為額外加購
   +25 元／注（見 Decision 6）。
5. ~~賓果賓果超級獎號判定的開獎順序資料？~~ 已提供資料結構規範：內部統一存成
   `{ issue, numbers: [{ number, order }] }`，並優先確認官方是否有獨立 `superNumber`
   欄位；實際呼叫官方 API 驗證陣列順序仍待 Tasks 階段執行，且列為第一個要做的驗證項目
   （見 Decision 6）。
