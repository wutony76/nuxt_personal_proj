## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/pong.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 10`、`coinCapPerRun: 100`、`coinDailyCap: 100000`、`maxReasonableScore(): 10`，註解說明此為精確上限而非估算值，見 design.md Decision 6）
- [x] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/pong/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有五款遊戲樣板）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'pong'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含，不抽共用 engine）

- [x] 5.1 `app/pages/game/pong.vue`：`PongEngine` inline class（球拍／球座標、牆面與球拍碰撞反彈、CPU 追蹤 AI、單局比分、`step(dt)` 由固定 tick 驅動，比照 snake.vue 的 `SnakeEngine` 慣例）
- [x] 5.2 局內比分判定：任一方先達 `ROUND_POINT_TARGET`（初始 5 分）視為該局結束，累計 `roundsWon` / `roundsLost`
- [x] 5.3 CPU AI：追蹤球 y 座標，移動速度設上限＋反應延遲，確保可被擊敗（見 design.md Decision 1，常數留待驗證階段微調）

## 6. 遊戲頁面互動與流程

- [x] 6.1 WELCOME 畫面新增「選擇局數」步驟（3／5／10 局按鈕），選定後才進入第一局的 READY 倒數（比照 snake.vue 既有 waiting-mask/ready-mask 三段式 overlay 慣例）
- [x] 6.2 玩家操作：↑/↓ 與 W/S 控制右側球拍（比照 snake 既有 keydown 慣例）
- [x] 6.3 單局結束過場：短暫顯示本局勝負，自動進入下一局 READY 倒數；局數用盡後進入最終 RESULT overlay
- [x] 6.4 RESULT overlay 顯示 `roundsWon` / `roundsLost` 與最終 `SCORE`（＝`roundsWon`），呼叫 `useGameHistory().actions.record()`，`meta` 帶 `{ totalRounds, roundsWon, roundsLost }`（不使用 `level` 欄位，見 design.md Decision 8）
- [x] 6.5 掛載共用 `GameRateDialog` / `GameRuleDialog`（比照 match3 系列），`accent-color` 採 PONG 專屬主題色，`GameRuleDialog` 的 `levels` 改為說明 3／5／10 局選項的內容（非難度等級）；`GameRuleDialog.vue` 新增可選的 `levelsTitle` prop（預設「等級對照」不影響既有 5 款遊戲），PONG 傳入「局數選項」

## 7. game-hall 入口

- [x] 7.1 `app/pages/game-hall.vue`：`gameSlots` 的 id 6 改為 `PONG`（`status: 'open'`，`path: '/game/pong'`）
- [x] 7.2 `app/components/GameMachineCard.vue`：`cuteIcon` 新增 `PONG` 圖示分支（🏓）
- [x] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆；6 款遊戲下 `ghd-summary` 原本 `repeat(3, 1fr)` 剛好排成兩行，不需調整欄數

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，用 Playwright 分別驗證選局數（3/5/10）、START→READY 倒數→PLAYING、球拍鍵盤操作（含邊界 clamp）、單局結束過場、局數用盡進入最終 RESULT，皆正常
- [ ] 9.2 實測 CPU 難度：自動化測試因大量 CDP 輪詢干擾頁面 tick 計時器，無法穩定量測「玩家主動操作下的實際勝率」；目前僅驗證 CPU AI 程式邏輯上可被擊敗（有速度上限與反應死區），實際勝率手感仍待人工試玩校準（見 design.md Open Questions）
- [x] 9.3 未登入：以 Playwright 驗證同一瀏覽器 session 內完成一場後，`GameHistoryDialog` 的 PONG 分頁能立即讀到剛寫入的 localStorage 紀錄
- [x] 9.4 已登入：以 Playwright 驗證 server 端紀錄寫入成功、`ghd-identity` 正確顯示會員名稱；本次測試對局 `roundsWon = 0`，故未觸發 coin 實際入帳分支，coin 換算邏輯本身沿用既有 `RETRO_GAME_BASE.actions.settleReward()`（已由其他遊戲驗證過），未重複測試
- [x] 9.5 `GameHistoryDialog` 篩選 tab 能正確顯示 `PONG` 紀錄與統計，`score` 顯示為獲勝局數（0～10 範圍），不與既有遊戲的分數量級混淆
- [x] 9.6 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/pong`
- [x] 9.7 `npx nuxt typecheck` 確認新增/修改檔案無新增型別錯誤（既有錯誤與本次變更無關的檔案不在範圍內）
