#!/usr/bin/env bash
#
# 在 VM 上部署一個版本。由 GitHub Actions 的 Deploy (GCP VM) workflow 透過 SSH 呼叫。
#
# 用法：bash remote-deploy.sh <版本ID> <release.tgz 路徑>
#
# 流程：解壓到新的版本目錄 → 安裝 migration 依賴 → 套用 migration → 切換 current →
#       重啟 pm2 → 健康檢查（失敗就回滾到上一版）→ 只保留最近 3 個版本。
#
# ⚠️ migration 只會往前套用、不會自動復原。回滾只會換回舊版程式，資料庫維持新的結構，
#    所以 migration 要寫成舊版程式也能相容（例如新增欄位而不是直接刪除欄位）。
set -euo pipefail

RELEASE_ID="${1:?需要版本 ID}"
TARBALL="${2:?需要 release.tgz 路徑}"
APP_DIR="${APP_DIR:-/srv/portfolio}"
ENV_FILE="$APP_DIR/shared/.env"
RELEASE_DIR="$APP_DIR/releases/$RELEASE_ID"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/}"
# e2-micro 共享 CPU 冷啟動差異大：一般約 12 秒，CPU burst 額度用完時實測慢到 106 秒（種子帳號的
# bcrypt 雜湊）。預設等 180 秒，避免把正常版本誤判為失敗而回滾
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
HEALTH_INTERVAL_SECONDS=2
KEEP_RELEASES=3

log() { printf '==> %s\n' "$*"; }

start_app() {
  pm2 delete portfolio >/dev/null 2>&1 || true
  pm2 start "$1/ecosystem.config.cjs"
}

health_check() {
  local attempts=$(( HEALTH_TIMEOUT_SECONDS / HEALTH_INTERVAL_SECONDS ))
  for _ in $(seq 1 "$attempts"); do
    if curl -sf -o /dev/null "$HEALTH_URL"; then
      return 0
    fi
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
  return 1
}

[[ -f "$ENV_FILE" ]] || { echo "找不到 $ENV_FILE，請先執行 setup-vm.sh 並填寫環境變數" >&2; exit 1; }

log "解壓版本 $RELEASE_ID"
mkdir -p "$RELEASE_DIR"
tar -xzf "$TARBALL" -C "$RELEASE_DIR"
rm -f "$TARBALL"

log "安裝 migration 依賴"
(cd "$RELEASE_DIR/migrate" && npm install --omit=dev --no-audit --no-fund --loglevel=error)

log "套用資料庫 migration"
node --env-file="$ENV_FILE" "$RELEASE_DIR/migrate/migrate.mjs"

# 第一次部署時 current 還不存在；不能直接用 readlink -f，它遇到不存在的路徑也會回傳路徑本身
PREVIOUS_DIR=""
if [[ -L "$APP_DIR/current" ]]; then
  PREVIOUS_DIR="$(readlink -f "$APP_DIR/current")"
fi

log "切換到新版本並重啟"
ln -sfn "$RELEASE_DIR" "$APP_DIR/current"
start_app "$RELEASE_DIR"

log "健康檢查 $HEALTH_URL"
if ! health_check; then
  echo "新版本健康檢查失敗，最近的 log：" >&2
  pm2 logs portfolio --lines 50 --nostream >&2 || true
  if [[ -n "$PREVIOUS_DIR" && -d "$PREVIOUS_DIR" && "$PREVIOUS_DIR" != "$RELEASE_DIR" ]]; then
    log "回滾到 $(basename "$PREVIOUS_DIR")"
    ln -sfn "$PREVIOUS_DIR" "$APP_DIR/current"
    start_app "$PREVIOUS_DIR"
    if health_check; then
      log "回滾完成，目前執行 $(basename "$PREVIOUS_DIR")"
    else
      echo "回滾後仍無法通過健康檢查，請登入 VM 檢查" >&2
    fi
  else
    echo "沒有可回滾的上一版（第一次部署）" >&2
  fi
  exit 1
fi

pm2 save >/dev/null

log "清理舊版本（保留最近 ${KEEP_RELEASES} 個）"
find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn | tail -n +$((KEEP_RELEASES + 1)) | cut -d' ' -f2- \
  | while read -r dir; do
      [[ "$dir" == "$RELEASE_DIR" ]] || rm -rf "$dir"
    done

log "部署完成：$RELEASE_ID"
