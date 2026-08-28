## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/runner.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.5`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 5000`，比照 racing.ts 的既有校準，見 design.md Decision 6）
- [x] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/runner/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有六款遊戲樣板）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'runner'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含）

- [x] 5.1 `app/pages/game/runner.vue`：`RunnerEngine` inline class（角色垂直位置／跳躍重力 physics、下蹲二元狀態、障礙物生成與回收、碰撞判定、`step()` 由固定 tick 驅動，比照 snake.vue／pong.vue 的 engine class 慣例）
- [x] 5.2 障礙物分兩類（地面／空中），生成間隔與比例隨等級調整（見 design.md Decision 4）
- [x] 5.3 碰撞判定：地面障礙站立/下蹲時判定，空中障礙站立/跳躍時判定，跳躍/下蹲時各自安全（見 design.md Decision 5）
- [x] 5.4 分數＝存活距離，隨時間持續累加；等級隨分數門檻提升，帶動捲動速度與障礙密度（比照 snake/racing 既有 Lv 慣例）

## 6. 遊戲頁面互動與流程

- [x] 6.1 WELCOME／READY／RESULT 三段式 overlay（比照 snake.vue／racing.vue 既有慣例）
- [x] 6.2 玩家操作：↑/W 或空白鍵跳躍、↓/S 下蹲（比照 snake 既有 keydown/keyup 慣例）
- [x] 6.3 RESULT overlay 顯示最終 SCORE（存活距離）與等級，呼叫 `useGameHistory().actions.record()`
- [x] 6.4 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#ffd400`（鮮黃色，不與現有六款遊戲撞色）

## 7. game-hall 入口

- [x] 7.1 `app/pages/game-hall.vue`：`gameSlots` 的 id 7 改為 `RUNNER`（`status: 'open'`，`path: '/game/runner'`）
- [x] 7.2 `app/components/GameMachineCard.vue`：`cuteIcon` 新增 `RUNNER` 圖示分支（🏃）
- [x] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試跳躍／下蹲時機是否能正確閃避對應障礙物，撞到障礙物是否正確結束
- [ ] 9.2 實測難度曲線：確認捲動速度與障礙密度確實隨距離提升，且前段不會太難、後段不會太無聊——自動化測試已確認跳躍/下蹲各自的安全窗邏輯正確（見 9.1），但「一般玩家憑肉眼反應能否穩定跳過地面障礙」的實際手感仍需人工試玩校準（跳躍安全窗約 272ms，理論上足夠但未經真人測試驗證），見 design.md Open Questions
- [x] 9.3 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [x] 9.4 已登入：確認 server 端紀錄寫入、coin 依 `distance × coinRate` 入帳、單局與每日上限機制正確
- [x] 9.5 `GameHistoryDialog` 篩選 tab 能正確顯示 `RUNNER` 紀錄與統計
- [x] 9.6 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/runner`
- [x] 9.7 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
