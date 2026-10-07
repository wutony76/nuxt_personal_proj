# Proposal

## 變更名稱

`migrate-wallet-and-reports-postgres` — F幣餘額/交易明細持久化 + 剩餘查詢路徑接 DB

## 背景

使用者盤點後剩下的 5 項全部一次處理：

1. 遊戲紀錄查詢路徑接 DB（`games/history.get.ts`）
2. 彩池稽核查詢路徑接 DB（`pool-audit.get.ts`）
3. F幣統計報表（`fcoin-summary.get.ts`）
4. 台彩派彩統計報表（`tw-lottery-payout.get.ts`）
5. F幣餘額/交易明細持久化（本批工程量最大的一項）

深入盤點後發現 3、4 其實**依賴** 5（F幣統計報表讀的是 `record.balanceChanges`；台彩派彩統計讀
的是 TW 各玩法 `betHistory` 的中獎列），所以把 5 項放在同一個 change 裡處理，依「先建地基、
再接查詢路徑」的順序實作。

## 範圍最大的一項：F幣餘額/交易明細，為什麼不是「重寫 46 處 coin 賦值 + 25 處 push」

`coin`（F幣餘額）分散在 23 款遊戲（15 BG + 8 TW）各自的結算邏輯裡直接賦值，`balanceChanges`
也分散在 23 款遊戲 + 錢包服務裡各自 push（其中 23 處 `pushBalanceChange()` 形狀幾乎逐字相同）。
若要 write-through，必須把這 71 個呼叫點全部改 async 並插入 DB 寫入——風險極高、牽動面極廣，
且這個專案的規模（個人作品集 Demo，非真實金流系統）不值得這個代價。

**決策：兩者都走批次同步（5 分鐘），完全不碰這 71 個呼叫點**：
- `coin`：新增 `wallet_coin` 表（`user_id` PK → `members.id` CASCADE），批次快照目前餘額。
  重啟時機好壞剛好卡在兩次同步之間，會遺失最近幾分鐘的餘額變動，退回上一輪同步快照——這跟
  Phase 3 既有「重啟會遺失進行中期別的 orders」是同一等級的已知取捨，記錄在案
- `balanceChanges`（交易明細）：新增 `wallet_balance_changes` 表，批次全量快照（比照
  `retro_game_history`/`login_history`/`pool_audit_*`，不裁剪、不回填記憶體），DB 保留永久
  完整歷史（比記憶體的 5000→4000 上限更完整），查詢路徑（Area A 的遊戲紀錄、Area C 的 F幣
  統計報表）改成「記憶體（近期）+ DB（完整歷史）」合併查詢，比照既有 `queryArchivedOrdersForMonth`
  的樣板

## Area D 的額外發現：台彩派彩統計不能重用 F幣交易明細

深入確認後發現：TW 玩法的「中獎」（`betHistory` 的 `winStatus`/`winAmount`，結算當下寫入）跟
「領獎」（`pushBalanceChange` 的 `type:'claim'`，玩家手動點擊領取時才寫入，可能延後、可能
從未發生）是兩個時間點不同、不能互相替代的事件。既有報表統計的是「中獎當下」，所以需要獨立
持久化 TW 的中獎紀錄，不能靠 F幣交易明細代替。新增 `tw_payout_events` 表，同樣批次全量快照
（只收 `winStatus === 'win'` 的列），不碰 8 款 TW 玩法的既有結算邏輯。

## 範圍

- 包含：`wallet_coin`/`wallet_balance_changes`/`tw_payout_events` 三張新表 + 對應 SyncSource；
  `coin` 開機回填（修正「重啟後 F幣全部變回 100000」的現有痛點）；`retro_game_history`/
  `pool_audit_*`（既有表，已在同步，只是查詢路徑沒接）接上 Area A/B 的查詢路徑；
  `fcoin-summary`/`tw-lottery-payout` 兩份報表改合併查詢
- 不包含：`balanceChanges`/TW 中獎紀錄的開機回填（比照既有 `login_history` precedent，
  只當永久備份，不回填記憶體）；`memberBalanceHistory.ts`（會員個人異動明細）的 DB 合併——
  這支既有缺漏 8 個 TW 來源（pre-existing bug，不是本次造成），不在本次處理範圍
- 不碰：23 款遊戲的任何既有結算/下注程式碼（46 處 coin 賦值、25 處 balanceChanges push 全部
  原封不動）

## 驗證方式

- 重啟後確認 F幣餘額正確回填（不再變回 100000）
- 下一輪同步後確認 `wallet_coin`/`wallet_balance_changes`/`tw_payout_events` 正確寫入
- 三份查詢路徑（遊戲紀錄、彩池稽核、F幣統計、台彩派彩）確認記憶體+DB 合併結果正確
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] 三張新表 + SyncSource + `coin` 開機回填完成並驗證
- [ ] 四條查詢路徑（Area A/B/C/D）合併查詢完成並驗證
- [ ] 既有測試無回歸
