#!/usr/bin/env bash
#
# 在 VM 上安裝刮刮樂試算 Python 服務。由 deploy-avscratch.sh 上傳程式碼後呼叫，可重複執行。
#
# 前提：/srv/avscratch/app 已有 py3_AVScratch_proj 的檔案（git 追蹤的檔案）。
#
# 版本固定的原因：程式碼使用 ImageDraw.textsize()，Pillow 10 已移除，必須用 Pillow 9.5；
# Pillow 9.5 只支援到 Python 3.11，Ubuntu 24.04 內建 3.12，所以用 uv 另外安裝 Python 3.10。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE=/srv/avscratch
APP_DIR=$BASE/app
VENV=$BASE/venv
PYTHON_VERSION=3.10
UV="$HOME/.local/bin/uv"

log() { printf '\n==> %s\n' "$*"; }

[[ -f "$APP_DIR/admin_site/manage.py" ]] || { echo "找不到 $APP_DIR/admin_site/manage.py，請先上傳程式碼" >&2; exit 1; }

log "1/5 uv"
if [[ ! -x "$UV" ]]; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
"$UV" --version

log "2/5 Python ${PYTHON_VERSION} 與虛擬環境"
"$UV" python install "$PYTHON_VERSION"
[[ -x "$VENV/bin/python" ]] || "$UV" venv --python "$PYTHON_VERSION" "$VENV"
"$UV" pip install --python "$VENV/bin/python" \
  'django==5.2.6' 'pillow==9.5.0' 'numpy==1.26.0' gunicorn
"$VENV/bin/python" -c 'import django, PIL, numpy; print("django", django.__version__, "Pillow", PIL.__version__, "numpy", numpy.__version__)'

log "3/5 packages/ 內的第三方套件（照專案 README，以 --target 安裝）"
"$UV" pip install --python "$VENV/bin/python" --target "$APP_DIR/packages" \
  'persistent==6.8' 'zope.interface==8.6'

log "4/5 初始化 sqlite"
(cd "$APP_DIR" && PYTHONPATH=packages:scratch:. DJANGO_SETTINGS_MODULE=admin_site.settings \
  "$VENV/bin/python" admin_site/manage.py migrate --noinput -v 0)

log "5/5 systemd 服務"
sed "s/__USER__/${USER}/g" "$SCRIPT_DIR/avscratch.service.template" \
  | sudo tee /etc/systemd/system/avscratch.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable -q avscratch
sudo systemctl restart avscratch

for _ in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:8000/api/scratch/info; then
    log "完成：http://127.0.0.1:8000/api/scratch/info 正常回應"
    exit 0
  fi
  sleep 2
done
echo "服務 60 秒內沒有回應，最近的 log：" >&2
sudo journalctl -u avscratch -n 50 --no-pager >&2
exit 1
