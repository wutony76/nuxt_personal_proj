# Proposal

## 變更名稱

`migrate-game-history-postgres` — 把遊戲紀錄（下注/開獎/復古遊戲）與每日配額計數器搬遷到 PostgreSQL，
並解決記憶體無上限成長問題（`add-postgres-docker` 規劃的 Phase 3）

## 背景

調查確認目前共 61 款玩法/遊戲（15 款 BG 彩票盤口 + 8 款 TW 台彩 + 30 款復古遊戲 + 8 款童玩），各自的
歷史資料全部是純記憶體，成長速度與上限狀況差異很大：

| 資料 | 成長觸發 | 目前上限/清理 |
| --- | --- | --- |
| `Storage.lottery.orders[key][issue]`（23 款彩票玩法共用） | 每次下注 | **完全無上限，永久累積** |
| `xxxRecord.betHistory` / `.balanceChanges`（每玩家每盤口） | 每次下注/入帳 | 5000 → 裁至 4000 |
| `xxxRecord.claimableIssues`（23 處） | 每次開獎有待領 | **無上限**，僅領獎時移除 |
| `Storage.lottery.poolAudit.{reseed,overpay}`（全站共用） | 重骰/保底超付事件 | 2000 → 裁至 1800 |
| `retroGames.history[key].records[userId]`（30 款復古遊戲） | 每局結束 | 50 筆（per user per game） |
| `retroGames.history[key].dailyGrants[userId][date]`（每日 coin 核發計數器） | 每局有核發 coin | **無清理**，且**無持久化** |

其中 `Storage.lottery.orders` 是唯一「完全無上限成長」的資料：以 15 款 BG 盤口、每款每天約 215 期、
每期數十到數百筆注單（含 20 個 NPC 帳號 24 小時自動下注）估算，單日可能新增 3 萬～16 萬筆，且從不清除，
長期不重啟會持續佔用記憶體。使用者確認本次要一併解決這個問題（而非只是把資料複寫一份到 DB）。

另外也發現一個既有邏輯缺口：`dailyGrants`（復古遊戲每日 coin 核發上限的計數器）完全沒有持久化，若
server 在一天中途重啟，計數器歸零，玩家等於能在同一天內多領一次每日上限——這跟 `add-game-history`
既有待辦「之後需要後台管理介面調整 `coinDailyCap` 等參數」是同一塊，本次順便修正。

6hc-cd 等盤口的配額驗證（`validateBetQuota()`）是**即時掃描記憶體**當期 `Storage.lottery.orders` 做
加總比對，屬於「正確性優先、需要即時資料」的場景，跟 Phase 1 規劃的 5 分鐘批次同步「最終一致」的前提
互相衝突，本次需要明確劃清楚「DB 只做歷史歸檔/報表查詢，配額驗證繼續只讀記憶體」的界線。

## 目標

1. 把下注紀錄（orders）、復古遊戲紀錄、彩池稽核事件，透過 Phase 1 規劃的批次 `SyncSource` 機制同步
   寫入 Postgres，作為永久歷史與後台報表查詢的來源
2. 同步成功後，從記憶體裁剪已結算、不再需要即時存取的歷史資料（主要是 `Storage.lottery.orders`），
   解決「永不清空、隨運行時間線性增長」的記憶體風險
3. 把 `dailyGrants`（每日 coin 核發計數器）改採 write-through + 開機回填（比照 Phase 2 模式），修正
   「伺服器重啟後當日配額歸零」的既有邏輯缺口
4. 調整後台報表 API（`members.get.ts`/`bg-summary.get.ts`），改成「近期資料查記憶體、較舊已歸檔資料
   查 DB」的合併查詢，不改變既有回應格式

## 範圍

- 包含：
  - `game_orders` 統一 schema（跨 23 款彩票玩法彙整成一張表，帶 `game_key` 欄位，取代現況各盤口
    `OrdersClass` 各自獨立 in-memory 結構不共用 schema 的狀況）
  - `retro_game_history` 表（對應 `records`，30 款復古遊戲共用一張表）
  - `pool_audit_reseed` / `pool_audit_overpay` 兩張表（全站共用，目前記憶體有 2000→1800 上限，DB 化後
    可保留完整歷史不再裁剪真實資料，只裁記憶體快取）
  - `retro_daily_grants` 表（write-through + 開機回填，修正重啟配額歸零缺口）
  - 擴充 Phase 1 的 `SyncSource` 介面：新增可選的 `onSynced(rows)` 回呼，供「增量 + 同步後裁剪記憶體」
    的來源使用（區別於 Phase 2 既有「全量快照、不裁剪」的用法，向下相容）
  - 記憶體保留策略：`Storage.lottery.orders` 只保留「目前進行中期別 + 前一個已結算期別」，其餘在
    DB 寫入確認成功後裁剪，確保配額驗證邏輯（只查當期）不受影響
  - 調整 `members.get.ts` / `bg-summary.get.ts` 的讀取路徑，改成合併查詢記憶體（近期未裁剪部分）+
    DB（已歸檔部分）
