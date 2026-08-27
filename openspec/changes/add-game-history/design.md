## Context

- game-hall.vue 已改版為 Cyberpunk HUD 風格（頂部切角導覽、像素復古 Hero、HUD 清單面板）。
- 三款遊戲頁（snake / racing / tetriminos）分數僅存於元件內的區域狀態，沒有任何持久化層。
- 專案內已有兩種 Dialog 慣例：
  - `useDialog` / `$dialog`：全域單例，只支援純文字 alert/confirm（全站共用同一顆實例）。
  - 彩票模組的局部 `DialogShell.vue`（`props: { visible, title, width? }` + `emit('close')` + 預設 slot）：可放豐富內容，但樣式綁定彩票主題色。
- 本功能需要篩選 tab／統計卡／清單等豐富內容，且要跟 game-hall 的 Cyberpunk HUD 視覺一致，因此比照 `DialogShell` 的介面合約另建元件，不直接重用彩票的視覺實作，也不使用全域 `useDialog`。
- **Server 端現況（6hc 架構調查結果）**：
  - `server/services/game/lottery/bg/` 以「共用基底類別 `LOTTERY_BASE`（`base.ts`）＋ 每款遊戲/變體一個服務檔（`6hcCd.ts`／`6hcOf.ts`…）」組成，遊戲實例在開機時註冊進 `Storage.games[key]` 註冊表，路由透過該註冊表取用，不直接 import 類別。
  - `server/api/lottery/` 是「每個遊戲一個資料夾」，資料夾內是固定的一組 action 檔（`current.get.ts`／`user-record.get.ts`／`claim.post.ts`…），未使用 Nitro 動態路由 `[game]` 收斂。
  - 登入驗證統一透過 `sessionController.require(event)`（未登入丟業務碼 40001）；`server/middleware/auth.ts` 對 `/api/lottery/*` 全域套用，僅白名單放行少數公開 GET（如彩池金額）。專案內**沒有**任何路由是「同一支 handler 依登入狀態回傳不同內容」的先例。
  - 持久化沒有資料庫，一律是 in-memory 的 `Storage` class 靜態欄位；最接近「歷史紀錄」的既有先例是 `orders.ts`（每個遊戲一份下注紀錄清單，掛在 `Storage.lottery.orders[lotteryKey]`）。
  - `app/services/api.ts` 的 `api.lottery.*` 是扁平的「一個函式對一支 API」慣例（如 `current6hcOf()` → `$fetch('/api/lottery/6hc-of/current')`）。

## Goals / Non-Goals

**Goals:**
- 讓玩家可在 game-hall 上方一鍵開啟「遊戲紀錄」，看到三款遊戲的歷史分數與簡易統計。
- 資料層與 UI 層清楚分離：`useGameHistory` 只管資料，`GameHistoryDialog` 只管呈現，`game-hall.vue` 負責組裝與進入點。
- **未登入使用者**（模式 A）走純前端 localStorage；**已登入使用者**（模式 B）走新增的 server API，兩者對 UI 層呈現同一組介面（`records` / `actions.record()` / `actions.clear()`），呼叫端不需 if/else 判斷模式。
- 已登入使用者結算後，分數 SHALL 依固定比例轉換為 coin 計入既有錢包餘額，並受單局／每日上限保護；未登入不觸發此機制。
- Server 端服務層比照 6hc 既有分層方式（共用基底＋每款遊戲一個服務檔），讓未來新增其他小遊戲時只需比照新增一個服務檔＋一組路由，不需改動既有遊戲的程式碼。

**Non-Goals:**
- 不做「登入時自動把本地 localStorage 歷史匯入／合併進 server」——模式 A、B 是兩份互不相通的資料，登入前後看到的紀錄列表可能不同，屬預期行為。
- 不做排行榜或玩家間比較功能。
- 不變更彩票模組既有的「下注紀錄」Dialog 或 `useDialog` 全域單例。
- 不做遊戲重播、不儲存完整對局過程，只存結算後的摘要（分數、等級、時間等）。
- 不引入資料庫；server 端持久化沿用專案現況的 in-memory 作法。

## Decisions

1. **持久化採「未登入 localStorage／已登入 server API」雙模式，而非單一方案**
   - 理由：使用者明確要求 A＋B 並存、依登入狀態切換；未登入沒有使用者身分可歸屬，資料留在 server 端沒有意義，登入使用者則應該有比瀏覽器儲存更可靠的紀錄。
   - 切換責任放在 `useGameHistory` composable 內部（讀取既有 `useAuth` 的登入狀態），對外介面簽章不變，遊戲頁與 Dialog 元件完全不需要感知目前是哪個模式。

