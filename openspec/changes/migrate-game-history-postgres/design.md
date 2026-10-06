# Design

> 本變更是資料持久化/後端架構調整，不是前端頁面功能，模板裡的 Layout/Component/Token Mapping 等
> 前端專屬段落不適用，以下僅保留與本次變更相關的段落並改寫內容。

## 1. 現況總覽（調查結果）

```
23 款彩票玩法（15 BG + 8 TW）
  Storage.lottery.orders[gameKey][issue] = OrderRow[]   // 永久累積，從不清除 ← 本次主要目標
  user.xxxRecord.betHistory[]                            // per user per game，5000→4000 裁剪（不動）
  user.xxxRecord.balanceChanges[]                        // 同上（不動）
  user.xxxRecord.claimableIssues[]                        // 無上限（不動，列為已知缺口）

Storage.lottery.poolAudit.{reseed,overpay}[]             // 全站共用，2000→1800 裁剪

30 款復古遊戲
  retroGames.history[gameKey].records[userId][]          // per user per game，50 筆裁剪（不動）
  retroGames.history[gameKey].dailyGrants[userId][date]  // 無清理 + 無持久化 ← 本次次要目標（修 bug）

6hc-cd 等盤口配額驗證
  validateBetQuota() → orders.get.issueTabCoin(issue, userId, tabId)
    = Storage.lottery.orders[issue].filter(...).reduce(...)   // 即時掃描當期記憶體，非計數器
```

後台報表（`members.get.ts`/`bg-summary.get.ts`）目前直接對 `Storage.lottery.orders` 做全量雙層迴圈
掃描（依月份篩選），沒有任何索引/快取，資料量越大越慢。

## 2. 決策記錄一：為什麼 `Storage.lottery.orders` 走「批次同步 + 同步後裁剪」，不走 write-through

比照 Phase 2（members/role-defs）用的對照表，套在 orders 上：

| 面向 | members/role-defs（Phase 2） | game orders（本次） |
| --- | --- | --- |
| 寫入頻率 | 低頻（admin 手動操作） | **極高頻**（每次下注，單日可能 3 萬～16 萬筆） |
| 遺失窗口的後果 | 不可接受 | 可接受（本來就是歷史歸檔，晚 5 分鐘落地不影響下注本身） |
| 對「主流程」的影響 | DB 失敗應該讓操作失敗 | **下注是即時業務流程，絕不能因為 DB 延遲/故障被卡住** |

結論：orders 延續 Phase 1 規劃的 5 分鐘批次 `SyncSource`（memory → SQL，失敗不中斷主流程），這正是
Phase 1 當初設計這套機制時設想的場景。

## 3. 決策記錄二：配額驗證維持「只讀記憶體」，DB 不作為驗證的 source of truth

`validateBetQuota()` 是下注當下的即時正確性檢查（同一玩家、同一期、同一分頁的累計投注額不可超過
`quota.issue.max`）。如果讓這個檢查去查「5 分鐘前才同步」的 DB 快照，會有兩種錯誤方向：

- 快照少算了這 5 分鐘內的新注單 → 驗證「假性通過」，玩家可能超額下注
- 若之後又疊加「DB 優先、記憶體其次」的混合查詢邏輯 → 複雜度大增，且記憶體本來就有當期全量正確資料，
  完全沒有必要捨近求遠

**本次明確決定：`validateBetQuota()`/`issueTabCoin()` 維持現狀，不碰。** DB 只用來存「已經確定不會
再變動」的歷史資料（已結算期別），配額驗證永遠只看記憶體裡「目前進行中期別」的即時資料——這也是第 7
節記憶體保留策略「目前期必須留在記憶體」的直接原因。

## 4. 決策記錄三：`dailyGrants` 改走 write-through + 開機回填（跟 orders 不同處理）

`dailyGrants` 雖然也是遊戲紀錄的一部分，但特性跟 orders 不同，比較接近 Phase 2 的場景：

| 面向 | game orders | `dailyGrants`（每日 coin 核發計數器） |
| --- | --- | --- |
| 寫入頻率 | 極高頻 | 低頻（每局遊戲結束才 +1，且只在有核發 coin 時） |
| 遺失/重置的後果 | 可接受（歷史歸檔） | **不可接受**——是配額防呆機制本身，重置等於防呆失效 |
| 資料量 | 巨量、持續累積 | 極小（每人每天每遊戲一個 number） |

