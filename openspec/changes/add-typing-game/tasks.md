## 1. Server 端服務層

- [x] 1.1 新增 `server/services/game/retro/typing.ts`：繼承 `RETRO_GAME_BASE`（`coinRate: 0.3`、`coinCapPerRun: 300`、`coinDailyCap: 100000`、`maxReasonableScore(): 8000`，見 design.md Decision 5）
- [x] 1.2 `server/services/storage.ts`：`retroGamesInit()` 新增 import 並 `new` 該類別

## 2. Server 端 API 路由

- [x] 2.1 新增 `server/api/games/retro/typing/history.get.ts`、`history.post.ts`、`history.delete.ts`（比照既有樣板）
- [x] 2.2 確認 `server/middleware/auth.ts` 的 `/api/games` 前綴已涵蓋新路由，不需修改

## 3. Client API 層

- [x] 3.1 `app/services/api.ts`：`RetroGameKey` 擴充 `'typing'`，`api.games.retro` 新增對應 3 個函式

## 4. Client 資料層

- [x] 4.1 `app/composables/useGameHistory.ts`：`GAME_KEYS` 陣列與 `_handlers.gameApi()` switch 新增一個分支

## 5. 遊戲核心邏輯（頁面自包含，inline class）

- [x] 5.1 `app/pages/game/typing.vue`：`TypingEngine` inline class（比照 `SpaceShooterEngine` 組織方式），單字資料模型 `{id,text,x,y,progress,state}`（`createdAt` 未實際使用，省略）
- [x] 5.2 單字池：依長度分層的固定英文單字陣列（不外接 API），`spawnWord()` 依目前等級從對應難度層抽字＋隨機 x 座標
- [x] 5.3 Game Loop：`step()` tick-driven（16ms），單字 y 座標遞減、生成倒數、MISS 判定（見 design.md Decision 3）
- [x] 5.4 鎖定機制：`handleChar(char)` 找第一個字元相符的 `waiting` 單字並鎖定為 `typing`（多候選取最接近頂端者），之後輸入只跟鎖定字比對（見 Decision 1）；Playwright 實測兩字同時存在時正確鎖定相符者、另一字維持未鎖定樣式
- [x] 5.5 逐字元驗證，不分大小寫：正確字元推進 `progress`，錯誤字元不加入輸入、觸發視覺回饋；**開發中發現並修正一個 bug**——未鎖定任何字時輸入了不匹配任何待打單字的字元，原本會靜默無反應，已修正為同樣觸發錯誤視覺回饋（見 Decision 2）
- [x] 5.6 完成判定：`progress === text.length` 時立即從陣列移除、加分（字長×10×連擊倍率）、疊加連擊、觸發飄走動畫、解鎖
- [x] 5.7 MISS 判定：單字 y 超出畫面頂端時扣 1 命、連擊歸零，若是鎖定中的字一併解鎖
- [x] 5.8 生命值機制：3 條命，命數歸零觸發最終結算（見 Decision 4）
- [x] 5.9 連擊倍率：`combo` 每次完成 +1，倍率門檻分級，MISS 時歸零（見 Decision 5）
- [x] 5.10 難度曲線：等級隨分數提升，`spawnCountdown` 基礎值隨等級遞減、單字池混入更長字的機率提高（見 Decision 6）

## 6. 遊戲頁面互動與流程

- [x] 6.1 WELCOME／READY／RESULT 三段式 overlay（比照既有遊戲慣例）
- [x] 6.2 鍵盤輸入：`window.addEventListener('keydown', ...)`，篩選單一可印字元（排除 Ctrl/Meta/Alt 組合鍵）呼叫 `handleChar()`
- [x] 6.3 HUD：SCORE／LIVES／COMBO，另外顯示目前鎖定的 TARGET 字與已輸入部分，未鎖定任何字時顯示「—」
- [x] 6.4 視覺回饋：單字已輸入部分高亮、完成往上飄走＋淡出＋「+分數」彈出文字（比照 `explosion-burst`／`.m3-combo-popup` 手法）、輸入錯誤時畫面短暫紅框閃爍（`wrong-flash`）
- [x] 6.5 RESULT overlay 顯示最終 SCORE 與等級，呼叫 `useGameHistory().actions.record()`（生命值／連擊皆不入庫）
- [x] 6.6 掛載共用 `GameRateDialog` / `GameRuleDialog`，`accent-color` 採 `#ffb627`（琥珀黃，不與現有十二款遊戲撞色）
- [x] 6.7 格線背景（`.typ-overlay` + `::before/::after` + `ambient-drift/ambient-pulse/grid-drift`，比照其他遊戲慣例）

## 7. game-hall 入口

- [x] 7.1 `app/config/gameSprites.ts`：新增 `typing` 項目（icon ⌨️，新增 `jitter` 動畫類型供 `GameHallSprites.vue` 使用）
- [x] 7.2 `app/pages/game-hall.vue`：`gameSlots` 陣列新增 `{ id: 13, name: 'TYPING', status: 'open', path: '/game/typing' }`
- [x] 7.3 `app/components/GameHistoryDialog.vue`：篩選 tab／`GAME_KEYS`／遊戲名稱對照各新增一筆

## 8. OpenSpec 文件

- [x] 8.1 `proposal.md` / `design.md` / `tasks.md` / `specs/game-history/spec.md`（本次變更文件本身）

## 9. 驗證

- [x] 9.1 `npm run dev` 啟動後，用 Playwright 實測：單字正確生成、混合大小寫輸入正確完成並得分（3 字得 30 分＝3×10×倍率1）、多字同時存在時鎖定機制正確（鎖定相符者、另一字維持未鎖定樣式）、輸入不匹配字元觸發錯誤視覺回饋（含發現並修正上述 bug 後）
- [ ] 9.2 實測難度曲線：確認等級提升後生成間隔縮短、單字變長——尚未實測（需要長時間對局衝到高等級），留待人工驗證
- [ ] 9.3 實測連擊：連續完成疊加倍率、MISS 後歸零——尚未實測 MISS 分支，留待人工驗證
- [x] 9.4 未登入：Playwright 實測確認寫入 `localStorage`（key `game-history-v1`），紀錄含正確的 `score`／`level`
- [ ] 9.5 已登入：尚未測試（需要登入帳號），coin 結算邏輯與其他十二款遊戲共用同一個 `RETRO_GAME_BASE`，架構上一致，留待人工驗證
- [ ] 9.6 `GameHistoryDialog` 篩選 tab 能正確顯示 `TYPING` 紀錄與統計——程式碼已加對應項目，尚未實際點開 dialog 驗證畫面
- [x] 9.7 `game-hall.vue` 卡片正常顯示（Playwright 確認頁面含「TYPING」、開放中數量顯示 13），可點擊進入 `/game/typing`
- [x] 9.8 確認既有十二款遊戲程式碼完全未被修改（僅 6 個共用檔案新增分支，未動既有分支邏輯）
- [x] 9.9 `npx nuxt typecheck`：新增/修改的檔案皆無型別錯誤；專案既有的 lottery/kl8 相關型別錯誤與本次變更無關（修改前即存在）
