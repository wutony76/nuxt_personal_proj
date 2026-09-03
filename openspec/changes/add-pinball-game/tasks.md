> 使用者已授權「先建 spec、之後直接開始實作」，本清單於本輪 OpenSpec 文件完成後立即依序執行，不等待額外核准。

## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/pinball.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.01`、`coinCapPerRun: 150`、`coinDailyCap: 100000`、`maxReasonableScore(): 30000`，見 design.md Decision 7）
- [x] 1.2 `server/services/storage.ts`：遊戲初始化區塊新增 import 並 `new RetroPinballClass()`

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/pinball/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有樣板）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'pinball'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（`app/utils/pinballEngine.ts`，不依賴 Vue）

- [x] 5.1 型別與常數：`Ball`／`Flipper`／`Bumper`／`Target`／`GoldenHole`／`UpgradeModifiers`／`PinballSnapshot`，物理/計分/Combo/Fever 常數與 `UPGRADE_POOL`（12 項）全部集中管理（design.md Decision 6、8）
- [x] 5.2 Virtual Coordinate 常數：`PINBALL_WIDTH = 360`／`PINBALL_HEIGHT = 640`（design.md Decision 1）
- [x] 5.3 Ball 物理：Gravity／Velocity Clamp／Friction、Ball vs Wall（含 Launcher 分隔牆）碰撞反彈
- [x] 5.4 Flipper：角度插值擺動（`FLIPPER_ANGULAR_SPEED`）、線段最近點碰撞判定、依撞擊點+角速度計算擊退（design.md Decision 3）
- [x] 5.5 Bumper：圓形碰撞、強力反彈（含最低反彈速度）、Score+100×modifiers、Combo+1（+modifiers 額外 Combo）、低機率掉落局內趣味幣
- [x] 5.6 Target（A/B/C/D）：命中判定＋亮起狀態、Score+200×modifiers、Combo+1、全部點亮觸發 Fever（design.md Decision 4）
- [x] 5.7 Golden Hole：命中判定、Score+1000×modifiers、Combo+3、局內趣味幣+5、球重新發射回場上（不算 Death，design.md Decision 5）
- [x] 5.8 Combo／Score：`comboMultiplier` 公式、Fever 期間乘法疊加、掉球即時歸零（design.md Decision 4）
- [x] 5.9 Fever：觸發/倒數/結束重置 Target、Bumper 擊退與 Combo 視窗加成
- [x] 5.10 Death Zone／Launcher：球落出雙 Flipper 之間扣一命、`Space` 觸發 Launcher 發球初速
- [x] 5.11 Upgrade：`UPGRADE_POOL`（12 項，Score/Combo/Control/Special 四類）、掉球後不重複隨機抽 3 個、`applyUpgrade(id)` 套用到 `modifiers`
- [x] 5.12 `PinballEngine` class：整合 5.1～5.11，提供 `reset()`、`tick(dtMs, input)`、`launchBall()`、`applyUpgrade(id)`、`getSnapshot()`

## 6. 遊戲頁面與互動流程

- [x] 6.1 `app/pages/game/pinball.vue`：`reactive()` state 鏡像 engine snapshot，`_handlers`/`_actions`/`click` 三分法（比照既有慣例）
- [x] 6.2 `.pb-stage-wrap` + `ResizeObserver` 等比例縮放（design.md Decision 1）、`setInterval(16ms)` tick（design.md Decision 2）、`keydown`/`keyup` 輸入（A/ArrowLeft、D/ArrowRight、Space、Esc/P）
- [x] 6.3 Flipper／Ball／Bumper／Target／Golden Hole／Wall 的 DOM 渲染，全部用 CSS transform 定位，不使用 Canvas
- [x] 6.4 Hit Feedback：Bumper 縮放/閃爍/Score Popup/Screen Shake，Target 亮起，Golden Hole 強烈視覺，Fever 全域樣式
- [x] 6.5 HUD：SCORE／COMBO xN／BALL n/3／COINS xx／FEVER! 提示（比照開發計畫第十八節版面）
- [x] 6.6 Upgrade 選擇 Overlay：掉球後（尚有生命）顯示 3 選 1，選擇後立即套用並自動進入下一顆球的 Ready 狀態
- [x] 6.7 Game Over／Restart：生命歸零顯示 `GAME OVER`／`SCORE`/`BEST`/`COINS`/`RESTART`，寫入 `useGameHistory`（見 design.md Decision 7）
- [x] 6.8 Pause（ESC／P）：暫停期間停用 tick 與輸入
- [x] 6.9 Sound Manager 介面：`playSound('bumper'|'flipper'|'target'|'fever'|'hole'|'gameover')`，內部用 Web Audio API 產生簡單音效，不下載音效素材
- [x] 6.10 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#00f5d4`

## 7. game-hall 與後台入口

- [x] 7.1 `app/pages/game-hall.vue`：`gameSlots` 新增 `{ id: 26, name: 'PINBALL', status: 'open', path: '/game/pinball' }`
- [x] 7.2 `app/config/gameSprites.ts`：`GAME_SPRITES` 新增一筆（`key: 'pinball'`, `icon: '🎱'`, `anim: 'bounce'`, `glow: '#00f5d4'`）
- [x] 7.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆
- [x] 7.4 `app/pages/admin/games.vue`：`PLAY_PATHS` 新增 `pinball: '/game/pinball'`

## 8. OpenSpec 文件

- [x] 8.1 `README.md` / `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，以 Playwright 自動化腳本實測核心玩法：Flipper 操作、發球、球反彈、Bumper/Target 得分、Combo（含倍率公式）、Golden Hole（不扣命＋重新發射）、掉球扣命、Upgrade 選擇、Game Over、Restart 皆正常運作；過程中發現並修正兩個問題：(1) Combo 倍率計算順序錯誤，導致第一次命中得分被打 0.85 折而非滿分——已修正為先 `registerHit()` 再 `addScore()`；(2) 預設 Launcher 彈射力道／角度與 Flipper 覆蓋寬度過窄，導致球幾乎必定直接漏球、Flipper 完全接觸不到球——已調高 `LAUNCH_POWER`/`MAX_BALL_SPEED`、加大水平初速 `LAUNCH_VX`，並將 `FLIPPER_LENGTH` 加大、Pivot 移至靠近桌面兩側，讓 Flipper 涵蓋大半桌寬。Fever 觸發／結束重置為程式碼審閱確認，自動化測試中未在單次 Run 內剛好集滿四個 Target 觸發，可視為後續人工微調項目。
- [x] 9.2 `npx vue-tsc --noEmit`（等效 `nuxt typecheck`）確認新增/修改檔案無型別錯誤
- [x] 9.3 確認 Playwright 測試過程中無 Console Error／Page Error；`server/services/storage.ts` 啟動 log 顯示 `TTT---RUN.PINBALL` 且其餘 26 款既有遊戲初始化序列不受影響
