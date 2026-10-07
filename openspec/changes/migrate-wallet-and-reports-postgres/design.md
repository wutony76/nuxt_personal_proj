# Design

## 1. Schema

```sql
-- F幣即時餘額，批次快照（見 proposal.md 決策）
CREATE TABLE wallet_coin (
  user_id     TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  coin        NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F幣交易明細，批次全量快照（不裁剪，DB 保留永久完整歷史，比記憶體 5000→4000 上限更完整）。
-- source = 22 個 *Record 欄位名稱其中之一（'record'/'k3Record'/.../'dltRecord'…），PK 用
-- (source, id) 複合鍵：id 格式在各來源檔案不保證全域唯一（比照 memberBalanceHistory.ts
-- 既有的 `${key}:${row.id}` 防禦寫法）。
CREATE TABLE wallet_balance_changes (
  source      TEXT NOT NULL,
  id          TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  issue       TEXT NOT NULL,
  type        TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  before      NUMERIC NOT NULL,
  after       NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  note        TEXT NOT NULL,
  PRIMARY KEY (source, id)
);
CREATE INDEX idx_wallet_balance_changes_user_month ON wallet_balance_changes (user_id, created_at);

-- 台彩中獎事件（betHistory 裡 winStatus='win' 的列），批次全量快照，不碰 8 款 TW 玩法既有結算
-- 邏輯。跟「領獎」(wallet_balance_changes 的 type='claim') 是兩個不同時間點的事件，不能互相
--替代，見 proposal.md「Area D 的額外發現」。
CREATE TABLE tw_payout_events (
  source      TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  issue       TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (source, order_id)
);
CREATE INDEX idx_tw_payout_events_user_month ON tw_payout_events (user_id, created_at);
```

## 2. SyncSource（三個，全部「全量快照、不裁剪」）

`server/services/walletSyncSource.ts`（新檔，集中放三個相關 source，因為都繞著「F幣相關」
這個主題，不像之前拆得很細）：

```ts
const RECORD_SOURCES = [
  'record', 'k3Record', 'k3OfRecord', 'pk10Record', 'pk10OfRecord', 'x5Record', 'x5OfRecord',
  'sscRecord', 'sscOfRecord', 'fc3dRecord', 'pl3Record', 'kl8Record', 'kl10Record', 'eggsRecord',
  'dltRecord', 'superlottoRecord', 'd539Record', 'm649Record', 'm539Record', 'p3Record',
  'p4Record', 'bingoRecord'
] as const

const TW_RECORD_SOURCES = [
  'dltRecord', 'superlottoRecord', 'd539Record', 'm649Record', 'm539Record', 'p3Record',
  'p4Record', 'bingoRecord'
] as const

export function registerWalletSyncSources(): void {
  registerSyncSource({
    table: 'wallet_coin',
    primaryKey: ['user_id'],
    snapshot: () => {
      const accounts = Storage.get.account()
      return Object.keys(accounts).map((userId) => ({
        user_id: userId,
        coin: String((Storage.get.user(userId) as { coin?: number }).coin ?? 0)
      }))
    }
  })

  registerSyncSource({
    table: 'wallet_balance_changes',
    primaryKey: ['source', 'id'],
    snapshot: () => {
      const rows: Record<string, unknown>[] = []
      const accounts = Storage.get.account()
      for (const userId of Object.keys(accounts)) {
        const user = Storage.get.user(userId) as Record<string, { balanceChanges?: WalletBalanceChange[] } | undefined>
        for (const source of RECORD_SOURCES) {
          for (const change of user[source]?.balanceChanges ?? []) {
            rows.push({
              source, id: change.id, user_id: userId, issue: change.issue, type: change.type,
              amount: String(change.amount), before: String(change.before), after: String(change.after),
              created_at: new Date(change.createdAt), note: change.note
            })
          }
        }
      }
      return rows
    }
  })

  registerSyncSource({
    table: 'tw_payout_events',
    primaryKey: ['source', 'order_id'],
    snapshot: () => {
      const rows: Record<string, unknown>[] = []
      const accounts = Storage.get.account()
      for (const userId of Object.keys(accounts)) {
        const user = Storage.get.user(userId) as Record<string, { betHistory?: BetHistoryRow[] } | undefined>
        for (const source of TW_RECORD_SOURCES) {
          for (const row of user[source]?.betHistory ?? []) {
            if (row.winStatus !== 'win') continue
            rows.push({
              source, order_id: row.orderId, user_id: userId, issue: row.issue,
              amount: String(row.winAmount), created_at: new Date(row.betTime)
            })
          }
        }
      }
      return rows
    }
  })
}
```

`amount`/`before`/`after`/`coin` 一律 `String(n)`（drizzle `numeric` 欄位型別是 string，見
migrate-npc-settings-postgres 踩過的坑，已記錄在 memory）。

`npm run db:generate` + `npm run db:migrate` 產生新 migration；`server/plugins/init.ts` 的
`if (isDbEnabled())` 區塊內新增 `registerWalletSyncSources()` 呼叫，跟其他五個既有來源並列。

