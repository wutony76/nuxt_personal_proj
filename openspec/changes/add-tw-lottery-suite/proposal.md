# Proposal

## 變更名稱

`add-tw-lottery-suite`（補齊 `tw` 分類剩餘 7 款台彩鏡射玩法）

## 背景

`add-dlt` 已經把大樂透做成「完全鏡射官方台灣彩券」的玩法，並確立了一套可重用的架構：
`TW_GAMES` 分類陣列、`roleGamePerms`/`bet.post.ts` 的分類分派、`tw/base.ts`／`tw/orders.ts`
獨立基底、`taiwanLotteryApi.ts` 的官方 API service 層。`lottery-hall-taiwan.vue`（彩運來大廳）
當初規劃時已經把 9 款官方玩法的卡片（含 `drawTime`／`topPrize`／`rules`）都放進 `GAME_META`，
`taiwanLotteryApi.ts` 也已經把大樂透以外 7 款玩法的官方 `gameCode`／查詢端點／獎項欄位都對照好了
——但目前**只有大樂透（DLT）真正做成可玩的頁面**，其餘玩法在大廳卡片上只能看、點進去沒有對應玩法：

1. **威力彩**（gameCode `5134`，兩區選號：第一區 01–38 選 6、第二區 01–08 選 1）
2. **今彩539**（`1197`，01–39 選 5，無特別號）
3. **49樂合彩**（`1121`，跟隨大樂透開獎號碼，選 2/3/4 個號碼全中）
4. **39樂合彩**（`5120`，跟隨今彩539開獎號碼，選 2/3/4 個號碼全中）
5. **3星彩**（`2108`，000–999 三位數字，正彩／組彩／對彩）
6. **4星彩**（`2109`，0000–9999 四位數字，正彩／組彩）
7. **賓果賓果**（`1102`，01–80 開 20 號，每 5 分鐘一期）

**賓果賓果**原本因為官方 `LastNumber`／`prize` 系列 API **沒有**中獎明細端點而列為 Open
Question（見 `design.md` Decision 6 舊版），但使用者已提供賓果賓果**完整的官方公開固定
賠率表**（基本玩法 1~10 星、超級獎號、猜大小、猜單雙，共 4 種投注類型），因此改採
**「開獎號碼鏡射官方 API、賠率表直接寫死官方公開的固定金額」**這個方案——這跟 DLT 等其他
6 款「賠率也即時讀官方 API」不完全一樣，但賠率本身仍然是官方公開資料照抄，**不是本站自訂
賠率**，仍符合「不自建賠率公式」的精神，只是資料來源從「API 查詢」變成「寫死常數表」
（因為官方就沒有提供這部分的 API）。詳見 `design.md` Decision 6。

本次比照 `add-dlt` 的定案原則，**能鏡射官方的一律鏡射**（開獎號碼與派彩金額直接讀官方，不自建
RNG／賠率／彩池），本站只負責選號 UI、下注、期別排程與結算判定；架構上盡量重用 `dlt.ts` 已經
驗證過的模式（官方期別 bootstrap／`pending-settlement`／逐期回填歷史），不重新發明一套。

## 目標

- 補齊 `TW_GAMES` 分類下剩餘 7 款官方玩法（威力彩、今彩539、49樂合彩、39樂合彩、3星彩、
  4星彩、賓果賓果），皆可選號、下注、依官方開獎結果與獎金結算。
- 開獎號碼與各獎項派彩金額**完全鏡射官方資料**（6 款即時讀官方 API，賓果賓果因官方無明細
  端點改用官方公開固定賠率表寫死常數，見 `design.md` Decision 6），比照 DLT 的 Decision 2
  原則，不自建賠率公式。
- 元件拆分沿用 `K3-CD` / DLT 已驗證的 block 清單；數字型玩法（3星彩／4星彩）改參考本站既有
  `pl3`／`fc3d`（排列3／福彩3D）的位數選號互動模型，不從零設計。
- 下注額度、開獎週期比照各玩法官方公開規則（見 `design.md` Decision 1 對照表）。

## 範圍

