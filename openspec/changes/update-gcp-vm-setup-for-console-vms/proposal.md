# Proposal

## 變更名稱

`update-gcp-vm-setup-for-console-vms` — 依實際部署經驗更新 `setup-vm.sh` 與部署文件

## 背景

2026-10-08 實際部署到 GCP VM（`hfyy-instance-1`，以主控台建立）並改接 Cloud SQL 時，
發現部署腳本與文件跟實際情況有落差，當時都是在 VM 上手動處理：

1. `setup-vm.sh` 強制要求 `INSTANCE_CONNECTION_NAME`，不支援先以純記憶體模式上線
2. Cloud SQL Auth Proxy 版本寫死 v2.14.1，實際安裝的是 v2.26.0
3. 開機時 pm2 可能比 Auth Proxy 先啟動，網站連不到 DB 會退回純記憶體模式
4. 文件只有 gcloud 建立流程；用主控台建立的 VM 預設存取權範圍不含 Cloud SQL，
   且自訂服務帳戶時主控台找不到修改選項，最後是用 Cloud Shell 的 `set-service-account` 才改成功
5. 主控台建立 Cloud SQL 時會先推「免費試用 30 天」（Enterprise Plus、8 vCPU），文件沒有提醒

## 目標

- 照著文件與腳本，就能重現這次的實際部署，不需要額外手動步驟

## 範圍

- `deploy/gcp-vm/setup-vm.sh`
  - `INSTANCE_CONNECTION_NAME` 改為選填，未設定時略過 Auth Proxy
  - Auth Proxy 升級為 v2.26.0
  - 安裝 Auth Proxy 時，同時新增 pm2 systemd unit 的 drop-in：`After=cloud-sql-proxy.service`
- `docs/deployment/gcp-vm.md`
  - 主控台建立 Cloud SQL 的注意事項（不要選免費試用、選 Enterprise + 沙箱）
  - 主控台建立的 VM 修改存取權範圍的 Cloud Shell 做法與確認方式
  - 純記憶體模式的 setup 方式、空資料庫第一次啟動的時間

## 不包含

- 不改變既有 gcloud 建立流程
- 不調整 `remote-deploy.sh`、workflow

## 影響面

- 只影響新 VM 的初始化；既有 VM 已手動套用相同設定

## 驗證方式

- `bash -n`、shellcheck
- 新腳本的 Auth Proxy 與 pm2 drop-in 設定，與 VM 上手動套用並驗證過的內容一致

## 成功標準

- [ ] 腳本通過語法與 shellcheck 檢查
- [ ] 文件涵蓋這次實際遇到的所有手動步驟
