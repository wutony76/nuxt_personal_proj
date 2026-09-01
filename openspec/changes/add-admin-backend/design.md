## Context

- 這是專案第一個「後台管理」性質的 change。`app/pages/admin.vue` 雖然已存在，但只是佔位頁（登入即可見、3 張靜態卡片），沒有真正的權限判斷，也沒有任何實質功能，可視為一張白紙。
- 專案目前**完全沒有角色／權限概念**：`AuthUser`／`AuthRecord`（`server/types/storage.ts`）只有 `id`／`name`／`email`／`passwordHash`，沒有 `role` 欄位；`sessionController.require()`（`server/services/auth.ts`）只驗證「有沒有登入」。
- 專案目前**完全沒有資料庫**，`Storage`（`server/services/storage.ts`）是單一 in-memory class，伺服器重啟所有狀態歸零，這是既有的、專案一致接受的架構限制，本次沿用、不引入資料庫。
- 「先用程式碼常數頂著、之後要做後台」是專案既有的反覆出現的技術債模式（coin 兌換三常數、PAC-MAN 固定樣板迷宮皆屬此類，各自的程式碼註解裡都寫著這件事），本次是第一次真正把「之後」兌現。
- **BG彩票彩池的實際狀況跟最初規劃認知有落差**，經過兩輪程式碼調查才釐清（見 Decision 3），這是本次 design 最大的技術風險來源，需要在這裡完整記錄調查結論，避免日後失憶重踩一次。

## Goals / Non-Goals

**Goals:**
- 建立「登入後台」的權限門禁機制（管理員白名單），作為後台所有功能的共同基礎
- 後台導覽建立 7 大項的資訊架構：總覽／角色權限／BG彩票／台彩甘仔店／經典遊戲／遊戲試算／報表分析
- 把 coin 兌換三常數、PAC-MAN 固定樣板迷宮從程式碼常數改為後台可讀寫的可變狀態
- BG彩票新增彩池補貼追蹤（池底重新擲骰事件、頭獎保底超付事件），這是全新的結算旁路記錄邏輯，需嚴格確保**只做觀察記錄、不改變任何玩家實際拿到的派彩金額或既有遊戲邏輯**
- 提供這批新記錄邏輯的驗證方法（見 Verification 一節），確保追蹤數字本身是可信的

**Non-Goals:**
- 不做角色分級／細部權限控管（使用者明確表示目前只需要「是不是 admin」二元判斷）
- 不做「新增／移除管理員」的後台 UI（白名單異動維持改程式碼，避免雞生蛋問題）
- 不做台彩甘仔店、遊戲試算、報表分析的實質功能（本次僅佔位導覽入口，完整規格留待各自獨立的後續 change）
- 不引入資料庫／不做後台設定的跨重啟持久化（沿用既有 in-memory 架構的既有限制，見 Decision 6）
- 不重新設計彩池的核心分配公式（`jackpotCalc`／`buildJackpotShares` 等既有邏輯維持原樣），只在既有邏輯的旁邊加觀察點，不動被觀察的邏輯本身
- 不做「新增管理員」以外的帳號管理功能（例如凍結玩家帳號、手動改玩家 coin 餘額等不在本次範圍）

## Decisions

### 1. 管理員身份判斷：白名單，不做角色分級

- **理由**：使用者明確拍板「目前就只分 admin，登入都看得到全部」。專案目前也沒有 `role` 欄位可用，硬加一個角色系統對目前的需求是過度設計（YAGNI）。
- **做法**：新增 `server/config/admin.ts`（或併入既有 `server/services/auth.ts`），匯出一個常數 `ADMIN_USER_IDS: string[]`，比照 coin 三常數的既有慣例，先用程式碼常數頂著。新增 `adminController`（或在 `sessionController` 上擴充一個 `requireAdmin(event)`），流程為：先呼叫既有 `sessionController.require(event)` 取得登入身份，再檢查其 `id` 是否在 `ADMIN_USER_IDS` 內，不在則拋出 403（比照 `sessionController.require` 拋 40001 的既有模式，新增一個對應的 error code，例如 40003）。
- **Client 端**：`app/pages/admin.vue` 從「檢查 `isLoggedIn`」改為呼叫一支新的 `GET /api/admin/me` 端點（回傳「是否為管理員」），非管理員導回首頁並顯示無權限提示；後台其餘頁面比照辦理，避免使用者直接把網址改成 `/admin/xxx` 繞過總覽頁的檢查。
- **意外發現、需要一併修正的既有行為，且使用者拍板簡化**：實際檢查 `app/pages/login.vue` 才發現，現有登入流程本來就會把**任何**登入成功的使用者導向 `/admin`（`router.replace('/admin')`，共兩處：已登入時自動導向、登入成功後導向）——這是先前開發階段留下的通用「登入後導向」邏輯，不是真的做過管理員判斷。一旦 `/admin` 改成管理員才能進，這段既有邏輯會讓**一般玩家登入後被導去 `/admin`、又立刻被踢出來**，體驗上會卡一下。使用者拍板的修法比原本設想的更單純：**登入一律導向 `/`，不分是否為管理員**，`login.vue` 的兩處 `router.replace('/admin')` 都改成 `router.replace('/')`，不需要在登入這一步查詢管理員身份。管理員要進後台，走既有的 `AppTopbar.vue`「後台」連結或直接輸入網址，實際的權限把關仍然是 `/admin` 頁面自己呼叫 `GET /api/admin/me`（見上一條），登入流程本身不用管這件事，職責更單純。
- **替代方案**：加 `role` 欄位——保留給日後真的要做「後台可管理後台帳號」時再升級，不在本次範圍。

