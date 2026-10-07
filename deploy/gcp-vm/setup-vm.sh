#!/usr/bin/env bash
#
# VM 初始設定，只需要執行一次（Debian 12）。
#
# 用法（在 VM 上，以一般使用者身分執行，需要 sudo 權限）：
#   INSTANCE_CONNECTION_NAME=專案ID:us-west1:portfolio-db \
#   DOMAIN=portfolio.example.com \
#   bash setup-vm.sh
#
# 會安裝與設定：swap、Node.js 22、pm2（開機自動啟動）、Caddy（HTTPS 反向代理）、
# Cloud SQL Auth Proxy（systemd），並建立 /srv/portfolio 目錄與 .env 範本。
# 重複執行是安全的：已存在的設定會略過或覆寫成相同內容，不會覆蓋已填好的 .env。
set -euo pipefail

: "${INSTANCE_CONNECTION_NAME:?請設定 INSTANCE_CONNECTION_NAME，格式為 專案ID:區域:執行個體名稱}"
: "${DOMAIN:?請設定 DOMAIN，例如 portfolio.example.com 或 34-82-1-2.sslip.io}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=/srv/portfolio
NODE_MAJOR=22
# 版本請對照 https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases 更新
CLOUD_SQL_PROXY_VERSION=v2.14.1
SWAP_SIZE=2G

log() { printf '\n==> %s\n' "$*"; }

log "1/7 swap（${SWAP_SIZE}）：e2-micro 只有 1GB 記憶體，避免記憶體不足時 process 被系統強制結束"
if ! swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l "$SWAP_SIZE" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf >/dev/null
  sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
else
  echo "已存在，略過"
fi

log "2/7 系統套件"
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

log "3/7 Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

log "4/7 pm2（開機自動啟動）"
if ! command -v pm2 >/dev/null; then
  sudo npm install -g pm2
fi
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
echo "pm2 $(pm2 -v)"

log "5/7 Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
fi
sed "s/__DOMAIN__/${DOMAIN}/g" "$SCRIPT_DIR/Caddyfile.template" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy || sudo systemctl restart caddy

log "6/7 Cloud SQL Auth Proxy（${CLOUD_SQL_PROXY_VERSION}）"
if [[ ! -x /usr/local/bin/cloud-sql-proxy ]] || ! /usr/local/bin/cloud-sql-proxy --version | grep -q "${CLOUD_SQL_PROXY_VERSION#v}"; then
  sudo curl -fsSL -o /usr/local/bin/cloud-sql-proxy \
    "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${CLOUD_SQL_PROXY_VERSION}/cloud-sql-proxy.linux.amd64"
  sudo chmod +x /usr/local/bin/cloud-sql-proxy
fi
sed "s/__INSTANCE_CONNECTION_NAME__/${INSTANCE_CONNECTION_NAME}/g" "$SCRIPT_DIR/cloud-sql-proxy.service.template" \
  | sudo tee /etc/systemd/system/cloud-sql-proxy.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now cloud-sql-proxy
sudo systemctl restart cloud-sql-proxy

log "7/7 應用程式目錄與 .env"
sudo mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
sudo chown -R "$USER:$USER" "$APP_DIR"
if [[ ! -f "$APP_DIR/shared/.env" ]]; then
  cp "$SCRIPT_DIR/env.production.example" "$APP_DIR/shared/.env"
  chmod 600 "$APP_DIR/shared/.env"
  ENV_HINT="已建立 $APP_DIR/shared/.env，請填入資料庫密碼與管理員密碼"
else
  ENV_HINT="$APP_DIR/shared/.env 已存在，未覆蓋"
fi

log "完成"
echo "- $ENV_HINT"
echo "- Cloud SQL Auth Proxy 狀態：sudo systemctl status cloud-sql-proxy"
echo "- Caddy 會在第一次有人連到 https://${DOMAIN} 時自動申請憑證（需先完成 DNS 設定）"
echo "- 接著到 GitHub Actions 執行 Deploy (GCP VM) workflow 部署應用程式"
