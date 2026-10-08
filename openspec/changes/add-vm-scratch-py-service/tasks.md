# Tasks

## 1. 實作

- [x] `deploy/gcp-vm/avscratch/avscratch.service.template`
- [x] `deploy/gcp-vm/avscratch/setup-avscratch.sh`
- [x] `deploy/gcp-vm/avscratch/deploy-avscratch.sh`
- [x] `docs/deployment/gcp-vm.md`：新增部署章節、移除已知事項

## 2. 驗證

- [x] shellcheck
- [x] 實際部署到 VM，`/api/scratch/info` 回傳 9 個 model
- [x] 服務不對外開放
- [x] `test-scratch-sim.mjs` 對線上網站全數通過
- [x] 9 個 model 逐一試算
- [x] 重開機後自動啟動
- [x] 記錄記憶體與磁碟用量

## 3. 交付

- [x] 補齊 validation.md
- [x] 新增 `docs/Engineering Evidence/add-vm-scratch-py-service.md`
- [x] commit