- 包含：
  - 7 支新的後端 service：
    `server/services/game/lottery/tw/{superlotto,d539,m649,m539,p3,p4,bingo}.ts`
    （檔名對應詳見 `design.md`），皆繼承既有 `tw/base.ts`；除賓果賓果外皆比照 `dlt.ts` 的
    官方期別 bootstrap／結算模式（賓果賓果的期別/輪詢頻率獨立設計，見 `design.md` Decision 6）
  - 7 支新頁面：`app/pages/lottery/tw/{superlotto,d539,m649,m539,p3,p4,bingo}.vue`
  - 對應的 `app/components/lottery/tw/{各玩法}/**` 元件樹（Header/Board/CurrItems/Controls/
    Report/History/Road/Dialog*/footer，比照 DLT block 清單；3星彩／4星彩的 Board 改參考
    `pl3`/`fc3d` 既有的位數選號元件；賓果賓果的 Board 需要支援「選星數＋選號」與「大小/單雙/
    超級獎號」等多種下注區塊並存，比照本站既有 `kl8` 的多玩法下注面板配置）
  - `app/composables/use{各玩法}.ts`（比照 `useDlt.ts` 的 module-level singleton 模式）
  - 全站接線的**新增條目**（不改既有邏輯，因為 Decision 0 已確認這條路徑是通用的）：
    `shared/config/gameSlugs.js` 的 `TW_GAMES` 陣列、`app/config/constants.js` 的 `LOTTERY.*`
    （皆帶 `category: 'tw'`）、`server/services/storage.ts` 註冊新 service
  - `TwAutoPanel.vue`／`useTwAutoActive.ts` 的 `v-if` 分支與 `LotteryType` union 擴充，
    新增各玩法的 `footer/Auto.vue`（各自獨立實作）／共用同一份 `footer/Chat.vue` wrapper
    （見 Open Question 3 已拍板結論）
  - 各玩法專屬的 `shared/config/{key}.ts`（對中條件判定邏輯／盤面設定），比照
    `shared/config/dlt.ts`；`shared/config/bingo.ts` 額外包含使用者提供的完整固定賠率表
    （基本玩法 1~10 星、超級獎號、猜大小、猜單雙）
- 不包含：
  - 不做信用盤／官方盤雙盤口、不做複式／包牌（比照 DLT 既有拍板原則）
  - 不修改既有 DLT（`dlt.ts`／`useDlt.ts`／`app/components/lottery/tw/dlt/**`）任何行為
  - 不修改 `taiwanLotteryApi.ts` 既有的 `GAME_DEFS`／`TAIWAN_LOTTERY_GAMES` 對照表本身
    （這些已經在 `add-taiwan-lottery-hall` 驗證過，本次只是「消費」這份既有資料，不重新核對）
  - 不修改 `lottery-hall-taiwan.vue` 既有的大廳卡片顯示邏輯（卡片點擊目的地路由屆時才會從
    「無對應頁面」變成「可進入」，卡片本身內容不變）
  - 賓果賓果**不做彩池／不做動態賠率**——賠率表為固定金額（見 `design.md` Decision 6），
    與官方公告一致，本站不會因為中獎人數多寡調整派彩金額

## 影響面

- 前端路由/頁面：新增 7 個 `app/pages/lottery/tw/*.vue`
- 前端元件/Composables：新增 7 組 `app/components/lottery/tw/{key}/**`、7 個
  `app/composables/use{Key}.ts`；修改 `TwAutoPanel.vue`／`useTwAutoActive.ts`（擴充分支，
  不變更既有 `dlt` 分支行為）
- 後端 API/Services：新增 7 支 `server/services/game/lottery/tw/{key}.ts`；修改
  `server/services/storage.ts`（註冊新 service，新增行，不動既有註冊）
- 設定或常數：`shared/config/gameSlugs.js`（`TW_GAMES` 新增 7 個條目）、
  `app/config/constants.js`（`LOTTERY` 新增 7 個 `category:'tw'` 條目）、新增 7 個
  `shared/config/{key}.ts`

## 風險與對策

