# Design

## 1. workflow 輸入

```yaml
on:
  workflow_dispatch:
    inputs:
      update_avscratch:
        description: '同時更新刮刮樂試算服務（從 GitHub 拉 py3_AVScratch_proj 最新版）'
        type: boolean
        default: false
```

## 2. 新步驟（放在 `Upload and deploy` 之後）

```yaml
- name: Update scratch simulator service (py3_AVScratch_proj)
  if: ${{ inputs.update_avscratch }}
  run: |
    ssh ... 'mkdir -p ~/avscratch-setup'
    scp setup-avscratch.sh update-avscratch.sh avscratch.service.template → VM ~/avscratch-setup/
    ssh ... 'bash ~/avscratch-setup/update-avscratch.sh'
```

- 與本機 `deploy-avscratch.sh` 預設模式執行相同的指令，只是改由 GitHub Actions 透過既有的部署 SSH 金鑰觸發。
- `if: ${{ inputs.update_avscratch }}` 加上 GitHub Actions 預設的 `success()`：網站部署失敗時不執行。
- 每次都上傳最新的腳本：`nuxt_personal_proj` 若改了 avscratch 的部署腳本，會一起生效。

## 3. 執行順序與失敗處理

```
build → 上傳 → remote-deploy.sh（失敗則回滾並結束）
                         └─ 成功 → [勾選時] update-avscratch.sh
```

## 4. 驗證

| 項目 | 方式 |
|---|---|
| 語法 | actionlint（`deploy-gcp-vm.yml` 無警告） |
| 勾選 | Run workflow 勾選，確認兩個步驟成功、VM 上兩個服務皆更新 |
| 不勾選 | 確認新步驟顯示為 skipped |
