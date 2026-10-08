# Engineering Evidence：修正 VM 首次實機部署發現的開機問題

## 變更摘要

- **對應變更**：`fix-vm-deploy-boot-issues`
- **變更檔案**
  - 修改：`deploy/gcp-vm/remote-deploy.sh`、`server/services/admin/hfyyManage.ts`、`docs/deployment/gcp-vm.md`
  - 新增：`openspec/changes/fix-vm-deploy-boot-issues/`（proposal / design / tasks / validation）

### 背景

2026-10-08 第一次把專案實際部署到 GCP VM（`hfyy-instance-1`，e2-micro，us-west1-b）。
這次沒有接 Cloud SQL，以純記憶體模式上線（`DATABASE_URL` 留空），網址 `https://8-231-244-199.sslip.io`。
`add-gcp-vm-deployment` 先前只在 Docker 模擬環境驗證過，實機部署才發現下面兩個問題。

### 發現的問題

| 問題 | 影響 | 處理 |
|---|---|---|
| 健康檢查只等 60 秒，e2-micro 首次冷啟動花了 106 秒 | 第一次部署沒有上一版所以沒出事；之後每次部署都會被誤判失敗並自動回滾，等於無法部署新版本 | 改為 `HEALTH_TIMEOUT_SECONDS`，預設 180 秒 |
| F 幣餘額回填（`571bef6`）沒有檢查 `isDbEnabled()` | 純記憶體模式每次開機都印出「DATABASE_URL 有設定但 DB 當下連不上」，與實際狀況不符；後面的 6hc-cd 限額回填被跳過（純記憶體模式下本來就沒有資料，無實際影響） | 加上 `isDbEnabled()` 檢查，與同區塊其他 9 個回填函式一致 |

### 為什麼 Docker 模擬沒發現

- **健康檢查**：模擬環境用的是本機 CPU，啟動很快。e2-micro 是共享 CPU，burst 額度用完時會明顯變慢。
- **F 幣回填**：模擬時接了 Postgres，只有純記憶體模式才會走到這條錯誤路徑。

## 驗證佐證

- 對應 `validation.md` 結論：**通過**

| 項目 | 結果 |
|---|---|
| `bash -n remote-deploy.sh` | 通過 |
| 本機 production build（linux/amd64，`DATABASE_URL=`） | `BOOT.admin-db-init.failed` 0 次，首頁 200 |
| dev server 接 Postgres，`npm test` | 38/38 通過 |
| VM 部署第二個版本 | exit 0，未回滾，pm2 restarts 0 |
| VM 新版本開機 log | `BOOT.admin-db-init.failed` 0 次（舊版本每次開機都出現） |
| 線上登入 | `test04` 成功；`admin` 用 `.env` 密碼成功、用 `123456` 被拒 |

### 冷啟動時間實測

| 部署 | 冷啟動（`SERV.INIT` → `Listening`） | 情境 |
|---|---|---|
| 第一次（`14bc0dc`） | 106 秒 | 剛安裝完 Node / pm2 / Caddy |
| 第二次（`fixboot`） | 12 秒 | 一般狀態 |

差異來自 e2-micro 的共享 CPU。180 秒上限以最壞情況為基準。

## 風險與後續追蹤

- **已知風險**
  - 這次部署只花 12 秒，180 秒上限沒有在慢啟動情境下被實際觸發驗證。
  - 健康檢查拉長後，真正壞掉的版本最多要等 180 秒才會回滾。
- **後續追蹤事項**
  - 縮短開機時間：25 個種子帳號在開機時同步做 bcrypt cost 12 雜湊，是慢啟動的主因。
  - VM 磁碟剩約 2.2G，`~/hfyy` 舊 clone 佔 605MB，可視需要清除。
  - 目前資料只存在記憶體，重啟或部署都會歸零；需要保留時可在 VM 上用 Docker 跑 Postgres。
  - GitHub Actions 部署（`deploy-gcp-vm.yml`）尚未設定 Secrets，這次是從本機 build 後手動上傳部署。

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` / build / preview（如適用）已確認正常
- [x] 可執行 `openspec archive`
