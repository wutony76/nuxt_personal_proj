# Tasks

> 本清單為 Implementation 階段的規劃草稿，**本次不執行**。待使用者明確要求後才會開始勾選/實作。

## 1. 規格與設計確認

- [ ] 完成 proposal 定稿（範圍/風險/驗證方式）
- [ ] 完成 design 定稿（環境變數設計 / 職責切分 / 部署檢查清單大綱）

## 2. 環境變數與種子邏輯調整

- [ ] `server/services/storage.ts`：`Storage.init()` 的 2 筆種子帳號，第一筆（`U0xA000001`）改讀
      `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`（未設定時 fallback 回現有字面值）
- [ ] `server/services/admin/hfyyManage.ts`：`setStartData()` 新增 `SEED_DEMO_DATA` 判斷，`false`
      時跳過 test01~05 與 20 筆 NPC 種子迴圈，但 `seedBootAdminsToDb()` 永遠執行
- [ ] `.env.example` 補充 `SEED_DEMO_DATA`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 與正式環境
      注意事項註解

## 3. 部署檢查清單文件

- [ ] 撰寫 `docs/deployment/postgres-production-checklist.md`（密碼與帳號 / 網路防火牆 / 備份 /
      監控四大項，見 design.md 第 6 節大綱）

## 4. 驗證

- [ ] `SEED_DEMO_DATA=false`：開機後 `members` 表只有 2 筆種子 admin，無 test01~05/NPC 帳號
- [ ] `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 自訂值：開機後能用自訂帳密登入 `U0xA000001`
- [ ] 未設定任何新環境變數：行為與 Phase 2/3 完成時的現狀完全一致（向下相容）
- [ ] 既有 `npm test`（含 `test:roles`）全數通過，確認無回歸

## 5. 交付檢查

- [ ] 補齊 Validation 文件（`openspec/templates/validation.md`）
- [ ] 補齊 Engineering Evidence 文件（`openspec/templates/engineering-evidence.md`）

## 6. 後續（不在本 change 範圍，僅記錄於此供追蹤）

- [ ] 實際在 GCP 建立 Compute Engine VM、部署 docker-compose.yml、套用正式環境變數
- [ ] 視需求：`U0xA666666`（HappyFatYoYo 固定展示帳號）是否也要環境變數化
- [ ] 視需求：備份排程的實際自動化（cron + 上傳腳本），本次只給做法建議，不寫自動化腳本
- [ ] 視需求：TLS/憑證設定，待確定部署方式（VM 內網 or 對外）後再評估
