## Why

遊戲中心目前已有 **BREAKOUT**（單一擋板、單一球、磚塊只有存在/摧毀二態、無 Power-Up、清光整關進下一關），玩法完整但屬於「打磚塊」類型中最基礎的一種。使用者明確要求新增 **ARKANOID**，且特別強調：**ARKANOID 必須是 BREAKOUT 的進階版本，不能只是複製同一套玩法重做一份**。差異化重點為 Multi-Hit Brick（多次命中才摧毀）、Moving Brick（會移動的磚塊）、Power-Up（WIDE／MULTI_BALL／SLOW 掉落拾取）、Multi Ball（同時多顆球）與 Combo 連段計分，Boss／特殊關卡留待後續變更。

本提案的第一階段僅分析 BREAKOUT 現有實作（`app/pages/game/breakout.vue`，未抽出獨立 engine 檔），找出可重用的 Ball Physics／Paddle／Collision／Brick／Score／Game Loop／Game State／Level System，並在 design.md `## Context` 中完整輸出：1. 差異分析 2. 可重用模組 3. 建議共用/獨立架構 4. 新增檔案 5. 修改檔案 6. MVP 順序。**「把 BREAKOUT 現有內嵌邏輯抽出成共用 engine」本身是一次對既有檔案的重構，本次不自行決定、不執行，只提出方案並列入 Open Questions 交由使用者確認。**

## What Changes

以下為本提案規劃、**待使用者核准後的未來實作階段**才會發生的變更（本次僅完成文件，不觸碰任何 `app/`／`server`／`shared` 程式碼）：

- 新增遊戲頁面 `app/pages/game/arkanoid.vue`（**ARKANOID**）：
  - 沿用 BREAKOUT 已驗證的 Paddle／Ball／Brick／Collision 基礎規則與 waiting/ready/countdown/result overlay 流程、`GameRateDialog`／`GameRuleDialog` 掛載方式。
  - **Multi-Hit Brick**：磚塊新增 `hitPoints`（1～3），每次被球擊中遞減 1，歸零才摧毀，依剩餘層數變換顏色/裂痕視覺，摧毀時給分隨初始層數加成。
  - **Moving Brick**：關卡進度達到門檻後，部分磚塊在自身所屬欄位範圍內左右來回移動，不與其他磚塊重疊、不越出磚塊區域。
  - **Brick Pattern**：關卡改用預先定義的圖樣（pattern）產生磚塊佈局，而非單純列數遞增。
  - **Power-Up（本次僅 3 種：WIDE／MULTI_BALL／SLOW，FIRE 留待下一版）**：磚塊摧毀時有機率掉落道具膠囊，擋板接住即生效；WIDE／SLOW 為限時效果，MULTI_BALL 為即時效果（分裂出額外球）。
  - **Multi Ball**：球的狀態由單一 `ballX`/`ballY` 改為 `balls: Ball[]` 陣列，擋板/磚塊碰撞需對每顆球逐一判定；只有當所有球都離開場地才算失去一命（見 design.md Decision 5）。
  - **Combo**：連續命中磚塊未經擋板重置的連段計數，達門檻提升分數倍率，碰到擋板或失去一命即重置。
  - 主題色採 `#ef476f`（玫瑰紅），與現有全部遊戲（含 BREAKOUT 的 `#1de9b6`）不撞色。
- 新增純邏輯核心 `app/utils/arkanoidEngine.ts`（不依賴 Vue）：是否與未來抽出的共用底層合併，取決於 Open Questions 的決議（方案 a/b/c，見 design.md）。
- 新增 server 端服務檔 `server/services/game/retro/arkanoid.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/arkanoid/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'arkanoid'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（glow `#ef476f`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 24`、`name: 'ARKANOID'`、`status: 'open'`、`path: '/game/arkanoid'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `arkanoid` 這個新的 `gameKey`；`score` 語意在 BREAKOUT 的基礎分數之上，新增 Multi-Hit Brick 層數加成與 Combo 倍率，`meta` 欄位可額外記錄 `maxCombo`／`powerUpsCollected`／`level` 供統計呈現。

## Impact

**本次（文件撰寫階段）不修改或新增任何 `app/`／`server`／`shared` 程式碼**，只在 `openspec/changes/add-arkanoid-game/` 底下新增本提案文件；**明確不修改 `app/pages/game/breakout.vue`，不影響既有 16 款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為**。

未來實作階段（待核准後）預期新增/修改的檔案：

- 新增檔案（client）：`app/pages/game/arkanoid.vue`、`app/utils/arkanoidEngine.ts`
- 新增檔案（server）：`server/services/game/retro/arkanoid.ts`、對應 3 支 API 路由檔
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroArkanoidClass()`）
- **條件式修改（僅當 Open Questions 決議採方案 a：抽出共用 engine 時才會發生）**：`app/pages/game/breakout.vue` 內嵌的 Ball Physics／Paddle／Collision／Brick 邏輯改為呼叫新抽出的共用模組——此為本提案唯一可能觸及既有遊戲檔案的項目，明確不在本次執行，需使用者另行確認（見 design.md Decision 1／Open Questions）。
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
