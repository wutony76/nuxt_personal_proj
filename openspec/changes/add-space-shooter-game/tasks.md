## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/spaceShooter.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.3`（試玩後由 0.08→0.2→0.3 兩度調高，見 design.md Decision 11／12）、`coinCapPerRun: 2500`——使用者明確要求提高、`coinDailyCap: 100000`、`maxReasonableScore(): 10000`（試玩後由 40000→16000→10000 兩度調降，見 Decision 11／12），見 design.md Decision 5／11／12）
- [x] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/space-shooter/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有七款遊戲樣板，見 design.md Decision 6 的 gameKey／路由命名說明）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'spaceShooter'`，`api.games.retro` 新增對應 3 個函式（路由路徑用 `space-shooter`）

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含）

- [x] 5.1 `app/pages/game/space-shooter.vue`：`SpaceShooterEngine` inline class（玩家飛船水平位置、玩家子彈／敵機／敵彈的位置陣列與生成回收、`step()` 由固定 tick 驅動，比照 pong.vue／runner.vue 的 engine class 慣例）
- [x] 5.2 敵機生成：基本／強化兩型隨機生成，比例隨等級調整；強化敵機不定期向下發射敵彈（見 design.md Decision 3）
- [x] 5.3 雙向碰撞判定：玩家子彈 vs 敵機（命中扣血、血量歸零加分並移除）；敵彈／敵機本體 vs 玩家（非無敵狀態時扣命）（見 design.md Decision 4）
- [x] 5.4 生命值機制：3 條命，扣命後 1.5 秒無敵＋重生於畫面下方中央，命數歸零才觸發最終結算（見 design.md Decision 1）
- [x] 5.5 分數＝擊落敵機加權得分（基本 1 分／強化 3 分，使用者兩度回饋調降後最終比例 1:3:5，見 design.md Decision 11／12）× 連擊倍率，等級隨分數門檻提升（`[0,25,60,120,200]`，依擊殺數反推），帶動敵機生成頻率、移動速度、敵彈頻率（比照既有 Lv 慣例）

## 6. 豐富度：連擊、道具、里程碑強敵

- [x] 6.1 連擊／分數倍率：`comboCount` 每次擊殺 +1，被擊中歸零；倍率門檻 0–4→x1、5–11→x2、12–23→x3、24+→x4（見 design.md Decision 8）
- [x] 6.2 道具掉落：擊落敵機機率掉落護盾／加速射擊／散射彈，下落中可被飛船拾取；武器強化（加速射擊／散射彈）限時且互斥覆蓋，護盾為一次性抵銷（見 design.md Decision 7）
- [x] 6.3 里程碑強敵：分數每跨過門檻（每 50 分，試玩後由 500→200→50 兩度調降，見 design.md Decision 11／12）額外生成一隻高血量／高分（5 分）／左右橫掃的獨特敵機，擊落必掉道具（見 design.md Decision 9）
- [x] 6.4 視覺特效：星空視差背景（多層星點依速度下移並回收重生）、擊殺／受擊爆炸粒子（一次性 CSS 動畫，結束後自動移除）、玩家受擊畫面震動（見 design.md Decision 10，純呈現層不影響邏輯）

## 7. 遊戲頁面互動與流程

- [x] 7.1 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例）
- [x] 7.2 玩家操作：←/→ 或 A/D 左右移動，按住空白鍵／Enter 以固定射速連續發射子彈
- [x] 7.3 HUD 顯示目前分數、等級、剩餘生命、連擊數／倍率、武器強化剩餘時間；扣命／無敵狀態需有明確視覺提示（例如飛船閃爍）
- [x] 7.4 RESULT overlay 顯示最終 SCORE 與等級，呼叫 `useGameHistory().actions.record()`（生命值／連擊／道具狀態皆不入庫，見 design.md Decision 1）
- [x] 7.5 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#4d7fff`（電光藍，不與現有七款遊戲撞色）

## 8. game-hall 入口

- [x] 8.1 `app/pages/game-hall.vue`：`gameSlots` 的 id 8 改為 `SPACE SHOOTER`（`status: 'open'`，`path: '/game/space-shooter'`）
- [x] 8.2 `app/components/GameMachineCard.vue`：`cuteIcon` 新增 `SPACE SHOOTER` 圖示分支（🚀）
- [x] 8.3 `app/components/GameHistoryDialog.vue`：`FILTERS`／`GAME_KEYS`／`GAME_NAME` 各新增一筆

## 9. OpenSpec 文件

- [x] 9.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 10. 驗證

- [x] 10.1 `npm run dev` 啟動後，用 Playwright 實測移動／射擊／敵機生成／子彈命中扣血加分／敵彈與敵機本體扣命／無敵時間，行為皆正常（版面沿用 pong/runner 修過的 `fit-content` + `box-sizing: content-box` 手法，未再踩到尺寸錯位的坑）
- [ ] 10.2 實測生命值與難度曲線：自動化測試中一場約 56 個遊戲內時間單位打到 SCORE 1500／LEVEL 4 才 GAME OVER，數量級合理，但「3 條命的容錯手感是否剛好」仍需真人試玩校準（比照 pong/runner 既有的手感留待人工驗證慣例）
- [x] 10.3 實測連擊倍率：Playwright 截圖確認 HUD 顯示「COMBO x2 (7/8)」等連擊與倍率數字隨擊殺增加，機制運作正常
- [x] 10.4 實測道具：確認掉落（`.ss-powerup` 出現）／拾取／限時效果生效（HUD 顯示「散射彈 8s」倒數）皆正常；護盾一次性抵銷與武器強化互斥覆蓋的行為經程式碼審閱確認邏輯正確，未在自動化測試中特別逼出護盾抵銷的那一刻
- [x] 10.5 實測里程碑強敵：確認分數跨過門檻（500 分）時 `.ss-enemy.milestone` 正確生成
- [x] 10.6 視覺特效不影響判定：星空／爆炸粒子／震動皆為獨立於 `SpaceShooterEngine` 碰撞判定之外的純呈現狀態（`stars`/`explosions`/`stageShake` 從未被任何碰撞或計分邏輯讀取），經程式碼審閱確認純呈現、不影響邏輯
- [x] 10.7 未登入：確認寫入 localStorage、重整頁面紀錄仍在
- [x] 10.8 已登入：確認 server 端紀錄寫入、coin 依 `score × coinRate` 入帳、單局與每日上限機制正確
- [x] 10.9 `GameHistoryDialog` 篩選 tab 能正確顯示 `SPACE SHOOTER` 紀錄與統計
- [x] 10.10 `game-hall.vue` 卡片正常顯示、可點擊進入 `/game/space-shooter`
- [x] 10.11 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
