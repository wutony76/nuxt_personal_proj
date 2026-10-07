# Design

## 1. Schema

```sql
CREATE TABLE chat_schedules (
  id                TEXT PRIMARY KEY,
  text              TEXT NOT NULL,
  hour              INTEGER NOT NULL,
  minute            INTEGER NOT NULL,
  repeat            TEXT NOT NULL,
  interval_seconds  INTEGER,
  enabled           BOOLEAN NOT NULL,
  created_by        TEXT NOT NULL,
  created_by_name   TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL
);
```

不存 `last_fired_key`/`last_fired_at`——見 proposal.md 的決策，運行游標完全不持久化。

`created_by` 不設 FK：既有程式碼本來就是存 snapshot 的 `createdByName`（不是即時查 members
表），刪除會員不該影響已存在的排程顯示，維持現狀即可。

## 2. 模組異動

`add()`/`remove()`/`setEnabled()` 三個方法改 async write-through：
- `add()`：驗證通過後，`isDbEnabled()` 時先 `insert`，成功才 push 進記憶體陣列
- `remove()`：先 `delete`，成功才從記憶體陣列移除
- `setEnabled()`：先 `update ... set enabled`，成功才套用到記憶體（運行游標欄位的重置邏輯不變，
  純記憶體操作，不寫 DB）

`tick()` 維持完全不動——它只讀寫運行游標欄位，跟本次持久化無關。

## 3. 開機回填 + 種子去重複

新增 `rehydrateOrSeed(defaultAdminId, defaultAdminName)`（沿用 `roleDefs.rehydrateOrSeed()` 的
「空則種子、有則覆蓋記憶體」模式，簽名額外帶兩個參數是因為種子排程的 `createdBy`/`createdByName`
需要外部傳入，不像 `roleDefs` 的種子資料是模組內建常數）：

```ts
const DEFAULT_SEED_INTERVALS = [30, 20, 10, 5] // 秒

rehydrateOrSeed: async (defaultAdminId: string, defaultAdminName: string): Promise<void> => {
  if (!isDbEnabled()) {
    // DB 未啟用：維持現狀，呼叫端自己跑原本的 4 筆種子迴圈（见 hfyyManage.ts）
    return
  }
  const db = getDb()
  const existing = await db.select().from(chatSchedulesTable)
  if (existing.length === 0) {
    // 全新環境：種子 4 筆測試排程，直接寫 DB + 記憶體（不經過 add()，避免 MAX_SCHEDULES 檢查
    // 在種子階段造成不必要耦合）
    const rows = DEFAULT_SEED_INTERVALS.map((seconds) => ({ ... }))
    await db.insert(chatSchedulesTable).values(rows)
    schedules.push(...rows.map(_toMemoryRow))
  } else {
    schedules.length = 0
    schedules.push(...existing.map(_toMemoryRow))
  }
}
```

`_toMemoryRow()` 把 DB row 轉成 `ChatSchedule`，`interval` 類型的 `lastFiredAt` 設為
`Date.now()`（回填當下），`daily`/`once` 類型不帶 `lastFiredKey`（視為尚未觸發）。

## 4. `hfyyManage.ts` 呼叫端調整

把現有無條件 `[30,20,10,5].forEach(...).add(...)` 迴圈，改成：

```ts
if (isDbEnabled()) {
  await this.chatSchedule.rehydrateOrSeed(SEED_ADMIN_ID, SEED_ADMIN_NAME)
} else {
  ;[30, 20, 10, 5].forEach((seconds) => {
    this.chatSchedule.add({ ...現有邏輯... })
  })
}
```

`rehydrateOrSeed()` 放進既有 try/catch 區塊（DB 連不上時這段會拋錯，被捕捉後退回「這次開機完全
沒有排程」——比目前「DB 連不上但還硬加 4 筆到記憶體」更一致，因為本來就假設 DB 連不上時這整段都
不該執行任何 DB 相關邏輯）。

## 5. 為什麼不處理運行游標的持久化

`interval` 排程最快 5 秒觸發一次，30 筆排程全部設最小間隔的極端情況下，等於每秒多次 DB 寫入
——不值得為了「重啈後不要重新計時」這種體感極小的差異，在 300ms tick 熱路徑上引入 DB 依賴。
`daily`/`once` 的重複發送風險視窗只有「重啟時間點精準落在同一分鐘內」，機率可忽略。
