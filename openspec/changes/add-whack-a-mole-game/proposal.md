## Why

遊戲中心目前十六款遊戲涵蓋動作／反應（射擊、跑酷）、消除（match3 系列、orb match）、解謎（minesweeper）、策略規劃（solitaire）、對戰（battleship）等類型，但沒有一款是最經典的「純反應速度」小遊戲：畫面隨機出現目標、玩家在極短時間內點擊命中即可得分。新增 WHACK-A-MOLE（打地鼠）補齊這個空缺：3×3 洞穴格中地鼠隨機出現，玩家快速點擊擊中得分，60 秒倒數計時內累積最高分，且隨時間推移地鼠停留時間逐漸縮短、難度遞增。玩法單純、低美術需求，不使用外部圖片，沿用既有 CSS/DOM Grid 渲染慣例。

## What Changes

- 新增遊戲頁面 `app/pages/game/whack-a-mole.vue`（**WHACK-A-MOLE**）：
  - **3×3 洞穴格**：比照 MINESWEEPER 的 `flatCells` computed 攤平＋`grid-template-columns: repeat(3, var(--cell))` 渲染模式，9 個洞穴格以像素風 CSS Shape（無外部圖片）呈現「空／地鼠冒出」兩種視覺狀態。
  - **單一地鼠回合制生成**：MVP 同一時間畫面上最多只有一隻地鼠（見 design.md Decision 1），比照 `runner.vue` 的「定時＋隨機」生成先例，拆成兩個獨立計時器：
    - **Spawn Timer**：地鼠消失（被擊中或逾時）後，等待一段隨機間隔，再從 9 個洞穴中隨機挑一個生成下一隻地鼠。
    - **Lifetime Timer**：地鼠生成當下，隨機賦予一段存活時間，逾時未被擊中則自動消失（不計分、不扣分）。
  - **難度隨時間遞增**：以「已經過的遊戲時間」為輸入，動態計算「目前地鼠存活時間上限」，隨時間增加而遞減至一個下限值後打平（見 design.md Decision 3 的公式），Spawn 間隔上限同步小幅縮短。
  - **點擊／觸控輸入**：滑鼠 `click` 與觸控 `touchstart` 皆可擊中地鼠，比照全專案既有慣例不分平台特殊處理。
  - **Score／Combo**：擊中地鼠得基礎分 × Combo 倍率；Combo 直接沿用 `typing.vue` 的 `calcMultiplier(combo)` 分段模式（`COMBO_THRESHOLDS`／`COMBO_MULTIPLIERS` 兩個平行陣列），連續命中 combo 遞增、點錯歸零。
  - **點錯處理**：點擊沒有地鼠的洞穴（含地鼠剛消失的殘影格）判定為 miss，**不加分、不扣分，但 combo 歸零**（取捨見 design.md Decision 4）。
  - **Timer／Game Over**：60 秒倒數計時，時間歸零時立即進入 Game Over，停用所有輸入並顯示最終分數。
  - **Restart／Pause**：Restart 完整重置洞穴狀態／Spawn Timer／Lifetime Timer／Score／Combo／倒數計時，不殘留上一局資料；Pause（ESC／P）暫停時停用輸入且不消耗 Timer、Spawn、Lifetime。
  - **Pixel UI**：像素風邊框／字型，主題色採 `#a0522d`（棕色，呼應地鼠泥土色調），掛載共用 `GameRateDialog`／`GameRuleDialog`。
- 新增純邏輯核心 `app/utils/whackAMoleEngine.ts`（不依賴 Vue），內含洞穴狀態／Spawn／Lifetime／難度公式／Score／Combo 邏輯，供頁面以 `getSnapshot()` 同步進 `reactive()` state。
- 新增 server 端服務檔 `server/services/game/retro/whackAMole.ts`，繼承既有 `RETRO_GAME_BASE`（`coinRate`／`coinCapPerRun`／`coinDailyCap: 100000`／`maxReasonableScore()`，估算見 design.md Decision 5），並在 `server/services/storage.ts` 的遊戲初始化區塊新增註冊。
- 新增 server 端 API 路由 `server/api/games/retro/whack-a-mole/history.{get,post,delete}.ts`，比照既有樣板。
- `app/services/api.ts` 的 `RetroGameKey` 擴充新增 `'whackAMole'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個新分支。
- `app/components/GameHistoryDialog.vue` 的篩選 tab／`GAME_KEYS`／遊戲名稱對照擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（icon 🐹，glow `#a0522d`），連帶 `GameMachineCard.vue`／`GameHallSprites.vue` 自動套用。
- `app/pages/game-hall.vue` 新增一筆 `id: 21`、`name: 'WHACK-A-MOLE'`、`status: 'open'`、`path: '/game/whack-a-mole'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `whackAMole` 這個新的 `gameKey`；`score` 語意為「累積擊中次數 × 當下 Combo 倍率」的加總，是一個表現越好分數越高的開放區間值（沒有像 battleship 那樣的固定上限），估算「一場優秀表現」落在數百到一千多分之間（見 design.md Decision 5）。

## Impact

- 新增檔案（client）：`app/pages/game/whack-a-mole.vue`、`app/utils/whackAMoleEngine.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/game-hall.vue`
- 新增檔案（server）：`server/services/game/retro/whackAMole.ts`、對應 3 支 API 路由檔
- 修改檔案（server）：`server/services/storage.ts`（遊戲初始化區塊新增 `new RetroWhackAMoleClass()`）
- 不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 本次僅實作單一地鼠、Random 生成位置與存活時間；特殊地鼠（金地鼠加倍分／炸彈地鼠扣分）列為 Non-Goal，留待下一個變更（見 design.md）
- 不影響既有十六款遊戲（snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship）的程式碼與行為
- `game-hall.vue` 的 `gameSlots` 註冊為 `id: 21`（既有最後一筆為 `id: 16`，中間 id 17~20 保留給其他規劃中變更使用，本次不佔用）
