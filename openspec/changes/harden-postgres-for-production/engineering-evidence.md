# Engineering Evidence

## 變更摘要

- 對應變更：`harden-postgres-for-production`（正式環境上線前的種子資料/密碼/部署安全強化）
- 變更檔案清單：
  - `server/services/storage.ts`（`Storage.init()` 的種子 admin 帳號改讀
    `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`）
  - `server/services/admin/modules/adminAccess.ts`（新增 `hasExistingAdmin()`/`seedMissingAdmin()`）
  - `server/services/admin/hfyyManage.ts`（`setStartData()` 新增 `SEED_DEMO_DATA` 判斷 + 獨立的
    admin 存在檢查）
  - `.env.example`（新增 `SEED_DEMO_DATA`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 與正式環境
    注意事項註解）
  - `docs/deployment/postgres-production-checklist.md`（新增：部署檢查清單文件）
  - `server/services/admin/hfyyManage.ts`（追加修正：整段 admin/role-defs 開機邏輯包 try/catch，
    DB 連不上時退回純記憶體繼續開機，不卡住遊戲引擎）
  - `server/plugins/init.ts`（追加修正：`rehydrateTodayDailyGrantsFromDb()` 同樣包 try/catch）
  - `openspec/changes/harden-postgres-for-production/`（tasks.md 勾選完成、design.md 記錄
    Implementation 階段的調整）
- Commit / PR 參考：（本次對話尚未 commit，待下一輪 commit 時附上 commit hash）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（驗證用環境變數/請求皆為暫時性，驗證後已清理，未留在 repo；以下為實際輸出摘錄）：
  - 全新 DB + `SEED_DEMO_DATA=false` + 自訂帳密：`members` 表僅 2 筆，自訂帳密登入回傳 200
  - 「有會員但沒有 admin」邊界情境：手動清空 2 筆既有 admin 的 `is_admin`，重啟後自動補回
    `U0xA000001` 為 admin，且可用預設帳密登入
  - 未設定新環境變數：既有 27 筆 members/4 筆 role_defs 不變，`npm test`（38 支）穩定通過
  - **追加修正驗證**：`docker compose stop postgres` 後重啟，確認 `SERV.RUN`/
    `sync.scheduler.start` 正常出現（遊戲引擎沒有被 DB 連線失敗卡住）、能用預設帳密登入；
    `docker compose start postgres` 後重啟確認完全恢復正常；DB enabled/disabled 兩種設定下
    `npm test` 皆通過（詳見 validation.md「追加修正」章節）

## 風險與後續追蹤

- 已知風險：
  - `seedMissingAdmin()` 固定使用 id `U0xA000001` 做 upsert 目標，若該 id 被其他非 admin 會員佔用
    會被直接升級為 admin，而非另外新建（見 validation.md 說明）
  - `U0xA666666` 固定展示帳號不受本次環境變數影響
- 後續追蹤事項（Open Questions 延伸）：
  - 實際在 GCP 部署留待使用者明確要求時再進行
  - `U0xA666666` 環境變數化、備份自動化腳本、TLS 設定皆視需求另行規劃

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（多種環境變數組合皆驗證過）
- [ ] 可執行 `openspec archive` — 待使用者確認後續是否還要在這塊繼續擴充（`U0xA666666`
      環境變數化等 tasks.md 第 6 節項目）再決定是否封存
