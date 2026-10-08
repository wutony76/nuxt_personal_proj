# Design

## 1. 關閉流程

```
pm2 restart / systemctl stop
  └─ SIGINT / SIGTERM
       └─ Nitro setupGracefulShutdown（nitropack/dist/runtime/internal/shutdown.mjs）
            └─ nitroApp.hooks.callHook('close')   ← 最多等 NITRO_SHUTDOWN_TIMEOUT（預設 30 秒）
                 └─ syncScheduler.stopAndFlush()
                      ├─ isRunning = false、清除 timer（不再排下一輪）
                      ├─ await 進行中的那一輪（如果有）
                      └─ 執行最後一次 runSyncTick()
```

- Nitro node-server preset 預設就會攔截 `SIGTERM SIGINT` 並呼叫 `close` hook，不需要自己掛 `process.on`。
- dev 模式下 Nitro worker 重新載入時也會呼叫 `close`，行為一致。

## 2. `SyncScheduler.stopAndFlush()`（`server/services/sync.ts`）

```ts
private _inFlight: Promise<void> | null = null

private async _circle(): Promise<void> {
  this._inFlight = this._runTickSafely()
  await this._inFlight
  this._inFlight = null
  if (!this.isRunning) return
  this._timer = setTimeout(() => this._circle(), this.intervalMs)
}

async stopAndFlush(): Promise<void> {
  this.stop()
  if (this._inFlight) await this._inFlight
  await this._runTickSafely()
}
```

- `_runTickSafely()`：把原本 `_circle()` 裡的 try/catch 抽出來，兩處共用。
- 先等待進行中的那一輪：避免同一批資料被兩輪同時 upsert，以及 `onSynced()` 裁剪記憶體的順序錯亂。
- upsert 本身是冪等的，即使重複寫入也不會產生重複資料。

## 3. 註冊 hook（`server/plugins/init.ts`）

```ts
export default defineNitroPlugin(async (nitroApp) => {
  ...
  const syncScheduler = new SyncScheduler().start()
  nitroApp.hooks.hook('close', async () => {
    console.log('SYNC.shutdown.flush.start')
    await syncScheduler.stopAndFlush()
    console.log('SYNC.shutdown.flush.done')
  })
```

- 只在 `isDbEnabled()` 分支內註冊，純記憶體模式行為不變。
- 參數原本命名為 `_nitroApp`（表示未使用），改為 `nitroApp`。

## 4. pm2 `kill_timeout`（`deploy/gcp-vm/ecosystem.config.cjs`）

- pm2 預設 `kill_timeout` 為 1600ms，超過就送 `SIGKILL`。
- 設為 `15000`：同步一輪通常不到 1 秒，Cloud SQL 經 Proxy 連線略慢，15 秒仍有充足餘裕，又不會讓部署卡太久。

## 5. 測試與驗證策略

| 項目 | 方式 |
|---|---|
| 單元測試 | `test/unit/sync.test.ts`，以 `vi.mock` 替換 `getDb()`，驗證等待進行中的同步、最後一次執行、不再排程 |
| 本機整合 | production build 接本機 Postgres，登入後立刻 `kill -TERM`，查 `login_history` |
| VM 實機 | 部署後登入，立刻 `pm2 restart portfolio`，查 Cloud SQL `login_history` |
| 回歸 | `npm run test:unit`、`npm test` |
