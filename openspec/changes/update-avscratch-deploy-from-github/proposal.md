# Proposal

## 變更名稱

`update-avscratch-deploy-from-github` — 刮刮樂試算服務改為 VM 直接從 GitHub 拉最新版部署

## 背景

`add-vm-scratch-py-service` 的部署方式是從使用者本機上傳 `py3_AVScratch_proj` 的 HEAD。
使用者希望改成直接從 GitHub（`wutony76/py3_AVScratch_proj`）抓最新版，並選擇讓 VM 自己從 GitHub 拉。

部署前發現本機有 1 個 commit（`b517c6e`）未 push，線上版本比 GitHub 新；經使用者同意先 push，
避免改用 GitHub 部署後線上版本倒退。

## 目標

- 一行指令把 GitHub `main` 最新版部署到 VM
- 不需要經過本機的程式碼

## 範圍

- VM：產生唯讀部署金鑰 `~/.ssh/avscratch_deploy`，`~/.ssh/config` 新增 `Host github-avscratch`，
  `known_hosts` 加入經官方指紋比對的 github.com host key
- 使用者：把公鑰加到 GitHub repo 的 Settings → Deploy keys（唯讀）
- 新增 `deploy/gcp-vm/avscratch/update-avscratch.sh`：VM 上 clone / fetch + reset 到 `origin/main`，再執行 setup
- 修改 `deploy/gcp-vm/avscratch/deploy-avscratch.sh`：預設改為呼叫 VM 上的 update；保留 `AVSCRATCH_DIR` 上傳本機的備用模式
- `docs/deployment/gcp-vm.md`：更新部署說明與部署金鑰設定

## 不包含

- 不做自動定時拉取或 GitHub webhook（仍是手動觸發）
- 不修改 `py3_AVScratch_proj` 程式碼

## 風險與對策

| 風險 | 對策 |
|---|---|
| repo 是私有的，VM 沒有權限 | 部署金鑰只授權這一個 repo、唯讀；以專用 Host 別名使用，不影響其他 git 操作 |
| 首次連 github.com 遭中間人攻擊 | host key 指紋與 GitHub 官方公布的 `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` 比對一致才寫入 |
| `git reset --hard` 清掉 VM 上的套件與 sqlite | 兩者都被 gitignore，`reset --hard` 不會動到 |
| GitHub 版本落後本機，部署後線上倒退 | 本次已先 push `b517c6e`；文件提醒部署的是 GitHub `main` |

## 驗證方式

- 從乾淨狀態（目前 app/ 不是 git repo）執行，確認會 clone，部署版本為 GitHub `main`
- 再執行一次，確認走 fetch + reset 路徑
- 線上 `test-scratch-sim.mjs` 與 9 個 model 試算

## 成功標準

- [ ] VM 從 GitHub 部署成功，版本與 GitHub `main` 一致
- [ ] 線上試算正常