因此 `dailyGrants` 採跟 Phase 2 相同的策略：每次核發 coin 時，記憶體更新與 DB 寫入在同一次請求內完成
（write-through），且 server 啟動時從 DB 回填當天（`todayKey`）的計數器，確保「重啟不會讓每日上限
防呆失效」。跟 Phase 2 一樣遵守 `add-postgres-docker` 定義的 `isDbEnabled()` guard：沒接 DB 時，核發
流程只更新記憶體（等同現況行為，不報錯），開機回填整段略過。

## 5. Schema 設計

```sql
CREATE TABLE game_orders (
  order_id   TEXT PRIMARY KEY,
  game_key   TEXT NOT NULL,            -- 例如 '6HC-CD'、'K3-OF'、'DLT'
  issue      TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  tab_id     TEXT,                     -- BG 盤口才有；TW 玩法為 NULL
  coin       NUMERIC NOT NULL,
  bet_code   JSONB NOT NULL,
  odds       NUMERIC,
  tiers      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_orders_game_issue ON game_orders (game_key, issue);
CREATE INDEX idx_game_orders_user_month ON game_orders (user_id, created_at);

CREATE TABLE retro_game_history (
  id         TEXT PRIMARY KEY,
  game_key   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,
  level      INTEGER,
  meta       JSONB,
  played_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_retro_history_user_month ON retro_game_history (user_id, played_at);

CREATE TABLE pool_audit_reseed (
  id TEXT PRIMARY KEY, lottery_key TEXT NOT NULL, issue TEXT NOT NULL,
  before NUMERIC NOT NULL, after NUMERIC NOT NULL, happened_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE pool_audit_overpay (
  id TEXT PRIMARY KEY, lottery_key TEXT NOT NULL, issue TEXT NOT NULL,
  overpay NUMERIC NOT NULL, happened_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE retro_daily_grants (
  user_id    TEXT NOT NULL,
  game_key   TEXT NOT NULL,
  date_key   TEXT NOT NULL,            -- 'YYYYMMDD'
  amount     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_key, date_key)
);
```

- `game_orders` 用統一表取代現況 23 款盤口各自獨立的 `OrdersClass` 記憶體結構，`game_key` 讓歷史查詢/
  報表不用再逐一遍歷 23 個不同欄位（比照 `walletBalanceService` 已經驗證過的「統一記法」模式）
- `tiers`/`bet_code` 用 `JSONB`，不同盤口的欄位形狀差異大（賠率表/組合碼），不值得為每個玩法切專屬欄位
- `retro_daily_grants` 用複合主鍵 `(user_id, game_key, date_key)`，天然支援 upsert（`ON CONFLICT DO
  UPDATE SET amount = amount + $delta`），不需要額外的唯一性設計

## 6. `SyncSource` 介面擴充：`onSynced` 回呼

Phase 1 原介面（`add-postgres-docker/design.md` 第 8.3 節）：

```ts
interface SyncSource {
  table: string
  primaryKey: string[]
  snapshot(): Record<string, unknown>[]
}
```

本次擴充一個**可選**欄位，Phase 2 的 members/role-defs 不需要它、不受影響：

```ts
interface SyncSource {
  table: string
  primaryKey: string[]
  snapshot(): Record<string, unknown>[]
  /**
   * 可選：DB 寫入成功後呼叫，傳入剛剛寫入的那批資料。
   * 用於「增量來源」在確認落地後，從記憶體裁剪掉同一批資料（見第 7 節）。
   * 沒有提供這個欄位的來源（例如 Phase 2 的 members/role-defs）維持「每輪全量快照、不裁剪」的既有行為。
   */
  onSynced?(syncedRows: Record<string, unknown>[]): void
}
```

`game_orders`/`pool_audit_*` 的 `SyncSource.snapshot()` 改成「只回傳尚未同步過的資料」（而非每次全量
重送），`onSynced()` 收到成功寫入的那批後，從對應的記憶體陣列中移除——這是本次新增的「增量 + 裁剪」
來源型態，跟 Phase 2「全量快照、不裁剪、因為資料本身不大」的來源型態並存。

## 7. 記憶體保留策略

```
Storage.lottery.orders[gameKey][issue]
  目前進行中期別（status ≠ settled）        → 永遠留在記憶體，絕不同步/裁剪（配額驗證依賴它）
  前一個已結算期別                           → 留在記憶體（安全邊界：admin 即時查「上一期」不必等 DB）
  更早的已結算期別，且已確認寫入 DB 成功      → 從記憶體裁剪（整個 issue key 一併刪除）
```

