# Proposal

## 變更名稱

`harden-postgres-for-production` — 正式環境上線前的種子資料/密碼/部署安全強化

## 背景

`add-postgres-docker`（Phase 1）、`migrate-members-roledefs-postgres`（Phase 2）、
`migrate-game-history-postgres`（Phase 3）已完成 Postgres 持久化遷移的核心架構，但這三個 Phase
的設計全部以「本機開發零設定可跑」為優先，直接照搬到正式環境會有明確的安全疑慮：

- **開機自動種子邏輯**（`hfyyManage.ts` 的 `setStartData()`，見 Phase 2 design.md 第 5 節）：DB 為空
  時會自動建立 2 筆硬編碼密碼的 admin 帳號（`admin@example.com`/`123456`、`hfyy@cc.cc`/`123456`，見
  `server/services/storage.ts` 的 `Storage.init()`）+ 5 筆測試帳號 + 20 筆 NPC 假會員。正式環境第一次
  開機會照樣跑這整套邏輯，產生：(a) 密碼已知、任何人都能登入的 admin 帳號，(b) 不該出現在正式資料庫
  的測試/假會員資料
- `.env.example` 的範例密碼（`portfolio`/`portfolio`）若正式環境忘記更換，等於資料庫密碼等同公開
- 目前完全沒有備份策略，也沒有「Postgres port 不應對外開放」這類部署安全檢查清單
- **admin 帳號的建立邏輯綁死在「DB 是否已有任何 member」這個判斷下**（Phase 2 的
  `hasExistingDbMembers()`），不是獨立判斷「DB 裡有沒有 admin」。正式環境若發生「DB 已有部分會員
  資料、但沒有任何 admin」這種邊界情況（例如 admin 帳號被誤刪、或資料庫是從別處只搬了部分會員過
  來），開機會直接走既有資料回填、完全不會檢查也不會補建 admin，導致沒有人能登入後台——
  使用者在規劃本次變更時明確要求補上這個獨立判斷

使用者計畫把系統部署到 GCP（先前討論過 Compute Engine + 自架 Postgres 容器，約 US$15-20/月），上線前
需要先把這些「只為本機開發方便」的設計調整成正式環境可以安全使用的樣子。

## 目標

1. 讓開機種子邏輯可以透過環境變數關閉，正式環境不會自動產生測試/NPC 假帳號
2. 種子 admin 帳號的 email/密碼改讀環境變數，不依賴寫死在程式碼裡的已知密碼；沒有設定環境變數時
   維持現有開發行為（向下相容，本機開發不受影響）
3. **把「DB 裡有沒有 admin」改成獨立判斷**：開機時先檢查 DB 是否已存在 admin 帳號，有的話預設不
   新增；沒有的話才真正跑建立種子 admin 的流程——不再依附於「DB 是否已有任何一般會員」這個判斷，
   避免「有會員但沒有 admin」這種邊界情況讓後台永遠進不去
4. 整理一份正式環境部署檢查清單文件（密碼管理、防火牆/port 綁定、備份排程），作為交付文件，本次
   不代表要在這次把每一項都程式碼化到底

## 範圍