- 不包含：
  - 23 款玩法各自的 `xxxRecord.betHistory` / `.balanceChanges` / `.claimableIssues`（玩家層級明細帳本）
    ——`betHistory`/`balanceChanges` 已有 4000→5000 裁剪保護，暫不在本次範圍；`claimableIssues` 無上限
    的問題標記為已知缺口，建議之後另開小 change 補上限，非本次 DB 遷移範圍
  - 配額驗證邏輯本身（`validateBetQuota()`/`issueTabCoin()`）**不改動**，繼續即時掃描記憶體當期
    orders，DB 僅作歷史查詢用途，不作為驗證的 source of truth（見 design.md 決策記錄）
  - 跨分頁/跨期/全站配額擴充（quota P2 遺留待辦）——本次只搬資料儲存層，不處理配額規則本身的擴充
  - Redis 快取層（Phase 4，非本次）
  - **實際執行任何指令或寫入程式碼**——本次僅規劃，待使用者明確要求才進入 Implementation

## 影響面

- 後端 Services（規劃）：`server/services/game/lottery/bg/orders.ts`、`tw/orders.ts`（新增
  snapshot/prune 介面）、`server/services/game/retro/history.ts`（`dailyGrants` 改 write-through）、
  `server/services/game/lottery/bg/poolAudit.ts`
- 後端 API（規劃，回應格式不變）：`server/api/admin/reports/members.get.ts`、`bg-summary.get.ts`
- Phase 1 基礎設施（規劃）：`server/services/sync.ts`（`SyncSource` 介面擴充 `onSynced`）

## 風險與對策

- 技術風險：
  - 風險：裁剪記憶體後，若 DB 查詢失敗，admin 報表會漏掉已裁剪的歷史資料
  - 對策：裁剪只在 DB 寫入「確認成功」後才執行，不會出現「裁了但 DB 沒資料」的情況；報表查 DB 若失敗，
    該時間範圍先回傳空/錯誤提示，不影響記憶體裡近期資料的正確性
  - 風險：重啟時「目前進行中期別」的 orders 不會被回填（本次不做 orders 的開機回填，只對 `dailyGrants`
    做），若重啟發生在某期中途，配額驗證會忘記這期已經下的注，玩家可能被允許重複下注超額
  - 對策：這是既有限制（Phase 1 已說明批次同步有 5 分鐘遺失窗口）的延伸，本次明確記錄為已知風險、
    不在本 change 解決；若之後需要「零風險」，需改走 write-through（成本/效益評估見 design.md，orders
    寫入頻率遠高於 members，暫不採用）
  - 風險：`dailyGrants` write-through 把「核發 coin」操作變成同步 DB 寫入，若 DB 延遲會拖慢復古遊戲
    結算流程
  - 對策：核發是「每局遊戲結束」才觸發一次，頻率遠低於每次下注，可接受這點延遲
  - 風險：擴充 Phase 1 已規劃好的通用 `SyncSource` 介面，可能影響 Phase 2 既有設計
  - 對策：`onSynced` 設計成可選（optional）欄位，Phase 2 的 members/role-defs 不使用這個欄位，向下相容
- UI/UX 風險：不適用（本次不涉及前端變更，報表 API 回應格式不變）

## 驗證方式

本次僅規劃、不執行，暫無程式變更可供驗證；待使用者明確要求進入 Implementation 階段後，才會依
Tasks 清單實際建表、改程式碼，並補齊 Validation / Engineering Evidence 文件。

## 成功標準

- [ ] 完成 `game_orders` / `retro_game_history` / `pool_audit_*` / `retro_daily_grants` schema 設計
- [ ] 完成記憶體裁剪策略與 `SyncSource` 介面擴充設計（design.md 定稿）
- [ ] 完成可追蹤的 Tasks 清單
- [ ] 使用者明確要求後才進入 Implementation（本次不涉及）
