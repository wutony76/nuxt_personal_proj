## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/breakout.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 8000`，見 design.md Decision 4）
- [x] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/breakout/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有樣板）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'breakout'`，`api.games.retro` 新增對應 3 個函式；連帶修正另一個並行開發中的 `app/pages/admin/games.vue`（`Record<RetroGameKey, string>` 窮舉對照表）因擴充型別而缺漏的一筆，避免打斷該功能的 typecheck

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含，inline class）

- [x] 5.1 `app/pages/game/breakout.vue`：`BreakoutEngine` inline class（比照 `PongEngine` 組織方式），Paddle／球/磚塊資料模型
- [x] 5.2 Paddle 移動：←/→ 或 A/D，邊界限制
- [x] 5.3 發球機制：`launched` 布林，球黏 Paddle 正上方（隨 Paddle 移動同步），按空白鍵才套用球物理開始移動（見 design.md Decision 6）；Playwright 實測發球前球確實跟隨 Paddle 移動
- [x] 5.4 球物理：`ballVX`/`ballVY` 向量，牆壁（左/右/頂）反彈對應軸取負，Paddle 反彈依撞擊相對位置決定角度（比照 PongEngine，見 Decision 1）
- [x] 5.5 球速漸進：每次擊中磚塊小幅提升球速，有上限；隨關卡提升球速上限
- [x] 5.6 關卡陣列：`LEVELS` 固定常數陣列，`buildBricks(levelIndex)` 依佈局生成磚塊物件（含所在列），比照 MINESWEEPER 的 `LEVELS` 先例（見 Decision 3）；Playwright 確認第 1 關正確生成 4×10＝40 顆磚塊
- [x] 5.7 磚塊碰撞：AABB 重疊比對＋最小重疊軸判斷撞擊面，同一 tick 只處理第一個重疊磚塊，單次擊破（見 Decision 2）；Playwright 實測擊中最下排磚塊得分（(4-3)×10=10 分）且該磚塊正確消失
- [x] 5.8 計分：依磚塊所在列給分，開放式無上限（見 Decision 4）
- [x] 5.9 過關判定：清光存活磚塊觸發 LEVEL CLEAR 短暫過場、載入下一關、球與 Paddle 歸位、`launched=false`，分數與生命值不重置
- [x] 5.10 掉球判定：球 y 超出底部觸發 BALL LOST 短暫過場、扣 1 命、球與 Paddle 歸位、`launched=false`；命數歸零觸發最終結算（見 Decision 5）；Playwright 實測扣命後生命值正確從 3→2、分數不歸零

## 6. 遊戲頁面互動與流程

- [x] 6.1 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例）
- [x] 6.2 鍵盤輸入：←/→或A/D 移動 Paddle、空白鍵發球
- [x] 6.3 HUD：SCORE／LEVEL／LIVES，另外顯示 LEVEL CLEAR／BALL LOST 短暫訊息提示（setTimeout 後自動清除）；**開發中發現並修正一個 bug**——掉球或過關重置球等待重新發球後，畫面下方的持續訊息文字原本沒有更新提示「按空白鍵發球！」，玩家可能不知道要再按一次空白鍵；已修正為掉球/過關後若球尚未發射，立即把訊息文字改回發球提示，並用 Playwright 驗證修正前後畫面差異
- [x] 6.4 視覺：磚塊網格渲染（依列不同顏色）、摧毀粒子效果（比照 `explosion-burst` 手法）、格線背景
- [x] 6.5 RESULT overlay 顯示最終 SCORE 與關卡，呼叫 `useGameHistory().actions.record()`（生命值皆不入庫）
- [x] 6.6 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#1de9b6`（薄荷青，不與現有十三款遊戲撞色）
- [x] 6.7 不使用任何外部圖片素材，不複製任何特定遊戲的 Logo/UI（純 CSS 色塊與圓形，符合使用者明確要求）

## 7. game-hall 入口

- [x] 7.1 `app/config/gameSprites.ts`：新增 `breakout` 項目（icon 🧱，重用既有 `bounce` 動畫類型）
- [x] 7.2 `app/pages/game-hall.vue`：`gameSlots` 陣列新增 `{ id: 14, name: 'BREAKOUT', status: 'open', path: '/game/breakout' }`
- [x] 7.3 `app/components/GameHistoryDialog.vue`：篩選 tab／`GAME_KEYS`／遊戲名稱對照各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，用 Playwright 實測完整流程：Paddle 移動與球跟隨、按空白鍵發球、球反彈磚塊並得分、磚塊正確消失、球掉出底部扣命且分數不歸零、掉球後正確提示重新發球
- [ ] 9.2 實測 Paddle 反彈角度：擊中 Paddle 不同位置，球的水平反彈方向明顯不同——已由程式碼審閱確認邏輯正確（比照 PongEngine 已驗證公式），未特別針對「不同擊中位置」逐一操作驗證，留待人工試玩確認手感
- [ ] 9.3 實測磚塊碰撞方向判定：從側面與從上下方擊中磚塊，球的反彈軸正確——已驗證至少一次由下往上擊中磚塊的案例（正常遊玩路徑），側面撞擊案例未特別逼出，留待人工驗證
- [x] 9.4 未登入：Playwright 實測確認寫入 `localStorage`（key `game-history-v1`），紀錄含正確的 `score`／`level`
- [ ] 9.5 已登入：尚未測試（需要登入帳號），coin 結算邏輯與其他十三款遊戲共用同一個 `RETRO_GAME_BASE`，架構上一致，留待人工驗證
- [ ] 9.6 `GameHistoryDialog` 篩選 tab 能正確顯示 `BREAKOUT` 紀錄與統計——程式碼已加對應項目，尚未實際點開 dialog 驗證畫面
- [x] 9.7 `game-hall.vue` 卡片正常顯示（Playwright 確認頁面含「BREAKOUT」、開放中數量顯示 14），可點擊進入 `/game/breakout`
- [x] 9.8 確認既有十三款遊戲程式碼完全未被修改（僅 6 個共用檔案新增分支，未動既有分支邏輯；另修正了並行開發中 `app/pages/admin/games.vue` 因型別擴充缺漏的一筆對照，屬於維持其 typecheck 通過的必要最小修正，非本次遊戲功能範圍）
- [x] 9.9 `npx nuxt typecheck`：新增/修改的檔案皆無型別錯誤；專案既有的 lottery/kl8 相關型別錯誤與本次變更無關（修改前即存在）
