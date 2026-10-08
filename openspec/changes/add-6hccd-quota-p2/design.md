# Design

## 1. Schema

```sql
-- 全站預設值，固定 1 列（id='default'），比照 toy_shop_settings/npc_settings 模式
CREATE TABLE sixhccd_quota_settings (
  id                   TEXT PRIMARY KEY DEFAULT 'default',
  cross_tab_issue_max  NUMERIC NOT NULL  -- 0 = 不限
);

-- 玩家層級覆寫，override-only 稀疏表（比照 retro_game_rates 模式）：缺列 = 套用全站預設
CREATE TABLE sixhccd_member_quota (
  user_id              TEXT PRIMARY KEY REFERENCES members.id ON DELETE CASCADE,
  cross_tab_issue_max  NUMERIC NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

兩張表都是 write-through（低頻 admin 設定），都比照既有模式維護一份記憶體鏡像：

```ts
let _globalCrossTabIssueMax = 0  // 開機回填，預設 0（不限）
const _memberCrossTabIssueMax = new Map<string, number>()  // 稀疏：只記有覆寫的玩家
```

## 2. `validateBetQuota()` 新增一段跨分頁檢查（讀 write-through counter，不是記憶體重算）

放在 `server/services/game/lottery/bg/6hcCd.ts` 既有 per-tab 單期檢查（L432-446）之後，
讀第 6 節新增的 `sixhccdIssueSpent` write-through counter（不是 `orders.get.members.issue()`
現場重算記憶體，這樣重啟後的額度才會正確）：

```ts
const crossTabMax = _memberCrossTabIssueMax.get(input.userId) ?? _globalCrossTabIssueMax
if (crossTabMax > 0) {
  const usedAll = sixhccdQuotaCounters.issueSpentOf(input.issue, input.userId)
  const newAll = [...newByTab.values()].reduce((sum, v) => sum + v.coin, 0)
  if (usedAll + newAll > crossTabMax) {
    rejectBet(`本期跨分頁合計下注已達上限（${crossTabMax} coin）。`)
  }
}
```

**不需要**改 `creditQuotaOf()` 的簽章、不需要改前端 `use6hcCredit.ts` 的 clamp 邏輯——這是
伺服端獨立的最後一道防線（跟既有 per-tab 單期檢查一樣，前端沒有對應的即時 clamp，使用者送出
後才會被拒單，體驗上跟現有的單期上限一致）。

## 3. 開機回填

比照 `role_game_perms.rehydrateFromDb()`：沒有種子分支（空 DB 天然對應「不限」的記憶體預設值）：

```ts
rehydrateFromDb: async () => {
  if (!isDbEnabled()) return
  const db = getDb()
  const [settingsRow, memberRows] = await Promise.all([
    db.select().from(sixhccdQuotaSettings).where(eq(sixhccdQuotaSettings.id, 'default')).then(r => r[0]),
    db.select().from(sixhccdMemberQuota)
  ])
  if (settingsRow) _globalCrossTabIssueMax = Number(settingsRow.crossTabIssueMax)
  _memberCrossTabIssueMax.clear()
  for (const row of memberRows) _memberCrossTabIssueMax.set(row.userId, Number(row.crossTabIssueMax))
}
```

放進 `hfyyManage.ts` 既有的 try/catch 開機回填區塊。

## 4. 後台 API（草案，實作階段可能微調；本批只做 API，UI 下一批再補）

- `GET /api/admin/bg-lottery/6hccd-quota`：回傳全站預設值 + 個別玩家覆寫清單
- `PATCH /api/admin/bg-lottery/6hccd-quota`：設定全站預設值
- `PATCH /api/admin/bg-lottery/6hccd-quota/members/[userId]`：設定/刪除個別玩家覆寫
  （`crossTabIssueMax` 傳 `null` 或特殊值代表「清除覆寫、改回跟隨全站預設」）

## 5. 後台 UI：本批不做

確認要做的只有 schema + enforcement + API。`/admin/bg-lottery` 的 UI（全域設定 + 逐會員
覆寫列表，比照 `NpcPanel.vue` 版面）留到下一個 change，等 API 穩定後再補，避免這批範圍
過大。在此之前，調整全站預設值/玩家覆寫只能直接呼叫 API 或用 DB 工具操作。

## 6. 解決「重啟後當期已用額度歸零」：新增 write-through counter

### 6a. 為什麼要解決、為什麼不是「重寫全部 orders 持久化」

既有 per-tab 單期檢查（`orders.get.issueTabCoin()`）跟新的跨分頁檢查都是現場從記憶體裡的
`Storage.lottery.orders['LHC-CD'].orders[issue]`（當期原始注單陣列）重新加總——這份資料
本來就只存在記憶體（`game_orders` 批次同步故意不歸檔當期/前一期，見 Phase 3 design.md），
重啟後歸零，重啟後第一筆下注的「已用額度」會被誤判成 0。

比照 `retro_daily_grants`/`npc_daily_spent` 的既有模式：**不需要把每一筆注單都 write-through
（那是 Phase 3 已經評估過、否決的做法，太高頻）**，只需要 write-through 一個「累計金額
counter」就夠：每次下注時，對這個 counter 做一次原子的 `amount = amount + $delta`，
DB `.returning()` 回傳的值才是真相，寫回記憶體。

### 6b. Schema

```sql
-- 每個玩家、每個分頁、每一期的累計投注額（取代 orders.get.issueTabCoin() 的記憶體重算）
CREATE TABLE sixhccd_tab_issue_spent (
  user_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  tab_id      INTEGER NOT NULL,
  issue       TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tab_id, issue)
);

