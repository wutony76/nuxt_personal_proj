# Validation

## 驗證範圍

- 對應變更：`update-gcp-vm-setup-for-console-vms`
- 驗證環境：本機（`bash -n`、`koalaman/shellcheck:stable` Docker image）、GCP VM `hfyy-instance-1`（比對手動套用的設定）

## 功能驗證

- [x] 腳本通過語法與 shellcheck 檢查 — 實際結果：`bash -n` 通過；shellcheck 對 `setup-vm.sh`、`remote-deploy.sh` 無任何警告
- [x] 文件涵蓋這次實際遇到的所有手動步驟 — 實際結果：免費試用陷阱、沙箱範本、存取權範圍 403 與 Cloud Shell 修正、
  純記憶體模式 setup、空資料庫首次啟動時間皆已補上

## 視覺驗證

- 不適用

## 回歸驗證

- 流程：既有 gcloud 建立流程（設定 `INSTANCE_CONNECTION_NAME`）
- 結果：`else` 分支內容與修改前相同，只多了 pm2 drop-in；Auth Proxy 版本改為 VM 上實際運作中的 v2.26.0
- 流程：pm2 drop-in
- 結果：與 VM 上手動建立的 `/etc/systemd/system/pm2-wutony76.service.d/cloud-sql-proxy.conf` 內容相同。
  套用 drop-in 後實際重開機（2026-10-08 09:03:59 開機）：Auth Proxy 09:04:12 啟動 → pm2 09:04:18 啟動
  → 09:05:02 `db.ping` 成功、`sync.scheduler.start`，BOOT 錯誤 0 次，網站 200

## 問題與修正紀錄

- 無

## 結論

- 是否通過：有條件通過
- 已知限制或風險：沒有在全新 VM 上從頭執行修改後的 `setup-vm.sh`（systemd 無法在一般 Docker 容器內模擬）；
  依據是 VM 上以相同指令手動套用並驗證的結果
- 後續追蹤事項：下次建立新 VM 時以修改後的腳本完整跑一次
