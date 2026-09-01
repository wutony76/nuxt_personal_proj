> 以下任務為**未來實作階段**（待使用者核准 design.md 的架構方案後）的規劃清單；本次 OpenSpec 提案僅完成文件本身（見第 8 節），不執行第 1～7、9 節的任何項目。

## 1. Server 端服務層

- [ ] 1.1 新增 `server/services/game/retro/arkanoid.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.01`、`coinCapPerRun: 150`、`coinDailyCap: 100000`、`maxReasonableScore(): 20000`——設計階段估算值，見 design.md Decision 6）
- [ ] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroArkanoidClass()`

## 2. Server 端 API 路由

- [ ] 2.1 新增 `server/api/games/retro/arkanoid/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有十六款遊戲樣板）
- [ ] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [ ] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'arkanoid'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [ ] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/arkanoidEngine.ts`，不依賴 Vue，視 Open Questions 決議是否與 breakout 共用底層）

- [ ] 5.0 **前置決策**：實作前先與使用者確認 design.md Open Questions 的共用/獨立架構方案（a/b/c）；本清單以方案 (b)（獨立實作、不動 `breakout.vue`）為預設路徑撰寫，若使用者選擇 (a) 或 (c)，本節任務需對應調整
- [ ] 5.1 型別與常數：`Paddle`／`Ball`／`Brick`／`PowerUp`／`GameState`，`BRICK_HIT_POINTS_BY_TIER`、`MULTI_BALL_MAX = 4`、`POWER_UP_DROP_RATE = 0.15`、`POWER_UP_DURATION_MS = 8000`、分數常數（基礎分/Multi-Hit 加成/Combo 倍率門檻，見 design.md Decision 2／6），全部集中管理
- [ ] 5.2 Paddle／Ball 基礎物理：擋板 clamp 移動、球的牆面反彈、球與擋板反彈角度計算（沿用 BREAKOUT 規則，見 design.md 可重用模組）
- [ ] 5.3 Collision：球與磚塊 AABB 碰撞、球與擋板碰撞、擋板與掉落中 Power-Up 膠囊碰撞（共用同一套 AABB 工具）
- [ ] 5.4 Brick／Brick Pattern：磚塊資料結構（含 `hitPoints`）、命中遞減判定（`hitPoints -= 1`，歸零才摧毀，見 design.md Decision 2）、關卡 Pattern 佈局產生器
- [ ] 5.5 Moving Brick：`moving` 欄位（`minX`/`maxX`/`speed`/`direction`）、每 tick 更新位置並於邊界反向（見 design.md Decision 3），限制在磚塊自身所屬欄位範圍內
- [ ] 5.6 Power-Up：掉落產生（磚塊摧毀時依機率）、下落更新、拾取判定、`WIDE`／`SLOW` 限時效果與倒數、`MULTI_BALL` 即時分裂邏輯（見 design.md Decision 4，FIRE 留待下一版）
- [ ] 5.7 Multi Ball：`balls: Ball[]` 陣列管理（新增/移除球）、對每顆球分別執行 5.2/5.3 判定、`balls.length === 0` 才觸發失去一命（見 design.md Decision 5）
- [ ] 5.8 Score／Combo：基礎分數＋Multi-Hit 層數加成＋Combo 連段倍率（碰到擋板或失去一命即重置，見 design.md Decision 6）
- [ ] 5.9 Level System：清光可摧毀磚塊即進下一關，關卡門檻觸發 Moving Brick 出現（見 design.md MVP 順序）
- [ ] 5.10 `ArkanoidEngine` class：整合 5.1～5.9，提供 `reset()`、`getSnapshot()`（回傳擋板/球陣列/磚塊/Power-Up/分數/關卡/生命/Combo 快照）

## 6. 遊戲頁面與互動流程

- [ ] 6.1 `app/pages/game/arkanoid.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照 BREAKOUT／MINESWEEPER 慣例）
- [ ] 6.2 沿用 BREAKOUT 既有 waiting/ready/countdown/result overlay 流程與 `setInterval` tick + `keydown`/`keyup` 輸入模式
- [ ] 6.3 磚塊渲染：依 `hitPoints` 剩餘層數切換樣式（顏色/裂痕），Moving Brick 位置隨 tick 更新
- [ ] 6.4 Power-Up 視覺：掉落膠囊圖示（emoji，不使用外部圖片）、擋板接住的拾取回饋、HUD 顯示生效中效果與倒數（WIDE/SLOW）
- [ ] 6.5 Multi Ball 渲染：`balls` 陣列各自渲染球體，任一顆球觸發碰撞時沿用既有 `particles` 碎屑效果
- [ ] 6.6 HUD：SCORE／LEVEL／LIVES／COMBO（連段數與目前倍率）
- [ ] 6.7 Game Over／過關：`bricks` 全數摧毀進下一關；`balls.length === 0` 才扣一命；生命歸零顯示 `GAME OVER`
- [ ] 6.8 Restart：完整重置 Paddle／Balls／Bricks／Power-Up 狀態／Score／Level／Lives／Combo，不殘留上一局資料
- [ ] 6.9 Pause（ESC／P）：`PAUSED` overlay，`[RESUME]`／`[RESTART]`／`[EXIT]`，暫停期間停用 tick 與輸入、Power-Up 倒數暫停
- [ ] 6.10 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#ef476f`（玫瑰紅，不與現有十六款遊戲撞色）

## 7. game-hall 入口

- [ ] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 24, name: 'ARKANOID', status: 'open', path: '/game/arkanoid' }`
- [ ] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'arkanoid'`, `icon: '🧱'` 或其他未重複 emoji, `anim`, `glow: '#ef476f'`）
- [ ] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `README.md` / `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身，已於本輪產出）

## 9. 驗證

- [ ] 9.1 `npm run dev` 啟動後，實際在瀏覽器測試核心玩法：擋板移動、發球、球反彈、磚塊摧毀，皆正常
- [ ] 9.2 實測 Multi-Hit Brick：命中後正確遞減 `hitPoints` 並切換視覺，歸零才真正摧毀
- [ ] 9.3 實測 Moving Brick：磚塊在自身欄位範圍內來回移動，不與其他磚塊重疊、不越界
- [ ] 9.4 實測 Power-Up：WIDE／SLOW／MULTI_BALL 掉落機率、擋板接住生效、限時效果倒數結束後正確恢復
- [ ] 9.5 實測 Multi Ball：MULTI_BALL 觸發後多顆球同時判定碰撞，僅當所有球都離開場地才扣一命
- [ ] 9.6 實測 Combo：連續命中磚塊正確累加倍率，碰到擋板或失去一命後正確重置
- [ ] 9.7 實測 Level System：清光可摧毀磚塊正確進下一關，關卡門檻正確觸發 Moving Brick
- [ ] 9.8 實測 Game Over／Restart／Pause：生命歸零正確結束、Restart 完整重置、Pause 期間不計時不觸發碰撞
- [ ] 9.9 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [ ] 9.10 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [ ] 9.11 `GameHistoryDialog` 篩選 tab 能正確顯示 `ARKANOID` 紀錄與統計
- [ ] 9.12 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/arkanoid`
- [ ] 9.13 確認沒有 Console Error，且 BREAKOUT（`app/pages/game/breakout.vue`）與其餘既有十五款遊戲行為完全不受影響
- [ ] 9.14 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
