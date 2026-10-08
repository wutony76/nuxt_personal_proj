# Proposal

## 變更名稱

`add-sync-flush-on-shutdown` — 伺服器關閉前先執行一次定時同步，避免遺失最近 5 分鐘的資料

## 背景

2026-10-08 線上 VM 改接 Cloud SQL 後實測：登入 3 次後幾秒內 `pm2 restart`，`login_history`
仍是 0 筆。原因是 `SyncScheduler` 每 5 分鐘才把記憶體資料批次寫入 DB，關閉前沒有最後一次同步。

受影響的是所有透過 `registerSyncSource()` 註冊的批次同步來源：

- `login_history`（`registerLoginHistorySyncSource`）
- 遊戲注單 / retro 遊戲紀錄 / 彩池稽核（`registerGameOrdersSyncSource` 等）
- F 幣交易明細（`registerWalletSyncSources`）

會員、角色、設定等 write-through 資料修改當下就寫入，不受影響。

每次部署都會重啟，所以**每次部署都可能遺失最多 5 分鐘的上述資料**。

## 目標

- 伺服器收到關閉訊號（`SIGTERM` / `SIGINT`）時，先完成一次同步再結束
- pm2 重啟時給足夠的時間完成同步，不被強制終止

## 範圍

- `server/services/sync.ts`：`SyncScheduler` 新增 `stopAndFlush()`，停止 timer、等待進行中的同步、再執行最後一次
- `server/plugins/init.ts`：在 Nitro `close` hook 呼叫 `stopAndFlush()`
- `deploy/gcp-vm/ecosystem.config.cjs`：設定 pm2 `kill_timeout`
- `test/unit/sync.test.ts`：新增單元測試

## 不包含

- 不改變 5 分鐘的同步週期
- 不處理程序被 `SIGKILL`、當機、VM 斷電等無法攔截的情況（仍可能遺失最多 5 分鐘）

## 影響面

- 只在 `isDbEnabled()` 為 true 時生效；純記憶體模式不啟動 `SyncScheduler`，不受影響
- 關閉時間會增加同步所需時間（實測同步一輪通常在 1 秒內）

## 風險與對策

| 風險 | 對策 |
|---|---|
| 進行中的同步與最後一次同步同時執行 | `stopAndFlush()` 先等待進行中的那一輪完成，再執行最後一次 |
| DB 連不上導致關閉卡住 | `runSyncTick()` 每個來源各自 catch；Nitro `close` hook 本身有 30 秒上限 |
| pm2 預設 1.6 秒後強制終止，同步來不及完成 | `kill_timeout` 設為 15 秒 |

## 驗證方式

- 單元測試：`stopAndFlush()` 會等待進行中的同步、只多執行一次、之後不再排程
- 本機 production build 接 Postgres：登入後立刻送 `SIGTERM`，確認 `login_history` 有寫入
- VM 實機：登入後立刻 `pm2 restart`，確認 Cloud SQL 的 `login_history` 有寫入

## 成功標準

- [ ] 關閉前的資料在重啟後仍存在於 DB
- [ ] 單元測試通過，既有測試無回歸
