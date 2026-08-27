## Why

遊戲中心（game-hall）目前有 SNAKE／RACING／TETRIMINOS 三款復古小遊戲，皆比照 `add-game-history` 建立的架構（頁面自包含 engine class + `useGameHistory` 紀錄／兌換 coin）。現在要新增 Match3 三消玩法。使用者明確要求：三消的「限時制」與「限步數制」不合併成一款可切換模式的遊戲，而是拆成**兩款完全獨立、互不干擾**的遊戲——各自獨立的分數紀錄、coin 每日上限、game-hall 卡片入口。

## What Changes

- 新增共用的三消棋盤核心邏輯 `Match3CoreEngine`（`app/utils/match3Engine.ts`）：8×8 棋盤、6 種寶石、交換／連鎖消除／掉落補位／無解自動洗牌，供兩款遊戲共用，避免複製一份高複雜度演算法。
- 新增兩個獨立遊戲頁面：
  - `app/pages/game/match3-rush.vue`（**MATCH3 RUSH**，限時制：60 秒倒數，時間到強制結算）
  - `app/pages/game/match3-classic.vue`（**MATCH3 CLASSIC**，限步數制：20 步，步數用完強制結算；只有成功消除的交換才消耗步數）
  - 兩者各自包裝 `Match3CoreEngine`，只在結束條件（計時／計步）與 HUD 上不同，比照 `snake.vue` 既有的 engine class + ref 鏡像 snapshot 慣例。
- 新增 server 端兩個獨立服務檔 `server/services/game/retro/match3rush.ts`、`match3classic.ts`，各自繼承既有 `RETRO_GAME_BASE`（比照 `snake.ts`），並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/match3rush/history.{get,post,delete}.ts`、`server/api/games/retro/match3classic/history.{get,post,delete}.ts`，比照 `snake` 的既有樣板（`/api/games` 已在既有 middleware 的登入閘門內，不需再修改）。
- `app/services/api.ts` 的 `RetroGameKey` 擴充為 `'snake' | 'racing' | 'tetriminos' | 'match3rush' | 'match3classic'`，`api.games.retro` 新增對應 6 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充兩個新遊戲分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充兩筆。
- `app/pages/game-hall.vue` 把兩個 `status: 'coming'` 佔位格改為 `MATCH3 RUSH` / `MATCH3 CLASSIC`（`status: 'open'`），`app/components/GameMachineCard.vue` 新增 Match3 的圖示分支。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `match3rush`、`match3classic` 兩個新的 `gameKey`；行為規則（結束才寫入、A/B 雙模式切換、單局／每日上限）與既有三款遊戲完全一致，不新增規則種類。

## Impact

- 新增檔案（client）：`app/utils/match3Engine.ts`、`app/pages/game/match3-rush.vue`、`app/pages/game/match3-classic.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/match3rush.ts`、`match3classic.ts`、對應 6 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有 SNAKE／RACING／TETRIMINOS 三款遊戲的程式碼與行為