2. **Dialog 元件比照 `DialogShell` 的 props/emit 合約，另建元件，而非重用彩票 `DialogShell.vue` 本體或全域 `useDialog`；此原則涵蓋元件內部所有互動（含二次確認），不只是外層 Dialog 本身**
   - 理由：彩票 `DialogShell.vue` 樣式綁定彩票主題色，直接重用會讓 game-hall 出現風格不一致的 Dialog；全域 `useDialog`／`$dialog`（`Dialog.vue`）同樣是彩票視覺主題（預設標題「溫馨提醒」），只能顯示純文字，無法放清單／tab／統計卡，也不符合 game-hall 的 Cyberpunk HUD 風格。
   - 做法：新增 `GameHistoryDialog.vue`，介面（`visible` / `title` / `width?` / `emit('close')` / 預設 slot）與既有慣例一致。**清除紀錄的二次確認也不例外**：實作時一度誤用全域 `$dialog.alert()` 做確認提示，導致點擊「清除紀錄」時彈出的是彩票風格的「溫馨提醒」，跟外層 Cyberpunk HUD 風格不一致；已改為在 `GameHistoryDialog.vue` 內建 retro 風格的二次確認覆蓋層（`.ghd-confirm-mask` / `.ghd-confirm-box`，magenta 描邊 + clip-path 切角），不依賴全域 Dialog。

3. **資料模型以 `gameKey` 區分遊戲，`meta` 欄位放遊戲專屬數據**
   - 理由：三款遊戲的額外指標不同（貪吃蛇的吃到果實數、賽車的距離、方塊的消行數），若都拆成獨立欄位會讓 schema 難以擴充；用 `meta: Record<string, unknown>` 保留彈性。
   - 替代方案：每個遊戲各自一張表／一個 store，放棄（清單無法統一渲染與排序，複雜度更高）。

4. **紀錄筆數上限與寫入時機**
   - 上限：無論模式 A 或 B，都只保留每位使用者／每個瀏覽器最近 50 筆，超過自動裁掉最舊的一筆。
   - 寫入時機：僅在單局「明確結束」（gameover／通關）時寫入一筆；暫停或離開頁面不視為結束、不寫入。

5. **Server 端比照 6hc 的「共用基底 + 每款遊戲一個服務檔」架構，另建 `server/services/game/retro/` 命名空間**
   - 理由：延續使用者指定、且專案既有的 6hc 分層方式（`LOTTERY_BASE` 基底 + 每個變體一個服務檔），並保留未來新增其他小遊戲時可直接比照擴充的路徑。
   - 做法：`base.ts` 提供共用邏輯（紀錄寫入／查詢／統計），`snake.ts` / `racing.ts` / `tetriminos.ts` 各自繼承並處理各遊戲專屬驗證（如分數合理性上限、`meta` 欄位白名單）。
   - 替代方案：三款遊戲塞進同一支服務檔用 `switch(gameKey)` 分流——放棄，因為不符合要延續的既有分層慣例，且未來新遊戲會讓單一檔案持續肥大。

6. **API 路由比照 6hc「每個遊戲一個資料夾」慣例，不用 Nitro 動態路由 `[game]` 收斂成一支**
   - 理由：6hc 現有架構本身就是每個 game/variant 各自資料夾（`6hc-cd/`、`6hc-of/`），不是用動態片段收斂；比照此慣例維持專案風格一致，也對應使用者明確要求的服務檔案結構（每款遊戲各一支）。
   - 取捨：路由檔案數量隨遊戲數量線性成長（每款遊戲 2 支：`history.get.ts` + `history.post.ts`），但共用邏輯集中在 `RETRO_GAME_BASE`，各路由檔案本身很薄，成長成本可控。

7. **Server 模式一律要求登入（`sessionController.require()`），不做「同一支路由內部依登入狀態分流」**
   - 理由：專案目前沒有任何路由是「同一支 handler 依登入狀態回傳不同內容」的先例（`sessionController.get()` 目前只在 middleware 內部用於白名單判斷，未曾在 handler 內直接使用）。
   - 做法：A/B 切換的責任放在**前端 `useGameHistory`**——登入時才呼叫 server API，未登入時純本地 localStorage、根本不會呼叫這些路由。伺服器端路由維持「全有全無」的既有慣例（比照 `bet.post.ts` / `user-record.get.ts` 全程需要登入），並在 `server/middleware/auth.ts` 把 `/api/games/*` 一併納入登入閘門，做為 defense-in-depth。
   - 替代方案：路由內部用 `sessionController.get(event)`（non-throwing）依有無 session 回傳訪客／會員兩種內容——放棄，專案內無此先例，且訪客資料本來就不該落地 server（沒有使用者可歸屬）。

