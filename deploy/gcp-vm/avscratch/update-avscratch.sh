#!/usr/bin/env bash
#
# 在 VM 上執行：從 GitHub 拉 py3_AVScratch_proj 最新版到 /srv/avscratch/app，再執行 setup-avscratch.sh。
# 由 deploy-avscratch.sh 呼叫，也可以登入 VM 直接執行。
#
# repo 是私有的，使用 VM 上的唯讀部署金鑰（~/.ssh/avscratch_deploy，對應 ~/.ssh/config 的
# Host github-avscratch）。金鑰需先加到 GitHub repo 的 Settings → Deploy keys（見 docs/deployment/gcp-vm.md）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${AVSCRATCH_REPO:-git@github-avscratch:wutony76/py3_AVScratch_proj.git}"
BRANCH="${AVSCRATCH_BRANCH:-main}"
APP_DIR=/srv/avscratch/app

sudo mkdir -p /srv/avscratch
sudo chown "$USER:$USER" /srv/avscratch

if [[ -d "$APP_DIR/.git" ]]; then
  echo "==> 更新到 GitHub 最新版（$BRANCH）"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  # reset --hard 只覆蓋追蹤中的檔案；packages/ 內的套件與 db.sqlite3 被 gitignore，會保留
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  echo "==> 第一次從 GitHub clone（$BRANCH）"
  rm -rf "$APP_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
echo "==> 目前版本：$(git -C "$APP_DIR" log --oneline -1)"

bash "$SCRIPT_DIR/setup-avscratch.sh"
