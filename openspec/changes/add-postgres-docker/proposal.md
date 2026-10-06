# Proposal

## 變更名稱

`add-postgres-docker` — 導入 PostgreSQL（Docker）作為資料持久化基礎建設

## 背景

目前 `server/services/storage.ts` 的 `Storage` class 把幾乎所有運行期資料（帳號 `account`、session、彩票期別/彩池
`lottery`、各玩法 instance、復古遊戲 `retroGames` 等）都放在 process 記憶體的 static 屬性上，`Storage.init()`
只在 server 啟動時跑一次；只要重啟 server，這些資料就全部歸零。後台 members / role-defs **也是純記憶體**
（`adminAccess.ts` 的 `accounts`/`adminIds`/`memberRoleId`、`roleDefs.ts` 的 `roles` Map，見
`migrate-members-roledefs-postgres` change 的調查記錄），並非 JSON 檔案持久化
（註：本文件先前誤寫為「JSON 檔案」，已於此訂正）。既有待辦（遊戲紀錄 coin 每日上限之後需要後台管理介面調整常數、
6hc-cd 配額目前只到分頁層級）都已經隱含「之後需要可查詢、可持久化的資料層」的方向。使用者詢問「最終用 Docker 架設
時該選哪種資料庫」，雙方已討論並決定方向為 PostgreSQL（關聯式資料、交易保證適合配額/期別這類易併發場景），
使用者要求本次先規劃、暫不動手實作。

## 目標

建立一套可在 Docker 環境中運行的 PostgreSQL 基礎設施與連線層，作為未來把 `Storage` 記憶體狀態與 JSON 檔案資料
逐步搬遷到持久化儲存的地基；本次僅打地基，不搬遷任何既有業務資料或邏輯。

## 範圍

- 包含：
  - 新增 `docker-compose.yml` 定義 `postgres` service（image、volume、環境變數）
  - ORM / migration 工具選型決定（見 design.md）
  - 規劃 DB 連線層（例如 `server/services/db.ts`）與最小連線健康檢查的介面設計
  - `.env.example` 新增 `DATABASE_URL` 等必要環境變數規劃
  - `package.json` 應新增的依賴清單（ORM/driver）
  - README 應補充的 Docker 啟動與本機開發說明
  - **通用「記憶體 → SQL 定時同步」排程機制設計**（見 design.md 第 8 節）：每 5 分鐘把目前存在
    `Storage` 裡的資料同步寫入 SQL，機制本身不綁定任何具體資料表，供之後每個 Phase 各自接上
- 不包含：
  - 搬遷 `Storage` 現有任何 class 的資料到 DB（帳號、session、彩票期別、彩池、復古遊戲紀錄、members/role-defs
    JSON 皆維持原狀）——本次只設計同步「機制」，不實作任何具體 `SyncSource`、不建任何業務資料表
  - server 重啟時「從 SQL 回填記憶體」的復原邏輯（本次同步方向僅 memory → SQL 單向，回填留待後續決定）
  - 正式 production 部署設定（TLS、備份策略、雲端代管）
  - Redis 或其他快取層導入（列為後續階段，非本次範圍）
  - **實際執行任何指令或寫入程式碼**（`docker compose up`、建表、撰寫 migration、新增依賴等）——本次僅規劃到
    可執行的程度，待使用者明確要求才進入 Implementation

## 影響面

- 新增設定檔（規劃）：`docker-compose.yml`、`.env.example`
- 後端 API/Services（規劃）：新增 `server/services/db.ts`（或等效連線模組），不調整既有 `Storage` 相關程式碼
- 設定或常數（規劃）：`package.json` 新增 ORM/driver 依賴

## 風險與對策

- 技術風險：
  - 風險：之後要把 `Storage` 大量 static 屬性操作改寫成 DB 讀寫，牽涉範圍廣（40+ 個玩法 class、admin 模組），
    一次做完風險極高
  - 對策：本次只打地基（Docker + 連線層 + 選型），實際資料搬遷拆成後續每個 domain 各自一個 change
    （例如先搬 members/role-defs，再搬遊戲紀錄/配額）
  - 風險：ORM/migration 工具選型會長期影響後續所有搬遷工作的難易度
  - 對策：design.md 中列出選項並說明 trade-off，待使用者確認後才定案
  - 風險：定時同步採「每 5 分鐘」而非即時寫入，server 若在兩次同步之間 crash，會遺失最多 5 分鐘的資料
  - 對策：本次先接受此權衡（比現況「重啟全歸零」已是大幅改善），同步機制設計成失敗不中斷主流程、下一輪
    自動重試；若之後有「零資料遺失」需求，留待後續 change 評估即時寫入或 WAL 等方案
- UI/UX 風險：不適用（本次不涉及前端變更）
- 開發體驗風險：
  - 風險：導入 Docker 依賴後，若本機開發被迫「必須先把 Postgres 容器跑起來才能 `npm run dev`」，會提高門檻
  - 對策：DB 連線透過環境變數控制是否啟用，初期讓 Postgres 屬於「選用」而非強制，現有無狀態流程不受影響

## 驗證方式

本次僅規劃、不執行，暫無程式變更可供驗證；待使用者明確要求進入 Implementation 階段後，才會依 Tasks 清單
實際跑 `docker compose up`、測試連線，並補齊 Validation / Engineering Evidence 文件。

## 成功標準

- [ ] 完成 Docker Compose 服務設計與 ORM/migration 工具選型（design.md 定稿）
- [ ] 完成可追蹤的 Tasks 清單
- [ ] 使用者明確要求後才進入 Implementation（本次不涉及）
