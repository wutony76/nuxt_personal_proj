# Validation

## 驗證範圍

- 對應變更：`fix-ci-startup-test-interference`
- 驗證環境：本機，模擬 CI 條件（`DATABASE_URL=` 純記憶體模式、dev server 就緒後立即 `npm test`）；本機一般開發模式（接 Docker Postgres）

## 功能驗證

| 情境 | 結果 |
|---|---|
| **修正前**：CI 條件 | 38 支中 2 支失敗（`test:6hc-cd`、`test:bg`），斷言全部是扣款金額不符，例如 `拒單未扣款 (before=95210 after=95200)` |
| 只加開關 `SKIP_STARTUP_TESTS=1` | dev log 有 `SKIP ---TESTING（SKIP_STARTUP_TESTS=1）`、`START.TESTING.RUN` 0 次；`test:bg` 通過，餘額干擾消失；但 `test:6hc-cd` 仍失敗：`⚠ 等待開盤逾時（最後狀態：準備中）` |
| 開關 + `waitForOpen` 130 秒，CI 條件完整 `npm test` | 38 支中 37 支通過；唯一失敗的 `test:unit` 是另一個變更（`add-sync-flush-on-shutdown`）尚未實作時新增的測試，與本變更無關 |
| 刻意在 6hc-cd「**已封盤**」時執行 `test:6hc-cd` | `waitForOpen` 等待約 110 秒（最壞情況）後回到開盤，56 項全部通過，沒有逾時警告 |
| 不設開關（一般開發模式） | dev log 仍有 `***---START.TESTING.RUN`，預設行為不變 |

- [x] CI `test` job 通過 — 實際結果：push `e4d5a18` 後，CI workflow 徽章由 failing（自 10/05 起）轉為 **passing**
- [x] 本機預設行為不變

## 視覺驗證

- 不適用

## 回歸驗證

- 流程：本機一般開發模式（接 Postgres、啟動測試照常執行），等啟動測試跑完後執行 `npm test`
- 結果：見 `add-sync-flush-on-shutdown/validation.md`（兩個變更一起做回歸）

## 問題與修正紀錄

- 問題：只加開關後 `test:6hc-cd` 仍失敗
  - 發現方式：以 CI 條件重跑
  - 修正方式：查出 bg 系列每期最長 110 秒不可下注，`waitForOpen` 只等 30 秒；預設改為 130 秒並納入本變更
  - 是否已重新驗證：是，刻意在已封盤時執行，等待 110 秒後通過

## 結論

- 是否通過：是
- 已知限制或風險：台彩系列每日封盤時段遠長於 130 秒，若 CI 剛好在台彩封盤時段執行，台彩測試仍可能逾時（修改前也一樣）
- 後續追蹤事項：無
