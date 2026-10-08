#!/usr/bin/env bash
#
# 在本機執行：部署刮刮樂試算服務（py3_AVScratch_proj）到 VM。第一次安裝與之後更新都用這支。
#
# 預設：VM 直接從 GitHub 拉最新版（main）
#   VM=user@host bash deploy/gcp-vm/avscratch/deploy-avscratch.sh
#
# 備用：上傳本機 repo 的 HEAD（測試還沒 push 的版本時使用）
#   AVSCRATCH_DIR=/path/to/py3_AVScratch_proj VM=user@host bash deploy/gcp-vm/avscratch/deploy-avscratch.sh
#   - 只上傳 HEAD 已 commit 的檔案（git archive）：packages/ 內有 macOS 編譯的 .so（已被 gitignore），
#     由 setup-avscratch.sh 在 VM 上重新安裝 Linux 版本。VM 預設沒有 rsync，所以用 tar 經 ssh 傳輸。
#   - 會清空 app/，下次改回預設模式時會重新從 GitHub clone。
set -euo pipefail

: "${VM:?請設定 VM，例如 wutony76@8.231.244.199}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 上傳部署腳本"
ssh "$VM" 'mkdir -p ~/avscratch-setup'
scp -q "$SCRIPT_DIR/setup-avscratch.sh" "$SCRIPT_DIR/update-avscratch.sh" \
  "$SCRIPT_DIR/avscratch.service.template" "$VM:~/avscratch-setup/"

if [[ -z "${AVSCRATCH_DIR:-}" ]]; then
  ssh "$VM" 'bash ~/avscratch-setup/update-avscratch.sh'
  exit 0
fi

if [[ -n "$(git -C "$AVSCRATCH_DIR" status --porcelain)" ]]; then
  echo "⚠ $AVSCRATCH_DIR 有未 commit 的修改，只會部署 HEAD 已 commit 的內容"
fi
echo "==> 上傳本機程式碼（$(git -C "$AVSCRATCH_DIR" rev-parse --short HEAD)）"
ssh "$VM" 'sudo mkdir -p /srv/avscratch && sudo chown "$USER:$USER" /srv/avscratch && rm -rf /srv/avscratch/app && mkdir /srv/avscratch/app'
git -C "$AVSCRATCH_DIR" archive --format=tar HEAD | ssh "$VM" 'tar -x -C /srv/avscratch/app'
ssh "$VM" 'bash ~/avscratch-setup/setup-avscratch.sh'
