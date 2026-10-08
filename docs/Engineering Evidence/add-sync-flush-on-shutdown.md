# Engineering Evidence：伺服器關閉前先同步，避免遺失最近 5 分鐘的資料

## 變更摘要

- **對應變更**：`add-sync-flush-on-shutdown`
- **變更檔案**
  - 修改：`server/services/sync.ts`、`server/plugins/init.ts`、`deploy/gcp-vm/ecosystem.config.cjs`
  - 新增：`test/unit/sync.test.ts`、`openspec/changes/add-sync-flush-on-shutdown/`

### 背景

線上 VM 改接 Cloud SQL 後實測：登入 3 次後幾秒內 `pm2 restart`，`login_history` 仍是 0 筆。
登入紀錄、遊戲注單、retro 紀錄、彩池稽核、F 幣交易明細都走 `SyncScheduler` 每 5 分鐘批次同步，
關閉前沒有最後一次同步，**每次部署或重啟都可能遺失最多 5 分鐘的這類資料**。

### 做法

| 位置 | 內容 |
|---|---|
| `SyncScheduler.stopAndFlush()` | 停止排程 → 等待進行中的那一輪 → 再同步最後一次；不會拋錯 |
| Nitro `close` hook | Nitro node-server 收到 `SIGTERM` / `SIGINT` 時會呼叫，最多等 30 秒 |
| pm2 `kill_timeout: 15000` | pm2 預設 1.6 秒就送 `SIGKILL`，Cloud SQL 經 Proxy 可能來不及寫完 |

先等待進行中的那一輪，是為了避免兩輪同時寫同一批資料，以及 `onSynced()` 裁剪記憶體的順序錯亂。

## 驗證佐證

- 對應 `validation.md` 結論：**有條件通過**（待 VM 實機驗證）

| 項目 | 結果 |
|---|---|
| 單元測試 `sync.test.ts` | 實作前 4/4 失敗，實作後 4/4 通過；`test:unit` 25/25 |
| 本機 production build + Postgres，登入後立刻 `SIGTERM` | `login_history` 0 → **1** 筆，flush 25ms，程序 0.2 秒結束 |
| 修改前對照（VM，登入後立刻 `pm2 restart`） | `login_history` 0 筆 |
| 回歸：dev + Postgres `npm test` | 38/38 |

## 風險與後續追蹤

- **已知風險**：`SIGKILL`、當機、VM 斷電等無法攔截的情況，仍可能遺失最多 5 分鐘的批次資料。
- **後續追蹤事項**：部署到 VM 後，以 pm2 + Cloud SQL 實測登入後立刻 `pm2 restart`。

## 封存前檢查

- [x] validation.md 已完成（有條件通過，待 VM 實機驗證）
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` / build 已確認正常
- [ ] 可執行 `openspec archive`（待 VM 實機驗證）