### 2. 後台導覽與視覺風格：比照 `SAMPLE/admin.design/main.dc.html` 這份參照稿

使用者提供了一份完整的互動式設計稿（`SAMPLE/admin.design/main.dc.html`），涵蓋所有頁面的版面、視覺風格與主要互動，本次直接以這份稿子為準，取代先前設想的「沿用 game-hall HUD 風」，也把導覽分組一併對齊稿子裡的做法。

**路由不變**，仍是先前規劃的這 7 個（`app/pages/admin.vue` 即總覽本身，其餘 6 個為子路由）：
`/admin`（總覽）、`/admin/roles`、`/admin/bg-lottery`、`/admin/taiwan-lottery`（佔位）、`/admin/games`、`/admin/game-simulator`（佔位）、`/admin/reports`（佔位）；管理員點擊 `AppTopbar.vue` 既有的「後台」連結進來就是 `/admin`（不是登入後自動導向，見 Decision 1），每個子頁面各自呼叫 `GET /api/admin/me` 做二次確認，不倚賴前端路由守衛單獨把關。

**視覺語言（跟先前設想的 Cyberpunk／HUD 風完全不同，是收斂的黑白編輯風）**：
- 純黑（`--ink: #1c1c22`）配純白（`--paper`），不用任何霓虹色、發光、掃描動畫
- 細髮絲線分隔（`--line`／`--line-soft`，用 `color-mix` 從 ink 淡化出來），卡片格線用「1px 間距＋line 色當背景」的技巧（`.grid1`：`gap:1px;background:var(--line)`），不用邊框
- 等寬數字（`.num { font-variant-numeric: tabular-nums }`）用在所有金額／統計數字，表格對齊好看
- 微型大寫英文標籤（`.en`：9.5px、letter-spacing 0.26em、大寫、`--muted` 灰）搭配中文大標題，中英雙語但英文只是裝飾性的分類標記
- 直角切角（`border-radius: 2px`），不是圓角也不是像素方角
- 標題字體走大尺寸、寬鬆行高的編輯排版（40px 頁面主標、18-22px 區塊標題），內文段落 13-13.5px、行高 1.65-1.75，優先可讀性
- 表格是報表類頁面（BG彩票、玩家紀錄、彩池事件記錄）的主要呈現方式，不是卡片
- 統一的空狀態／錯誤狀態視覺：一個線條 icon（SVG，2.75px 描邊）＋大寫英文小標＋中文標題＋一段說明＋一顆按鈕回到上一層，這個 pattern 同時用在「佔位頁（即將推出）」與「非管理員被拒絕（40003）」兩種情境

**導覽分組（比參照稿發現前規劃的「7 個同層級大項」更收斂）**：
頂層導覽只有 **4 個項目**：總覽／角色權限／**遊戲管理**／報表分析。原本規劃的 BG彩票、台彩甘仔店、經典遊戲、遊戲試算這 4 項，改成收在「遊戲管理」底下，透過一個常駐左側次導覽（sticky sidebar）切換，路由本身仍是原本規劃的扁平路徑（`/admin/bg-lottery`、`/admin/taiwan-lottery`、`/admin/games`、`/admin/game-simulator`，不是巢狀在 `/admin/game-management/*` 底下），只是在 UI 分組上多一層、頂端導覽列不會塞 7 個按鈕。這個分組合理，因為這 4 項本來概念上就是「跟遊戲／彩票產品有關的管理」，跟總覽／角色權限／報表分析這種系統層級的項目性質不同。

