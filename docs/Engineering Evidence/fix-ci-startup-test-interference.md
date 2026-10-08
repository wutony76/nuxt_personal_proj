# Engineering Evidence：修正 CI `npm test` 持續失敗

## 變更摘要

- **對應變更**：`fix-ci-startup-test-interference`
- **變更檔案**
  - 修改：`server/plugins/init.ts`、`.github/workflows/ci.yml`、`test/_test-utils.mjs`
  - 新增：`openspec/changes/fix-ci-startup-test-interference/`

### 背景

CI 的 `test` job 自 2026-10-05 起連續失敗至少 7 次，都停在 `npm test`。GitHub Actions 的 log 需要登入才能讀取，
所以先在本機以 CI 相同條件重現，找出兩個獨立的原因。

### 兩個原因

| # | 原因 | 症狀 | 修正 |
|---|---|---|---|
| 1 | dev server 在非 production 啟動時，會自動以 `admin@example.com` 跑一輪 bg / 台彩 / retro 測試；CI 在 dev server 就緒後立刻跑 `npm test`，兩邊同時用同一個帳號下注 | 扣款金額不符，例如拒單卻被扣 10、預期扣 110 實際扣 210 | 新增 `SKIP_STARTUP_TESTS=1` 開關，CI 的 `Start dev server` 步驟設定它 |
| 2 | bg 系列每期 7 分鐘，最長 110 秒不可下注（封盤到開獎完成 80 秒 + 下一期「準備中」30 秒），`waitForOpen()` 只等 30 秒 | `⚠ 等待開盤逾時（最後狀態：準備中）` 後下注被拒 | `waitForOpen()` 預設改為 130 秒 |

原因 2 是修正原因 1 之後才浮現的：CI 一啟動 4 秒就跑第一支 `test:6hc-cd`，很容易碰到「準備中」。

## 驗證佐證

- 對應 `validation.md` 結論：**通過**

| 情境（本機，CI 條件） | 結果 |
|---|---|
| 修正前 | 38 支中 2 支失敗，全部是扣款金額不符 |
| 只加開關 | 餘額干擾消失；`test:6hc-cd` 仍因等待開盤逾時失敗 |
| 開關 + `waitForOpen` 130 秒 | 與本變更相關的 37 支全部通過 |
| 刻意在「已封盤」時跑 `test:6hc-cd` | 等待約 110 秒後開盤，56 項全部通過 |
| 不設開關（一般開發模式） | 啟動測試照常執行，預設行為不變 |
| **GitHub Actions CI**（push `e4d5a18`） | 自 10/05 起的 failing 轉為 **passing** |

## 風險與後續追蹤

- **已知風險**
  - 台彩系列每天 20:00～20:30 封盤，遠長於 130 秒；CI 剛好在這段時間執行時，台彩測試仍可能逾時（修改前也一樣）。
  - 測試總時間在碰上封盤時最多會多 110 秒。
- **後續追蹤事項**：無。

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（有開關、無開關兩種情況）
- [x] 可執行 `openspec archive`