## 3. 開機回填：只有 `coin`

```ts
// hfyyManage.ts 的既有 try/catch 區塊內，放在其他回填之後
if (isDbEnabled()) {
  const rows = await getDb().select().from(walletCoin)
  for (const row of rows) {
    ;(Storage.get.user(row.userId) as { coin?: number }).coin = Number(row.coin)
  }
}
```

`wallet_balance_changes`/`tw_payout_events` **不回填記憶體**，比照 `login_history`/
`retro_game_history` 既有 precedent：DB 只當永久備份，查詢路徑改合併查詢（見第 4 節），不影響
任何業務邏輯判斷（下注/結算邏輯全部只讀記憶體內的即時狀態，不讀這兩張表）。

## 4. 四條查詢路徑：比照 `queryArchivedOrdersForMonth` 的合併樣板

四個新函式都放在對應 service 檔案旁，形狀一致：`if (!isDbEnabled()) return []`，查完
`numeric`→`Number()`、`Date`→`.getTime()`，呼叫端用「記憶體優先、DB 補歷史、以 id 去重」合併
（記憶體版本較新/權威，衝突時記憶體勝出）。

### 4a. Area A：`server/services/game/retro/historyReportQuery.ts`（新檔）

```ts
export async function queryArchivedRetroHistoryForUser(userId: string): Promise<RetroHistoryRecordRow[]> {
  if (!isDbEnabled()) return []
  const rows = await getDb().select().from(retroGameHistory).where(eq(retroGameHistory.userId, userId))
  return rows.map((row) => ({
    id: row.id, gameKey: row.gameKey,
    gameName: (Storage.retroGames.instances as Record<string, { name?: string } | undefined>)[row.gameKey]?.name ?? row.gameKey,
    score: row.score, level: row.level ?? undefined,
    meta: row.meta ? JSON.parse(row.meta as string) : undefined,
    playedAt: row.playedAt.toISOString()
  }))
}
```

`gameHistory.ts` 的 `list(userId)` 改 async：記憶體版 `records` 合併 DB 版（用 `id` 去重，記憶體
優先），`balanceChanges` 半邊同理合併 `wallet_balance_changes`（`source='record'`、
`type='game-reward'`）。呼叫端 `games/history.get.ts` 補 `await`。

### 4b. Area B：`server/services/game/lottery/bg/poolAuditReportQuery.ts`（新檔）

同構，查 `pool_audit_reseed`/`pool_audit_overpay`，`poolAudit.ts` 的 `list()` 改 async 合併，
呼叫端 `pool-audit.get.ts` 補 `await`。

### 4c. Area C：`fcoin-summary.get.ts` 改 async

新增 `queryArchivedWalletChangesForMonth(month, source='record')`（複用 Area A 新檔或獨立
一個 `walletReportQuery.ts`），查 `wallet_balance_changes` 當月（`created_at` 落在該月）、
`type IN ('toy-bet','toy-reward','game-reward')` 的列，合併進既有 `_accumulate()` 迴圈（DB
列跟記憶體列用 `id` 去重）。`dataNote` 文字更新為「記憶體（近期）+ PostgreSQL（完整歷史）」。

### 4d. Area D：`tw-lottery-payout.get.ts` 改 async

新增 `queryArchivedTwPayoutsForMonth(month)`，查 `tw_payout_events` 當月列，合併進既有迴圈
（用 `(source, order_id)` 去重）。`dataNote` 同步更新。

## 5. 為什麼合併查詢「記憶體優先、DB 補歷史」而非「DB 優先」

記憶體版本是「這一輪同步之前」的最新狀態，DB 版本最舊可能落後一輪同步間隔（5 分鐘）。用 id/
(source,id) 去重時，只要記憶體裡有這筆 id，就一律採用記憶體版本（理論上內容一致，只是保險起見
優先權給較新鮮的來源），這跟 `queryArchivedOrdersForMonth` 既有呼叫端（`bg-summary.get.ts`/
`reports/members.get.ts`）的合併順序一致。

## 6. 刪除會員的連動

`wallet_coin`/`wallet_balance_changes`/`tw_payout_events` 的 `user_id` 都設 `ON DELETE
CASCADE`，刪除會員時自動清除，不需要修改 `add-delete-member` 已經寫好的
`adminAccessService.deleteMember()`。

## 7. 已知限制（延續到 validation.md）

- `coin` 重啟時機卡在兩次同步之間，會遺失最近幾分鐘的餘額變動，退回上一輪同步快照——跟 Phase 3
  「重啟會遺失進行中期別 orders」同等級取捨
- `memberBalanceHistory.ts`（會員個人異動明細，`GET .../balance-changes`）本來就缺漏 8 個 TW
  來源（pre-existing bug），本次不處理，不在 5 項盤點範圍內
- `wallet_balance_changes` 全量快照理論上隨使用量無上限增長（DB 面不裁剪），但以這個專案的
  實際使用規模（Demo/測試為主）不構成問題，之後若要上線真實流量需要另外設計裁剪/分區策略
