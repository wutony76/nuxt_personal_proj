# Tasks

> 本清單為 Implementation 階段的規劃草稿，**本次不執行**。待使用者明確要求後才會開始勾選/實作。

## 1. 規格與設計確認

- [ ] 使用者確認 ORM/migration 工具選型（Drizzle / Prisma / 原生 pg，見 design.md 第 4 節）
- [ ] 完成 proposal 定稿（範圍/風險/驗證方式）
- [ ] 完成 design 定稿（架構/選型/連線層設計）

## 2. Docker 基礎設施

- [ ] 新增 `docker-compose.yml`（postgres service + named volume）
- [ ] 新增 `.env.example`（`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` / `DATABASE_URL`）
- [ ] 確認 `.gitignore` 已排除實際 `.env`

## 3. 連線層

- [ ] 安裝選定的 ORM/driver 依賴（`package.json`）
- [ ] 建立 `server/services/db.ts`（連線 pool singleton + `ping()` + `isDbEnabled()`，見 design.md 5.1 節）
- [ ] 確認 `isDbEnabled()` 為 false 時，既有 `Storage`/`npm run dev` 流程不受影響

## 4. 定時同步機制（Memory → SQL，通用，見 design.md 第 8 節）

- [ ] 建立 `server/services/sync.ts`：`SyncScheduler`（自重啟 async timer，`intervalMs` 預設 300_000）
- [ ] 定義 `SyncSource` 介面（`table` / `primaryKey` / `snapshot()`）與空的註冊表
- [ ] 實作 `runSyncTick()`：逐一呼叫已註冊 `SyncSource.snapshot()` → 組 upsert SQL → 單一 transaction 寫入
- [ ] `server/plugins/init.ts` 註冊 `SyncScheduler` 前先檢查 `isDbEnabled()`，false 時完全不啟動這個
      timer（而非啟動了但每輪都靜默失敗）
- [ ] 失敗處理：try/catch 包住整輪同步，失敗只記錄 log、不中斷主流程
- [ ] 日誌輸出：每輪同步印出耗時與各 `SyncSource` 寫入列數

## 5. 驗證

- [ ] `docker compose up -d postgres` 本機啟動成功
- [ ] 連線層 `ping()` 測試成功
- [ ] `docker compose down` 後以 `docker compose up` 重啟，確認 volume 資料仍在
- [ ] 註冊假 `SyncSource` 測試：兩輪同步確認 upsert 冪等（無重複列）
- [ ] 刻意斷開 DB 測試：確認同步失敗不影響主流程與遊戲 tick、log 有記錄、恢復後自動補上
- [ ] 完全不設定 `DATABASE_URL`（模擬本機沒裝 Docker）：`npm run dev` 正常啟動、`SyncScheduler` 不啟動、
      所有功能行為與遷移前完全一致
- [ ] 既有 `npm test`（36+ 支）全數通過，確認無回歸

## 6. 交付檢查

- [ ] README 補充 Docker 啟動與本機開發說明
- [ ] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [ ] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 7. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 開新 change：搬遷 admin members / role-defs 到 Postgres
- [ ] 開新 change：搬遷遊戲紀錄 / 配額資料到 Postgres
- [ ] 視需求開新 change：導入 Redis 快取層
