# Proposal

## 變更名稱

`fix-ci-startup-test-interference` — 新增開關關閉 dev server 的啟動自動測試，修正 CI `npm test` 持續失敗

## 背景

CI 的 `test` job 自 2026-10-05 起連續失敗（至少 7 次），失敗步驟都是 `npm test`。

`server/plugins/init.ts` 在非 production 環境啟動時，會自動以 `admin@example.com` 依序執行
bg / 台彩 / retro 三組測試腳本（`TestClass`，約數分鐘）。CI 在 dev server 就緒後**立刻**執行
`npm test`，兩邊同時用同一個帳號下注，餘額互相干擾。

2026-10-08 在本機以 CI 相同條件重現（`DATABASE_URL=` 純記憶體模式、dev server 就緒後立即 `npm test`）：
38 支中 `test:6hc-cd`、`test:bg` 失敗，失敗斷言全部是扣款金額不符，例如：

- `拒單未扣款 (before=95210 after=95200)`：拒單卻被扣 10（另一邊的下注）
- `扣款金額正確（100 + 10 = 110）(before=97480 after=97270)`：實際扣了 210

同一天早上本機也遇過相同狀況；等啟動測試跑完後再執行，38 支全數通過。

加上開關後重跑，餘額干擾完全消失，但 `test:6hc-cd` 仍失敗：下注被拒「目前為『準備中』，不受理投注」，
log 顯示 `⚠ 等待開盤逾時（最後狀態：準備中）`。這是**第二個原因**：

- bg 系列每期 7 分鐘（`CYCLE_SECONDS = 420`），不開放下注的時間最長 110 秒
  （第 340～420 秒封盤到開獎完成 80 秒，加上下一期開頭「準備中」30 秒）
- 測試工具 `waitForOpen()` 預設只等 30 秒
- CI 剛啟動 dev server 4 秒就開始跑第一支 `test:6hc-cd`，碰到這段時間就必定逾時

## 目標

- CI 的 `npm test` 不再受啟動測試干擾
- 本機開發預設行為不變（啟動時仍會自動跑測試）

## 範圍

- `server/plugins/init.ts`：設定 `SKIP_STARTUP_TESTS=1` 時不執行啟動測試
- `.github/workflows/ci.yml`：`Start dev server` 步驟設定 `SKIP_STARTUP_TESTS=1`
- `test/_test-utils.mjs`：`waitForOpen()` 預設逾時 30 秒 → 130 秒

## 不包含

- 不移除啟動測試本身（本機開發仍在使用）
- 不調整台彩系列的開獎排程；台彩每日封盤時段遠長於 130 秒，碰到時仍會逾時（只是失敗得比較慢）

## 影響面

- 只影響非 production 環境；production 原本就不執行啟動測試
- 未設定環境變數時行為與修改前完全相同

## 風險與對策

| 風險 | 對策 |
|---|---|
| 修正後 CI 仍有其他原因失敗 | 本機以 CI 條件 + `SKIP_STARTUP_TESTS=1` 重跑驗證；push 後確認 CI 實際結果 |
| `waitForOpen` 拉長後測試總時間變長 | 只有碰上封盤時段才會等待，最多多等 110 秒 |

## 驗證方式

- 本機重現 CI 條件並設定 `SKIP_STARTUP_TESTS=1`：`npm test` 全數通過，dev log 沒有 `START.TESTING.RUN`
- 未設定時：dev log 仍有 `START.TESTING.RUN`（預設行為不變）
- push 後 CI 的 `test` job 通過

## 成功標準

- [ ] CI `test` job 通過
- [ ] 本機預設行為不變