**稿子裡其他值得沿用、有直接對應到既有 Decision 的具體做法**：
- 頁首下方有一條常駐提示：「In-memory only — 後台改的所有值僅在伺服器運行期間有效，重啟後回復程式碼預設值」，直接對應 Decision 6 與 Risks 提到「需要在 UI 上明顯提示」這件事，稿子已經給出具體文案跟位置（header 正下方、全站共用）
- Coin 常數編輯是「表格內就地編輯」（inline edit）：預設顯示唯讀數值＋「編輯」「試玩 ↗」兩顆按鈕，點編輯後三個欄位變成輸入框＋「儲存」「取消」，儲存時前端就先擋「必須是數字」「必須為正數」「單局上限不得高於每日上限」三種驗證，稿子裡也已經把驗證訊息文案寫好了，這些前端驗證規則要跟 server 端的驗證規則一致（見 Decision 5）
- 固定樣板迷宮的新增是一個 dialog：文字框輸入 `#`／`.` 的 ASCII 地圖＋樣板名稱，稿子裡的 `validateMaze()` 就是一份 BFS 連通性驗證的參考實作（走訪＋比對 open 格數與可達格數是否相等），跟 `pac-man.vue` 現有的 `isMazeFullyConnected()` 邏輯是同一套演算法，之後搬到 server 端共用時可以互相對照
- 彩池事件記錄（Decision 3）在稿子裡是一張表（時間／彩種／期號／事件類型 tag／池底 before→after／超付金額），「重新擲骰」跟「保底超付」兩種事件用不同底色的 tag 區分；篩選是「彩種下拉＋時間區間（近 7 日／近 30 日／全部）」
- 玩家紀錄查詢是「User ID 輸入框＋查詢按鈕」，查無資料要有明確的空狀態文案，不是空白一片
- 總覽頁除了導覽卡片，稿子額外加了 4 個關鍵數字摘要（今日活躍會員、彩池補貼累計、池底重新擲骰次數、可調遊戲常數數量）——這解答了先前 Decision 2 留的「摘要卡片是否要做」的問題，稿子給出了具體答案：要做，且是這 4 個數字

實際切版時以這份稿子的版面／文案／互動為準；`.vue` 元件命名、路由檔案結構仍遵循專案既有的 Nuxt 慣例（見 Decision 5 等其餘決策），稿子本身是純 HTML／JS 原型，不是可以直接搬進 Nuxt 的程式碼。

### 3. BG彩票彩池補貼追蹤——本次調查結論與新增記錄邏輯

這是本次最花時間釐清、也最容易日後被誤解的一塊，完整記錄調查過程與結論：

**現況（已用程式碼調查確認，非猜測）**：
- 「彩池」不是福彩3D／排列3專屬，10 種彩種（六合彩／K3／PK10／SSC／X5／PC蛋蛋／快樂十分／快樂8／福彩3D／排列3）都有，各自在自己的 service 檔案（`server/services/game/lottery/bg/*.ts`）內維護 `poolBase`／`carryJackpot`／`issueJackpotMap` 等欄位，邏輯高度重複但沒有共用基底類別（只共用 `base.ts` 的兩個靜態工具函式 `jackpotBase`／`jackpotCalc`）。
- 彩池金額是純公式：`distributablePool = (poolBase + issuePool*0.8 + carry) * jackpotCalc 比例（0.55）`，派彩金額定義為彩池的一個比例，**數學上不可能超支**——「彩池不夠發」這個情境在現有公式下不會發生。
- `ensurePoolBase()`：彩池低於門檻（`*_POOL_FLOOR`，約等於 `minAmount / ratio`）時，會**重新擲骰一個新的隨機 `poolBase`**（例如福彩3D範圍 12萬~48萬），是隨機重灌，不是「精算差額後補差額」。
- **真正會讓系統多付錢、但目前完全沒被記錄的情境**：頭獎等高階獎項有保底金額（`tier.minAmount`，例如福彩3D頭獎保底 20,000），若中獎人數少、池子分配到該獎項的預算不夠付保底，結算時仍照樣付保底（`Math.max(naturalPerUnit, tier.minAmount)`），超出預算的差額目前無任何記錄、無任何追蹤。

**本次新增兩種追蹤（使用者確認兩者都要做，且明確簡化為只記金額，不分獎項）**：
1. **池底重新擲骰事件**：`ensurePoolBase()` 觸發重新擲骰時，記錄一筆 `{ lotteryKey, issue, before, after, timestamp }`
2. **保底超付事件**：結算時只要算出 `naturalPerUnit < tier.minAmount`（不論是哪個獎項分級），就記錄一筆 `{ lotteryKey, issue, overpay: actualPaid - budgeted, timestamp }`——**不記錄獎項名稱／分級**，單純累加「彩池這一期總共被迫多補了多少錢」，這是使用者明確拍板的簡化，不需要再逐一確認 10 個彩種的獎項分級設定（原本的 Open Question 因此解除）

