# Design

## 1. `setup-vm.sh`

### `INSTANCE_CONNECTION_NAME` 改為選填

```bash
INSTANCE_CONNECTION_NAME="${INSTANCE_CONNECTION_NAME:-}"
...
if [[ -z "$INSTANCE_CONNECTION_NAME" ]]; then
  echo "未設定 INSTANCE_CONNECTION_NAME，略過（純記憶體模式，.env 的 DATABASE_URL 請留空）"
else
  # 安裝 Auth Proxy、寫 systemd unit、pm2 drop-in、啟動
fi
```

- `DOMAIN` 仍為必填（HTTPS 必須）。
- `deploy/gcp-vm/migrate/migrate.mjs` 在 `DATABASE_URL` 為空時已會略過 migration，不需修改。

### pm2 排在 Auth Proxy 之後啟動

```bash
sudo mkdir -p "/etc/systemd/system/pm2-${USER}.service.d"
printf '[Unit]\nAfter=cloud-sql-proxy.service\nWants=cloud-sql-proxy.service\n' \
  | sudo tee "/etc/systemd/system/pm2-${USER}.service.d/cloud-sql-proxy.conf" >/dev/null
```

- `pm2 startup systemd -u $USER` 建立的 unit 名稱是 `pm2-$USER.service`，在步驟 4 已建立。
- 用 drop-in 而非修改 pm2 產生的 unit 檔，`pm2 startup` 重跑時不會被覆蓋。
- 與 VM 上手動套用的內容相同（`systemctl show pm2-wutony76.service -p After` 已確認包含 `cloud-sql-proxy.service`）。

### Auth Proxy 版本

- v2.14.1 → v2.26.0（2026-10-08 最新版，VM 上實際使用的版本）。

## 2. `docs/deployment/gcp-vm.md`

| 位置 | 新增內容 |
|---|---|
| 步驟 2 之後 | 主控台建立 Cloud SQL：不要選免費試用、Enterprise + 沙箱、規格建議、刪除保護 |
| 步驟 4 之後 | 主控台建立的 VM：403 錯誤訊息、Cloud Shell `set-service-account --scopes=cloud-platform`（需停機、先改靜態 IP）、metadata 確認方式 |
| 步驟 6 之後 | 純記憶體模式的 setup 方式；空資料庫第一次啟動約 3 分鐘、之後約 30 秒 |
