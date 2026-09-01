## 1. 權限門禁機制（Decision 1）

- [x] 1.1 `server/config/admin.ts`：`ADMIN_USER_IDS: string[]` 白名單常數
- [x] 1.2 `app/config/constants.js`：新增 `40003`（無管理員權限）錯誤碼
- [x] 1.3 `server/services/auth.ts`：`sessionController` 擴充 `isAdmin(user)`／`requireAdmin(event)`
- [x] 1.4 `server/api/admin/me.get.ts`：回傳 `{ isAdmin, user }`，非管理員不拋錯，交給前端渲染拒絕畫面
- [x] 1.5 `app/composables/useAdminAuth.ts`：比照 `useAuth.ts` 的 singleton 模式
- [x] 1.6 `app/pages/login.vue`：登入後導向統一改為 `/`（不分是否為管理員，簡化自原本「馬上導入後台」的規劃）

## 2. 後台導覽與視覺風格（Decision 2）

- [x] 2.1 `app/assets/style/admin.scss`：黑白編輯風視覺 tokens，`nuxt.config.ts` 註冊
- [x] 2.2 `app/components/admin/AdminShell.vue`：權限守衛、頂部導覽（總覽／角色權限／遊戲管理／報表分析）、in-memory 提示、40003 拒絕畫面
- [x] 2.3 `app/components/admin/AdminGameNav.vue`：遊戲管理底下的常駐左側次導覽（BG彩票／台彩甘仔店／經典遊戲／遊戲試算）
- [x] 2.4 `app/components/admin/AdminComingSoon.vue`：共用佔位頁元件
- [x] 2.5 `app/pages/admin/index.vue`（總覽）：3 張導覽卡片（角色權限／遊戲管理／報表分析）
- [ ] 2.6 總覽頁的 4 個關鍵數字摘要卡片（今日活躍會員數、彩池補貼累計、池底重新擲骰次數、可調遊戲常數數量）——design.md Decision 2 有規劃但**尚未實作**，目前總覽頁只有導覽卡片

## 3. BG彩票彩池補貼追蹤（Decision 3）

- [x] 3.1 `server/services/game/lottery/bg/poolAudit.ts`：`recordPoolReseed()`／`recordFloorOverpay()`，寫入 `Storage.lottery.poolAudit`（含陣列長度上限保護）
- [x] 3.2 10 個彩種結算檔案（6hcOf／eggs／fc3d／k3Of／k3Shared／kl10／kl8／pk10Of／pk10Shared／pl3／sscOf／sscShared／x5Of／x5Shared）各自在 `ensurePoolBase()` 與保底判定旁加一行記錄呼叫
- [x] 3.3 `server/api/admin/bg-lottery/pool-audit.get.ts`：`requireAdmin` 把關，依彩種／時間區間篩選＋彙總
- [x] 3.4 `app/pages/admin/bg-lottery.vue`：篩選器、3 張統計卡、保底超付／池底重骰／各彩種摘要三個 tab
- [x] 3.5 驗證：14 個檔案 diff 逐一比對，確認「只加一行記錄呼叫、不動既有派彩／池底計算」的不變量成立；`npx nuxt typecheck` 零新增錯誤；Playwright 實機測試登入／篩選／分頁切換／API 回應皆正常

## 4. BG彩票報表其餘指標（Decision 4）

- [ ] 4.1 下注量／輸贏彙總（掃描 `orders.ts` 各彩種訂單記錄，依 issue 彙總下注金額與派彩差額）
- [ ] 4.2 coin 發放總量（掃描各彩種 `balanceChanges` 裡 `type: 'claim'` 加總）
- [ ] 4.3 每日活躍會員數（掃描當日有下注紀錄的不重複 `userId` 數）
- [ ] 4.4 上述三項在 `/admin/bg-lottery` 或總覽頁的呈現位置——**尚未實作，目前只有 Decision 3 的彩池補貼追蹤上線**

## 5. 經典遊戲後台管理（Decision 5）

- [x] 5.1 `RETRO_GAME_BASE` 的 `coinRate`／`coinCapPerRun`／`coinDailyCap` 改可變欄位，`PUT /api/admin/games/retro/:key/rates`（正數／`coinCapPerRun <= coinDailyCap` 驗證）
- [x] 5.2 `server/services/game/retro/mazeTemplates.ts`：`MazeTemplate`／`validateMazeRows()`（BFS 連通性驗證，搬自 `pac-man.vue`）／`mazeTemplates.list/add/remove`
- [x] 5.3 `GET /api/games/retro/pacman/maze-templates`（公開）、`POST`／`DELETE /api/admin/games/pacman/maze-templates`（管理員限定）
- [x] 5.4 `app/pages/game/pac-man.vue`：`pickMaze()` 改為開局時 fetch 後台樣板清單，取代原本寫死的 `FIXED_MAZE_TEMPLATES`
- [x] 5.5 `GET /api/admin/games/history?userId=xxx`：玩家遊戲紀錄與 coin 兌換查詢
- [x] 5.6 `app/pages/admin/games.vue`：coin 常數表格就地編輯、固定樣板迷宮卡片＋新增 dialog、玩家紀錄查詢區塊
- [x] 5.7 各遊戲直達路由：`PLAY_PATHS` 對照表，管理頁每列附「試玩 ↗」連結

## 6. 台彩甘仔店／遊戲試算／報表分析（佔位）

- [x] 6.1 `app/pages/admin/taiwan-lottery.vue`、`game-simulator.vue`：`AdminShell` + `AdminGameNav` + `AdminComingSoon`
- [x] 6.2 `app/pages/admin/reports.vue`：`AdminShell` + `AdminComingSoon`（無次導覽，屬頂層項目）

## 7. 持久化與風險提示（Decision 6）

- [x] 7.1 in-memory 限制提示：`AdminShell` 頁首下方常駐一行「僅在伺服器運行期間有效」文案

## 8. 驗證

- [x] 8.1 Nuxt 路由：`admin.vue` + `admin/` 目錄衝突已排查並修正（`git mv` 成 `admin/index.vue`）
- [x] 8.2 一般帳號登入落地首頁；管理員帳號登入落地首頁後，點 `AppTopbar.vue`「後台」連結可正常進入 `/admin` 總覽
- [x] 8.3 `npx nuxt typecheck`：確認新增/修改檔案無新增型別錯誤（僅既有 baseline 錯誤，與本次無關）
- [x] 8.4 BG彩票彩池追蹤：見第 3 節 3.5
- [ ] 8.5 經典遊戲管理頁（`/admin/games`）：coin 常數編輯、迷宮樣板新增/刪除、玩家紀錄查詢——**尚未做過 Playwright 實機驗證**（本次僅完成程式碼實作與 typecheck）
- [ ] 8.6 角色權限頁（`/admin/roles`）：白名單顯示、登入導向前後對照——**尚未做過 Playwright 實機驗證**