**做法**：
- 新增一個共用工具模組（例如 `server/services/game/lottery/bg/poolAudit.ts`），提供 `recordPoolReseed(...)`／`recordFloorOverpay(...)` 兩個函式，寫入 `Storage.lottery.poolAudit`（新增的 in-memory 陣列，比照 `orders.ts` 的儲存模式）
- 10 個彩種檔案各自在 `ensurePoolBase()` 與保底判定的既有程式碼旁**加一行呼叫**這兩個共用函式，不改動被觀察的既有邏輯本身（原始的 `poolBase` 賦值、`Math.max(...)` 判定完全不動，只是多一行「順便記一筆」）；保底判定那一行呼叫本身不需要知道自己在哪個獎項分級裡，任何觸發 `Math.max(naturalPerUnit, tier.minAmount)` 且後者較大的地方都可以呼叫同一個 `recordFloorOverpay(lotteryKey, issue, overpay)`，不用把獎項資訊一起傳進去，這也讓 10 個檔案裡「要加在哪裡」的判斷變簡單（只看數值比較，不用對齊各彩種獎項分級命名的差異）
- 後台 `/admin/bg-lottery` 讀取 `Storage.lottery.poolAudit`，依彩種／時間區間彙總顯示：重新擲骰次數、彩池補貼總金額

**風險與範圍界線**：這是新增邏輯，會碰到 10 個彩種的結算程式碼，屬於「量大但單點改動小」的工程；每一處新增都必須是**純觀察、加一行記錄呼叫**，不得改動既有的金額計算或判定順序，見 Verification 一節如何確保這點。

### 4. BG彩票報表其餘指標（下注量／輸贏／coin 發放總量／活躍會員數）

- **做法**：這幾項不需要新增記錄邏輯，可從既有資料彙總：
  - 下注量／輸贏：掃描 `orders.ts` 各彩種的 `orders` 記錄（依 issue 彙總下注金額，輸贏 = 派彩金額 − 下注金額，派彩金額需從 `betHistory`／`claimableIssues` 取得，見下方風險）
  - coin 發放總量：掃描各彩種 `user.{lottery}Record.balanceChanges` 裡 `type: 'claim'` 的加總
  - 每日活躍會員數：掃描當日有下注紀錄的不重複 `userId` 數
- **風險**：這些都是「即時掃描全體玩家記憶體資料」而非讀取現成彙總表，玩家數與紀錄量變大時效能會下降；本次規模（單機、少量測試帳號）可接受，不做預先聚合，若未來量體變大需要另外考慮寫入時就做彙總（超出本次範圍）。

### 5. 經典遊戲後台管理

- **Coin 常數編輯**：`RETRO_GAME_BASE`（`server/services/game/retro/base.ts`）的 `coinRate`／`coinCapPerRun`／`coinDailyCap` 從建構子唯讀欄位改為可變欄位，新增 `PUT /api/admin/games/retro/:key/rates`，寫入時驗證數值為正數、`coinCapPerRun` 不得為 0
- **固定樣板迷宮管理**：`FIXED_MAZE_TEMPLATES` 從 `app/pages/game/pac-man.vue` 內的程式碼常數搬到 server 端（`Storage.retroGames` 底下新增一個欄位），連通性驗證邏輯（`isMazeFullyConnected`／`parseFixedTemplate`）也一併搬到 server 端共用，新增 `GET/POST/DELETE /api/admin/games/pacman/maze-templates`；`pac-man.vue` 的 `pickMaze()` 改為開局時先 fetch 一次後台清單，快取在 client 端供該局使用（不用每個 tick 都打 API）
- **玩家紀錄與 coin 兌換查詢**：新增 `GET /api/admin/games/history?userId=xxx`，回傳該玩家所有遊戲的 `GameHistoryRecord`（沿用既有型別）＋ coin 兌換相關的 `balanceChanges`（`type: 'game-reward'`）
- **各遊戲的直達路由（使用者新增要求）**：`/admin/games` 列出 12 款遊戲時，每一款除了 coin 常數／管理入口，都要附一個直接連到該遊戲實際遊玩頁面的連結（`/game/snake`、`/game/racing`…`/game/pac-man` 等，沿用 `game-hall.vue` 既有的 `gameSlots` 路徑清單），方便管理員改完常數或樣板後可以直接點過去試玩驗證，不用回 game-hall 再找一次


