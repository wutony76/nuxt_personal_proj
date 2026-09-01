## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/tower-stack.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.14`、`coinCapPerRun: 110`、`coinDailyCap: 100000`、`maxReasonableScore(): 20000`——開放式計分的寬鬆防呆上限，見 design.md Decision 5）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroTowerStackClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/tower-stack/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十六款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'towerStack'`，`api.games.retro` 新增對應 3 個函式（historyTowerStack／recordTowerStack／clearTowerStack）

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/towerStackEngine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Layer`／`MovingBlock`／`FallingPiece`／`GamePhase`，`TOWER_STACK_CONFIG`（`blockSpeed`／`speedIncrease`／`maxSpeed`／`perfectThreshold`／`baseScorePerLayer`／`perfectBonus`／`comboBonusStep`／`comboBonusCap`，全部集中管理，見 design.md Decision 5）
- [ ] 5.2 Overlap Detection：`detectOverlap(layer, block)` 一維區間交集運算，回傳 `overlapLeft`／`overlapRight`／`overlapWidth`（見 design.md Decision 1）
- [ ] 5.3 Block Resize：`resizeBlock(layer, block, overlap)` 依交集計算新層寬度／位置，同時作為下一顆 moving block 的初始寬度（見 design.md Decision 2）
- [ ] 5.4 Perfect／Combo 判定：`checkPerfect(layer, overlap, perfectThreshold)`，Perfect 時維持原寬並回傳 combo 加分；非 Perfect 時 combo 歸零（見 design.md Decision 4）
- [ ] 5.5 Falling Piece 產生與更新：`spawnFallingPiece()` 依 Block Resize 判定出的懸空矩形建立碎片物件（初始位置／`vy`），`updateFallingPieces()` 每 tick 以固定重力常數更新位置，離開舞台或超過生命週期即從陣列移除（見 design.md Decision 3）
- [ ] 5.6 Moving Block 位移與難度遞增：`stepMovingBlock()` 依 `blockSpeed` 左右來回移動，抵達邊界反彈；`applyDifficulty()` 每次成功疊放後依 `speedIncrease` 遞增速度並以 `maxSpeed` 封頂
- [ ] 5.7 Game Over 判定：`overlapWidth <= 0` 時判定完全沒有重疊，回傳 Game Over 結果
- [ ] 5.8 `TowerStackEngine` class：整合 5.1~5.7，提供 `reset()`、`dropBlock()`（觸發 Overlap Detection → Perfect 判定 → Block Resize/Falling Piece → 難度遞增的完整流程）、`step()`（tick 驅動 moving block 位移與 falling piece 更新）、`getSnapshot()`（回傳塔身層陣列、moving block、falling pieces、分數、combo、phase）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/tower-stack.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 BREAKOUT 慣例）
- [ ] 6.2 塔身與方塊渲染：`v-for` + `position: absolute` 純 CSS 矩形，塔身容器用 `transform: translateY()` 做鏡頭下移（比照 BREAKOUT 磚塊渲染模式，見 design.md Decision 6）
- [ ] 6.3 Moving Block 動畫：單一 tick timer 驅動水平來回移動，抵達邊界反彈
- [ ] 6.4 Drop 互動：點擊舞台／`Space`／觸控皆呼叫同一個 `dropBlock()` 動作，三種輸入零拖曳
- [ ] 6.5 Falling Piece 視覺：比照 `breakout.vue` 的 `particles` 陣列渲染模式（`v-for` + 即時位置樣式綁定），每 tick 隨 engine snapshot 更新位置，離開畫面後從陣列移除（見 design.md Decision 3）
- [ ] 6.6 Perfect／Combo 視覺提示：Perfect 觸發時顯示短暫通知文字（如 `PERFECT!` `COMBO x3`），非 Perfect 疊放時 Combo 歸零並隱藏提示
- [ ] 6.7 HUD：SCORE／HEIGHT（塔高層數）／COMBO／目前 `blockSpeed` 對應的難度提示
- [ ] 6.8 Game Over：`overlapWidth <= 0` 時顯示 `GAME OVER` overlay，呼叫 `useGameHistory().actions.record()`（`score` 依 design.md Decision 5 規則，`meta` 記錄 `maxCombo`／`perfectCount`／`finalWidthRatio`）
- [ ] 6.9 Restart：完整重置塔身層陣列／moving block／falling pieces／combo／分數／`blockSpeed`／phase，不殘留上一局資料（需求「Restart」項目）
- [ ] 6.10 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停用 Drop 互動且 tick timer 暫停
- [ ] 6.11 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#118ab2`（藍色，不與現有十六款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 23, name: 'TOWER STACK', status: 'open', path: '/game/tower-stack' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'towerStack'`, `icon: '🗼'`, `anim: ` 依 `GameSpriteAnim` 既有列舉挑選合適動畫類型, `glow: '#118ab2'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試 Moving Block 來回移動與邊界反彈是否正常
- [ ] 9.2 實測 Drop：點擊／`Space`／觸控皆能觸發落下，且三種輸入行為一致
- [ ] 9.3 實測 Overlap Detection／Block Resize：位置偏移時新層寬度與位置正確依交集計算，塔身確實變窄
- [ ] 9.4 實測 Falling Piece：未重疊部分正確產生掉落碎片動畫，離開畫面後從陣列移除、不殘留
- [ ] 9.5 實測 Perfect／Combo：偏移在 `perfectThreshold` 內時維持原寬並累積 Combo 加分，非 Perfect 疊放正確中斷 Combo
- [ ] 9.6 實測 Difficulty Increase：`blockSpeed` 隨疊放次數遞增，且不超過 `maxSpeed`
- [ ] 9.7 實測 Game Over：完全沒有重疊時立即結束遊戲，不會誤判仍有微小重疊的情況
- [ ] 9.8 實測 Restart：確認完整重置，不殘留上一局的塔身/方塊/Combo/分數/速度狀態
- [ ] 9.9 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確，暫停期間 Drop 無效
- [ ] 9.10 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.11 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.12 `GameHistoryDialog` 篩選 tab 能正確顯示 `TOWER STACK` 紀錄與統計
- [ ] 9.13 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/tower-stack`
- [ ] 9.14 確認沒有 Console Error，不影響其他既有遊戲
- [ ] 9.15 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
