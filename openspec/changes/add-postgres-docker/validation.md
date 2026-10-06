# Validation

## 驗證範圍

- 對應變更：`add-postgres-docker`（Phase 1：Docker Compose + 連線層 + 通用批次同步機制地基）
- 驗證環境：本機 dev（macOS，Docker Desktop 29.1.3，Postgres 16-alpine，Node 22.22.2）

## 功能驗證

依 proposal 的「成功標準」逐項驗證：

- [x] 完成 Docker Compose 服務設計與 ORM/migration 工具選型（design.md 定稿）— 實際結果：Drizzle +
      `postgres`（postgres.js driver）定案，`docker-compose.yml` 已建立並實測可啟動
- [x] 完成可追蹤的 Tasks 清單 — 實際結果：`tasks.md` 全數項目已勾選（1 項延後到 Phase 2/3，見下方說明）
- [x] 使用者明確要求後才進入 Implementation — 實際結果：使用者在對話中明確要求「可以幫我開始實作規劃好
      的」，並在實作前額外確認 ORM 選型（Drizzle）與推進節奏（先完成 Phase 1 驗證再決定後續）

## 回歸驗證

- 流程：`isDbEnabled()` 為 false（無 `.env`/`DATABASE_URL`）時，`npm run dev` 是否與遷移前行為一致
  - 結果：通過。`npm test`（38 支）連續執行兩輪皆全數通過；server log 印出
    `SKIP ---BASE>sync.scheduler（DATABASE_URL 未設定，維持純記憶體模式）`，確認 `SyncScheduler` 完全
    不啟動
- 流程：`isDbEnabled()` 為 true（`.env` 指向本機 docker-compose 啟動的 Postgres）時，既有功能是否受影響
  - 結果：通過。`npm test`（38 支）執行兩輪（第一輪 1 支暫時性失敗、重跑全過，判定為既有測試套件本身
    的時序性 flaky，詳見下方問題紀錄，非本次變更造成）；server log 印出
    `SUCCESS ---BASE>db.ping` 與 `SUCCESS ---BASE>sync.scheduler.start`

## 連線層 / 同步機制驗證

- `docker compose up -d`：本機啟動成功，`docker compose ps` 顯示 `healthy`
- `ping()`：連線層健康檢查成功（server log `SUCCESS ---BASE>db.ping`）
- Volume 持久化：手動在 Postgres 內建表寫入測試資料 → `docker compose down` → `docker compose up -d`
  → 重新查詢，資料完整保留（確認 named volume 真的掛載、不是 container 內部暫存）
- `SyncSource` upsert 冪等性：用暫時性驗證腳本（驗證後已刪除，未留在 repo）註冊一個假
  `SyncSource`，以 200ms 間隔跑 3 輪同步，確認目標 table 全程維持「恰好 2 筆」且 `value` 欄位正確
  更新為最新快照值，不會因重複同步產生重複列
- `isDbEnabled()` 的 guard 一致性：開機回填（none，Phase 1 無回填邏輯）／`SyncScheduler` 啟動／
  write-through（none，Phase 1 無 write-through 呼叫端）三類呼叫端中，本次只實作「批次 Scheduler」
  一類，已確認其 guard 生效

## 問題與修正紀錄

- 問題：Implementation 過程中因手動重啟 dev server 操作不當，一度產生多個重複的 `nuxt dev --port 6100`
  殘留 process（其中一個因埠號被佔用改綁到 3000），並觸發 Nitro 開發伺服器的
  `[unhandledRejection] No worker available` 瞬間錯誤與自動重啟迴圈
  - 發現方式：`curl` health check 回應與預期埠號不符、`ps aux` 檢查發現多組重複 process
  - 修正方式：`pkill -9` 清除所有殘留的 `nuxt dev`/`@nuxt/cli` process 後，重新乾淨啟動單一 dev server
    實例，問題隨即消失，後續多輪測試穩定
  - 是否已重新驗證：是，清理後連續兩輪 `npm test` 皆 38/38 全過，`db.ping`／`SyncScheduler` 行為正常
  - 補充：這是本次操作過程中的環境問題，與 `add-postgres-docker` 本身的程式邏輯無關；記錄於此供日後
    操作參考（見 [[feedback_temp_dev_server_testing]]）
- 問題：`npm test` 在 DB-enabled 設定下第一次執行時，38 支裡有 1 支暫時性失敗
  - 發現方式：`npm test` 彙總結果顯示「成功 37 支，失敗 1 支」
  - 修正方式：立即重跑 `npm test`，第二輪 38/38 全過；同一現象在 DB-disabled 設定下的第一輪測試也出現
    過一次（且與本次變更無關的檔案改動無關），判定為既有測試套件本身對 dev server 長時間執行後的狀態
    或時序較敏感的既有 flaky 行為，不是本次 Postgres 相關程式碼造成的回歸
  - 是否已重新驗證：是，兩種設定（DB enabled / disabled）各自連續跑出至少一輪 38/38 全過的穩定結果

## 結論

- 是否通過：是
- 已知限制或風險：
  - 「刻意斷開 DB 測試」這項驗證案例，因 Phase 1 的 `SyncSource` 註冊表本來就是空的（設計如此），
    沒有真正會失敗的同步動作可供測試；程式碼層級的 try/catch 容錯已到位（見 `sync.ts`），實際的
    「斷線中失敗不影響主流程」行為會在 Phase 2/3 真正註冊 `SyncSource` 後一併驗證
  - 既有測試套件本身存在低機率的時序性 flaky（詳見上方問題紀錄），非本次變更引入，但會影響日後
    類似變更的驗證判讀，建議后續若有餘力可另外追查根因
- 後續追蹤事項：
  - Phase 2（`migrate-members-roledefs-postgres`）與 Phase 3（`migrate-game-history-postgres`）待
    使用者明確要求後依序進入 Implementation
  - 本機目前 `.env`／Postgres container 維持在啟用狀態，供後續 Phase 接續開發使用
