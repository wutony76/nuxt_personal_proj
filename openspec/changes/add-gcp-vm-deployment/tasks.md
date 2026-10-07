# Tasks

## 1. 評估

- [x] 比較 Cloud Run、VM + Cloud SQL、VM + 同機 Postgres
- [x] 比較 Google Cloud 與 AWS（EC2、Lightsail）
- [x] 確認專案限制：單一 instance、WebSocket、secure cookie 需 HTTPS、資料庫可選

## 2. 上線阻擋問題

- [x] 新增 `server/config/seedAccounts.ts`，兩個種子管理員密碼改由環境變數設定，production 未設定即拒絕啟動
- [x] `login.vue`：production 預填 Demo 唯讀帳號
- [x] `encrypt.js`：crypto-js 子路徑補上 `.js`
- [x] `ci.yml`：build job 增加 production 啟動 smoke test

## 3. 部署檔案

- [x] `deploy/gcp-vm/setup-vm.sh`
- [x] `deploy/gcp-vm/remote-deploy.sh`（含健康檢查與自動回滾）
- [x] `deploy/gcp-vm/ecosystem.config.cjs`
- [x] `deploy/gcp-vm/Caddyfile.template`
- [x] `deploy/gcp-vm/cloud-sql-proxy.service.template`
- [x] `deploy/gcp-vm/env.production.example`
- [x] `deploy/gcp-vm/migrate/`
- [x] `.github/workflows/deploy-gcp-vm.yml`

## 4. 驗證

- [x] 靜態檢查：bash -n、shellcheck、caddy validate、actionlint
- [x] Docker 模擬部署：成功部署、migration、登入、Demo 權限、登入頁預填
- [x] 壞版本自動回滾
- [x] 缺少密碼拒絕啟動
- [x] 重啟後資料保留

## 5. 文件

- [x] `docs/deployment/gcp-vm.md`
- [x] `docs/Engineering Evidence/add-gcp-vm-deployment.md`
- [x] `docs/Tech Notes/README.md` 新增部署相關問答

## 6. 待使用者執行

- [ ] 建立 GCP 資源並完成第一次部署（依 `docs/deployment/gcp-vm.md`）
