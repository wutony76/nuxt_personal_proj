# Validation

- 對應變更：`migrate-wallet-and-reports-postgres`（盤點清單最後 5 項：F幣餘額/交易明細持久化 +
  遊戲紀錄/彩池稽核/F幣統計/台彩派彩 四條查詢路徑接 DB）
- 日期：2026-10-07

## 實作內容確認

- `server/services/db/schema.ts` 新增 `wallet_coin`（PK user_id）、`wallet_balance_changes`
  （PK (source, id)）、`tw_payout_events`（PK (source, order_id)）三張表，migration
  `drizzle/0007_wise_bug.sql` 已產生並套用成功
- `server/services/walletSyncSource.ts`：三個 SyncSource，全量快照，不裁剪，**完全沒有
  修改任何既有的 23 款遊戲結算/下注程式碼**（46 處 coin 賦值、25 處 balanceChanges push
  原封不動）
- `hfyyManage.ts` 新增 `coin` 開機回填
- 四條查詢路徑（`gameHistory.ts`/`poolAudit.ts`/`fcoin-summary.get.ts`/
  `tw-lottery-payout.get.ts`）皆改 async，比照既有 `queryArchivedOrdersForMonth` 樣板合併
  記憶體+DB，`dataNote` 文字同步更新

## 核心驗證：第一輪、第二輪同步都撲空，第三輪才成功（誠實記錄實測過程）

- 乾淨重啟後，`wallet_coin` 立刻在第一輪同步正確寫入（27 筆，對應當時全部會員）
- 但 `wallet_balance_changes`/`tw_payout_events` 連續兩輪同步都是 0 筆——追查後發現單純是
  時間點問題：前兩輪同步剛好發生在「背景測試腳本還沒跑完、使用者還沒累積任何交易明細」的
  空窗期，不是程式邏輯錯誤。等到第三輪（開機後約 15 分鐘），背景測試已經產生大量真實交易，
  同步正確寫入 75 筆 `wallet_balance_changes`、47 筆 `tw_payout_events`——後者的 47 筆
  精確對應當下 `tw-lottery-payout` 報表記憶體讀到的 `totalCount: 47`，數字完全吻合

## 核心驗證：重啟後合併查詢證實真的在讀 DB（不是只讀記憶體）

重啟 dev server 後，記憶體幾乎全空（背景測試才剛開始跑），立刻用 admin 帳號查詢四條路徑：

| 路徑 | 結果 |
|---|---|
| 遊戲紀錄（`games/history`） | `records: 1381`、`balanceChanges: 60` |
| 彩池稽核（`pool-audit`） | `reseed: 1242`、`overpay: 674` |
| F幣統計報表（`fcoin-summary`） | `totalReward: 5774`，30 款玩法明細 |
| 台彩派彩統計（`tw-lottery-payout`） | `totalPayout: 3789990988`、`totalCount: 89` |

這些數字遠超過「剛重啟、測試才跑幾秒」的記憶體內容量，證實合併查詢正確地把 DB 裡的歷史資料
接回來顯示。

## `coin` 開機回填驗證

- 重啟前記錄 admin 帳號的 coin（記憶體與 `wallet_coin` 表皆為 99007，一致）
- 重啟後立刻查詢，coin 為 96077——**不是舊痛點的 100000**，而是從 99007 為基準再扣掉重啟後
  幾秒內背景測試已經消耗掉的金額（BG 測試腳本會快速下注），證實回填正確運作、只是因為背景
  測試持續在跑，無法抓到「重啟瞬間、測試還沒開始」的絕對淨值

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：四條查詢路徑皆正常回 200（退回純記憶體行為）
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤
- 完整 `npm test`（38 支腳本）：通過 36 支，失敗 2 支（`test:6hc-cd`/`test:bg`），個別重跑後
  皆 100% 通過（`test:6hc-cd` 56/56、`test:bg` 14/14）——確認是既有已知的 BG 期別邊界時序
  flakiness，與本次變更無關

## typecheck

新增/異動的檔案（`schema.ts`/`walletSyncSource.ts`/`walletReportQuery.ts`/
`historyReportQuery.ts`/`poolAuditReportQuery.ts`/`gameHistory.ts`/`poolAudit.ts`/
`fcoin-summary.get.ts`/`tw-lottery-payout.get.ts`/`history.get.ts`/`pool-audit.get.ts`/
`hfyyManage.ts`）皆無新增型別錯誤；`tw-lottery-payout.get.ts` 既有的 6 個 `TS2532` 錯誤
（`gameMap[g.key]` 索引存取）在改動前後行號不同但數量/型態一致，確認是既有缺陷，不是本次
新增。

## 已知限制（延續 design.md 的決策）

- `coin` 重啟時機卡在兩次同步之間，會遺失最近幾分鐘的餘額變動，退回上一輪同步快照
- `wallet_balance_changes`/`tw_payout_events` 不回填記憶體，只當永久備份；重啟後管理員查詢
  畫面要等累積到新交易才會再顯示記憶體內容（DB 歷史透過合併查詢補上，不影響正確性）
- `memberBalanceHistory.ts`（會員個人異動明細）本來就缺漏 8 個 TW 來源（pre-existing bug），
  本次不處理
- `wallet_balance_changes` 全量快照理論上隨使用量無上限增長，以這個專案的實際使用規模（Demo/
  測試為主）不構成問題

## 成功標準檢核

- [x] 三張新表 + SyncSource + `coin` 開機回填完成並驗證
- [x] 四條查詢路徑（Area A/B/C/D）合併查詢完成並驗證
- [x] 既有測試無回歸（2 支已知 flaky 測試重跑後皆 100% 通過）
