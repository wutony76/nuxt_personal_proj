# Engineering Evidence：部署到 Google Cloud（VM + Cloud SQL）

## 變更摘要

- **對應變更**：`add-gcp-vm-deployment`
- **變更檔案**
  - 新增：`deploy/gcp-vm/`、`.github/workflows/deploy-gcp-vm.yml`、`server/config/seedAccounts.ts`、`docs/deployment/gcp-vm.md`
  - 修改：`server/services/storage.ts`、`server/services/admin/modules/adminAccess.ts`、`server/utils/encrypt.js`、
    `app/pages/login.vue`、`.github/workflows/ci.yml`

### 架構

e2-micro VM（us-west1 免費額度）+ Cloud SQL Postgres，每月約 US$13。Caddy 處理 HTTPS，pm2 管理單一 Node process，
Cloud SQL Auth Proxy 以 VM 服務帳戶連線資料庫。GitHub Actions 手動觸發部署，健康檢查失敗自動回滾。

選擇過程比較了 Cloud Run（每月約 US$50～60，需固定 1 台且 CPU 常駐）、VM + 同機 Postgres（價差約 US$3，
但要自己負責備份），以及 AWS EC2／Lightsail。

### 準備部署時發現的問題

| 問題 | 影響 | 處理 |
|---|---|---|
| 登入頁預填 `hfyy@cc.cc / 123456`，且該帳號在管理員白名單、密碼寫死 | 公開部署後任何人都有完整後台權限 | 密碼改由環境變數設定，production 未設定拒絕啟動；production 改預填 Demo 唯讀帳號 |
| `import 'crypto-js/enc-base64'` 沒有副檔名 | production build 啟動即崩潰（自 10/06 起）；CI 只 build 不啟動，沒有發現 | 補上 `.js`；CI 增加 production 啟動 smoke test |
| migration 只能用 devDependency 的 drizzle-kit 執行 | production 無法建立資料表 | 部署時改用 drizzle-orm 內建 migrator |
| 部署腳本第一次失敗時誤判有上一版可回滾 | 會重啟同一個失敗的版本 | 先確認 `current` 是 symlink 再讀取 |

後兩個部署相關問題，是用 Docker 模擬 VM 實際執行部署腳本時才發現的。

## 驗證

| 項目 | 結果 |
|---|---|
| shellcheck、caddy validate、actionlint | 通過 |
| Docker 模擬部署（Debian 12 + Node 22 + Postgres 16） | 部署成功，3 筆 migration、9 個資料表 |
| 管理員帳號用 `123456` 登入 | 兩個帳號皆被拒絕 |
| Demo 帳號 `test04` | 可登入，`isDemo: true` |
| 部署壞版本 | 自動回滾到上一版 |
| 缺少密碼環境變數 | 拒絕啟動並指出缺少的變數 |
| 重啟 | 資料保留 |

詳細數據見 `openspec/changes/add-gcp-vm-deployment/validation.md`。

## 風險與後續

- **尚未在真實 GCP 環境部署**：Cloud SQL Auth Proxy、Caddy 憑證、GitHub Actions SSH 需在建立資源後驗證。
- **production 模式 E2E 不穩定（既有問題）**：約 34 項失敗，上線前建議先追查。
- **回滾不會復原資料庫結構**：migration 需與上一版程式相容。
- **重啟期間約數秒無法服務**：採用 `pm2 delete` + `start`，以確保切換到正確的版本目錄。

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [ ] 完成第一次真實部署
- [ ] `openspec archive`
