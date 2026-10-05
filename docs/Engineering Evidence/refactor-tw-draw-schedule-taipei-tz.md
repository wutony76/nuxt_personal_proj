# Engineering Evidence：台彩開獎時間收斂、固定台灣時區、導入單元測試

## 變更摘要

- **對應變更**：`refactor-tw-draw-schedule-taipei-tz`
- **變更檔案**
  - 新增：`server/services/game/lottery/tw/drawSchedule.ts`、`server/plugins/00.timezone.ts`、
    `vitest.config.ts`、`test/unit/drawSchedule.test.ts`
  - 修改：7 個台彩彩種檔案、`package.json`、`package-lock.json`

### 問題

1. **同一個 bug 修了 7 次**：`fix-tw-lottery-stuck-settlement-clock-drift` 要改 7 個檔案，因為每個彩種都複製了一份
   `_nextDrawWindow()`。逐行比對後，7 份邏輯完全相同，只差常數名稱。
2. **部署到 UTC 主機時開獎時間差 8 小時**：舊寫法依賴伺服器本地時間。同一個輸入在 UTC 下，
   大樂透 20:00 的鎖單時間會變成台灣時間隔天 04:00。
3. **沒有單元測試**：時間邊界與「伺服器休眠」這類情境只能靠 E2E，很難重現。

### 做法

- **收斂成單一模組**：`nextDrawWindow(from, schedule)` 是不依賴任何模組的純函式，各彩種只宣告 `DRAW_SCHEDULE`。
  沒有放進 `LOTTERY_BASE`，因為 base class 會載入整個伺服器服務圖，無法單獨測試。
- **開獎計算明確用台灣時間**：台灣固定 UTC+8（無日光節約時間），以 `Date.UTC` 加減位移計算，
  與伺服器時區無關。
- **整個 server 固定 `Asia/Taipei`**：涵蓋其餘約 90 處本地時間 API。
  - 主要機制是啟動指令帶 `TZ=Asia/Taipei`。實測發現 `nuxt dev` 的 Nitro 跑在 worker thread，
    worker 內修改 `process.env.TZ` 不會生效。
  - `00.timezone.ts` plugin 作為 production 直接啟動時的保底，時區不對時印出警告。
- **導入 Vitest**：`npm run test:unit` 以 `TZ=UTC` 執行，在 UTC 下通過才能證明部署後結果正確。
  `npm test` 會自動納入這支腳本，CI 不需修改。

## 驗證

| 項目 | 結果 |
|---|---|
| 單元測試（`TZ=UTC`） | 21/21 通過，包含一年內每 37 分鐘取樣的性質測試 |
| 測試能否抓到原問題 | 舊寫法在 UTC 下鎖單時間差 8 小時，新寫法正確 |
| production build 以 UTC 啟動 | DLT／D539／SUPERLOTTO 的鎖單與開獎時間皆為台灣時間 20:00 / 20:30 |
| dev server E2E | 7 款台彩 + bingo 全數通過（390 項） |
| production build E2E | 與改動前版本對照，失敗分布相同（各 34 項），屬既有問題 |

詳細數據見 `openspec/changes/refactor-tw-draw-schedule-taipei-tz/validation.md`。

## 風險與後續

- **production 模式 E2E 不穩定（既有問題）**：production build 下約 34 項 E2E 失敗，集中在「強制結算後注單仍為
  pending」，bingo 最明顯。dev 模式全過，CI 只跑 dev 所以沒被發現。部署前需要追查。
- **`_nextOfficialPeriod()` 依賴全域時區**：用 `drawDate.getFullYear()` 推算民國年，目前由全域 `TZ` 保證正確。
- **其他重複邏輯**：各彩種的 `_nextOfficialPeriod()`、`_parseOfficialPeriod()` 等也是複製的，可依同樣方式收斂。
- **Windows**：`TZ=...` 前綴不支援 Windows cmd，需要時改用 `cross-env`。

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [ ] `openspec archive`
