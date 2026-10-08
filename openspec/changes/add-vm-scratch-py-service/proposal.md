# Proposal

## 變更名稱

`add-vm-scratch-py-service` — 在 GCP VM 上部署刮刮樂試算 Python 服務，讓線上的試算頁可以使用

## 背景

後台「刮刮樂試算」（`/admin/game-simulator`）在 `replace-scratch-simulator-with-python-proxy` 改為代理外部 Python 服務
`py3_AVScratch_proj`（Django，`/api/scratch/info`、`/api/scratch/<model_id>`）。Nuxt 端以
`SCRATCH_PY_API_BASE`（預設 `http://127.0.0.1:8000`）呼叫。

這支服務原本只在使用者本機執行，GCP VM（`hfyy-instance-1`）上沒有，所以線上試算頁無法使用
（`docs/deployment/gcp-vm.md` 列為已知事項）。

## 目標

- VM 上常駐執行 `py3_AVScratch_proj`，線上 9 個 model 皆可試算
- 服務只聽 VM 本機，不對外開放
- 部署步驟寫成腳本與文件，可重現

## 範圍

- 新增 `deploy/gcp-vm/avscratch/setup-avscratch.sh`：在 VM 上建立 Python 3.10 環境、安裝套件、初始化、安裝 systemd 服務
- 新增 `deploy/gcp-vm/avscratch/avscratch.service.template`：systemd unit（gunicorn，127.0.0.1:8000）
- 新增 `deploy/gcp-vm/avscratch/deploy-avscratch.sh`：在本機執行，上傳 Python 專案並呼叫 setup
- `docs/deployment/gcp-vm.md`：新增部署章節、移除「試算頁無法使用」的已知事項

## 不包含

- 不修改 `py3_AVScratch_proj` 的程式碼
- 不改 Nuxt 端的代理 API（預設網址已是 `http://127.0.0.1:8000`，不需設定環境變數）
- 不納入 GitHub Actions 自動部署（Python 專案在另一個 repo，更新頻率低）

## 影響面

- VM 多一個常駐服務（預估記憶體 100～200MB、磁碟約 400MB）
- 不影響 Nuxt 網站本身

## 風險與對策

| 風險 | 對策 |
|---|---|
| 程式碼大量使用 `ImageDraw.textsize()`（15 處），Pillow 10 已移除；Pillow 9.5 只支援到 Python 3.11，VM 內建是 3.12 | 用 `uv` 安裝 Python 3.10，套件版本與本機完全一致（Django 5.2.6、Pillow 9.5.0、numpy 1.26.0） |
| `packages/` 內有 macOS 編譯的 `.so`（已被 gitignore） | 只上傳 git 追蹤的檔案，在 VM 上以 `pip --target packages` 重新安裝 persistent / zope.interface |
| Django 設定 `DEBUG=True`、`SECRET_KEY` 寫死、`ALLOWED_HOSTS=['*']` | 服務只綁 `127.0.0.1:8000`，防火牆與 Caddy 皆不對外；只透過 Nuxt 需登入的代理 API 存取 |
| e2-micro 記憶體只有 1GB | gunicorn 單一 worker；systemd `MemoryMax` 限制，避免拖垮網站 |
| 字型以相對路徑 `msjhbd.ttc` 載入 | systemd `WorkingDirectory` 設為專案根目錄 |

## 驗證方式

- VM 本機 `curl http://127.0.0.1:8000/api/scratch/info` 回傳 9 個 model
- 以 `test/test-scratch-sim.mjs` 對線上網站（`BASE_URL=https://8-231-244-199.sslip.io`）執行，全數通過
- 9 個 model 各試算一次，含卡片圖的 model 正確回傳圖片
- VM 重開機後服務自動啟動
- 記錄服務的記憶體用量

## 成功標準

- [ ] 線上試算頁 9 個 model 皆可試算
- [ ] 服務不對外開放
- [ ] 重開機後自動啟動
