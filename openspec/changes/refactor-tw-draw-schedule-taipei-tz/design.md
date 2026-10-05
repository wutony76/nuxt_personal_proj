# Design

## 1. 模組結構

```
server/services/game/lottery/tw/
├─ drawSchedule.ts      新增：nextDrawWindow()、DrawSchedule 型別
├─ dlt.ts / d539.ts / … 改為宣告 DRAW_SCHEDULE，呼叫 nextDrawWindow(now, DRAW_SCHEDULE)
└─ base.ts              不變
```

### 為什麼不放進 `LOTTERY_BASE`

`base.ts` 會 import `Storage`，連帶載入整個伺服器服務圖（所有彩種、後台、retro 遊戲）。
放在 base class 裡就無法在單元測試中單獨 import。獨立的純函式沒有任何相依，測試可以直接引用。

## 2. 介面

```ts
type DrawSchedule = {
  weekdays: readonly number[]          // 0 = 週日 … 6 = 週六（台灣時間）
  cutoff: { hour: number; minute: number }
  draw: { hour: number; minute: number }
}

function nextDrawWindow(from: Date, schedule: DrawSchedule): {
  drawDate: Date      // 開獎日台灣時間 00:00
  cutoffAt: number    // epoch ms
  drawAt: number      // epoch ms
}
```

各彩種的設定直接取自 `shared/config/<game>.ts` 既有常數：

```ts
const DRAW_SCHEDULE: DrawSchedule = {
  weekdays: DLT_DRAW_WEEKDAYS,
  cutoff: { hour: DLT_CUTOFF_HOUR, minute: DLT_CUTOFF_MINUTE },
  draw: { hour: DLT_DRAW_HOUR, minute: DLT_DRAW_MINUTE }
}
```

## 3. 台灣時間的計算方式

台灣自 1979 年起沒有日光節約時間，固定 UTC+8，不需要時區資料庫：

1. `from` 加 8 小時後用 `getUTC*()` 讀出台灣當地的年、月、日。
2. 逐日往後找（最多 14 天）：用 `Date.UTC(y, m, d + i).getUTCDay()` 判斷星期。
3. 台灣 00:00 的 epoch = `Date.UTC(y, m, d + i) - 8h`，再加上鎖單／開獎的時分。
4. `from >= cutoffAt` 視為已鎖單，繼續找下一天。

`Date.UTC` 會自動處理日期進位，跨月與跨年不需要特別處理。

## 4. 全域時區

其餘約 90 處本地時間 API 不逐一改寫，改由整個 process 固定在 `Asia/Taipei`：

| 機制 | 涵蓋情境 | 說明 |
|---|---|---|
| `package.json`：`TZ=Asia/Taipei nuxt dev` 等 | dev、preview、start | process 啟動時就決定時區，worker thread 也會沿用 |
| `server/plugins/00.timezone.ts` | 直接 `node .output/server/index.mjs` | 主執行緒執行期修改 `process.env.TZ` 有效；時區仍不正確時印警告 |

實測確認：在 worker thread 內修改 `process.env.TZ` 不會改變時區；主執行緒修改則立即生效。
`nuxt dev` 的 Nitro 跑在 worker thread，所以不能只靠 plugin。

## 5. 測試策略

- **單元測試**（`test/unit/drawSchedule.test.ts`，以 `TZ=UTC` 執行）
  - 鎖單前 1 秒 / 剛好鎖單 / 鎖單後開獎前
  - 跨週、跨月、跨年
  - 台灣清晨（UTC 仍是前一天）
  - 伺服器休眠數週後以真實 now 計算
  - 性質測試：一年內每 37 分鐘取樣，結果必須在未來、落在開獎日、且是最早的一個
  - 不修改輸入、`weekdays` 為空時不會無限迴圈
  - 7 款彩種的設定值合法
- **回歸**：7 款台彩與 bingo 的 E2E 腳本
- **時區**：production build 以 `TZ=UTC` 啟動後查詢 `/api/lottery-tw/*/current`

## 6. 已知限制

- `_nextOfficialPeriod()` 用 `drawDate.getFullYear()` 推算民國年，依賴全域時區。
  在全域時區固定的前提下正確；若之後要讓它也不依賴時區，可改由 `nextDrawWindow()` 回傳台灣日期欄位。