- 包含：
  - 新增環境變數 `SEED_DEMO_DATA`（布林，預設 `true`）：控制 `setStartData()` 是否要種子
    test01～test05 + 20 筆 NPC 帳號
  - 新增環境變數 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`：種子 admin 帳號改讀這兩個環境變數，
    沒設定時 fallback 回現有的 `admin@example.com`/`123456`（維持本機開發零設定可跑）
  - 新增 `adminAccessService.hasExistingAdmin()`：獨立查詢 DB 裡是否已存在 `is_admin = true` 的
    member，跟「DB 裡有沒有任何 member」（既有的 `hasExistingDbMembers()`）是兩個不同判斷
  - 新增 `adminAccessService.seedMissingAdmin()`：只在 `hasExistingAdmin()` 為 false 時才呼叫，
    取代原本綁死在 `hasExistingDbMembers()` 分支下的 `seedBootAdminsToDb()` 呼叫方式
  - `.env.example` 補充正式環境注意事項註解（`SEED_DEMO_DATA` 正式環境建議設 `false`、
    `SEED_ADMIN_PASSWORD` 務必更換、`POSTGRES_PASSWORD` 務必更換）
  - 撰寫「正式環境部署檢查清單」文件（`docs/` 或 `openspec/` 底下，格式待 design.md 決定）：
    - Postgres 密碼管理建議
    - `docker-compose.yml` 的 port 綁定建議（不對外網開放 5432）
    - 備份策略範例（`pg_dump` 排程 + 上傳 Cloud Storage 的做法與頻率建議）
    - 部署前檢查清單（逐項打勾）
- 不包含：
  - 實際在 GCP 上建立任何雲端資源（VM / Cloud SQL / Cloud Storage bucket 等）——本次只處理程式碼
    與文件層級的準備，真正動手部署留到使用者明確要求時再做
  - CI/CD 自動化部署流程
  - TLS/憑證設定——等實際選定部署方式（VM 內網連線 or 對外）後再決定是否需要
  - Phase 3 已記錄的既有限制（`claimableIssues` 上限、quota P2 擴充等）不在本次處理
  - Redis 快取層（視需求的 Phase 4，仍無任何設計）
  - **實際執行任何指令或寫入程式碼**——本次僅規劃，待使用者明確要求才進入 Implementation

## 影響面

- 後端 Services（規劃）：`server/services/storage.ts`（種子 admin 帳號改讀環境變數）、
  `server/services/admin/hfyyManage.ts`（`setStartData()` 依 `SEED_DEMO_DATA` 決定是否跑測試/NPC
  種子迴圈）
- 設定檔（規劃）：`.env.example` 補充註解
- 新增文件（規劃）：正式環境部署檢查清單

## 風險與對策

- 技術風險：
  - 風險：`SEED_ADMIN_PASSWORD` 若不小心用明碼直接存進程式碼/log，等於製造新的洩漏風險
  - 對策：延續專案既有的 `encodePassword()`/`encodePasswordBcjs()` 雙重雜湊慣例，環境變數裡放的是
    明碼（部署時人工設定，不進版控），程式內部讀到後立刻雜湊，不中途印出明碼
  - 風險：`SEED_DEMO_DATA=false` 若實作時沒注意順序，可能連同「唯一的種子 admin 帳號」都一起跳過，
    導致正式環境開機後完全沒有能登入的 admin
  - 對策：design.md 明確切分「admin 帳號種子」與「測試/NPC 帳號種子」是兩段獨立邏輯，
    `SEED_DEMO_DATA` 只控制後者；`hasExistingAdmin()` 的檢查永遠獨立執行一次，不管
    `hasExistingDbMembers()` 走哪個分支，確保每次開機後 DB 裡一定至少有一筆 admin
  - 風險：`hasExistingAdmin()` 跟既有 `hasExistingDbMembers()`/`rehydrateFromDb()` 的執行順序若
    安排錯誤，可能在 `rehydrateFromDb()` 還沒把既有 admin 讀回記憶體前就誤判「沒有 admin」而重複建立
  - 對策：design.md 明確規定 `hasExistingAdmin()` 查的是 **DB**（不是記憶體），且放在
    `hasExistingDbMembers()`/`rehydrateFromDb()` 分支執行**之後**才判斷，兩者查詢的是同一個資料來源
    （DB 現況），不會有時序競爭問題
- UI/UX 風險：不適用（本次不涉及前端變更）
- 部署風險：
  - 風險：部署檢查清單如果只是文件，沒有強制機制，上線時仍可能忘記調整
  - 對策：checklist 格式設計成「逐項打勾」，且把最關鍵的幾項（密碼、`SEED_DEMO_DATA`）同時寫進
    `.env.example` 的註解裡，降低遺漏機率（多一層提醒而非單一一份文件）

## 驗證方式

本次僅規劃、不執行，暫無程式變更可供驗證；待使用者明確要求進入 Implementation 階段後，才會依
Tasks 清單實際調整程式碼，並補齊 Validation / Engineering Evidence 文件。

## 成功標準

- [ ] 完成環境變數設計與「admin 種子 vs 測試/NPC 種子」的職責切分，含獨立的 `hasExistingAdmin()`
      判斷（design.md 定稿）
- [ ] 完成部署檢查清單文件大綱
- [ ] 完成可追蹤的 Tasks 清單
- [ ] 使用者明確要求後才進入 Implementation（本次不涉及）
