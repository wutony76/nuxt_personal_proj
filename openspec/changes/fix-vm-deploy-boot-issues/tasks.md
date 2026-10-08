# Tasks

## 1. 實作

- [x] `deploy/gcp-vm/remote-deploy.sh`：新增 `HEALTH_TIMEOUT_SECONDS`（預設 180），健康檢查改用它換算重試次數
- [x] `server/services/admin/hfyyManage.ts`：F 幣餘額回填加上 `isDbEnabled()` 檢查
- [x] `docs/deployment/gcp-vm.md`：補充冷啟動時間、健康檢查設定、純記憶體部署說明

## 2. 驗證

- [x] `bash -n deploy/gcp-vm/remote-deploy.sh` 語法檢查
- [x] 本機 production build 以 `DATABASE_URL=` 啟動，log 沒有 `BOOT.admin-db-init.failed`
- [x] dev server（接 Postgres）跑 `npm test` 全數通過（38/38）
- [x] 部署到 VM 第二個版本，健康檢查通過、未觸發回滾，線上登入正常

## 3. 交付

- [x] 補齊 validation.md
- [x] 新增 `docs/Engineering Evidence/fix-vm-deploy-boot-issues.md`
- [x] commit
