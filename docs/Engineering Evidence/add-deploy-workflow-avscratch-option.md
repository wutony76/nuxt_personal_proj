# Engineering Evidence：Deploy workflow 新增「同時更新刮刮樂試算服務」選項

## 變更摘要

- **對應變更**：`add-deploy-workflow-avscratch-option`
- **變更檔案**
  - 修改：`.github/workflows/deploy-gcp-vm.yml`、`docs/deployment/gcp-vm.md`
  - 新增：`openspec/changes/add-deploy-workflow-avscratch-option/`

### 背景

網站透過 GitHub Actions 部署，刮刮樂試算服務（另一個 repo）原本只能在本機執行 `deploy-avscratch.sh` 更新。
使用者希望部署網站時可以順便更新。

### 做法

- `workflow_dispatch` 新增 boolean 輸入 `update_avscratch`（預設 false）
- 網站部署步驟之後新增一步：上傳 `deploy/gcp-vm/avscratch/` 的腳本到 VM，執行 `update-avscratch.sh`
  （VM 以唯讀 Deploy key 從 GitHub 拉 `py3_AVScratch_proj` 的 `main`）
- 網站部署失敗時不執行（GitHub Actions 預設前一步失敗即略過後續步驟）
- 沿用既有 SSH secrets，不需新增設定

## 驗證佐證

- 對應 `validation.md` 結論：**有條件通過**（「不勾選」路徑未實際執行）

| 項目 | 結果 |
|---|---|
| actionlint（`deploy-gcp-vm.yml`） | 無警告 |
| 勾選並部署 `e48ac3a` | 網站 10:19:38 啟動 → 10:19:46 上傳腳本 → 10:19:58 試算服務重啟，版本 = GitHub `main` |
| 線上驗證 | 登入正常；`test-scratch-sim.mjs` 17/17；9 個 model 試算全部 200 |
| 不勾選 | 未單獨執行（輸入預設 false，`if:` 條件控制） |

## 風險與後續追蹤

- **已知風險**：試算服務更新失敗時 workflow 顯示失敗，但網站已部署完成。
- **後續追蹤事項**：下次不勾選部署時，確認新步驟為 skipped。

## 封存前檢查

- [x] validation.md 已完成（有條件通過）
- [x] 變更檔案與風險說明已整理完成
- [x] 線上網站已確認正常
- [ ] 可執行 `openspec archive`（待確認不勾選路徑）
