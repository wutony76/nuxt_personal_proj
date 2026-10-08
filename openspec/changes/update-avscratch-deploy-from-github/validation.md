# Validation

## 驗證範圍

- 對應變更：`update-avscratch-deploy-from-github`
- 驗證環境：GCP VM `hfyy-instance-1`、線上網站 `https://8-231-244-199.sslip.io`

## 功能驗證

- [x] VM 從 GitHub 部署成功，版本與 GitHub `main` 一致 — 實際結果：
  - 部署金鑰：`git ls-remote git@github-avscratch:…` 回傳 `main` = `b517c6e`；`ssh -T` 顯示
    `Hi wutony76/py3_AVScratch_proj!`（金鑰只授權此 repo）
  - github.com host key 指紋 `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` 與官方一致
  - **首次 clone 路徑**（原本 `app/` 是上傳模式、沒有 `.git`）：`第一次從 GitHub clone（main）` →
    `b517c6e`，健康檢查通過，26 秒
  - **更新路徑**（再執行一次）：`更新到 GitHub 最新版（main）` → `b517c6e`，20 秒
  - VM `git rev-parse HEAD` = GitHub `main` = `b517c6e9224446aff652d68481461372f5923f15`；工作區 0 個修改
  - `reset --hard` 後 `packages/` 內的 persistent / zope 套件與 `db.sqlite3` 保留
- [x] 線上試算正常 — 實際結果：`test-scratch-sim.mjs` 17/17；9 個 model 隨機非 0 金額試算全部 200，
  8 個含卡片圖（model07 本來就沒有）

## 視覺驗證

- 不適用

## 回歸驗證

- 流程：shellcheck（`setup-avscratch.sh`、`update-avscratch.sh`、`deploy-avscratch.sh`）
- 結果：無警告

## 問題與修正紀錄

- 部署前發現本機 `py3_AVScratch_proj` 有 1 個 commit（`b517c6e`）未 push，線上版本比 GitHub 新；
  經使用者同意先 push，避免改用 GitHub 部署後線上版本倒退

## 結論

- 是否通過：是
- 已知限制或風險：部署的是 GitHub `main`，本機未 push 的 commit 不會上線（文件已提醒，並保留 `AVSCRATCH_DIR` 上傳模式）
- 後續追蹤事項：無
