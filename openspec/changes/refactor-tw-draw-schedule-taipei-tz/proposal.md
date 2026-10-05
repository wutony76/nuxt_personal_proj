# Proposal

## 變更名稱

refactor-tw-draw-schedule-taipei-tz — 台彩開獎時間計算收斂為單一模組、固定台灣時區，並導入 Vitest 單元測試

## 背景

1. **同一份邏輯複製了 7 次**：DLT／D539／M539／M649／P3／P4／SUPERLOTTO 各自有一份 `_nextDrawWindow()`，
   逐行比對後邏輯完全相同，只差常數名稱。`fix-tw-lottery-stuck-settlement-clock-drift` 因此必須修 7 個地方。
2. **開獎時間依賴伺服器時區**：`_nextDrawWindow()` 用 `setHours()`／`getDay()` 這類本地時間 API。
   server 端沒有任何地方固定時區，開發機在台灣看不出問題，但雲端主機與 GitHub Actions 預設是 UTC，
   鎖單與開獎時間會差 8 小時（例如 20:00 鎖單變成台灣時間隔天 04:00）。
   台彩 `base.ts`、BG `base.ts` 與各彩種檔案中還有約 90 處本地時間 API，同樣受影響。
3. **時間相關邏輯沒有單元測試**：專案只有打 dev server 的 E2E 腳本，「伺服器休眠超過一個開獎週期」
   這類情境很難用 E2E 重現。

## 目標

- 開獎時間計算只有一份實作，各彩種只提供設定。
- 開獎與鎖單時間一律以台灣時間計算，伺服器跑在 UTC 時結果相同。
- 建立單元測試基礎設施，並用它鎖住開獎時間的邊界行為。

## 範圍

- 包含：
  - 新增 `server/services/game/lottery/tw/drawSchedule.ts`（純函式 `nextDrawWindow()`，明確以 UTC+8 計算）
  - 7 個彩種改用 `nextDrawWindow(now, DRAW_SCHEDULE)`，移除各自的 `_nextDrawWindow()`
  - 新增 `server/plugins/00.timezone.ts`，並讓 `dev`／`preview`／`start` 指令帶 `TZ=Asia/Taipei`
  - 導入 Vitest：`vitest.config.ts`、`test/unit/drawSchedule.test.ts`、`npm run test:unit`
- 不包含：
  - bingo（每 5 分鐘一期，不是日曆式開獎，沿用 `_nextFiveMinuteBoundary`）
  - 其他本地時間 API 改寫成明確時區（由全域 `TZ` 涵蓋）
  - `_nextOfficialPeriod()` 等其他重複邏輯的收斂

## 影響面

- 後端 Services：7 個台彩彩種檔案、新增 `drawSchedule.ts`
- 後端 Plugins：新增 `00.timezone.ts`
- 建置／測試：`package.json` scripts、`vitest.config.ts`、`devDependencies` 新增 `vitest`

## 風險與對策

- 風險：抽出共用函式時改變行為。
  - 對策：單元測試涵蓋鎖單邊界、跨週、跨月、跨年；7 款台彩 E2E 測試回歸。
- 風險：`nuxt dev` 的 Nitro 跑在 worker thread，執行期修改 `process.env.TZ` 不會生效。
  - 對策：以啟動指令帶 `TZ` 為主要機制；plugin 只作為 production 主執行緒的保底，時區不對時印警告。
- 風險：`TZ=...` 前綴寫法不支援 Windows cmd。
  - 對策：目前開發與 CI 環境皆為 macOS／Linux；若之後需要 Windows，再改用 `cross-env`。

## 驗證方式

- 單元測試：`npm run test:unit`（以 `TZ=UTC` 執行）
- 回歸：`npm run test:{dlt,superlotto,d539,m649,m539,p3,p4,bingo}`
- 時區：production build 以 `TZ=UTC` 啟動，確認 `/api/lottery-tw/*/current` 的鎖單與開獎時間為台灣時間

## 成功標準

- [x] 7 個彩種不再各自持有 `_nextDrawWindow()`
- [x] 單元測試在 UTC 下全數通過
- [x] UTC 啟動的 production build 回傳正確的台灣時間
- [x] 台彩 E2E 測試無新增失敗
