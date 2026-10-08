# Proposal

## 變更名稱

`add-deploy-workflow-avscratch-option` — Deploy (GCP VM) workflow 新增「同時更新刮刮樂試算服務」選項

## 背景

網站（`nuxt_personal_proj`）透過 GitHub Actions「Deploy (GCP VM)」部署；刮刮樂試算服務（`py3_AVScratch_proj`）
在 `update-avscratch-deploy-from-github` 改為 VM 直接從 GitHub 拉，但仍需在本機執行 `deploy-avscratch.sh`。
使用者希望在 GitHub 部署網站時，可以順便更新試算服務。

## 目標

- Run workflow 時可勾選「同時更新刮刮樂試算服務」
- 不勾選時行為與現在完全相同

## 範圍

- `.github/workflows/deploy-gcp-vm.yml`：新增 `workflow_dispatch` 輸入 `update_avscratch`（boolean，預設 false），
  網站部署成功後，上傳 `deploy/gcp-vm/avscratch/` 的腳本並在 VM 執行 `update-avscratch.sh`
- `docs/deployment/gcp-vm.md`：補充說明

## 不包含

- 不提供「只更新試算服務、不部署網站」的 workflow 選項（本機 `deploy-avscratch.sh` 可做到）
- 不新增 GitHub Secrets（沿用網站部署的 SSH 設定；VM 已有讀取 `py3_AVScratch_proj` 的 Deploy key）

## 風險與對策

| 風險 | 對策 |
|---|---|
| 網站部署失敗（已回滾）時又更新試算服務 | 新步驟放在網站部署之後，前一步失敗時 GitHub Actions 預設略過後續步驟 |
| 試算服務更新失敗 | workflow 標示失敗，但網站已部署完成；試算服務的健康檢查失敗只影響試算頁 |
| 預設行為改變 | 預設 false，不勾選時不執行新步驟 |

## 驗證方式

- actionlint
- 實際 Run workflow：勾選與不勾選各一次

## 成功標準

- [ ] 勾選時網站與試算服務都更新成功
- [ ] 不勾選時只部署網站
