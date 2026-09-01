## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/frogger.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.05`、`coinCapPerRun: 140`、`coinDailyCap: 100000`、`maxReasonableScore(): 5000`——依「一場優秀表現清完 2~3 輪約 100 coin」估算，見 design.md Open Questions，上線後應實測校準）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroFroggerClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/frogger/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有 16 款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'frogger'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/froggerEngine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`LaneType`／`Direction`／`LaneConfig`／`LaneEntity`／`PlayerState`／`GameStatus`／`HazardResult`；`GRID_COLS = 11`、`GRID_ROWS = 13`、`GOAL_SLOT_COLS = [0, 2, 5, 8, 10]`、`LANE_CONFIGS`（5 條 ROAD + 5 條 RIVER，各自 `direction`/`baseSpeed`/`entityLength`/`gap`）、`LIVES_START = 3`、`HOP_SCORE = 10`、`GOAL_SCORE = 200`、`LEVEL_CLEAR_BONUS = 500`、`TICK_MS = 50`、`SPEED_GROWTH_PER_LEVEL`／`GAP_SHRINK_PER_LEVEL`／`MIN_GAP`，全部集中於檔案頂部（需求「集中設定」，見 design.md Decision 6）
- [ ] 5.2 Grid／座標工具：`rowType(row)`、`isInBounds(row, col)`、`createHomePosition()`
- [ ] 5.3 Lane 實體產生與 tick：`generateLaneEntities(config, level)`（依 `entityLength + gap` 週期均勻分佈初始實體）、`advanceLane(entities, config, level, dtMs)`（浮點座標累加 + wrap-around 循環，見 design.md Decision 3）、`getOccupiedCols(entity)`
- [ ] 5.4 Player 移動：`movePlayer(state, direction)`——邊界檢查、GOAL 列蓮花座命中判定、離散移動後重置 `raftCol`，回傳移動後的新座標（不含 hazard 判定，hazard 統一交給 5.5）
- [ ] 5.5 共用碰撞/落水/漂移判定：`resolveHazard(state)`——依玩家所在列的 `LaneType` 分流 ROAD 撞車／RIVER 落水與平台跟隨（`raftCol` 累加，見 design.md Decision 4）／GOAL 蓮花座命中或落水／HOME、MEDIAN 恆安全；供 `movePlayer()` 與 `tick()` 共用同一份判定（見 design.md Decision 5）
- [ ] 5.6 Level／難度：`getLaneSpeedForLevel(config, level)`、`getLaneGapForLevel(config, level)`（`Math.max`/`Math.min` 夾限）；5 個蓮花座全部佔用時 `level += 1` 並呼叫 5.3 重建全部車道實體、蓮花座重置為空、`+LEVEL_CLEAR_BONUS`
- [ ] 5.7 `FroggerEngine` class：整合 5.1~5.6，提供 `tick(dtMs)`（驅動所有車道 + 呼叫 `resolveHazard()`）、`move(direction)`（驅動玩家 + 呼叫 `resolveHazard()`）、`reset()`、`getSnapshot()`（回傳 Grid／車道實體／玩家位置／蓮花座佔用／Life／Score／Level／GameStatus 快照）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/frogger.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 MINESWEEPER／BATTLESHIP 慣例）
- [ ] 6.2 Grid 渲染：地形（HOME/ROAD/MEDIAN/RIVER/GOAL）+ 車道實體 + 玩家三層疊加後的 `flatCells` computed 攤平 + `v-for` + `grid-template-columns: repeat(11, var(--cell))`（比照 MINESWEEPER 慣例）
- [ ] 6.3 NPC tick 迴圈：`setInterval(TICK_MS)` 呼叫 `engine.tick(dtMs)` 並同步回 `reactive()` state；`state.status !== 'PLAYING'` 時 tick callback 提前 return（Pause 期間不需要真的清除/重建 interval，見 design.md Risks）
- [ ] 6.4 Player 輸入：`window.addEventListener('keydown', ...)` 綁定方向鍵/WASD，`onUnmounted` 解綁；呼叫共用 `click.dir(direction)` → `engine.move(direction)`
- [ ] 6.5 Touch 輸入：比照 `pac-man.vue` 的 `pm-keypad` on-screen 四方向按鈕先例，新增同樣的四方向按鈕，`@click="click.dir(...)"` 呼叫與鍵盤相同的處理函式，不重複寫兩份移動邏輯
- [ ] 6.6 河流平台跟隨視覺：玩家站在浮木上時，渲染位置需反映 `raftCol` 隨浮木漂移的即時欄位（見 design.md Decision 4）
- [ ] 6.7 HUD：LIVES／SCORE／LEVEL／蓮花座佔用狀態（5 格圖示，已佔用/未佔用）
- [ ] 6.8 撞車／落水／蓮花座命中提示：短暫通知文字（如 `SPLASH!`／`SQUISHED!`／`HOME!`），比照 `pac-man.vue` 的 `flashLevelToast` 先例
- [ ] 6.9 Game Over：`GAME OVER` overlay，呼叫 `useGameHistory().actions.record()`（`score` 依 design.md Decision 6 規則持續累計，`meta` 記錄 `roundsCleared`／`goalsFilled`）
- [ ] 6.10 Restart：完整重置 Grid／車道實體／玩家位置／蓮花座佔用狀態／Life／Score／Level／GameStatus，不殘留上一局資料（需求「Restart」）
- [ ] 6.11 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停用 Grid 互動且 NPC tick 不推進進度
- [ ] 6.12 掛載共用 `GameRateDialog` / `GameRuleDialog`（說明蓮花座是終點列唯一安全落點），`accent-color` 採 `#52b788`（森林綠，不與現有 16 款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 19, name: 'FROGGER', status: 'open', path: '/game/frogger' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'frogger'`, `icon: '🐸'`, `anim: 'hop'`, `glow: '#52b788'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試 Grid 是否正確顯示 13 列（HOME/ROAD×5/MEDIAN/RIVER×5/GOAL）與 5 個蓮花座
- [ ] 9.2 實測玩家離散移動：按方向鍵/觸控按鈕才移動一格，沒有輸入時完全靜止、不會自動前進
- [ ] 9.3 實測車輛連續 tick：5 條車道各自方向/速度正確、車輛超出畫面邊界時從另一側 wrap-around 出現
- [ ] 9.4 實測撞車判定：玩家所在格與車輛佔用格重疊時扣 1 命並重置回起點
- [ ] 9.5 實測河流落水與平台跟隨：玩家站上浮木後座標隨浮木漂移，浮木漂走導致腳下淨空時判定落水；跳進無浮木水域立即判定落水
- [ ] 9.6 實測終點判定：跳進未佔用蓮花座記為佔用並重置回起點，跳進已佔用蓮花座或終點列非蓮花座欄位視為落水
- [ ] 9.7 實測一輪完成：5 個蓮花座全部佔用後 `level += 1`、車道速度變快/間距變小、蓮花座重置為空、`+LEVEL_CLEAR_BONUS`
- [ ] 9.8 實測 Life 歸零：命數歸零正確顯示 `GAME OVER` 並停止 NPC tick
- [ ] 9.9 實測計分：HOP/GOAL/LEVEL CLEAR 正確累加，且分數在單命內因撞車/落水不會重置
- [ ] 9.10 實測 Restart：確認完整重置，不殘留上一局的 Grid/車道實體/玩家位置/蓮花座/分數/命數/等級
- [ ] 9.11 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確，暫停期間 NPC 不推進
- [ ] 9.12 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.13 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.14 `GameHistoryDialog` 篩選 tab 能正確顯示 `FROGGER` 紀錄與統計
- [ ] 9.15 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/frogger`
- [ ] 9.16 確認沒有 Console Error，不影響其他 16 款遊戲
- [ ] 9.17 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