`SyncSource.snapshot()` 對 orders 的實作邏輯：掃描 `Storage.lottery.orders`，排除「目前進行中期別」與
「最近一個已結算期別」，其餘已結算期別的 order 全部回傳；`onSynced()` 收到成功批次後，`delete
Storage.lottery.orders[gameKey][issue]`。

`retroGames.history[key].records` 本身已有 50 筆上限保護，記憶體端**不需要**額外裁剪，但超過 50 筆
被裁掉的舊紀錄目前是永久遺失——改成「每輪同步時，把目前還在記憶體裡的 50 筆全部當作全量快照送一次」
（沿用 Phase 2 式的全量快照，不需要 `onSynced`），讓裁剪前的紀錄在被裁掉之前有機會先落地到 DB（只要
5 分鐘的同步週期比紀錄被裁剪的速度快）。

`dailyGrants` 不適用本節（見第 4 節，走 write-through，不經過批次 `SyncSource`）。

## 8. 後台報表讀取路徑調整

```
members.get.ts / bg-summary.get.ts（規劃後的查詢邏輯）
  1. 查詢月份區間 vs. 記憶體目前保留的期別範圍比對
  2. 記憶體仍有的部分（目前期 + 前一期，通常是「本月最新這幾分鐘」）→ 維持現有的即時掃描邏輯
  3. 記憶體已裁剪的部分（該月份其餘時間）→ 改查 `game_orders` / `retro_game_history`（依 game_key +
     月份區間），SQL 直接用 GROUP BY 彙總，比現況的應用層迴圈更快
  4. 兩部分結果合併（Set 去重會員、加總金額），回應格式不變，前端無感
```

這個調整是本次範圍擴大的主因（使用者選擇「同時解決記憶體裁剪」），比單純加一份 DB 備份多出的工作量。

## 9. 已知限制與不在本次處理的風險

- **重啟遺失進行中期別的 orders**：本次沒有對 `game_orders` 做開機回填，若重啟發生在某期中途，記憶體
  裡這期已經下的注會消失，配額驗證對這期「重新從 0 開始算」，玩家理論上可能被允許在重啟後於同一期
  多下超過原本額度的注。這是 Phase 1「5 分鐘遺失窗口」限制在配額場景下的延伸後果，本次不解決（若要
  解決，需要幫 orders 也做 write-through，但其高頻特性使這個取捨不划算，見第 2 節）
- **`claimableIssues` 無上限**：本次不處理，維持現狀（23 處皆無清理機制），建議之後視記憶體實際使用
  情況再評估是否需要補上限或搬遷
- **跨分頁/跨期/全站配額**（quota P2 遺留待辦）：本次只搬資料儲存層，配額規則本身的擴充留待另外決定

## 10. 測試與驗證策略（規劃用，待 Implementation 階段才執行）

- 單元/整合測試：
  - `SyncSource.snapshot()` 排除「目前期 + 前一期」的邏輯，涵蓋跨期切換瞬間的邊界案例
  - `onSynced()` 裁剪後，再次呼叫 `issueTabCoin()` 對「目前期」查詢結果不受影響（確認裁剪沒有誤刪
    進行中期別的資料）
  - `retro_daily_grants` write-through 的 upsert 累加邏輯（同一天多次核發正確加總）
- 手動測試案例：
  - 模擬跨越一個 BG 期別（約 400 秒），確認上一期資料在下一輪同步後被正確寫入 DB 且從記憶體移除
  - 查詢「本月」報表時，橫跨記憶體保留範圍與 DB 歸檔範圍的合併結果，與裁剪前的全記憶體版本結果一致
    （用裁剪前後各跑一次同樣的報表查詢比對）
  - 重啟 server 後，當天已核發的 `dailyGrants` 從 DB 正確回填，同一玩家無法在重啟後重新拿到一次當日
    上限
  - 刻意讓 DB 斷線一輪：確認下注流程完全不受影響（orders 繼續寫記憶體），只有批次同步那輪失敗記 log
- 回歸風險與檢查點：
  - 確認 `isDbEnabled()` 為 false 時，`SyncScheduler` 不啟動、`Storage.lottery.orders` 完全不裁剪、
    退回現狀（無限累積但不出錯），報表查詢走原本的純記憶體邏輯
  - 確認既有 `npm test`（含 `test:bg`、`test:games`）全數通過