### 6. 持久化：沿用 in-memory，不做跨重啟保存

- **理由**：專案目前完全沒有資料庫，本次若為了後台單獨導入資料庫，範圍會遠超「新增後台管理介面」，也違反「保持小而可審查」的專案慣例
- **代價**：後台改的所有值（coin 常數、固定樣板迷宮、彩池追蹤記錄）伺服器重啟就會消失，這跟 coin 常數過去「改程式碼才會生效」相比，某種意義上更不持久（改程式碼至少重啟後還在）
- 這點延續之前規劃階段的討論，先照專案既有的 in-memory 慣例做，之後如果需要跨重啟保存，屬於另一個獨立的「導入持久化層」的 change，不在本次範圍

## Verification（使用者明確要求：需要幫忙驗證彩池追蹤邏輯的正確性）

彩池補貼追蹤（Decision 3）是全新邏輯，且牽涉金流數字，需要比一般功能更嚴謹的驗證方式：

1. **單元測試，不依賴真實隨機開獎**：`ensurePoolBase()`／保底超付判定都是純函式（輸入池子數值、輸出是否觸發＋新數值），可以直接用固定輸入（例如手動建構一個「彩池餘額剛好低於門檻」的情境、一個「中獎人數=1、保底遠高於自然分配」的情境）呼叫，斷言 `poolAudit` 記錄的 `before`／`after`／`overpay` 數字跟手算結果一致，不需要真的跑隨機開獎流程去「碰運氣」觸發
2. **不變量測試（最重要）**：新增追蹤前後，同一組輸入跑出來的**玩家實際拿到的派彩金額必須完全不變**——寫一組「加追蹤前」與「加追蹤後」的快照比對測試，確保這批新增程式碼是純觀察、零副作用，這是本次最需要守住的紅線（見 Decision 3 的風險與範圍界線）
3. **後台報表本身的交叉驗證**：`/admin/bg-lottery` 顯示的「保底超付總額」，理論上應該等於「所有 `betHistory` 裡頭獎派彩加總」減去「所有頭獎預算（`tierPool * ratio`）加總」——可以寫一支一次性的核對腳本，拿現有的（未追蹤前的）歷史資料手動算一次，跟追蹤機制上線後累積出來的數字比對，確認兩種算法收斂一致
4. **10 個彩種逐一過**：由於邏輯是複製貼上到 10 個檔案，每個檔案都要各自確認「加的那一行記錄呼叫」語法正確、抓到的欄位名稱跟該檔案自己的變數一致（各彩種欄位命名可能有些微差異，例如 `carryJackpot` vs `carryPool`，不能整批無腦複製）

## Risks / Trade-offs

- [風險] 彩池補貼追蹤要改 10 個彩種的結算程式碼，屬於本次範圍最大、最容易出錯的一塊；因應：嚴格遵守「只加一行記錄呼叫、不動既有計算」的原則（Decision 3），並用不變量測試守住「派彩金額不變」這條紅線（Verification #2）
- [風險] BG彩票報表指標用即時掃描而非預先聚合，玩家/紀錄量變大會變慢；因應：本次規模可接受，先不做預先聚合，記錄在這裡供未來參考
- [風險] in-memory 持久化代表後台的所有編輯重啟就消失，如果之後忘記這個限制、以為改了就永久生效，可能造成誤解；因應：後台 UI 上應該要有明顯提示（例如一行小字「目前設定僅在伺服器運行期間有效」），這個提示屬於實作細節，tasks.md 應該要列一項
- [風險] 管理員白名單寫在程式碼常數，新增管理員需要改程式碼＋重新部署，不像其他後台功能可以線上調整；因應：這是使用者明確接受的取捨（避免雞生蛋問題），非本次要解決的問題

## Migration Plan

不涉及既有資料遷移；新增的 `Storage.lottery.poolAudit`、`ADMIN_USER_IDS`、後台可變的 coin 常數／固定樣板迷宮初始值，皆從既有的程式碼常數初始化即可，不影響現有玩家與遊戲的既有行為。

`login.vue` 的登入後導向邏輯調整（見 Decision 1）會影響既有行為：現有「登入就導向 `/admin`」對所有帳號一視同仁，改完之後不論是否為管理員都導向 `/`。這是本次刻意的行為修正（原本的通用導向本來就是專案早期留下、未經設計的暫時邏輯），需要在 tasks.md 的驗證項目裡明確列出兩種情境：①一般帳號登入，確認落地在首頁；②管理員帳號登入後同樣先落地首頁，再手動點 `AppTopbar.vue` 的「後台」連結，確認能正常進入 `/admin` 總覽。
