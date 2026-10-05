# Validation

## 結論：通過

## 1. 單元測試

`npm run test:unit`（`TZ=UTC vitest run`，Vitest 4.1.11）：

```
Test Files  1 passed (1)
     Tests  21 passed (21)
```

### 測試能抓到原本的問題

把舊的 `_nextDrawWindow()`（本地時間寫法，DLT 設定）在兩種時區下執行：

| 輸入（台灣時間） | `TZ=Asia/Taipei` 的鎖單時間 | `TZ=UTC` 的鎖單時間 |
|---|---|---|
| 10/5（一）10:00 | 10/6 20:00 ✅ | 10/7 04:00 ❌ |
| 10/6（二）07:00 | 10/6 20:00 ✅ | 10/7 04:00 ❌ |

新寫法在 `TZ=UTC` 下兩者皆為 10/6 20:00，對應單元測試的「非開獎日」與「台灣清晨」案例。

## 2. 時區：production build 以 UTC 啟動

`TZ=UTC NODE_ENV=production node .output/server/index.mjs`，於台灣時間 10/5（一）上午查詢：

| 彩種 | 開獎日 | `cutoffAt` | `drawAt` |
|---|---|---|---|
| DLT | 週二、五 | 10/6 20:00 | 10/6 20:30 |
| D539 | 週一～六 | 10/5 20:00 | 10/5 20:30 |
| SUPERLOTTO | 週一、四 | 10/5 20:00 | 10/5 20:30 |

server log 無 `TTT---WARN.TIMEZONE` 警告，代表 plugin 在主執行緒成功設定時區。

## 3. 回歸：dev server

| 腳本 | 結果 |
|---|---|
| `test:dlt` | 40/40 |
| `test:superlotto` | 52/52 |
| `test:d539` | 39/39 |
| `test:m649` | 38/38 |
| `test:m539` | 40/40 |
| `test:p3` | 45/45 |
| `test:p4` | 42/42 |
| `test:bingo` | 94/94 |

## 4. 回歸：production build（對照實驗）

同樣的 8 支 E2E 腳本在全新啟動的 production build 上執行，三組各跑一次：

| 組別 | 失敗總數 | 其中 bingo |
|---|---|---|
| 改動前（HEAD），`TZ=Asia/Taipei` | 34 | 19 |
| 本次改動，`TZ=Asia/Taipei` | 34 | 17 |
| 本次改動，`TZ=UTC` | 34 | 19 |

失敗項目皆為「強制結算後注單仍為 pending」，三組分布相同，屬於 production 模式下既有的不穩定，
與本次改動無關。CI 只在 dev 模式跑 E2E，因此先前沒有被發現，另案追蹤。

> 第一次做這組對照時，前一台 server 沒有正確關閉，後兩組實際上打到同一台 server，結果作廢；
> 上表是改以 port 確認 server 已關閉後重新跑的結果。

## 5. 依賴變更

- `devDependencies` 新增 `vitest@^4.1.11`。
- npm 10.9.7 安裝時遇到 arborist 的 `edgesOut` 錯誤（解析 peer 相依時的已知問題），改用 npm 11 安裝。
- lock 檔變動：新增 vitest 及其相依；移除兩個 optional peer 項目（`commander`、`@nuxt/test-utils` 底下的 `crossws`），不影響執行。
