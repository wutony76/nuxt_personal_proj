#!/usr/bin/env bash
#
# 在本機執行：把 py3_AVScratch_proj 部署到 VM（第一次安裝與之後更新都用這支）。
#
# 用法：
#   AVSCRATCH_DIR=/path/to/py3_AVScratch_proj VM=user@host bash deploy/gcp-vm/avscratch/deploy-avscratch.sh
#
# 只上傳 HEAD 已 commit 的檔案（git archive）：packages/ 內有 macOS 編譯的 .so（已被 gitignore），
# 由 setup-avscratch.sh 在 VM 上重新安裝 Linux 版本。VM 預設沒有 rsync，所以用 tar 經 ssh 傳輸。
# 每次都清空重建 app/，避免殘留已刪除的檔案（packages/ 套件與 sqlite 由 setup 重新產生）。
set -euo pipefail

: "${AVSCRATCH_DIR:?請設定 AVSCRATCH_DIR（py3_AVScratch_proj 的路徑）}"
: "${VM:?請設定 VM，例如 wutony76@8.231.244.199}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "$(git -C "$AVSCRATCH_DIR" status --porcelain)" ]]; then
  echo "⚠ $AVSCRATCH_DIR 有未 commit 的修改，只會部署 HEAD 已 commit 的內容"
fi
echo "==> 上傳程式碼（$(git -C "$AVSCRATCH_DIR" rev-parse --short HEAD)）"
ssh "$VM" 'sudo mkdir -p /srv/avscratch && sudo chown "$USER:$USER" /srv/avscratch && rm -rf /srv/avscratch/app && mkdir /srv/avscratch/app'
git -C "$AVSCRATCH_DIR" archive --format=tar HEAD | ssh "$VM" 'tar -x -C /srv/avscratch/app'

echo "==> 上傳並執行 setup"
ssh "$VM" 'mkdir -p ~/avscratch-setup'
scp -q "$SCRIPT_DIR/setup-avscratch.sh" "$SCRIPT_DIR/avscratch.service.template" "$VM:~/avscratch-setup/"
ssh "$VM" 'bash ~/avscratch-setup/setup-avscratch.sh'
