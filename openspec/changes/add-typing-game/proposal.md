## Why

遊戲中心目前 12 款遊戲涵蓋動作反應、消除、接龍等類型，沒有一款是「打字反應」類型。新增 TYPING 補齊這個空缺：畫面持續生成單字、玩家鍵盤逐字元輸入，是本次架構首度需要「捕捉任意可印字元」的遊戲（其餘遊戲都只篩選固定的方向鍵／功能鍵）。

## What Changes

- 新增遊戲頁面 `app/pages/game/typing.vue`（**TYPING**）：
  - **持續生成單字**：畫面下方隨機 x 座標生成單字，往上飄移；生成間隔隨等級縮短，單字池隨等級混入更長的字（比照既有「Lv 隨分數提升」慣例）。
  - **鎖定機制**：畫面上可能同時有多個單字待打（`WAITING`），玩家按下第一個字元時，系統在所有 `WAITING` 單字中找「第一個字元相符」的一個並鎖定為 `TYPING`，之後輸入只跟這個字比對，完成或該字 MISS 才會解鎖。
  - **逐字元即時驗證，不分大小寫**：輸入與目標字統一轉小寫比對；字元正確立即顯示、推進輸入進度；字元錯誤不加入輸入，可直接繼續打，並給予明確視覺回饋（輸入框短暫變色/震動）。
  - **完成判定**：輸入完全等於目標字時，判定 `COMPLETED`：加分、疊加連擊倍率、觸發往上飄走＋淡出動畫、生成下一個字。
  - **MISS 判定**：單字飄出畫面頂端仍未完成，判定 `MISSED`：扣 1 命、連擊歸零；命數歸零觸發 `GAME_OVER`（3 條命，比照 SPACE SHOOTER 先例）。
  - **計分**：完成一個字得分依字長（字長 × 10）× 當下連擊倍率累加，開放式無上限；連續完成（中間無 MISS）疊加倍率，MISS 時歸零（比照 SPACE SHOOTER 已驗證過的 combo 機制）。
  - **HUD**：SCORE／LIVES／COMBO／目前鎖定的 TARGET 與已輸入部分（同色高亮＋游標）。
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#ffb627` 琥珀黃，跟現有十二款遊戲皆不撞色）。
- 新增 server 端服務檔 `server/services/game/retro/typing.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/typing/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'typing'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon ⌨️），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 13`、`name: 'TYPING'`、`status: 'open'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `typing` 這個新的 `gameKey`；`score` 語意延續「單局原始表現值」慣例（字長×連擊倍率累加得分），與 snake／racing／tetriminos／match3／runner／spaceShooter／spaceInvaders 一致。生命值（3 條命）與連擊數是純前端遊戲內狀態，不寫入 `useGameHistory` 紀錄，只有最終分數會被記錄。

## Impact

- 新增檔案（client）：`app/pages/game/typing.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/typing.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度需要「捕捉任意可印字元」的鍵盤輸入，但沿用既有 `window.addEventListener('keydown', ...)` 模式，不是新架構
- 不影響既有十二款遊戲的程式碼與行為
