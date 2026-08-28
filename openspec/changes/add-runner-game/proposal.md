## Why

遊戲中心（game-hall）目前六款遊戲分別是「操控型」（貪吃蛇）、「賽道躲避」（賽車）、「堆疊消除」（俄羅斯方塊／Match3 兩款）與「對戰 CPU」（PONG），尚未有經典的「跑酷（endless runner）」類型：玩家角色固定在畫面側邊持續自動奔跑，需即時跳躍／下蹲避開接連而來的障礙物，跑得越久／越遠分數越高。新增 RUNNER 補齊這個街機經典類型的空缺。

## What Changes

- 新增遊戲頁面 `app/pages/game/runner.vue`（**RUNNER**）：
  - 側視角自動捲軸跑酷：玩家角色固定在畫面水平位置，地面與障礙物由右向左捲動，製造持續奔跑的錯覺（比照 Chrome Dino／Canabalt 等經典側視角跑酷玩法）。
  - 操作：↑/W 或空白鍵跳躍（避開地面障礙）、↓/S 下蹲（避開空中障礙），比照 snake 既有 keydown 慣例；只有單一車道，不做左右移動。
  - 障礙物分兩類：地面障礙（需跳躍通過）、空中障礙（需下蹲通過），隨存活距離增加逐漸提高出現頻率、縮短間距、加快捲動速度（比照 snake/racing/tetriminos 既有「Lv 隨進度提升」慣例）。
  - 分數＝存活距離（開放式無上限計分，比照 racing.vue 既有的「存活 tick 數」設計）；撞到任一障礙物即結束，是單次連續衝分玩法（非 PONG 的多局賽制）。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#ffd400` 鮮黃色，跟現有六款遊戲的綠／青／淡紫／橘／紫／桃紅皆不撞色）。
- 新增 server 端服務檔 `server/services/game/retro/runner.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`maxReasonableScore` 比照 `racing.ts` 的開放式計分校準方式），並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/runner/history.{get,post,delete}.ts`，比照既有六款遊戲樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'runner'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/pages/game-hall.vue` 把一個 `status: 'coming'` 佔位格（id 7）改為 `RUNNER`（`status: 'open'`），`app/components/GameMachineCard.vue` 新增對應圖示（🏃）。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `runner` 這個新的 `gameKey`；`score` 語意延續「單局原始表現值」慣例（存活距離），與 snake／racing／tetriminos／match3 一致，不像 PONG 是「勝場數」的特例定義。

## Impact

- 新增檔案（client）：`app/pages/game/runner.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/runner.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有六款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong）的程式碼與行為
