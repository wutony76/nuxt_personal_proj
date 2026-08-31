## Why

遊戲中心目前 11 款遊戲都是「動作／反應」或「點擊消除」類型（射擊、跑酷、消方塊、踩地雷等），沒有一款是「策略／規劃」類的**卡牌接龍**。新增 SOLITAIRE（傳統 Klondike 接龍，比照 Windows XP 經典版）補齊這個空缺，操作方式比照 MINESWEEPER 的純點擊模式（原規劃含 Drag & Drop，實作驗證後與使用者確認拿掉，見 design.md Decision 3）。

## What Changes

- 新增遊戲頁面 `app/pages/game/solitaire.vue`（**SOLITAIRE**）：
  - **標準 Klondike 規則**：52 張牌、7 欄 Tableau（1~7 張遞增發牌、每欄僅最下面一張正面）、Stock／Waste（**Draw 1**，本專案無既有 Solitaire 規格，採用業界最常見預設）、4 個依花色由 A 到 K 排列的 Foundation。
  - **Tableau 移動規則**：交替顏色＋點數遞減才能疊放；合法的連續牌組（如 黑K-紅Q-黑J）可整組搬動；空欄只能放 K（或以 K 開頭的合法牌組）。
  - **Stock 循環**：Stock 抽完後，Waste 可重新洗回 Stock 繼續抽，**次數不限**（見 design.md 計分漏洞說明）。
  - **自動翻牌**：Tableau 某欄最下面的正面牌被移走後，下面若還有反面牌，自動翻正面。
  - **點擊操作**：第一次點擊選取一張牌（或合法的連續牌組），第二次點擊目標區嘗試移動；雙擊嘗試自動移動到合法的 Foundation
  - **Game State**：`ready → playing ⇄ pause → win` 或 `→ gameover`（Solitaire 沒有「輸」的判定條件，`gameover` 只會由玩家主動結束/離開觸發，見 design.md）
  - **HUD**：SCORE／MOVES／TIME（比照 MINESWEEPER 的「非 tick-driven、1 秒計時器」做法，不需要 16ms tick loop）
  - **計分**：合法移動 +5、翻出「這局第一次」正面的牌 +10、移到 Foundation +10、完成遊戲 Bonus +200（見 design.md，含防刷分說明）
  - 掛載共用 `GameRateDialog`／`GameRuleDialog`，主題色採全新配色（`#2ecc71` 撲克綠，跟現有十一款遊戲皆不撞色）
- 新增純邏輯核心 `app/utils/solitaireEngine.ts`（不依賴 Vue），比照 `match3Engine.ts` 先例，內含牌組資料結構、發牌／洗牌、規則驗證（`tryMove`／`tryAutoMoveToFoundation`／`checkWin`）
- 新增共用牌面元件 `app/components/PlayingCard.vue`（純呈現，props: suit/rank/faceUp/selected），供 Tableau/Foundation/Stock/Waste 四處共用，純 CSS/Text 畫牌面、不用圖片素材
- 新增 server 端服務檔 `server/services/game/retro/solitaire.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 的 `retroGamesInit()` 註冊
- 新增 server 端 API 路由 `server/api/games/retro/solitaire/history.{get,post,delete}.ts`，比照既有樣板
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'solitaire'`，`api.games.retro` 新增對應 3 個函式
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支
- `app/components/GameHistoryDialog.vue` 的篩選 tab／摘要卡／遊戲名稱對照擴充一筆
- `app/config/gameSprites.ts` 新增一筆（icon 🃏），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用
- `app/pages/game-hall.vue` 新增一筆 `id: 12`、`name: 'SOLITAIRE'`、`status: 'open'` 的卡片

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `solitaire` 這個新的 `gameKey`；`score` 語意為「合法移動／翻牌／上疊 Foundation 的事件加分＋完成獎勵」，`meta` 欄位額外記錄 `moves`／`elapsedSeconds`，是本次唯一同時記錄 moves 與時間的遊戲。

## Impact

- 新增檔案（client）：`app/pages/game/solitaire.vue`、`app/utils/solitaireEngine.ts`、`app/components/PlayingCard.vue`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/solitaire.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（`retroGamesInit()` 新增註冊）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 首度把遊戲規則核心拆到 `app/utils/`（第二個這樣做的遊戲，第一個是 match3 系列）；操作方式維持全專案「零拖曳」的既有慣例
- 不影響既有十一款遊戲的程式碼與行為
