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

## 6. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 實際在 GCP 建立 Compute Engine VM、部署 docker-compose.yml、套用正式環境變數
- [ ] 視需求：`U0xA666666`（HappyFatYoYo 固定展示帳號）是否也要環境變數化
- [ ] 視需求：備份排程的實際自動化（cron + 上傳腳本），本次只給做法建議，不寫自動化腳本
- [ ] 視需求：TLS/憑證設定，待確定部署方式（VM 內網 or 對外）後再評估
