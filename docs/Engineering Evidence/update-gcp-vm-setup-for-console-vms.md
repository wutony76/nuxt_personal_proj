# Engineering Evidence：依實際部署經驗更新 VM 初始化腳本與部署文件

## 變更摘要

- **對應變更**：`update-gcp-vm-setup-for-console-vms`
- **變更檔案**
  - 修改：`deploy/gcp-vm/setup-vm.sh`、`docs/deployment/gcp-vm.md`
  - 新增：`openspec/changes/update-gcp-vm-setup-for-console-vms/`

### 背景

2026-10-08 以主控台建立的 VM（`hfyy-instance-1`）先以純記憶體模式上線，之後改接 Cloud SQL（`hfyy-db`）。
過程中有 5 個步驟是在 VM 或主控台上手動處理、腳本與文件沒有涵蓋的：

| 實際遇到的狀況 | 處理 |
|---|---|
| 想先不接資料庫上線，但 `setup-vm.sh` 強制要求 `INSTANCE_CONNECTION_NAME` | 改為選填，未設定時略過 Auth Proxy |
| 腳本的 Auth Proxy 是 v2.14.1 | 升級為 VM 上實際使用的 v2.26.0 |
| 開機時 pm2 可能比 Auth Proxy 先啟動，網站退回純記憶體模式 | 新增 pm2 drop-in `After=cloud-sql-proxy.service` |
| 主控台建立的 VM 存取權範圍不含 Cloud SQL（403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT`），主控台找不到修改選項 | 文件補上 Cloud Shell `set-service-account --scopes=cloud-platform` 與確認方式 |
| 主控台建立 Cloud SQL 會先推 30 天免費試用（Enterprise Plus、8 vCPU） | 文件提醒不要選，改用 Enterprise + 沙箱 |

## 驗證佐證

- 對應 `validation.md` 結論：**有條件通過**

| 項目 | 結果 |
|---|---|
| `bash -n setup-vm.sh` | 通過 |
| shellcheck（`setup-vm.sh`、`remote-deploy.sh`） | 無警告 |
| pm2 drop-in | 與 VM 上手動套用的內容相同；實際重開機後 Auth Proxy（09:04:12）先於 pm2（09:04:18）啟動，網站連上 Cloud SQL、BOOT 錯誤 0 次 |

## 風險與後續追蹤

- **已知風險**：修改後的 `setup-vm.sh` 沒有在全新 VM 上完整執行過（systemd 無法在一般 Docker 容器內模擬）。
- **後續追蹤事項**：下次建立新 VM 時用修改後的腳本完整跑一次。

## 封存前檢查

- [x] validation.md 已完成且結論為「有條件通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` / build / preview（如適用）已確認正常（不適用：未改動應用程式）
- [x] 可執行 `openspec archive`
