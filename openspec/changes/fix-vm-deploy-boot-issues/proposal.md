# Proposal

## 變更名稱

`fix-vm-deploy-boot-issues` — 修正 VM 首次實機部署發現的兩個開機問題

## 背景

2026-10-08 第一次把專案實際部署到 GCP VM（`hfyy-instance-1`，e2-micro，純記憶體模式，
`DATABASE_URL` 留空），網站成功上線，但過程中發現兩個問題：

1. **健康檢查等待時間不夠**：e2-micro 冷啟動約 106 秒才開始監聽（主要時間花在 25 個種子帳號的
   bcrypt cost 12 雜湊），`deploy/gcp-vm/remote-deploy.sh` 的健康檢查只等 60 秒（30 次 × 2 秒）。
   第一次部署因為沒有上一版可回滾才沒有造成影響；**之後每次部署都會被誤判失敗並自動回滾**，
   等於無法透過 workflow 部署新版本。
2. **純記憶體模式開機時印出誤導的錯誤**：`HFYYManage.setStartData()` 的 F 幣餘額回填
   （`571bef6` 新增）直接呼叫 `getDb()`，沒有先檢查 `isDbEnabled()`。`DATABASE_URL` 未設定時
   會拋錯，落入 catch 印出 `BOOT.admin-db-init.failed —— DATABASE_URL 有設定但 DB 當下連不上`，
   訊息與實際狀況不符。同一個 try 區塊內其他 9 個回填函式都有 `if (!isDbEnabled()) return`，
   只有這段漏掉。

## 目標

- 部署腳本能正確等待 e2-micro 的冷啟動，不會誤判失敗
- 純記憶體模式開機不再出現 `BOOT.admin-db-init.failed`

## 範圍

- `deploy/gcp-vm/remote-deploy.sh`：健康檢查等待時間改為可設定，預設 180 秒
- `server/services/admin/hfyyManage.ts`：F 幣餘額回填前加上 `isDbEnabled()` 檢查
- `docs/deployment/gcp-vm.md`：補充冷啟動時間與健康檢查說明

## 不包含

- 不縮短開機時間本身（例如降低 bcrypt cost、改成非同步雜湊），列為後續追蹤
- 不調整 `.github/workflows/ci.yml` 的 production smoke test（CI runner CPU 較快，未遇到逾時）

## 影響面

- 只影響部署腳本與開機流程，不影響 API 行為與前端
- 接 DB 的情境：`isDbEnabled()` 為 true，回填邏輯與修改前完全相同

## 風險與對策

| 風險 | 對策 |
|---|---|
| 健康檢查拉長後，真正壞掉的版本要等更久才回滾 | 180 秒仍在可接受範圍；可用 `HEALTH_TIMEOUT_SECONDS` 覆寫 |
| 修改開機流程影響接 DB 的情境 | 只加 guard，DB 啟用時執行路徑不變；以 dev（接 Postgres）跑完整測試確認 |

## 驗證方式

- 本機 production build 以 `DATABASE_URL=` 啟動，確認沒有 `BOOT.admin-db-init.failed`
- 本機 dev server（接 Postgres）跑 `npm test`，確認無回歸
- 實際部署到 VM 第二個版本，健康檢查通過、不觸發回滾

## 成功標準

- [ ] 純記憶體模式開機 log 不再出現 `BOOT.admin-db-init.failed`
- [ ] 接 DB 模式 F 幣餘額回填行為不變，`npm test` 全數通過
- [ ] VM 第二次部署成功，不觸發回滾
