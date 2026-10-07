# 正式環境部署檢查清單：PostgreSQL

對應規劃：`openspec/changes/harden-postgres-for-production/`。本機開發（`docker-compose.yml` +
`.env`）不需要照這份清單做，這裡是「要把這套系統搬到正式環境（例如 GCP Compute Engine）」時的
上線前檢查。

## 1. 密碼與帳號

- [ ] `.env` 的 `POSTGRES_PASSWORD` 已換成正式密碼，不是 `.env.example` 裡的範例值 `portfolio`
- [ ] `.env` 的 `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 已設定為正式管理帳號，不是預設的
      `admin@example.com`/`123456`
- [ ] `.env` 的 `SEED_OWNER_PASSWORD`（`hfyy@cc.cc` 的密碼）已設定。這個帳號也在管理員白名單內；
      production 沒設定這兩個密碼會拒絕啟動（見 `server/config/seedAccounts.ts`）
- [ ] `.env` 的 `SEED_DEMO_DATA=false`（正式環境不應該自動產生 5 筆測試帳號 + 20 筆 NPC 假會員）。
      例外：作品集公開 Demo 需要 `test04` 唯讀帳號給訪客瀏覽後台，維持 `true`（見 `gcp-vm.md`）
- [ ] 首次開機後，用正式管理帳號登入一次確認可用；之後若要再調整密碼，走後台「重設密碼」
      （`PATCH /api/admin/members/:id`），不要直接改 `.env` 重啟（重啟不會重新套用已經寫進 DB
      的帳號資料，`SEED_ADMIN_PASSWORD` 只在 DB 完全沒有 admin 時才會被拿來用一次）

## 2. 網路／防火牆

- [ ] `docker-compose.yml` 的 Postgres `ports` 不對外網開放——本機開發用的 `5432:5432` 會把
      Postgres 直接暴露在公網，正式環境建議改成只在 Docker network 內部讓應用程式連線（移除
      `ports` 設定，或至少用雲端防火牆規則限制來源 IP 只允許應用程式所在的那台機器）
- [ ] 應用程式（Nuxt/Nitro）與 Postgres 在同一台 VM、或同一個私有網路（VPC）內，`DATABASE_URL`
      用內部網路位址，不要走公網 IP

## 3. 備份

- [ ] 排程 `pg_dump` 定期備份（建議每日一次），例如：
  ```bash
  docker exec <postgres-container> pg_dump -U portfolio portfolio | gzip > backup-$(date +%F).sql.gz
  ```
  排進 VM 的 crontab，備份檔案上傳到 Cloud Storage 或等效物件儲存（不要只放在同一台 VM 的磁碟上，
  VM 本身出問題備份也會一起不見）
- [ ] 訂出備份保留天數策略（例如只保留最近 30 天，避免儲存空間無限成長）
- [ ] **至少手動演練過一次「從備份還原」**：下載一份備份、`gunzip` 後 `psql` 匯入一個全新的測試
      DB，確認資料正確無誤——沒演練過的備份，實際需要時很可能發現根本用不了

## 4. 監控（最小可行）

- [ ] 確認 `docker compose ps` 的 healthcheck 狀態可以被看到（排進既有監控系統，或至少記錄「手動
      SSH 進去跑這個指令檢查」的操作方式，不要完全沒有任何檢查手段）
- [ ] 確認應用程式的 server log（`SUCCESS ---BASE>db.ping`／`SKIP ---BASE>sync.scheduler` 等，見
      `server/plugins/init.ts`）在正式環境也看得到，用來確認開機時 DB 連線是否正常

## 5. 開機行為自我檢查（上線當下就能驗證，不用等出事）

- [ ] 開機 log 確認 `SUCCESS ---BASE>sync.scheduler.start`（代表 `DATABASE_URL` 有生效、DB 連線正常）
- [ ] 確認 `members` 表筆數符合預期（`SEED_DEMO_DATA=false` 的話應該只有少數幾筆種子 admin，不是
      27 筆那種本機開發的數量）
- [ ] 確認能用 `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 設定的帳密登入後台

## 本次不涵蓋的項目（留待之後視需要另外處理）

- TLS/憑證設定（等確定部署方式——VM 內網連線或對外——後再評估是否需要）
- CI/CD 自動化部署流程
- 備份排程的自動化腳本（上面只給手動指令範例，沒有寫自動化腳本）
- Redis 快取層（視需求的 Phase 4，目前完全沒有設計）
