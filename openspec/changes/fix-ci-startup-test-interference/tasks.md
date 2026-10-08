# Tasks

## 1. 實作

- [x] `server/plugins/init.ts`：`SKIP_STARTUP_TESTS=1` 時跳過啟動測試
- [x] `.github/workflows/ci.yml`：`Start dev server` 設定 `SKIP_STARTUP_TESTS: '1'`
- [x] `test/_test-utils.mjs`：`waitForOpen()` 預設逾時改為 130 秒

## 2. 驗證

- [x] 本機 CI 條件 + 開關：`npm test` 全數通過，dev log 沒有 `START.TESTING.RUN`
- [x] 不設開關：dev log 仍有 `START.TESTING.RUN`
- [ ] push 後 CI `test` job 通過

## 3. 交付

- [x] 補齊 validation.md
- [x] 新增 `docs/Engineering Evidence/fix-ci-startup-test-interference.md`
- [x] commit
