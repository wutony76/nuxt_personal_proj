# Design

## 1. 架構

```
瀏覽器 ─HTTPS─▶ Caddy ─▶ Nuxt（127.0.0.1:3000）
                          └─ /api/admin/game-simulator/scratch*（需登入）
                                └─▶ gunicorn（127.0.0.1:8000）─▶ py3_AVScratch_proj（Django）
```

- Nuxt 代理 API 預設呼叫 `http://127.0.0.1:8000`，不需設定 `SCRATCH_PY_API_BASE`。
- gunicorn 只綁 `127.0.0.1`，GCP 防火牆也只開 80/443，外部無法直接存取。

## 2. VM 目錄

```
/srv/avscratch/
├─ app/      py3_AVScratch_proj（git 追蹤的檔案）+ packages/ 內重新安裝的套件 + db.sqlite3
└─ venv/     uv 建立的 Python 3.10 虛擬環境
```

## 3. Python 環境（`setup-avscratch.sh`）

| 項目 | 版本 | 理由 |
|---|---|---|
| Python | 3.10（uv 管理） | 本機版本；Pillow 9.5 不支援 3.12 |
| Django | 5.2.6 | 本機版本 |
| Pillow | 9.5.0 | 程式碼使用 `ImageDraw.textsize()`，Pillow 10 已移除 |
| numpy | 1.26.0 | 本機版本（model07） |
| gunicorn | 最新 | WSGI server |
| persistent / zope.interface | 6.8 / 8.6，`--target packages` | 照專案 README，以 `PYTHONPATH=packages` 載入 |

- 用 `uv` 而不是 deadsnakes PPA：單一執行檔、不動到系統 Python。
- 執行 `manage.py migrate` 建立 sqlite（Django session 等內建 app 需要）。

## 4. systemd（`avscratch.service.template`）

```ini
[Service]
User=__USER__
WorkingDirectory=/srv/avscratch/app
Environment=PYTHONPATH=packages:scratch:.
Environment=DJANGO_SETTINGS_MODULE=admin_site.settings
ExecStart=/srv/avscratch/venv/bin/gunicorn admin_site.wsgi:application \
  --bind 127.0.0.1:8000 --workers 1 --timeout 120
Restart=always
MemoryMax=400M
```

- 用 gunicorn 而不是 README 的 `runserver`：`runserver` 是開發用伺服器。
- 單一 worker：流量極低，且 e2-micro 記憶體有限。
- `--timeout 120`：試算最多 50 張並產生卡片圖，e2-micro 上可能較慢。
- `MemoryMax=400M`：超過時由 systemd 終止並自動重啟，避免拖垮網站。

## 5. 部署流程（`deploy-avscratch.sh`，在本機執行）

1. 在 `py3_AVScratch_proj` 用 `git archive HEAD` 打包，經 ssh 以 `tar` 解到 VM 清空後的 `/srv/avscratch/app/`
   （VM 預設沒有 rsync；只含已 commit 的檔案，自然排除被 gitignore 的 macOS 編譯檔）
2. 上傳 `setup-avscratch.sh`、`avscratch.service.template`，在 VM 上執行
3. 驗證 `curl http://127.0.0.1:8000/api/scratch/info`

可重複執行：更新 Python 專案時重跑即可。

## 6. 測試與驗證策略

| 項目 | 方式 |
|---|---|
| 服務本身 | VM 上 `curl 127.0.0.1:8000/api/scratch/info` |
| 不對外 | 從本機 `curl http://8.231.244.199:8000` 應連不上 |
| 經由網站 | `BASE_URL=https://8-231-244-199.sslip.io` 執行 `test/test-scratch-sim.mjs` |
| 9 個 model | 逐一呼叫，確認卡片圖（model07 本來就沒有） |
| 重開機 | `sudo systemctl reboot` 後確認服務自動啟動 |
| 資源 | `systemctl status` 記憶體用量、`df -h` |