8. **Server 端持久化沿用專案現況的 in-memory store（無 DB），掛在 `Storage.retroGames`**
   - 理由：專案目前完全沒有資料庫，所有彩票下注紀錄／session 都是 in-memory（`Storage` class 的 static 欄位），重啟即清空。為了架構一致性與最小變更，沿用相同模式：`server/services/game/retro/history.ts`（比照 `orders.ts`）以 per-game 的 in-memory 清單儲存，依 `userId` 分桶、每人上限 50 筆。
   - 取捨：跟現有彩票下注紀錄一樣，**server 重啟會清空所有登入使用者的遊戲紀錄**。這是專案現況的既有限制，非本次變更新增的缺陷；若後續要換成真正持久化（檔案／DB），只需替換 `history.ts` 內部實作，對外介面（`add.record` / `get.byUser`）不變。

9. **身分資訊只在 Dialog 頂部顯示一次，清單各列不重複標示身分**
   - 理由：同一份清單在任何時間點只會來自單一資料來源（模式 A 或模式 B 其中之一，兩者不合併），所以清單裡的每一列本來就必然是同一個身分（訪客本機／該登入帳號），逐列重複標示「GUEST」或帳號名稱是多餘的視覺雜訊。
   - 做法：Dialog 標題／副標處依目前模式顯示「訪客（本機保存）」或「會員 {使用者名稱}」，清單本體只保留遊戲／分數／等級／時間等紀錄本身的欄位。

10. **得分轉換 coin 採方案 A：固定線性比例（`coin = floor(score × rate[gameKey])`），每款遊戲各自一個倍率常數**
    - 理由：三款遊戲的原始分數量級差異極大（實際讀過計分邏輯：snake 是蛇身長度，一場普通局約 20 分；racing 是存活 tick 數，一場普通局約 150-200 分；tetriminos 是 `cleared×100+(cleared-1)×50`，一場普通局可輕鬆上千），若共用同一倍率會讓某款遊戲明顯「比較好賺」。改成每款遊戲各自校準倍率，讓「一場普通局」的預期收益（建議先抓 ~100 coin）在三款遊戲間大致接近。
    - 建議初始倍率（依程式碼估算，正式上線前建議用實測局數再校準）：snake `×5`、racing `×0.5`、tetriminos `×0.05`。
    - 替代方案：方案 B（分級對照表）／方案 C（常態化轉換），皆因維護成本或實作複雜度較高而暫不採用，記錄於本次決策討論、未來若要升級不影響對外呼叫介面（`settleReward()` 內部換算法可替換）。

11. **轉換時機與位置：跟寫入遊戲紀錄同一個 handler、同一次呼叫內完成**
    - 理由：比照 6hc `bet.post.ts`「一次呼叫內完成扣款＋建單」的既有模式，避免拆成兩支 API 造成「紀錄寫了但 coin 沒發」之類的不一致狀態（專案沒有交易機制，拆兩步等於引入不必要的不一致風險）。
    - 做法：`history.post.ts` 內部依序執行「驗證分數合理性 → 寫入 game-history 紀錄 → 呼叫 `settleReward(userId, score)` 計算並核發 coin」，全部在同一個 in-memory 操作中完成（Node 單執行緒，無需額外鎖）。

12. **雙重防濫用上限：單局上限 ＋ 每日上限**
    - 理由：純線性公式若不設上限，極端一局（或掛機刷分）可能產生不合理的 coin 數量，等同印幣漏洞。
    - 做法：`RETRO_GAME_COIN_CAP_PER_RUN[gameKey]`（單局上限，300）與 `RETRO_GAME_COIN_DAILY_CAP[gameKey]`（每人每遊戲每日上限，100000）雙重夾住 `coinReward`；每日额度比照 `LOTTERY_BASE.timer.formatDateKey` 的日期分桶方式判斷「今天」，存在 `Storage.retroGames` 底下、跟 in-memory 歷史紀錄一樣重啟歸零（現況一致的既有限制）。
    - 伺服器端同時要對 client 回報的 `score` 做上限校驗（比照各遊戲既有的分數/meta 白名單驗證），不可直接信任前端數字去換算 coin。

13. **coin 入帳留下可稽核紀錄，比照 6hc 的 `balanceChanges`**
    - 理由：現有彩票模組的下注／領獎都會在 `user.record.balanceChanges` 留一筆流水（`type: 'bet'|'claim'`），讓玩家在「金額異動」分頁能對帳；遊戲兌幣比照同一套稽核習慣，而不是悄悄改 `coin` 數字。
    - 做法：`server/services/users.ts` 的 `BalanceChangeType` 新增 `'game-reward'`，核發時 push 一筆（`note` 帶遊戲名稱與分數，例如「snake 遊戲結算 +100 coin」）。