- 技術風險：
  - 風險：**39樂合彩／49樂合彩是否需要依賴「主遊戲」（今彩539／大樂透）的開獎結果**，
    而不是各自獨立呼叫官方 API？若真有依賴，49樂合彩就必須等 DLT 結算完成才能結算，
    產生跨玩法的耦合。
  - 對策：已確認**不需要**——`taiwanLotteryApi.ts` 的 `TAIWAN_LOTTERY_GAMES`／
    `fetchTaiwanLotteryLastNumber()` 把 `1121`／`5120` 當成獨立 gameCode，官方 API
    本身就會回傳這兩款玩法自己的 `lotNumber`（內容等於主遊戲的開獎號，但走的是各自的
    gameCode 查詢），39/49樂合彩可以各自獨立呼叫官方 API，不需要讀取 DLT／今彩539 的內部
    `recordOpenCode`，兩個 service 之間沒有執行順序依賴（詳見 `design.md` Decision 3）。
  - 風險：3星彩／4星彩的「正彩／組彩／對彩」判定邏輯與 DLT 的「k 個對中」模型完全不同
    （數字位置比對，而非集合交集），若沿用 DLT 的 `dltTierOf(bet, W, s)` 判定函式模式，
    直接套用會判定錯誤。
  - 對策：改為參考本站既有 `pl3`（排列3）／`fc3d`（福彩3D）的位數比對判定邏輯（這兩款玩法
    已經是「自建開獎＋正彩/組彩」模式，只是開獎號碼來源需要換成本次的官方鏡射），不重新
    設計判定演算法，只置換開獎號碼來源。
  - 風險：**賓果賓果每 5 分鐘開一期**，官方期別更新頻率遠高於其他玩法（每週 2 期／每天
    1 期），若沿用 DLT 現有的輪詢頻率或期別 bootstrap 邏輯，可能來不及跟上官方期別推進，
    或對官方 API 造成過高的請求頻率。
  - 對策：輪詢頻率與期別 bootstrap 需要獨立設計（例如以官方回傳的期別/倒數時間直接排程
    下一次查詢，而非固定 interval 輪詢），不可直接複製 DLT 的參數，詳見 `design.md`
    Decision 6。
  - 風險：賓果賓果「猜大小」「猜單雙」的判定門檻是「≥13 個」，20 個號碼理論上可能出現
    兩邊都不到 13 個的情況（例如 12/8、10/10），此時「大小」「單雙」都不成立，需要明確
    的「和局」處理方式，否則玩家下注後可能永遠無法判定輸贏。
  - 對策：和局（兩邊皆未達 13）時**注碼原額退還**（不算輸也不算贏），比照一般博弈規則的
    push 慣例，需要在 `shared/config/bingo.ts` 的判定函式明確處理這個分支，並在
    `DialogRule.vue` 向玩家說明。
  - 風險：~~使用者提供的賠率表僅列出「中幾星」對應賠率，未明確標示「每注金額」~~ **已解決**
    ——每注基準金額 25 元（`BET_UNIT = 25`），基本玩法（1~10 星／猜大小／猜單雙）皆為
    25 元／注；超級獎號是**額外加購**（+25 元／注），若同時下基本玩法＋超級獎號，
    總投注金額為 50 元（兩者分開計費，不是同一個 25 元裡面含兩種玩法）。
  - 風險：**賓果賓果超級獎號判定需要官方開獎號碼保留「原始開獎順序」**（第 20 個開出的
    號碼＝超級獎號），若直接假設 API 回傳陣列的最後一個元素就是超級獎號，一旦官方實際
    回傳的是「由小到大排序」而非「開獎順序」，判定會整個錯誤。
  - 對策：**不可假設陣列順序＝開獎順序**。實作時優先確認官方 API 是否有獨立的
    `superNumber`／「超級獎號」欄位可直接讀取；只有在確認官方文件或實測結果保證陣列順序
    就是原始開獎順序時，才能用 `numbers[19]` 取代。本站內部資料結構統一存成
    `{ issue, numbers: [{ number, order }] }`（帶明確 `order` 欄位，而不是只存排序後的
    純數字陣列），`superNumber = numbers.find(n => n.order === 20).number`，避免日後有人
    誤用陣列索引當作開獎順序。此驗證需在 Tasks 階段實際呼叫官方 API 確認。
  - 補充：**同一期只產生一份開獎結果**，基本玩法（1~10 星）、超級獎號、猜大小、猜單雙
    這 4 種投注類型全部共用同一份 `{ issue, numbers, superNumber }`，`bingo.ts` 的結算
    流程 SHALL NOT 為每種玩法各自產生一份獨立開獎結果。