-- 每個玩家、每一期、跨所有分頁的累計投注額（取代 orders.get.members.issue() 的記憶體重算）
CREATE TABLE sixhccd_issue_spent (
  user_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  issue       TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, issue)
);
```

### 6c. 寫入時機：`playBets()` 下注成功當下

比照 `retroDailyGrants.add.dailyGrant()`（`server/services/game/retro/history.ts`）的
寫法，`playBets()` 建單成功後（既有 `orders.add.record()` 呼叫處）為每個分頁各自累加：

```ts
newByTab.forEach(async ({ coin }, tabId) => {
  if (isDbEnabled()) {
    const [row] = await db.insert(sixhccdTabIssueSpent)
      .values({ userId, tabId, issue, amount: String(coin) })
      .onConflictDoUpdate({
        target: [sixhccdTabIssueSpent.userId, sixhccdTabIssueSpent.tabId, sixhccdTabIssueSpent.issue],
        set: { amount: sql`${sixhccdTabIssueSpent.amount} + ${coin}`, updatedAt: new Date() }
      })
      .returning({ amount: sixhccdTabIssueSpent.amount })
    _tabIssueSpentCache.set(`${userId}:${tabId}:${issue}`, Number(row.amount))
  }
})
// 同樣邏輯對 sixhccd_issue_spent 做一次（跨分頁總額）
```

**重要**：`playBets()` 目前是同步/半同步混合（下注扣款本身是同步的記憶體操作），這裡新增的
DB 寫入必須跟既有「扣款決不能等 DB」的原則一致——**write-through 這件事本身要 fire-and-forget**
（比照 `npcAutoPlay.ts` 的 `_addSpent()` 處理方式：`void write(...).catch(logError)`，不
擋下注流程），但 validateBetQuota() 的「讀」仍然優先讀記憶體快取（`_tabIssueSpentCache`/
`_issueSpentCache`，由這次寫入同步更新），只有開機回填時才會真的 `await` 一次 DB 查詢。
這樣「驗證當下讀的是最新記憶體值」「DB 落地是異步的，不卡下注」兩者都成立，實作階段需要
特別注意落實這個「讀記憶體快取、寫 fire-and-forget」的分工，不要搞成每次下注都同步等 DB。

### 6d. 開機回填

只回填「當期」會用到的列會比較麻煩（6hc-cd 沒有像 retro 的 `dateKey` 那麼簡單的「今天」
概念，期別是開獎排程決定的），簡化處理：直接整張表 `select *` 灌進記憶體 Map（兩張表筆數
有限——每個玩家每期每分頁最多一列，不會無限增長很快，比照 `role_game_perms` 等既有表
「全表回填」的做法，不另外篩選）。

### 6e. 與既有 per-tab 檢查的關係

`validateBetQuota()` 既有的 per-tab 單期檢查（L432-446）要同步改掉，從
`orders.get.issueTabCoin()` 改讀 `_tabIssueSpentCache`，這是本次「一併解決」範圍內的改動，
不是維持原樣。
