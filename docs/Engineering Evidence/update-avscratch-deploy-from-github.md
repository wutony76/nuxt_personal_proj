# Engineering Evidence：刮刮樂試算服務改為 VM 直接從 GitHub 部署

## 變更摘要

- **對應變更**：`update-avscratch-deploy-from-github`
- **變更檔案**
  - 新增：`deploy/gcp-vm/avscratch/update-avscratch.sh`、`openspec/changes/update-avscratch-deploy-from-github/`
  - 修改：`deploy/gcp-vm/avscratch/deploy-avscratch.sh`（預設改從 GitHub、保留上傳本機模式）、
    `deploy/gcp-vm/avscratch/setup-avscratch.sh`（註解）、`docs/deployment/gcp-vm.md`
- **VM 設定**（不在 repo 內）：唯讀部署金鑰 `~/.ssh/avscratch_deploy`、`~/.ssh/config` 的 `Host github-avscratch`、
  github.com host key
- **GitHub 設定**：`wutony76/py3_AVScratch_proj` 新增唯讀 Deploy key（使用者操作）

### 背景

`add-vm-scratch-py-service` 是從本機上傳 HEAD 部署。使用者希望直接抓 GitHub 最新版，並選擇讓 VM 自己從 GitHub 拉
（另一個選項是本機先 fetch 再上傳，不需新增金鑰）。

### 做法

| 項目 | 內容 |
|---|---|
| 私有 repo 存取 | VM 產生 ed25519 唯讀 Deploy key，以專用 Host 別名使用，不影響其他 git 操作 |
| 首次連線安全 | github.com host key 指紋與官方公布值比對一致才寫入 `known_hosts` |
| 更新方式 | `git fetch` + `git reset --hard origin/main`：與 GitHub 完全一致、不會卡在合併衝突；被 gitignore 的套件與 sqlite 不受影響 |
| 上線前檢查 | 發現本機有未 push 的 `b517c6e`，經同意先 push，避免線上版本倒退 |

## 驗證佐證

- 對應 `validation.md` 結論：**通過**

| 項目 | 結果 |
|---|---|
| 首次 clone 路徑 | 成功，`b517c6e`，26 秒 |
| 更新路徑 | 成功，`b517c6e`，20 秒 |
| VM 版本 vs GitHub `main` | 完全一致，工作區 0 修改 |
| 套件、sqlite 保留 | 是 |
| 線上 `test-scratch-sim.mjs` | 17/17 |
| 9 個 model 試算 | 全部 200 |

## 風險與後續追蹤

- **已知風險**：部署的是 GitHub `main`，本機未 push 的 commit 不會上線。
- **撤銷 VM 存取**：GitHub repo → Settings → Deploy keys 刪除 `hfyy-instance-1 (VM)`。
- **後續追蹤事項**：無。

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] 線上網站已確認正常
- [x] 可執行 `openspec archive`
