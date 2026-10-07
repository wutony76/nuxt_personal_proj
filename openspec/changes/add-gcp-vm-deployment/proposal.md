# Proposal

## 變更名稱

add-gcp-vm-deployment — 部署到 Google Cloud（Compute Engine e2-micro + Cloud SQL Postgres），並修正上線前的阻擋問題

## 背景

專案需要一個公開的線上 Demo。評估過 Cloud Run、VM + Cloud SQL、VM + 同機 Postgres，以及 AWS 的 EC2／Lightsail 後，
選擇 Google Cloud 的 **e2-micro VM（us-west1 免費額度）+ Cloud SQL**：主機免費，資料庫由 Google 負責備份與維護，
每月約 US$13。

準備部署時發現三個會阻擋上線的問題：

1. **公開頁面預填管理員帳密**：登入頁預填 `hfyy@cc.cc / 123456`，這個帳號在管理員白名單內，密碼寫死在程式碼。
   照現況部署，任何人都能取得完整的後台寫入權限。`SEED_ADMIN_PASSWORD` 只涵蓋另一個管理員帳號。
2. **production build 無法啟動**：`server/utils/encrypt.js` 以 `import 'crypto-js/enc-base64'` 匯入（沒有副檔名），
   Vite 會補副檔名，Node 直接以 ESM 載入時不會，啟動即丟出 `ERR_MODULE_NOT_FOUND`。CI 只做 build、不啟動，所以沒被發現。
3. **production 沒有套用 migration 的方式**：migration 目前只能用 `drizzle-kit`（devDependency）執行，
   production 產物不含 devDependencies。

## 目標

- 可重複執行的部署流程：VM 初始化腳本、手動觸發的 GitHub Actions 部署、失敗自動回滾。
- 公開部署時不存在任何已知的管理員帳密。
- production build 可以啟動，且 CI 會實際啟動驗證。

## 範圍

- 包含：
  - `deploy/gcp-vm/`：setup-vm.sh、remote-deploy.sh、pm2 設定、Caddyfile、Cloud SQL Auth Proxy 服務、環境變數範本、migration 腳本
  - `.github/workflows/deploy-gcp-vm.yml`
  - `server/config/seedAccounts.ts`：種子管理員密碼一律由環境變數設定，production 未設定即拒絕啟動
  - `app/pages/login.vue`：production 改預填 Demo 唯讀帳號
  - `server/utils/encrypt.js`：crypto-js 子路徑補上 `.js`
  - `.github/workflows/ci.yml`：build job 增加 production 啟動 smoke test
  - `docs/deployment/gcp-vm.md`
- 不包含：
  - 實際建立 GCP 資源與執行部署（需在使用者自己的帳號操作）
  - production 模式 E2E 不穩定的追查（既有問題，另案）
  - 刮刮樂試算頁依賴的本機 Python 服務

## 影響面

- 前端：`app/pages/login.vue`（只影響 production 預填值）
- 後端：`server/services/storage.ts`、`server/services/admin/modules/adminAccess.ts`、`server/utils/encrypt.js`、新增 `server/config/seedAccounts.ts`
- 建置與部署：`.github/workflows/`、新增 `deploy/gcp-vm/`

## 風險與對策

- 風險：production 未設定密碼就拒絕啟動，可能讓人以為部署壞了。
  - 對策：錯誤訊息直接指出缺少的變數與文件位置；部署腳本健康檢查失敗時會印出最近的 log。
- 風險：回滾只換回程式，不會復原資料庫結構。
  - 對策：文件明確要求 migration 需與上一版程式相容。
- 風險：e2-micro 記憶體只有 1GB。
  - 對策：不在 VM 上 build；設定 2GB swap；pm2 超過 700MB 自動重啟。

## 驗證方式

- 靜態檢查：`bash -n`、shellcheck、`caddy validate`、actionlint
- 以 Docker 模擬 VM（Debian 12 + Node 22）與 Postgres 16，執行真正的 `remote-deploy.sh`：
  部署、migration、登入權限、Demo 權限、壞版本自動回滾、缺少密碼拒絕啟動、重啟後資料保留

## 成功標準

- [x] 模擬環境中部署成功並通過健康檢查
- [x] 預設密碼無法登入管理員帳號；production 登入頁預填 Demo 唯讀帳號
- [x] 壞版本會自動回滾
- [x] production build 可以啟動，CI 會實際啟動驗證
