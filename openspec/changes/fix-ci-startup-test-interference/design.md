# Design

## 1. 開關（`server/plugins/init.ts`）

```ts
const skipStartupTests = process.env.SKIP_STARTUP_TESTS === '1'
if (process.env.NODE_ENV !== 'production' && !skipStartupTests) {
  void (async () => { ... })()
} else if (skipStartupTests) {
  console.log('SKIP ---TESTING（SKIP_STARTUP_TESTS=1）')
}
```

- **命名**：`SKIP_STARTUP_TESTS`，直接描述效果；沿用專案既有 `SEED_DEMO_DATA` 這類「全大寫、無前綴」的環境變數風格。
- **只認 `'1'`**：避免 `false`、`0` 之類字串被當成 truthy 而意外關閉。
- **預設不跳過**：本機開發仍維持「啟動就跑一輪測試」的既有習慣。
- 跳過時印一行 log，方便從 dev log 判斷這次有沒有跑。

## 2. CI（`.github/workflows/ci.yml`）

```yaml
- name: Start dev server
  env:
    # 不跑 dev server 啟動時的自動測試，避免與下面的 npm test 同時用同一個帳號下注互相干擾
    SKIP_STARTUP_TESTS: '1'
  run: |
    nohup npm run dev > dev-server.log 2>&1 &
```

- `nohup` 啟動的子程序會繼承這個 step 的環境變數。
- 其他 step 不需要設定。

## 3. `waitForOpen()` 預設逾時（`test/_test-utils.mjs`）

```js
async function waitForOpen(currentPath, { timeoutMs = 130000, intervalMs = 500 } = {}) {
```

- bg 系列狀態（`server/services/game/lottery/bg/base.ts` 的 `getStatusBySeconds`，每期 420 秒）：

  | 秒數 | 狀態 | 可下注 |
  |---|---|---|
  | 0～30 | 準備中 | ✗ |
  | 30～340 | 開盤中 | ✓ |
  | 340～420 | 封盤 → 準備開獎 → 開獎中 → 已開獎 | ✗ |

- 最長不可下注時間 = 80 + 30 = 110 秒，取 130 秒保留餘裕。
- 改預設值而不是逐一改呼叫端：所有 bg 測試共用同一個週期，呼叫端仍可傳 `timeoutMs` 覆寫。

## 4. 測試與驗證策略

| 項目 | 方式 |
|---|---|
| CI 條件 + 開關 | 本機 `DATABASE_URL= SKIP_STARTUP_TESTS=1 npm run dev`，就緒後立即 `npm test` |
| 預設行為 | 不設開關啟動，dev log 有 `START.TESTING.RUN` |
| 實際 CI | push 後以 GitHub API 確認 `test` job 結果 |
