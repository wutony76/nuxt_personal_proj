# Validation

## 結論：通過（尚未在真實 GCP 環境部署）

## 1. 靜態檢查

| 項目 | 工具 | 結果 |
|---|---|---|
| `setup-vm.sh`、`remote-deploy.sh` | `bash -n`、shellcheck | 無錯誤、無警告 |
| Caddyfile | `caddy validate`（caddy:2 映像檔） | Valid configuration |
| pm2 設定 | `node -e "require(...)"` | 可正常載入 |
| `ci.yml`、`deploy-gcp-vm.yml` | actionlint | 本次新增的內容無警告（`ci.yml` 原有的 dev server 步驟有一則既有的 SC2034 提示） |

## 2. Docker 模擬部署

環境：
- 「VM」：`node:22-bookworm` 容器，安裝 pm2，目錄結構與 `/srv/portfolio` 相同
- 資料庫：`postgres:16-alpine`，密碼刻意包含 `@` 與空白，驗證 `DATABASE_URL` 的 URL encode
- 部署包：以 HEAD 加上本次改動建立的乾淨複本 build，依 workflow 相同方式打包（9.6MB）

### 2.1 第一次執行：發現兩個問題

| 問題 | 原因 | 修正 |
|---|---|---|
| 啟動時 `ERR_MODULE_NOT_FOUND: crypto-js/enc-base64` | 子路徑匯入沒有副檔名；Mac 上的 production build 也一樣失敗，確認不是平台問題 | `encrypt.js` 補上 `.js` |
| 第一次部署失敗時，腳本試圖「回滾到 current」 | `readlink -f` 遇到不存在的路徑仍會回傳路徑本身 | 先確認 `current` 是 symlink 才讀取；回滾目標不可等於新版本 |

### 2.2 修正後

| 項目 | 結果 |
|---|---|
| 部署流程 | 解壓 → 安裝 migration 依賴 → migration → 切換 → 健康檢查通過 |
| 開機 log | `Listening on http://127.0.0.1:3000`、`SUCCESS ---BASE>sync.scheduler.start`，無時區警告 |
| 資料庫 | 3 筆 migration、9 個資料表、27 位會員（2 位管理員） |
| `test04@test.cc` / `222222` | 200；`/api/admin/me` 回傳 `isDemo: true` |
| `hfyy@cc.cc` / 環境變數密碼 | 200 |
| `hfyy@cc.cc` / `123456` | 400（拒絕） |
| `admin@example.com` / 環境變數密碼 | 200 |
| `admin@example.com` / `123456` | 400（拒絕） |
| production 登入頁預填 | `test04@test.cc` |

### 2.3 失敗情境

| 情境 | 結果 |
|---|---|
| 部署一個啟動即拋錯的版本 B | 健康檢查失敗 → 印出錯誤 log → 回滾到版本 A，首頁 200 |
| `.env` 缺少 `SEED_OWNER_PASSWORD` | 拒絕啟動，訊息：「production 環境必須設定 SEED_OWNER_PASSWORD」 |
| `pm2 restart` 後 | 會員數維持 27 位 |

## 3. 未驗證項目

- 真實 GCP 環境：Cloud SQL Auth Proxy 連線、Caddy 申請憑證、GitHub Actions 的 SSH 部署。需在建立 GCP 資源後依 `docs/deployment/gcp-vm.md` 第 9 節驗證。
- `setup-vm.sh` 未在真實 Debian VM 上執行，只通過靜態檢查。
