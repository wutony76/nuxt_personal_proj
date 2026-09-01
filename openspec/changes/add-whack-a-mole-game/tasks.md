## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/whackAMole.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.08`、`coinCapPerRun: 150`、`coinDailyCap: 100000`、`maxReasonableScore(): 6000`——貼齊理論極限值估算，見 design.md Decision 6）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroWhackAMoleClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/whack-a-mole/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十六款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'whackAMole'`，`api.games.retro` 新增對應 3 個函式（`historyWhackAMole`／`recordWhackAMole`／`clearWhackAMole`）

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/whackAMoleEngine.ts`，不依賴 Vue）

- [ ] 5.1 型別與常數：`Hole`／`GameStatus`，`HOLE_COUNT = 9`、`GAME_DURATION_SEC = 60`、難度公式常數（`LIFETIME_CEILING_START_MS`／`LIFETIME_CEILING_MIN_MS`／`LIFETIME_DECAY_PER_SEC`／`SPAWN_CEILING_START_MS`／`SPAWN_CEILING_MIN_MS`／`SPAWN_DECAY_PER_SEC`）、Combo 常數（`COMBO_THRESHOLDS`／`COMBO_MULTIPLIERS`，與 `typing.vue` 相同數值）、`HIT_BASE_SCORE = 10`，全部集中管理（需求「Timer、Spawn、Score、Game State 分離」原則）
- [ ] 5.2 難度公式函式：`currentLifetimeCeiling(elapsedMs)`／`currentSpawnCeiling(elapsedMs)`（見 design.md Decision 3），依已過遊戲時間動態計算目前上限，並隨機取上限的 60%~100% 作為實際數值
- [ ] 5.3 Spawn 邏輯：`scheduleSpawn(elapsedMs)`——`setTimeout` 排程下一次 `spawnMole()`；`spawnMole()`——從目前所有 `moleActive === false` 的洞穴中隨機挑一個，設定 `moleActive = true`、`moleSpawnedAt`，並呼叫 `scheduleLifetime()`
- [ ] 5.4 Lifetime 邏輯：`scheduleLifetime(holeIndex, elapsedMs)`——`setTimeout` 排程 `expireMole(holeIndex)`；`expireMole(holeIndex)`——若該格仍是同一隻未被擊中的地鼠，設回 `moleActive = false`（不計分、不扣分），並呼叫 `scheduleSpawn()`
- [ ] 5.5 Combo／Score：`calcMultiplier(combo)`（比照 `typing.vue` 模式）；`hitHole(holeIndex)`——若命中，`score += HIT_BASE_SCORE * multiplier`、`combo += 1`、清除該格與其 Lifetime Timer、呼叫 `scheduleSpawn()`；若未命中（miss），`combo = 0`，`score` 不變（見 design.md Decision 5）
- [ ] 5.6 Game State／Timer：`start()`／`pause()`／`resume()`／`restart()`——完整重置洞穴陣列、兩個計時器代碼、Score、Combo、剩餘秒數；`tickGameTimer()` 每秒遞減剩餘秒數，歸零時呼叫 `gameOver()`（清除所有計時器，`status = 'gameover'`）
- [ ] 5.7 `WhackAMoleEngine` class：整合 5.1~5.6，提供 `getSnapshot()`（回傳洞穴陣列快照＋score／combo／multiplier／剩餘秒數／status）供頁面同步進 `reactive()` state

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/whack-a-mole.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 MINESWEEPER 慣例）
- [ ] 6.2 3×3 洞穴渲染：比照 MINESWEEPER 的 `flatCells` computed 攤平 + `v-for` + `grid-template-columns: repeat(3, var(--cell))`
- [ ] 6.3 地鼠視覺：純 CSS Shape（無外部圖片）呈現「空洞穴／地鼠冒出」兩種狀態，簡單 `transform`/`opacity` transition 做冒出與縮回動畫
- [ ] 6.4 輸入處理：洞穴格 `@click` 綁定 `clickHole(index)`，`playing` 狀態下才回應點擊；確認點擊事件在觸控裝置上正常觸發、無明顯延遲
- [ ] 6.5 HUD：SCORE／COMBO x{multiplier} ({combo})／剩餘秒數，比照 `typing.vue` 的 HUD 呈現方式
- [ ] 6.6 Game Over：`state.status === 'gameover'` overlay 顯示最終分數，呼叫 `useGameHistory().actions.record()`（`gameKey: 'whackAMole'`）
- [ ] 6.7 Restart：完整重置洞穴／Timer／Spawn／Lifetime／Score／Combo／剩餘秒數，不殘留上一局資料
- [ ] 6.8 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`；暫停期間停用洞穴點擊且不消耗 Game Timer／Spawn Timer／Lifetime Timer
- [ ] 6.9 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#a0522d`（棕色，不與現有十六款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 21, name: 'WHACK-A-MOLE', status: 'open', path: '/game/whack-a-mole' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'whackAMole'`, `icon: '🐹'`, `anim: 'hop'`, `glow: '#a0522d'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [ ] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試地鼠生成：地鼠隨機出現於任一空洞穴，同一時間最多只有一隻
- [ ] 9.2 實測 Spawn Timer：地鼠消失後間隔一段隨機時間才會出現下一隻，不會瞬間連續生成
- [ ] 9.3 實測 Lifetime Timer：地鼠逾時未被擊中會自動消失，且不計分、不扣分
- [ ] 9.4 實測滑鼠點擊與觸控點按皆能正確擊中地鼠
- [ ] 9.5 實測 Score／Combo：連續命中 combo 遞增、倍率隨 `COMBO_THRESHOLDS` 分段提高；點錯（含空洞穴／已消失地鼠格）combo 歸零、分數不變
- [ ] 9.6 實測難度遞增：遊戲後段地鼠存活時間明顯比開局短，Spawn 間隔也略為縮短
- [ ] 9.7 實測 60 秒倒數：時間歸零立即 Game Over，停用所有輸入
- [ ] 9.8 實測 Restart：確認完整重置，不殘留上一局的洞穴/計時器/分數/combo 狀態
- [ ] 9.9 實測 Pause：ESC/P 觸發暫停，`[RESUME]`/`[RESTART]`/`[EXIT]` 行為正確，暫停期間不消耗任何計時器
- [ ] 9.10 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.11 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.12 `GameHistoryDialog` 篩選 tab 能正確顯示 `WHACK-A-MOLE` 紀錄與統計
- [ ] 9.13 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/whack-a-mole`
- [ ] 9.14 確認沒有 Console Error，不影響其他既有十六款遊戲
- [ ] 9.15 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
