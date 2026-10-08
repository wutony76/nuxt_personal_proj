# Validation

## 驗證範圍

- 對應變更：`add-sync-flush-on-shutdown`
- 驗證環境：本機單元測試（vitest）、本機 production build 接 Docker Postgres 16、本機 dev server（接 Postgres）完整 `npm test`

## 功能驗證

- [x] 關閉前的資料在重啟後仍存在於 DB — 實際結果（本機 production build，`PORT=3100`）：
  - `test04` 登入成功後，`login_history` 仍是 0 筆（在記憶體，等下一輪 5 分鐘同步）
  - 對 node 程序送 `SIGTERM`：log 依序出現 `SYNC.shutdown.flush.start` → `SYNC.tick.source.success table=login_history rows=1`
    → `SYNC.tick.done sources=8 rows=81 durationMs=25` → `SYNC.shutdown.flush.done`
  - 程序 0.2 秒後結束，`login_history` 變為 **1 筆**
  - 對照：修改前在 VM 上登入後立刻 `pm2 restart`，`login_history` 為 0 筆
- [x] 單元測試通過，既有測試無回歸 — 實際結果：
  - `test/unit/sync.test.ts` 4 項：實作前 4 項皆失敗（`stopAndFlush is not a function`），實作後全數通過
  - `npm run test:unit` 25/25 通過
  - 本機 dev server（接 Postgres）等啟動測試跑完後執行 `npm test`：38/38 通過
- [ ] VM 實機（pm2 + Cloud SQL）：登入後立刻 `pm2 restart`，`login_history` 有寫入 — 待部署後驗證

## 視覺驗證

- 不適用

## 回歸驗證

- 流程：純記憶體模式
- 結果：`isDbEnabled()` 為 false 時不建立 `SyncScheduler`，也不註冊 close hook，行為不變
  （CI 條件的純記憶體模式 `npm test` 已在 `fix-ci-startup-test-interference` 驗證）

## 問題與修正紀錄

- 問題：第一次本機實測顯示關閉後仍是 0 筆
  - 發現方式：程序看似 0 秒結束，log 沒有 `SYNC.shutdown`
  - 原因：測試指令把 `cd && node … &` 一起放到背景，`$!` 拿到的是外層 subshell，`SIGTERM` 沒送到 node；
    node 其實仍在 3100 埠執行。屬於驗證方式錯誤，不是程式問題
  - 修正方式：改用 `lsof` 取得實際監聽 3100 的 node pid 再送 `SIGTERM`
  - 是否已重新驗證：是，結果如上

## 結論

- 是否通過：有條件通過（待 VM 實機驗證）
- 已知限制或風險：`SIGKILL`、當機、VM 斷電等無法攔截的情況，仍可能遺失最多 5 分鐘的批次資料
- 後續追蹤事項：部署後在 VM 上以 pm2 + Cloud SQL 實測
