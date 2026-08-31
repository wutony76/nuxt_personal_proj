## Why

遊戲中心（game-hall）現有的 `SPACE SHOOTER` 是 Galaga 式縱向捲軸射擊（連擊倍率、道具掉落、里程碑強敵），跟維基百科定義的傳統《太空侵略者》玩法（固定隊形艦隊整批移動、防禦掩體、限定單發子彈、神秘 UFO）是不同的遊戲體驗，現有 9 款遊戲中都沒有「固定隊形陣列敵人＋掩體防禦」這種玩法。新增 SPACE INVADERS 補齊傳統版玩法，作為與 SPACE SHOOTER 並存的獨立第 10 款遊戲，不更動既有兩款遊戲（MINESWEEPER／SPACE SHOOTER）的程式碼。

## What Changes

- 新增遊戲頁面 `app/pages/game/space-invaders.vue`（**SPACE INVADERS**）：
  - **固定隊形移動**：5 列 × 8 欄的外星艦隊整批以固定 tick 同步左右移動，碰到畫面邊界時整批下降一層並反向；**剩餘敵機越少、移動間隔越短（越快）**，是傳統版標誌性的節奏機制（跟 SPACE SHOOTER 敵機各自獨立生成/移動完全不同）。
  - **玩家單發子彈限制**：同一時間畫面上最多 1 發玩家子彈，需等該發子彈擊中目標或飛出畫面才能再開火（區別於 SPACE SHOOTER 的固定射速連發），比照原作核心限制。
  - **敵機還擊**：每欄最前線（最底部）的敵機才會隨機向下開火，頻率隨波次增加。
  - **防禦掩體（Bunker）**：畫面下方 4 座掩體，各自是一個小型像素格陣列；玩家子彈、敵彈打中掩體格子，或敵機本體移動經過掩體位置時，該格掩體被摧毀，掩體會逐漸被打穿、無法回復。
  - **神秘 UFO**：不定期從畫面最上方飛過，擊中給隨機獎勵分（50/100/150/300），不開火、不參與一般敵機的碰撞判定。
  - **生命值機制**（3 條命，比照 SPACE SHOOTER 先例）：被敵彈或敵機本體擊中扣 1 命，扣命後短暫無敵並重生於畫面下方中央，生命歸零才結束遊戲。
  - **波次制**：清空一整批敵機即進入下一波，隊形重新從頂部滿編開始，波次基礎移動速度與開火頻率遞增；分數開放式無上限（比照 snake/racing/tetriminos/match3/runner/spaceShooter 的既有計分慣例）。
  - **即死條件**（傳統版特有，獨立於生命值）：任一敵機隊形下降到玩家所在列（掩體列以下的底線）時，不論剩餘生命數，直接判定遊戲結束——比照原作「敵人打到底就輸」規則，這是本次唯一「非扣命導致」的結束條件。
  - 計分依敵機所在列給分（越上排分越高），UFO 額外獎勵分累加。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#ff3b3b` 警報紅，跟現有九款遊戲皆不撞色）。
- 新增 server 端服務檔 `server/services/game/retro/spaceInvaders.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`maxReasonableScore` 依開放式計分模型獨立估算，見 design.md），並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/space-invaders/history.{get,post,delete}.ts`，比照既有九款遊戲的樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'spaceInvaders'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/pages/game-hall.vue` 新增一筆 `id: 10`、`name: 'SPACE INVADERS'`、`status: 'open'` 的卡片，`app/components/GameMachineCard.vue` 新增對應圖示（👾）。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `spaceInvaders` 這個新的 `gameKey`；`score` 語意延續「單局原始表現值」慣例（依敵機列數加分＋UFO 獎勵分累加），與 snake／racing／tetriminos／match3／runner／spaceShooter 一致。生命值（3 條命）與掩體損毀狀態是純前端遊戲內狀態，不寫入 `useGameHistory` 紀錄，只有最終分數會被記錄。

## Impact

- 新增檔案（client）：`app/pages/game/space-invaders.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/pages/game-hall.vue`、`app/components/GameMachineCard.vue`
- 新增檔案（server）：`server/services/game/retro/spaceInvaders.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不影響既有九款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper）的程式碼與行為，尤其 MINESWEEPER 與 SPACE SHOOTER 完全不動
