# Validation

## 功能驗證

- curl（已登入 admin cookie）`GET /admin/reports`：SSR 回應 HTML 含正確月份
  字串 `"2026-10"`
- Playwright 重整 `/admin/reports`：hydration/mismatch 相關 console 警告
  數量為 0
- Playwright 點擊「上月」按鈕：

  | 階段 | 月份顯示 |
  |---|---|
  | 初始 | 2026-10 |
  | 點擊上月後 | 2026-09 |

  確認 `useState` 回傳的 ref 可寫、`AdminMonthPicker` 的 `v-model` 行為與
  修正前一致。

## 回歸驗證

`npm test`（36 支既有測試腳本）：本次改動僅涉及
`app/composables/useAdminReportData.ts`，與任何遊戲伺服端邏輯無關；執行過程
中若有失敗項目，與本次變更的檔案範圍無關（詳見同一輪 code review 的其他
變更 `fix-admin-guard-hydration-duplicate-fetch`／
`fix-lottery-hall-pool-reveal-flash` 的 validation 記錄）。

## 成功標準檢查

- [x] SSR 與 client hydration 的初始月份一致，不受伺服器/瀏覽器時區差異影響
- [x] 無新增 hydration mismatch 或 runtime error
- [x] 月份選擇器行為與修正前一致
