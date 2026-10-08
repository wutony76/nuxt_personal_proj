# Validation

## 驗證範圍

- 對應變更：`add-deploy-workflow-avscratch-option`
- 驗證環境：GitHub Actions「Deploy (GCP VM)」、GCP VM `hfyy-instance-1`、線上網站

## 功能驗證

- [x] 勾選時網站與試算服務都更新成功 — 實際結果（使用者 Run workflow 並勾選，部署 `e48ac3a`）：
  | 時間（UTC） | 事件 |
  |---|---|
  | 10:19:38 | 網站新版本 `20261008101914-e48ac3a` 由 pm2 啟動 |
  | 10:19:42 | `db.ping` 成功、`sync.scheduler.start` |
  | 10:19:46 | workflow 上傳 `setup-avscratch.sh`、`update-avscratch.sh`、`avscratch.service.template` 到 VM |
  | 10:19:58 | `avscratch` 重新啟動，版本 `b517c6e`（= GitHub `main`） |
  - 順序符合設計：網站部署成功後才更新試算服務
  - Deploy (GCP VM) workflow 徽章：passing
  - 線上驗證：登入 3 情境皆符合預期；`test-scratch-sim.mjs` 17/17；9 個 model 試算全部 200
- [ ] 不勾選時只部署網站 — **未單獨執行**。依據：新步驟 `if: ${{ inputs.update_avscratch }}`，輸入預設 `false`；
  actionlint 對 `deploy-gcp-vm.yml` 無警告。下次一般部署時可確認該步驟顯示為 skipped

## 視覺驗證

- 不適用

## 回歸驗證

- 流程：網站部署本身（build、migration、健康檢查、回滾機制）
- 結果：步驟未修改；本次部署成功、網站正常

## 問題與修正紀錄

- 無

## 結論

- 是否通過：有條件通過（「不勾選」路徑未實際執行）
- 已知限制或風險：試算服務更新失敗時 workflow 會顯示失敗，但網站已部署完成
- 後續追蹤事項：下次不勾選部署時，確認 `Update scratch simulator service` 步驟為 skipped
