## Why

遊戲中心目前的 26 款遊戲都是「單一畫面內完成一局」的輕量小品，尚未有一款具備「物理彈跳＋雙 Flipper 操作＋Combo／Fever 高潮＋Roguelite 局內成長」的深度動作遊戲。使用者明確要求新增 **PINBALL**（像素風彈珠台 + Roguelite），並提出非常明確的優先順序：**手感／物理／操作反饋／Combo/Fever/Risk-Reward 優先於美術**，且**禁止 Canvas／WebGL**，一律以 DOM + CSS transform 呈現，物理與美術分階段（Phase 1～5）逐步疊加。

本次直接進入實作（使用者已明確授權「先建 spec、之後直接開始實作，方向錯了之後再調整」），不採用其餘既有 `add-*-game` 提案「本次僅產出文件、等待核准」的保守流程。

## What Changes

- 新增遊戲頁面 `app/pages/game/pinball.vue`（**PINBALL**）：
  - 固定 Virtual Coordinate 桌面（360×640，9:16），外層以 `ResizeObserver` 計算等比例 `transform: scale()` 置中顯示，讓物理運算永遠在同一組座標下進行，不因裝置尺寸不同而改變手感（見 design.md Decision 1）。
  - 雙 Flipper（左 `A`/`ArrowLeft`、右 `D`/`ArrowRight`）：非圖片旋轉，而是「角度隨按鍵朝目標角度插值擺動＋碰撞時依撞擊點與擺動角速度給予反彈/擊退」的真實手感（見 Decision 3）。
  - `Space` 發球（Launcher／Plunger 機制）。
  - 3 個 Bumper（強力反彈＋Score+100＋Combo+1＋縮放/閃爍/Screen Shake/Score Popup）、4 個 Target（A/B/C/D，命中即亮起＋Score+200＋Combo+1，全部點亮觸發 Fever）、1 個 Golden Hole（高風險位置，進入＋Score+1000＋Combo+3＋Coins+5，不消耗生命，會把球重新彈回場上，見 Decision 5）、Death Zone（掉出雙 Flipper 之間即扣一命）。
  - Combo 系統：命中有效目標 Combo+1 並重置倒數，倒數歸零或掉球即重置；分數＝基礎分 × Combo 倍率（見 Decision 4）。
  - Fever（4 個 Target 全亮觸發，持續 10 秒）：Score×3、Combo 倒數視窗放大、Bumper 擊退加成、UI `FEVER!` 提示，結束後重置 Target 狀態。
  - 3 顆球一輪，掉球後（若還有剩餘球）顯示 3 選 1 隨機 Upgrade（12 選項集中於設定表，見 Decision 6），選擇後立即套用並重新發球；生命歸零進入 `GAME OVER`。
  - 沿用既有全站遊戲慣例：`setInterval(16ms)` 驅動 game loop（非 `requestAnimationFrame`，見 Decision 2）、`reactive()` snapshot 鏡像 engine 狀態、`GameRateDialog`／`GameRuleDialog` 掛載、ESC/P 暫停、waiting/result overlay 流程、Sound Manager 介面先接 `playSound(name)`，內部以 Web Audio API 產生簡單音效（不下載音效素材）。
  - 主題色 `#00f5d4`（螢光薄荷綠，全站尚未使用），HUD 走「黑底＋硬邊像素風」，不使用漸層與外部圖片。
- 新增純邏輯核心 `app/utils/pinballEngine.ts`（不依賴 Vue）：內部依職責分節（Physics／Flipper／Bumper／Target／SpecialHole／Combo／Fever／Upgrade／Score），比照其餘 `*Engine.ts` 慣例整支收斂為單一 class，數值集中於檔案頂部常數表，不寫死在各物件方法內。
- 新增 server 端服務檔 `server/services/game/retro/pinball.ts`，繼承既有 `RETRO_GAME_BASE`，並在 `server/services/storage.ts` 註冊。
- 新增 server 端 API 路由 `server/api/games/retro/pinball/history.{get,post,delete}.ts`，比照既有樣板；`/api/games` 前綴已受 `server/middleware/auth.ts` 保護，不需修改。
- `app/services/api.ts` 的 `RetroGameKey` 擴充 `'pinball'`，`api.games.retro` 新增對應 3 個函式。
- `app/composables/useGameHistory.ts` 的 `GAME_KEYS` 與 `_handlers.gameApi()` 擴充一個分支。
- `app/components/GameHistoryDialog.vue` 的 `FILTERS`／`GAME_KEYS`／`GAME_NAME` 各擴充一筆。
- `app/config/gameSprites.ts` 新增一筆（`icon: '🎱'`、`anim: 'bounce'`、`glow: '#00f5d4'`）。
- `app/pages/admin/games.vue` 的 `PLAY_PATHS` 新增一筆 `pinball: '/game/pinball'`（後台 coin 兌換率管理自動涵蓋新遊戲）。
- `app/pages/game-hall.vue` 新增一筆 `id: 26`、`name: 'PINBALL'`、`status: 'open'`、`path: '/game/pinball'` 的卡片。

## Capabilities

### Modified Capabilities

- `game-history`：既有的遊戲紀錄／coin 轉換能力擴充支援 `pinball` 這個新的 `gameKey`；`score` 為 Combo 加權後的累積分數，`meta` 額外記錄 `maxCombo`／`feverCount`／`coinsCollected`（局內 Golden Hole／Bumper／Fever 掉落的「趣味幣」，僅顯示用途，與帳號等級的 coin 經濟是兩個獨立概念，見 design.md Decision 7）供統計呈現。

## Impact

- 新增檔案（client）：`app/pages/game/pinball.vue`、`app/utils/pinballEngine.ts`
- 新增檔案（server）：`server/services/game/retro/pinball.ts`、`server/api/games/retro/pinball/history.{get,post,delete}.ts`
- 修改檔案（client）：`app/services/api.ts`、`app/composables/useGameHistory.ts`、`app/components/GameHistoryDialog.vue`、`app/config/gameSprites.ts`、`app/pages/admin/games.vue`、`app/pages/game-hall.vue`
- 修改檔案（server）：`server/services/storage.ts`
- 不影響其餘 26 款既有遊戲的程式碼與行為；不涉及資料庫，沿用既有 in-memory `Storage.retroGames` 架構
- 不建立永久商店／排行榜／成就／多張地圖／Boss，符合開發原則中「MVP 優先」的範圍限制
