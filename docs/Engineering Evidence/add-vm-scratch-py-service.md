# Engineering Evidence：在 VM 上部署刮刮樂試算 Python 服務

## 變更摘要

- **對應變更**：`add-vm-scratch-py-service`
- **變更檔案**
  - 新增：`deploy/gcp-vm/avscratch/`（`deploy-avscratch.sh`、`setup-avscratch.sh`、`avscratch.service.template`）、
    `openspec/changes/add-vm-scratch-py-service/`
  - 修改：`docs/deployment/gcp-vm.md`（新增部署章節、移除「試算頁無法使用」已知事項）
- **未修改**：`py3_AVScratch_proj` 程式碼、Nuxt 代理 API

### 背景

後台刮刮樂試算頁代理外部 Django 服務 `py3_AVScratch_proj`，原本只在使用者本機執行，線上 VM 無法使用。

### 部署上的三個關鍵

| 問題 | 處理 |
|---|---|
| 程式碼 15 處使用 `ImageDraw.textsize()`，Pillow 10 已移除；Pillow 9.5 只支援到 Python 3.11，VM 內建 3.12 | 用 `uv` 安裝 Python 3.10，套件版本與本機一致（Django 5.2.6、Pillow 9.5.0、numpy 1.26.0），**不改 Python 專案程式碼** |
| `packages/` 內有 macOS 編譯的 `.so`（已被 gitignore） | 只上傳 HEAD 已 commit 的檔案（`git archive`），在 VM 以 `pip --target packages` 重裝 Linux 版 |
| Django `DEBUG=True`、`ALLOWED_HOSTS=['*']`、`SECRET_KEY` 寫死 | gunicorn 只綁 `127.0.0.1:8000`，只透過 Nuxt 需登入的代理存取 |

其他：字型以相對路徑載入，systemd `WorkingDirectory` 設為專案根目錄；`MemoryMax=400M` 保護 e2-micro。

## 驗證佐證

- 對應 `validation.md` 結論：**通過**

| 項目 | 結果 |
|---|---|
| `test-scratch-sim.mjs` 對線上網站 | 17/17 |
| 9 個 model 逐一試算（隨機非 0 金額，3 張） | 全部 200；8 個含卡片圖，model07 本來就沒有 |
| 外部直連 8000 | 連不上 |
| 重開機 | 所有服務自動啟動，試算正常 |
| 資源 | 服務約 154MB 記憶體；磁碟多用約 290MB，剩 1.6G |

## 風險與後續追蹤

- **已知風險**
  - Python 專案為私有 repo，部署須從本機執行，部署的是本機 HEAD（這次是 `b517c6e`，比 GitHub 多 1 個 commit）。
  - VM 磁碟剩 1.6G，之後再加服務要留意空間。
- **後續追蹤事項**：`py3_AVScratch_proj` 的 `b517c6e` 尚未 push 到 GitHub。

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] 線上網站已確認正常
- [x] 可執行 `openspec archive`
