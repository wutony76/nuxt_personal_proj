## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/minesweeper.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.2`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 1200`——精確對齊 5 關理論上限 1170 加一點餘裕，見 design.md Decision 6）
- [ ] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/minesweeper/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有八款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'minesweeper'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含，非 tick-driven）

- [ ] 5.1 `app/pages/game/minesweeper.vue`：定義 `LEVELS` 常數陣列（5 關：寬高／地雷數／基礎分／每秒扣分／保底分，見 design.md Decision 4／5 的數值表）
- [ ] 5.2 `MinesweeperEngine` class：`reset(levelConfig)` 建空白棋盤（不放雷）、`reveal(row, col)`（首次呼叫才佈雷＋排除首格與 8 鄰居、0 格連鎖展開、踩雷回傳結果）、`toggleFlag(row, col)`、勝負判定（見 design.md Decision 2／3）
- [ ] 5.3 計時：每關第一次 `reveal()` 時開始計時，`setInterval(1000ms)` 只更新 HUD 秒數顯示，不驅動棋盤邏輯（見 design.md Decision 2）
- [ ] 5.4 計分：過關時依「基礎分 - 花費秒數 × 每秒扣分」（下限保底分）計入 `totalScore`；踩雷則以目前 `totalScore` 結算（見 design.md Decision 1／4）

## 6. 遊戲頁面互動與流程

- [ ] 6.1 WELCOME／LEVEL CLEAR 過場／RESULT 三段式 overlay（比照既有遊戲慣例，但過關不需要 READY 倒數，直接顯示本關耗時與得分後自動進入下一關棋盤）
- [ ] 6.2 玩家操作：左鍵／點擊翻格，右鍵插旗（`contextmenu` 需 `preventDefault`）；新增「🚩 插旗模式」切換鈕供觸控裝置使用（見 design.md Decision 7）
- [ ] 6.3 HUD 顯示目前關卡（1～5）、已花費秒數、目前累計分數；過關/踩雷有明確視覺提示
- [ ] 6.4 RESULT overlay 顯示最終 SCORE（已過關卡加總）與最終停在第幾關，呼叫 `useGameHistory().actions.record()`（`level` 記錄「結束在第幾關／是否全破」）
- [ ] 6.5 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#39d98a`（翡翠綠，不與現有八款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 的 id 9 改為 `MINESWEEPER`（`status: 'open'`，`path: '/game/minesweeper'`）
- [ ] 7.2 `app/components/GameMachineCard.vue`：`cuteIcon` 新增 `MINESWEEPER` 圖示分支（💣）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試翻格／連鎖展開／插旗／首格必安全／踩雷結束，5 關依序過關流程皆正常
- [ ] 9.2 實測計分：確認越快過關分數越高、保底分機制生效，5 關全破的總分與理論上限（1170）數量級相符
- [ ] 9.3 實測關卡制：確認過關才會進入下一關、踩雷立即結束並以已過關卡分數結算，不會出現「跳關」或「踩雷後還能繼續」的情況
- [ ] 9.4 實測觸控替代操作：插旗模式切換鈕能正確讓一般點擊變成插旗
- [ ] 9.5 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.6 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.7 `GameHistoryDialog` 篩選 tab 能正確顯示 `MINESWEEPER` 紀錄與統計
- [ ] 9.8 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/minesweeper`
- [ ] 9.9 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
