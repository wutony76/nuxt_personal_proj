## 1. 共用型別

- [x] 1.1 定義 `GameHistoryRecord` 型別（`gameKey` / `score` / `level?` / `meta?` / `playedAt` 等）——放在 `app/services/api.ts`（client 端型別來源），server 端在 `server/services/game/retro/history.ts` 用結構相同的 `RetroHistoryRecordRow` 獨立定義，比照專案既有 lottery 型別 client/server 各自一份、手動對齊欄位的慣例（專案沒有 `shared/types/` 這種跨端型別資料夾）

## 2. Server 端服務層（比照 6hc 架構）

- [x] 2.1 新增 `server/services/game/retro/base.ts`：共用基底類別 `RETRO_GAME_BASE`（紀錄寫入／查詢／統計、per-user 50 筆上限裁剪）——不繼承 `LOTTERY_BASE`（該類別的期數/開獎循環邏輯是彩票專屬，retro 遊戲用不到）
- [x] 2.2 新增 `server/services/game/retro/history.ts`：比照 `orders.ts`，per-game 的 in-memory 紀錄儲存，依 `userId` 分桶
- [x] 2.3 新增 `server/services/game/retro/snake.ts`：繼承基底，處理貪吃蛇專屬驗證（分數合理性上限 900）
- [x] 2.4 新增 `server/services/game/retro/racing.ts`：繼承基底，處理賽車專屬驗證（分數合理性上限 5000，防偽造用途，非遊戲設計天花板）
- [x] 2.5 新增 `server/services/game/retro/tetriminos.ts`：繼承基底，處理俄羅斯方塊專屬驗證（分數合理性上限 100000，同上）
- [x] 2.6 於 `server/services/storage.ts` 新增 `Storage.retroGames`（`instances`/`history` 兩個註冊表）與 `handle.retroGamesInit()`，在 `Storage.init()` 內呼叫，開機時實例化三款遊戲服務

## 3. Server 端 API 路由

- [x] 3.1 新增 `server/api/games/retro/snake/history.get.ts`（`sessionController.require()`，回傳該使用者紀錄）
- [x] 3.2 新增 `server/api/games/retro/snake/history.post.ts`（`sessionController.require()`，寫入一筆紀錄＋觸發 coin 結算，見第 4 組）
- [x] 3.3 racing／tetriminos 比照 3.1／3.2 各自建立 `history.get.ts` / `history.post.ts`
- [x] 3.4 於 `server/middleware/auth.ts` 將 `/api/games` 納入 `PROTECTED_PREFIXES`（比照 `/api/lottery` 的既有規則，無公開白名單）
- [x] 3.5（實作時補上，原規劃遺漏）三款遊戲各自新增 `history.delete.ts`（`sessionController.require()` + `actions.clear(userId)`），對應 spec.md「玩家 SHALL 能清除所有遊戲紀錄」在已登入模式下也要有伺服器端清除能力，原本只規劃了 GET/POST 兩支路由，少了清除的入口

## 4. Coin 轉換機制

- [x] 4.1 定義常數（各自寫在 `snake.ts`/`racing.ts`/`tetriminos.ts` 的 `super()` 參數，而非獨立常數檔）：coinRate 依序 ×5 / ×0.5 / ×0.05，單局上限皆 300、每日上限皆 100000（使用者拍板定案值，見 design.md Open Questions）
- [x] 4.2 在 `RETRO_GAME_BASE` 新增 `actions.settleReward(userId, score)`：套用倍率 → 套用單局／每日雙重上限 → 核發 coin（`validateScore()` 另外在 `actions.record()` 內先做分數合理性驗證）
- [x] 4.3 `RETRO_GAME_BASE.actions.record()` 於寫入紀錄的同一次呼叫內呼叫 `settleReward`，`history.post.ts` 回傳值附上 `coinReward` / `coinCapped` / `newCoinBalance`
- [x] 4.4 擴充 `server/services/users.ts` 的 `BalanceChangeType` 新增 `'game-reward'`，核發時 push 一筆可稽核的 `balanceChanges`
- [ ] 4.5 racing／tetriminos 實際玩測幾局，記錄分數分佈，校準 4.1 的倍率是否需要調整（待人工實測，非本輪程式碼變更範圍）

## 5. Client API 層

- [x] 5.1 `app/services/api.ts` 新增 `games.retro.*` 群組（`historySnake`/`recordSnake`/`clearSnake` 及 racing/tetriminos 同組），沿用既有 `$fetch<Type>(path)` 慣例

## 6. Client 資料層（A/B 雙模式）

