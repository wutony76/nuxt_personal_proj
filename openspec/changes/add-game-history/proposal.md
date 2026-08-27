## Why

遊戲中心（game-hall）目前的三款小遊戲（貪吃蛇／賽車／俄羅斯方塊）分數只存在單局的元件狀態中，離開頁面或重新整理後就消失，玩家無法回顧過去的成績。需要在 game-hall 上方提供「遊戲紀錄」查看入口，讓玩家能看到歷史分數與簡易統計，強化遊戲中心的可玩性與黏著度。同時，登入使用者應該要有比瀏覽器 localStorage 更可靠的紀錄來源，因此本次一併規劃 server 端架構（比照既有 6hc 服務層的分層方式），讓「未登入」與「已登入」兩種情境分別對應不同的儲存策略，且未來新增更多小遊戲時可直接比照擴充。

## What Changes

- 新增 `useGameHistory` composable，對外提供一致介面（`records` / `actions.record()` / `actions.clear()`），內部依登入狀態自動切換兩種資料來源：
  - **模式 A（未登入）**：純前端 localStorage 持久化
  - **模式 B（已登入）**：改為讀寫新增的 server API，資料儲存在該使用者名下
- snake / racing / tetriminos 三個遊戲頁在單局明確結束（game over／通關）時，各自呼叫 `useGameHistory` 寫入一筆紀錄（呼叫端不需感知目前是模式 A 還是 B）。
- 新增 server 端「復古遊戲」服務層 `server/services/game/retro/`，比照 6hc 現有「共用基底類別＋每款遊戲一個服務檔」的分層架構：
  - `base.ts`：共用基底類別（紀錄寫入／查詢／統計等共用邏輯），比照 `LOTTERY_BASE`
  - `snake.ts` / `racing.ts` / `tetriminos.ts`：各自繼承基底、處理各遊戲專屬驗證，日後新增遊戲比照擴充
  - `history.ts`：比照既有 `orders.ts`，per-game 的 in-memory 紀錄儲存（專案目前無資料庫，沿用現況架構）
- 新增 API 路由，比照 6hc「每個遊戲一個資料夾」慣例：`server/api/games/retro/snake/history.get.ts`、`history.post.ts`（racing / tetriminos 各自比照），皆透過既有 `sessionController.require()` 限定登入使用者才能呼叫。
- `app/services/api.ts` 新增 `games.retro.*` 群組，沿用既有 `$fetch<Type>(path)` 慣例。
- 新增 `GameHistoryDialog.vue` 元件，比照專案既有 Dialog Shell 的 props/emit 合約（`visible` / `title` / `width?` + `emit('close')` + 預設 slot），視覺採 game-hall 既有的 Cyberpunk HUD 風格。
- `game-hall.vue` 頂部（`.op-header .right-tools`）新增「遊戲紀錄」進入按鈕，點擊開啟 Dialog。
- Dialog 內容包含：依遊戲篩選 tab、各遊戲最高分／局數摘要卡、紀錄清單（時間倒序）、清除紀錄動作、空狀態文案；頂部另顯示目前身分（訪客／會員名稱），清單各列不重複標示身分。
- **已登入使用者結算後，分數 SHALL 依固定比例（每款遊戲各自的倍率）轉換為 coin，計入既有錢包餘額**，並受單局上限與每日上限保護；未登入玩家不觸發此機制（沒有錢包可歸屬）。轉換入帳比照 6hc 的 `balanceChanges` 留下可稽核紀錄。

## Capabilities

### New Capabilities
- `game-history`：遊戲中心的遊戲紀錄記錄／查詢／清除能力，含前端（localStorage）與 server 端（登入使用者）雙資料來源的自動切換、資料模型與 Dialog UI 的行為規範。

### Modified Capabilities
（無：本次變更不涉及既有 spec 的需求異動）

## Impact

- 新增檔案（server）：
  - `server/services/game/retro/base.ts`
  - `server/services/game/retro/snake.ts`
  - `server/services/game/retro/racing.ts`
  - `server/services/game/retro/tetriminos.ts`
  - `server/services/game/retro/history.ts`
  - `server/api/games/retro/snake/history.get.ts`、`history.post.ts`、`history.delete.ts`
  - `server/api/games/retro/racing/history.get.ts`、`history.post.ts`、`history.delete.ts`
  - `server/api/games/retro/tetriminos/history.get.ts`、`history.post.ts`、`history.delete.ts`
- 修改檔案（server）：`server/services/storage.ts`（新增 `Storage.retroGames` 註冊與開機初始化）、`server/middleware/auth.ts`（把 `/api/games/*` 納入登入閘門）、`server/services/users.ts`（`BalanceChangeType` 新增 `'game-reward'`）
- 新增檔案（client）：`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`
- 修改檔案（client）：`app/services/api.ts`（新增 `games` 分組）、`app/pages/game-hall.vue`、`app/pages/game/snake.vue`、`app/pages/game/racing.vue`、`app/pages/game/tetriminos.vue`
- 不涉及資料庫（沿用專案現況的 in-memory store，比照彩票下注紀錄／session 的既有作法）
- 不影響既有彩票模組（`DialogUser`／`user-record`）與全域 `useDialog` 單例
