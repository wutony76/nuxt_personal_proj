# Design

## 1. 流程

```
本機：VM=... bash deploy/gcp-vm/avscratch/deploy-avscratch.sh
  ├─ 上傳 setup-avscratch.sh、update-avscratch.sh、avscratch.service.template 到 VM ~/avscratch-setup/
  └─ ssh 執行 update-avscratch.sh
        ├─ app/.git 不存在 → rm -rf app && git clone git@github-avscratch:wutony76/py3_AVScratch_proj.git
        ├─ app/.git 存在   → git fetch origin main && git reset --hard origin/main
        └─ setup-avscratch.sh（套件已裝則略過、migrate、重啟 systemd 服務、健康檢查）
```

## 2. VM 上的 GitHub 存取

```
~/.ssh/avscratch_deploy(.pub)   ed25519，註解 "hfyy-instance-1 avscratch read-only"
~/.ssh/config
  Host github-avscratch
    HostName github.com
    User git
    IdentityFile ~/.ssh/avscratch_deploy
    IdentitiesOnly yes
~/.ssh/known_hosts              github.com ed25519（指紋比對官方值後寫入）
```

- 用 Host 別名而不是覆寫 `github.com`：VM 上其他 git 操作（若有）不會意外用到這把金鑰。
- GitHub Deploy key 不勾選「Allow write access」。

## 3. 為什麼 `reset --hard` 而不是 `pull`

- VM 上不應該有任何手動修改；`reset --hard origin/main` 保證與 GitHub 完全一致，即使 GitHub 上有 force push 也不會卡在合併衝突。
- 被 gitignore 的 `packages/` 第三方套件、`admin_site/db.sqlite3` 不受影響。

## 4. 備用模式

`AVSCRATCH_DIR` 有設定時沿用原本的「上傳本機 HEAD」：清空 `app/`（含 `.git`），下次改回預設模式時重新 clone。

## 5. 測試與驗證策略

| 項目 | 方式 |
|---|---|
| 首次 clone | 目前 `app/` 是上傳模式（沒有 `.git`），執行預設模式應走 clone |
| 更新路徑 | 再執行一次應走 fetch + reset |
| 版本 | VM `git log -1` 與 GitHub `origin/main` 相同 |
| 線上 | `test-scratch-sim.mjs`、9 個 model 試算 |