## Risks / Trade-offs

- [風險] Server in-memory store 重啟後遺失登入使用者的遊戲紀錄，比 localStorage 情境更容易讓使用者覺得「資料不見了」（登入通常被預期代表更可靠的保存）→ [因應] 與彩票模組現況一致的限制，UI／文案上不過度承諾「永久保存」；後續若要導入真正持久化，只需替換 `history.ts` 內部實作，不影響對外介面與呼叫端。
- [風險] 登入前後兩份歷史（本地 localStorage vs server）互不相通，使用者切換登入狀態時可能誤以為「紀錄消失了」→ [因應] Non-Goals 已明確排除自動合併；可在 Dialog 於已登入狀態下額外顯示一行提示「目前顯示為會員紀錄」，降低誤解（列入 tasks 的可選 UI 細節）。
- [風險] 三個遊戲頁各自要加一段「寫入紀錄」的呼叫，未來新增第四款遊戲容易忘記接線 → [因應] tasks 中把「三個遊戲頁都要接」列為各自獨立可勾選項，design 中明確點名此為必須遵守的慣例。
- [風險] localStorage 在 Nuxt SSR 情境下伺服器端不存在 `window` / `localStorage` → [因應] `useGameHistory` 內部讀寫需做 client-only 防護（例如 `import.meta.client` 判斷），只在瀏覽器端執行實際讀寫。
- [風險] 固定線性比例的倍率是依程式碼估算，不是實測數據，正式上線後可能發現某款遊戲明顯「比較好賺」或「太難賺」→ [因應] 倍率抽成獨立常數（非寫死在公式內），上線後可依實際數據調整，不影響整體機制與對外介面。
- [風險] 分數驗證若做得不夠嚴謹，玩家可能透過偽造/竄改 client 端分數換取超額 coin → [因應] `settleReward` 在計算前先套用各遊戲的分數合理性上限（如 snake 理論最大長度），並疊加單局與每日雙重上限，任一防線失守另一道仍能擋住異常放大。

## Migration Plan

- 全新功能，無既有資料需要遷移。
- 部署順序（每一步都可獨立回滾）：
  1. Server 端服務層與 in-memory 儲存（`base.ts`／`history.ts`／`snake.ts`／`racing.ts`／`tetriminos.ts`／`Storage.retroGames` 註冊）——尚未被任何路由引用，無風險。
  2. Server 端 API 路由（`server/api/games/retro/**`）＋ middleware 閘門——路由存在但尚未被前端呼叫，無風險。
  3. Client `app/services/api.ts` 的 `games.retro.*` 群組。
  4. `useGameHistory` composable（A/B 雙模式）＋ 三個遊戲頁接線——此步驟起才有實際資料寫入行為。
  5. `GameHistoryDialog.vue` ＋ `game-hall.vue` 進入點——此步驟起使用者才看得到入口與內容，是唯一改變可見行為的步驟。

## Open Questions

- 是否需要支援「刪除單筆紀錄」，而不只是整批清除？MVP 先只做整批清除，若有需求可後續擴充。
- Server 端 in-memory 儲存要不要設定「每人／每遊戲」以外的**全站總筆數上限**以控制記憶體？目前先只做「每人每遊戲 50 筆」，若上線後發現需要再補。
- racing／tetriminos 的建議倍率（`×0.5` / `×0.05`）是依現有計分邏輯粗估，實作階段建議實際玩幾局記錄分數分佈後再校準，避免上線後才發現失衡。
- 單局上限（300）目前仍是拍腦袋的起始值；每日上限已由使用者拍板定案為 **100000**（相當於實質不設限，目的是先讓遊戲紀錄機制跑起來，不急著卡玩家），兩者皆為常數，之後有後台管理介面時可直接調整，見下方「Follow-up」。

## Follow-up

- **後台管理需求（尚未排入本次變更範圍）**：`coinRate` / `coinCapPerRun` / `coinDailyCap` 目前寫死在 `server/services/game/retro/{snake,racing,tetriminos}.ts` 各自的建構子參數裡，改值需要改程式碼＋重啟服務。使用者已提出之後需要一個後台管理介面來調整這些參數（以及可能包含查看/清除玩家遊戲紀錄），屬於獨立的後續 OpenSpec change，不在本次 `add-game-history` 範圍內實作，僅在此記錄需求來源與現況常數位置，方便日後串接。
