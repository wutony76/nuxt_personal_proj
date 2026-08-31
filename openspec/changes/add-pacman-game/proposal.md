## Why

遊戲中心目前十款遊戲涵蓋「單次連續衝分」「多局賽制（PONG）」「關卡制解謎（MINESWEEPER）」，但尚未有「迷宮吃豆＋敵人追逐」這個經典類型。新增 PAC-MAN 補齊這個空缺：隨機生成迷宮＋方向鍵移動＋4 隻鬼魂即時追逐，並首度引入「AI 難度依關卡數分層遞增」的設計——鬼魂行為從簡化貪心，到四種經典性格分工，再到 scatter/chase 交替，讓遊戲難度曲線由簡入繁，同時把「高擬真」AI 複雜度封頂在特定關卡之後，避免開發與測試範圍隨關卡數無限擴大。上線後使用者進一步要求「過關牆壁也要能隨機產生」與「混入可設定的固定樣板，之後在遊戲後台管理」，故迷宮生成機制迭代為「程序隨機生成＋可設定固定樣板」等機率混選（後台管理介面本身不在本次範圍內，見 design.md Open Questions）。

## What Changes

- 新增遊戲頁面 `app/pages/game/pac-man.vue`（**PAC-MAN**）：
  - 迷宮（19×21 格，含左右穿隧通道）每次開局／每次過關皆重新生成：以柱狀網格規則（保證通道全連通）隨機擲骰牆面，並跟「可設定的固定樣板」（`FIXED_MAZE_TEMPLATES`，目前 1 筆示範樣板）等機率混選；固定樣板載入時會做 BFS 連通性驗證，驗證失敗自動退回隨機生成。4 個大力丸固定位於四個角落，其餘通道格皆為豆子。
  - 方向鍵操作，可隨時改變方向（不像貪食蛇會擋反向鍵）；3 條命，碰到未受驚嚇的鬼魂扣一命並重置本關位置，命歸零遊戲結束。
  - 吃光整張迷宮的豆子與大力丸即過關，進入下一關（迷宮重新佈滿豆子，分數與命數延續），**關卡數不設上限**（開放式計分，比照 racing/runner/spaceShooter，非 minesweeper 那種 5 關封頂總分模型）。
  - **首度導入「鬼魂 AI 難度依關卡數分三層遞增」**：Lv1–2 四隻鬼共用簡化貪心＋路口隨機；Lv3–4 四隻鬼各自套用固定性格（直追／預判包抄／側翼夾擊／怕生）；Lv5 以上在同一批性格上加 scatter⇄chase 交替計時器，且 **Lv5 以後 AI 邏輯不再加深**，之後每關只用移動速度遞增加難度。
  - 吃到大力丸觸發驚嚇模式（不分關卡層級）：鬼魂逃跑、可被吃掉，連續吃鬼分數倍增（200/400/800/1600，吃到下一顆大力丸重置倍率）。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色 `#ff3b3b`（不與現有十款遊戲撞色）。
- 新增 server 端服務檔 `server/services/game/retro/pacMan.ts`，繼承既有 `RETRO_GAME_BASE`（開放式計分，`coinRate`／`maxReasonableScore` 依「無上限、跨關卡累加」的模型獨立估算，見 design.md），並在 `server/services/storage.ts` 的 `gamesInitRetro()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/pac-man/history.{get,post,delete}.ts`，比照既有遊戲樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'pacman'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/pages/game-hall.vue` 新增一筆 `PAC-MAN` 遊戲卡（`status: 'open'`），`app/components/GameMachineCard.vue` 新增對應圖示（👻）。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `pacman` 這個新的 `gameKey`；`score` 語意為「命數歸零前跨關卡累加的總分」，`level` 語意為「本局抵達的最高關卡數」，皆為開放式無上限（跟 minesweeper 的「5 關封頂總分」不同）。

## Impact

- 新增檔案（client）：`app/pages/game/pac-man.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/pacMan.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`gamesInitRetro()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度是「鬼魂 AI 難度依關卡數分層遞增」的遊戲；不影響現有十款遊戲的程式碼與行為
