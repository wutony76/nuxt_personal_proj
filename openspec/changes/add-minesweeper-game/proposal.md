## Why

遊戲中心（game-hall）目前八款遊戲都是「單次連續衝分」（撞到/失敗即結束）或 PONG 的「多局賽制」，尚未有「解謎／回合制點擊」類型，也尚未有「關卡制」（過關進下一關）的遊戲。新增 MINESWEEPER（踩地雷）補齊這兩個空缺：經典的邏輯推理玩法＋明確的 5 關關卡進度，並用「計時、時間越短分數越高」的計分方式，跟現有八款遊戲「越久/越多分越高」的既有計分哲學形成有趣對比。

## What Changes

- 新增遊戲頁面 `app/pages/game/minesweeper.vue`（**MINESWEEPER**）：
  - 經典踩地雷玩法：左鍵（或點擊）翻開格子，翻到數字格顯示週圍地雷數，翻到 0 格自動連鎖展開；右鍵（或切換「插旗模式」後點擊）插旗標記疑似地雷；翻到地雷即整場結束。
  - **首度導入「5 關關卡制」**：固定 5 個關卡，難度（棋盤大小、地雷數）依序遞增，過關才會進入下一關，任一關踩到地雷則整場立即結束（比照 PONG 的多局賽制先例，是本次架構第二個「非單次衝分」的例外）。
  - **計時計分，時間越短分數越高**：每一關從第一次翻格開始計時，過關時依花費秒數換算分數（越快分數越高，設有每關的基礎分與最低保底分）；5 關全部過關的總分＝各關分數加總。這是本次唯一「時間越短分數越高」的計分方向，跟其他八款遊戲「越久/越多分越高」相反。
  - 「首格必安全」：地雷佈局在玩家第一次翻格之後才生成，排除該格與其八個鄰居，保證開局一定有一片連鎖展開的安全區域（業界標準踩地雷慣例）。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#39d98a` 翡翠綠，跟現有八款遊戲皆不撞色）。
- 新增 server 端服務檔 `server/services/game/retro/minesweeper.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`maxReasonableScore` 依「5 關固定加總、有明確理論上限」的計分模型獨立估算，見 design.md），並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/minesweeper/history.{get,post,delete}.ts`，比照既有八款遊戲樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'minesweeper'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/pages/game-hall.vue` 把最後一個 `status: 'coming'` 佔位格（id 9）改為 `MINESWEEPER`（`status: 'open'`），`app/components/GameMachineCard.vue` 新增對應圖示（💣）。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `minesweeper` 這個新的 `gameKey`；`score` 語意為「5 關過關分數加總」，且是本次唯一「有明確理論上限」的計分模型（不像其他遊戲開放式無上限），需在需求中明確標註以免與既有遊戲的分數定義混淆。

## Impact

- 新增檔案（client）：`app/pages/game/minesweeper.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/minesweeper.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度是「以滑鼠/觸控點擊為主要操作」的遊戲，不像其他八款遊戲以鍵盤為主要輸入
- 不影響既有八款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter）的程式碼與行為
