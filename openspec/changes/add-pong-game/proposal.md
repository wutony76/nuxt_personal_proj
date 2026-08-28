## Why

遊戲中心（game-hall）目前有 SNAKE／RACING／TETRIMINOS／MATCH3 RUSH／MATCH3 CLASSIC 五款復古小遊戲，皆比照 `add-game-history` 建立的架構（頁面自包含 engine class + `useGameHistory` 紀錄／兌換 coin）。現在要新增第六款：**PONG 乒乓球**——玩家對戰 CPU，開局可選擇本場局數（3／5／10 局），依玩家「勝場數」而非單局內的來回比分計算最終分數。

## What Changes

- 新增遊戲頁面 `app/pages/game/pong.vue`（**PONG**）：
  - 開局 WELCOME 畫面新增「選擇局數」步驟（3／5／10 局，比照既有 waiting-mask + START 按鈕的版面延伸）。
  - 玩家操作右側球拍（↑/↓ 或 W/S，比照 snake 既有控制慣例），CPU 操作左側球拍（固定難度 AI，追蹤球的 y 座標但有速度上限與反應誤差，可被擊敗）。
  - 每局採定點賽制：先取得 `ROUND_POINT_TARGET`（初始估計 5 分）者贏得該局；輸掉來回的一方得 1 分，不重置全場比分。
  - 完整比照 snake.vue 的 waiting／ready 倒數／result overlay 三段式流程，額外新增「單局結束」的短暫過場（顯示本局勝負，自動進入下一局的 READY 倒數），直到選定的局數全部打完才進入最終 RESULT。
  - 最終 `SCORE = 玩家獲勝局數（0～N）`，而非任何一局內的來回比分；結束時透過 `useGameHistory().actions.record()` 寫入紀錄，`meta` 附帶 `{ totalRounds, roundsWon, roundsLost }` 供未來擴充顯示用（比照 snake 的 `fruitCount` 現況：先存進 `meta`，不強制要求本次就在 Dialog 顯示）。
  - 比照 match3 系列，掛載共用的 `GameRateDialog`／`GameRuleDialog`（coin 兌換比與玩法規則說明），`accent-color` 採 PONG 專屬主題色（草坪綠／複古 CRT 綠，待實作時定案）。
- 新增 server 端服務檔 `server/services/game/retro/pong.ts`，繼承既有 `RETRO_GAME_BASE`（比照 `snake.ts`），並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/pong/history.{get,post,delete}.ts`，比照既有五款遊戲的樣板（`/api/games` 已在既有 middleware 登入閘門內，不需再修改）。
- `app/services/api.ts` 的 `RetroGameKey` 擴充為新增 `'pong'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/pages/game-hall.vue` 把一個 `status: 'coming'` 佔位格（id 6）改為 `PONG`（`status: 'open'`），`app/components/GameMachineCard.vue` 新增 PONG 的圖示分支（🏓）。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `pong` 這個新的 `gameKey`；行為規則（結束才寫入、A/B 雙模式切換、單局／每日上限）與既有五款遊戲完全一致，不新增規則種類；但「分數定義」不同於其他遊戲——`score` 代表整場比賽的勝場數，不是單一局內的來回得分，需在需求中明確標註以免與既有遊戲的分數定義混淆。

## Impact

- 新增檔案（client）：`app/pages/game/pong.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/pong.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不引入多人連線對戰（CPU 對手，非玩家對玩家），不影響既有 `useChat`／`useSocket` 的聊天室基礎設施
- 不影響既有 SNAKE／RACING／TETRIMINOS／MATCH3 RUSH／MATCH3 CLASSIC 五款遊戲的程式碼與行為
