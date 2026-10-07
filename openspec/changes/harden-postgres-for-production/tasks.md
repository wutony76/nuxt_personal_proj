# Tasks

> Implementation 已完成（見 validation.md / engineering-evidence.md）。

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（環境變數設計 / 職責切分 / 部署檢查清單大綱）

## 2. 環境變數與種子邏輯調整

- [x] `server/services/storage.ts`：`Storage.init()` 的種子帳號（`U0xA000001`）改讀
      `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`（未設定時 fallback 回現有字面值）
- [x] `server/services/admin/modules/adminAccess.ts`：新增 `hasExistingAdmin()`（查 DB 是否已有
      `is_admin = true` 的 member）與 `seedMissingAdmin()`（只在沒有 admin 時呼叫；**實作時發現
      design.md 原本規劃的「傳入 ids 清單」在 `rehydrateFromDb()` 已整個重建 `Storage.account` 的
      情境下不可靠——那個分支跑完後記憶體裡不保證還有 `U0xA000001` 這個 id，所以改成不依賴記憶體、
      直接用 `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 現場組一筆並 `ON CONFLICT DO UPDATE SET
      is_admin = true` upsert，詳見 validation.md 問題紀錄**）
- [x] `server/services/admin/hfyyManage.ts`：`setStartData()` 新增 `SEED_DEMO_DATA` 判斷（`false`
      時跳過 test01~05 與 20 筆 NPC 種子迴圈），並在 `hasExistingDbMembers()`/`rehydrateFromDb()`
      分支執行之後，獨立呼叫 `hasExistingAdmin()` 判斷是否需要 `seedMissingAdmin()`
- [x] `.env.example` 補充 `SEED_DEMO_DATA`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 與正式環境
      注意事項註解

## 3. 部署檢查清單文件

- [x] 撰寫 `docs/deployment/postgres-production-checklist.md`（密碼與帳號 / 網路防火牆 / 備份 /
      監控 / 開機行為自我檢查，五大項）

## 4. 驗證

- [x] `SEED_DEMO_DATA=false` + 全新 DB + 自訂 `SEED_ADMIN_EMAIL`/`PASSWORD`：開機後 `members` 表
      只有 2 筆（`U0xA000001` 用自訂帳密、`U0xA666666` 維持固定值），無 test01~05/NPC 帳號，且能
      用自訂帳密登入
- [x] 未設定任何新環境變數：`members` 表維持既有 27 筆，行為與 Phase 2/3 完成時完全一致（向下相容）
- [x] `hasExistingAdmin()` 情境矩陣中最關鍵的一列：手動把 DB 裡既有的 2 筆 admin 全部
      `is_admin = false`（模擬「有會員但沒有 admin」），重啟後確認系統自動把 `U0xA000001` 補回
      `is_admin = true`，且能用預設帳密登入
- [x] 既有 `npm test`（含 `test:roles`）在未設定新環境變數時全數通過，確認無回歸

## 5. 交付檢查

- [x] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [x] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 6. 追加修正：開機時 DB 連線失敗會卡住整個遊戲引擎（使用者追問後發現並修正）

> 這是驗收本次變更後，使用者問「我這樣 dev 的執行步驟需要調整嗎」而發現的真實 bug，不在原始
> proposal 範圍內，但直接關係到本次變更的「DB 可選」承諾是否真的成立，記錄在同一個 change 底下。

- [x] 發現：`DATABASE_URL` 有設定但 Postgres 當下連不上（例如忘記先啟動 Docker）時，
      `hfyyManage.ts` 的 `roleDefs.rehydrateOrSeed()` 會丟出未捕捉的例外，導致
      `server/plugins/init.ts` 的 `await Storage.adminInitPromise` 整個中斷，後面的
      `SyncScheduler.start()`／300ms 遊戲 tick 迴圈／`SERV.RUN` 全部沒有機會執行——網站 HTTP
      服務看起來正常（200），但遊戲引擎完全沒有啟動，且沒有任何明顯錯誤畫面
- [x] 修正一：`hfyyManage.ts` 的 `setStartData()` 把整段 admin/role-defs 開機回填/種子邏輯包進
      `try/catch`，失敗時記清楚的 log 並退回「只有 `Storage.init()` 建立的 2 筆硬編碼種子 admin」
      繼續開機；`npcAutoPlay.setEnabled(true)` 移到 `try/catch` 外層，確保無論如何都會執行
- [x] 修正二：`server/plugins/init.ts` 的 `rehydrateTodayDailyGrantsFromDb()` 同樣包
      `try/catch`，失敗時只是當天配額計數器從 0 開始（等同遷移前的既有行為），不會卡住後面的
      `SyncScheduler.start()`
- [x] 驗證：`docker compose stop postgres` 後重啟 dev server，確認 `SERV.RUN`／
      `SUCCESS ---BASE>sync.scheduler.start` 都正常出現、能用預設帳密登入；`docker compose start
      postgres` 恢復後重啟，確認完全正常（`SUCCESS ---BASE>db.ping` 等）；`npm test`（38 支）在
      DB enabled/disabled 兩種設定下皆通過

## 7. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 實際在 GCP 建立 Compute Engine VM、部署 docker-compose.yml、套用正式環境變數
- [ ] 視需求：`U0xA666666`（HappyFatYoYo 固定展示帳號）是否也要環境變數化
- [ ] 視需求：備份排程的實際自動化（cron + 上傳腳本），本次只給做法建議，不寫自動化腳本
- [ ] 視需求：TLS/憑證設定，待確定部署方式（VM 內網 or 對外）後再評估