- UI/UX 風險：
  - 風險：威力彩「兩區選號」（第一區 01–38 選 6、第二區 01–08 選 1）的盤面互動，跟 DLT
    單一 1–49 選號池＋另開特別號的呈現方式不同，需要兩個獨立的選號網格同時顯示在同一組
    `Board.vue` 內。
  - 對策：`Board.vue` 改為兩個子網格並排（比照官方紙本投注單「第一區／第二區」的視覺分隔），
    互動邏輯各自獨立（`toggleNumber` 需要多帶一個 zone 參數）。
  - 風險：7 款玩法一次規劃，範圍偏大，若不先拆解優先順序，實作階段容易失焦或半途而廢。
  - 對策：`tasks.md` 依玩法拆成 7 組獨立任務區塊，且依複雜度排序（今彩539／49樂合彩／
    39樂合彩最接近 DLT、優先度最高；威力彩次之；3星彩／4星彩需要額外參考 pl3/fc3d；
    賓果賓果因為輪詢頻率與判定邏輯都不同於其他玩法，排最後、獨立驗證），允許分批交付、
    互不阻塞。

## 驗證方式

- 功能驗證：
  - 每款玩法選號規則（號碼池大小、需選幾個、是否有特別號/第二區）符合官方公開規則
  - 官方開獎後，各 service 能正確抓到對應 gameCode 的開獎號與獎項 `perPrize`
  - 39樂合彩／49樂合彩各自獨立呼叫官方 API 取得開獎號，不依賴另一款玩法的內部狀態
  - 3星彩／4星彩正彩／組彩判定邏輯與 `pl3`/`fc3d` 既有邏輯行為一致（只是號碼來源換成官方
    鏡射）；3星彩對彩（`pl3`/`fc3d` 無等價規則，本次新增）前二／後二對彩各自獨立判定，
    同時中獎時合計 1,500 元（750+750），不因三碼全同只算一次
  - 賓果賓果 4 種投注類型（基本玩法 1~10 星、超級獎號、猜大小、猜單雙）皆依使用者提供的
    固定賠率表正確派彩；猜大小／猜單雙的和局情境正確退還注碼
- 視覺驗證：
  - 元件拆分與版面順序對照 DLT／K3-CD；數字型玩法對照 `pl3`/`fc3d`
- 回歸驗證：
  - DLT 既有功能、`lottery-hall-taiwan.vue` 大廳卡片、既有 `bg`/`retro` 分類玩法皆不受影響
  - `TwAutoPanel.vue`／`useTwAutoActive.ts` 新增分支後，既有 `dlt` 分支行為不變

## 成功標準

- [ ] 7 款玩法皆可選號、送單、結算
- [ ] 開獎號碼皆鏡射官方即時資料；派彩金額 6 款即時讀官方 API、賓果賓果依官方公開固定
      賠率表，皆未自建賠率公式
- [ ] 39樂合彩／49樂合彩各自獨立呼叫官方 API，與主遊戲之間沒有結算順序依賴
- [ ] 3星彩／4星彩判定邏輯與 `pl3`/`fc3d` 既有邏輯行為一致
- [ ] 賓果賓果 4 種投注類型皆正確派彩，和局情境正確退還注碼
- [ ] `TwAutoPanel.vue`／既有 DLT 功能不受影響
- [ ] 無新增重大 console / runtime error
- [ ] 相關驗證完成並落於 `validation.md`（進入實作階段後補）

## Open Questions（全數已解決，本次規劃定稿）

1. ~~賓果賓果要不要做、怎麼做？~~ **已拍板：官方開獎號鏡射 API、賠率表改用使用者提供的
   官方公開固定金額表寫死**，本次納入範圍（見 `design.md` Decision 6）。
2. ~~3星彩「對彩」判定規則細節？~~ **已提供**：分「前二對彩」與「後二對彩」，各自獨立
   判定、可同時中獎，各 750 元（25 元×30 倍），詳見 `design.md` Decision 5。
3. ~~是否要比照 DLT 幫每一款玩法都各自複製一份 `footer/Auto.vue`，還是共用同一份？~~
   **已拍板：採納建議方案**——`Auto.vue`（自動下注）7 款玩法各自獨立實作（下注邏輯/選號
   規則不同，無法共用）；`Chat.vue` 共用同一個 `ChatPanel.vue` wrapper（見 `design.md`
   Decision 7）。
4. ~~賓果賓果的「每注」基準金額為何？~~ **已提供**：25 元／注（`BET_UNIT = 25`），超級
   獎號為額外加購 +25 元／注，詳見「風險與對策」與 `design.md` Decision 6。
5. ~~賓果賓果超級獎號的開獎順序資料是否可靠取得？~~ **已提供資料結構規範**：內部統一存成
   `{ issue, numbers: [{ number, order }] }` 並優先確認官方是否有獨立 `superNumber` 欄位，
   實際 API 驗證仍待 Tasks 階段執行，詳見「風險與對策」與 `design.md` Decision 6。