- [x] 6.1 新增 `app/composables/useGameHistory.ts`：對外介面 `records` / `statsByGame` / `identityLabel` / `actions.record()` / `actions.clear()` / `actions.reload()`
- [x] 6.2 實作模式 A（未登入）：`_handlers.loadLocal` / `_handlers.persistLocal` 走 localStorage（`import.meta.client` 防護、50 筆上限裁剪）
- [x] 6.3 實作模式 B（已登入）：改呼叫 `api.games.retro.*`，`actions.record()` 回傳值附帶 `coinReward` / `coinCapped` 供 UI 顯示
- [x] 6.4 依 `useAuth().isLoggedIn` 自動判斷走 A 或 B（module-level 共用 state，比照 `useAuth` 的 singleton 慣例）
- [x] 6.5 實作衍生 computed：`recordsSorted`（時間倒序）、`statsByGame`（各遊戲最高分／局數）

## 7. 遊戲頁接線

- [x] 7.1 `app/pages/game/snake.vue`：於 gameover 分支（含 `endGameNow`）呼叫 `_actions.recordHistory()` → `useGameHistory().actions.record(...)`，已登入且有 coin 獎勵時顯示 `rewardMessage`
- [x] 7.2 `app/pages/game/racing.vue`：同上
- [x] 7.3 `app/pages/game/tetriminos.vue`：同上

## 8. Dialog 元件

- [x] 8.1 新增 `app/components/GameHistoryDialog.vue`：props（`visible` / `title?` / `width?`）＋ `emit('close')`，Cyberpunk HUD 視覺（clip-path 切角、cyan/magenta 描邊，沿用 game-hall.vue `.ops-hall` 既有 CSS 變數，不重新宣告一份——因此不使用 `<Teleport>`，維持在 `.ops-hall` 的 DOM 子孫節點內以繼承變數）
- [x] 8.2 實作依遊戲篩選 tab（全部／SNAKE／RACING／TETRIMINOS）
- [x] 8.3 實作摘要卡（各遊戲最高分＋局數）
- [x] 8.4 實作紀錄清單（時間倒序渲染，含空狀態「尚無遊戲紀錄」文案）
- [x] 8.5 實作「清除紀錄」動作：**不使用**全域 `$dialog`（該元件視覺是彩票主題，跟 game-hall 的 Cyberpunk HUD 不符），改在 `GameHistoryDialog.vue` 內建一個 retro 風格的二次確認覆蓋層（`ghd-confirm-mask`/`ghd-confirm-box`，magenta 描邊 + clip-path 切角），確認後才呼叫 `actions.clear()`
- [x] 8.6 Dialog 頂部顯示目前身分（未登入：「訪客（本機保存）」；已登入：「會員 {使用者名稱}」），清單各列不重複顯示身分欄位

## 9. game-hall.vue 進入點

- [x] 9.1 `.op-header .right-tools` 新增「遊戲紀錄」按鈕（沿用 `.status-pill` 樣式 + `.history-btn` hover 效果）
- [x] 9.2 UI 狀態改用 `reactive` 物件 `ui.historyOpen`，`click.openHistory` / `click.closeHistory` 走 `click` 入口慣例
- [x] 9.3 掛載 `<GameHistoryDialog :visible="ui.historyOpen" title="遊戲紀錄" @close="click.closeHistory" />`

## 10. 驗證

- [x] 10.1 未登入：以 Playwright 寫入 localStorage 模擬紀錄、開啟 Dialog，確認身分「訪客（本機保存）」、清單/摘要卡/篩選 tab 皆正確顯示
- [x] 10.2 已登入：以 curl 呼叫 `POST /api/games/retro/{snake,racing,tetriminos}/history`，並以 Playwright 開啟 Dialog 確認身分「會員 {name}」、清單顯示 server 端資料
- [x] 10.3 已登入：以 curl 驗證 coin 正確入帳（score×rate）、單局上限（900 分 × rate 夾到 300）與每日上限機制（測試時暫用 1000 累計驗證 `coinCapped:true`、剩餘額度精準核發皆正確；上限常數後改為 100000，夾住邏輯不變，數值調整不影響已驗證的機制本身）
- [x] 10.4 未登入呼叫 `/api/games/retro/*` 系列 API（GET/POST/DELETE）皆回傳 401
- [x] 10.5 以 curl 驗證同一 session 內 POST 後再 GET 能讀回剛寫入的紀錄（server in-memory 持久化在 process 存活期間有效）
- [x] 10.6 清除紀錄：未登入以 Playwright 走「清除紀錄→retro 風格二次確認覆蓋層→localStorage 清空＋清單回到空狀態」；已登入以 curl 呼叫 `DELETE` 確認該遊戲紀錄清空
- [x] 10.7 `npm run dev` 正常啟動；`npx nuxt typecheck` 確認新增/修改的檔案皆無型別錯誤（僅有 kl10/kl8 既有、與本次變更無關的錯誤）；Playwright 全程無新增 console 錯誤（僅訪客狀態既有的 `/api/me` 401，非本次變更引入）
