# Tasks

## 1. 實作

- [x] `setup-vm.sh`：`INSTANCE_CONNECTION_NAME` 選填
- [x] `setup-vm.sh`：Auth Proxy 升級 v2.26.0
- [x] `setup-vm.sh`：pm2 drop-in `After=cloud-sql-proxy.service`
- [x] `docs/deployment/gcp-vm.md`：主控台建立 Cloud SQL / VM 存取權範圍 / 純記憶體模式說明

## 2. 驗證

- [x] `bash -n`、shellcheck
- [x] 與 VM 上手動套用並驗證過的設定比對一致

## 3. 交付

- [x] 補齊 validation.md
- [x] 新增 `docs/Engineering Evidence/update-gcp-vm-setup-for-console-vms.md`
- [x] commit
