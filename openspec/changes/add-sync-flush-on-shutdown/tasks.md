# Tasks

## 1. 實作

- [x] `server/services/sync.ts`：`SyncScheduler` 新增 `_inFlight`、`_runTickSafely()`、`stopAndFlush()`
- [x] `server/plugins/init.ts`：Nitro `close` hook 呼叫 `stopAndFlush()`
- [x] `deploy/gcp-vm/ecosystem.config.cjs`：`kill_timeout: 15000`

## 2. 驗證

- [x] 新增 `test/unit/sync.test.ts`，`npm run test:unit` 通過
- [x] 本機 production build 接 Postgres：登入後立刻 `SIGTERM`，`login_history` 有寫入
- [x] `npm test` 無回歸
- [ ] VM 實機：登入後立刻 `pm2 restart`，Cloud SQL `login_history` 有寫入

## 3. 交付

- [x] 補齊 validation.md
- [x] 新增 `docs/Engineering Evidence/add-sync-flush-on-shutdown.md`
- [x] commit
