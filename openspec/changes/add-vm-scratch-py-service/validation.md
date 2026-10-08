# Validation

## 驗證範圍

- 對應變更：`add-vm-scratch-py-service`
- 驗證環境：GCP VM `hfyy-instance-1`（e2-micro、Ubuntu 24.04）、線上網站 `https://8-231-244-199.sslip.io`
- 部署的 Python 專案版本：`py3_AVScratch_proj` `b517c6e`（本機 HEAD，比 GitHub `origin/main` 多 1 個未 push 的 commit）

## 功能驗證

- [x] 線上試算頁 9 個 model 皆可試算 — 實際結果：
  - `test/test-scratch-sim.mjs` 對線上網站執行：**17/17 通過**（model 清單、不合法 model / 金額拒絕、張數夾擠、
    model02 含卡片圖、model07 無卡片圖、model05 無 `win_coin`）
  - 9 個 model 各以隨機非 0 金額試算 3 張：全部 200；model01～06、08、09 每張都有卡片圖，
    model07 無卡片圖（原始系統本來就沒有素材）；每次約 0.15～0.8 秒
- [x] 服務不對外開放 — 實際結果：只監聽 `127.0.0.1:8000`；從外部 `curl http://8.231.244.199:8000` 連不上
- [x] 重開機後自動啟動 — 實際結果：重開機（09:40:43）後 `avscratch`、`cloud-sql-proxy`、`caddy`、pm2 皆自動啟動，
  9 個 model 試算正常（冷啟動後第一次約 0.5～2 秒）

## 資源用量

| 項目 | 數值 |
|---|---|
| 服務記憶體 | 約 154MB（`MemoryMax` 400MB） |
| `/srv/avscratch` | 204MB（程式碼 + Python 3.10 venv + 套件） |
| uv 的 Python 安裝 | 87MB |
| VM 磁碟剩餘 | 2.0G → 1.6G |
| VM 可用記憶體（重開機後） | 約 383MB，swap 未吃緊 |

## 視覺驗證

- 不適用（未改動前端；卡片圖由 Python 服務產生，已確認回傳 `data:image` 格式）

## 回歸驗證

- 流程：網站本身（登入、Cloud SQL 連線）
- 結果：重開機後 pm2、Cloud SQL Proxy 正常；網站首頁與試算頁正常

## 問題與修正紀錄

- 問題：第一次執行 `deploy-avscratch.sh` 失敗：`rsync: command not found`
  - 發現方式：實際部署
  - 原因：VM（Ubuntu 24.04 GCP 映像檔）預設沒有安裝 rsync
  - 修正方式：改用 `git archive HEAD | ssh tar -x`，不需額外安裝套件，且只含已 commit 的檔案
  - 是否已重新驗證：是，shellcheck 通過、部署成功
- 問題：一度誤判字型 `msjhbd.ttc` 沒有被 git 追蹤
  - 原因：檢查指令用了 `head -3` 截掉輸出；以 `git ls-files --error-unmatch` 確認有被追蹤，非實際問題

## 結論

- 是否通過：是
- 已知限制或風險：
  - Python 專案為私有 repo，VM 無法直接 clone，部署須從本機執行腳本，部署的是本機 HEAD
  - Django 設定 `DEBUG=True` 與寫死的 `SECRET_KEY` 未修改，依賴「只綁 127.0.0.1」隔離
- 後續追蹤事項：`py3_AVScratch_proj` 本機有 1 個 commit 未 push 到 GitHub（`b517c6e`）
