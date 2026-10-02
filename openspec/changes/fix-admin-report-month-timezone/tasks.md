# Tasks

## 1. 問題確認

- [x] 確認 `useAdminReportData.ts` 的 `month` 仍是 `ref(dayjs().format(...))`，
      會在 SSR／client hydration 各自重算一次

## 2. 修正

- [x] 改用 `useState(\`admin-report-month-${key}\`, () => dayjs().format('YYYY-MM'))`
- [x] 確認 `ref` import 仍被 `status`／`error`／`summary` 使用，不需要移除

## 3. 驗證

- [x] curl 驗證 `/admin/reports` SSR 回應仍含正確月份（`2026-10`）
- [x] Playwright 驗證：無 hydration/mismatch 相關 console 警告
- [x] Playwright 驗證：點擊「上月」按鈕後 `AdminMonthPicker` 的 `v-model`
      仍正常切換（`2026-10` → `2026-09`），確認 `useState` 回傳的 ref 可寫
- [x] `npm test`（36 支既有測試腳本）回歸：本次改動僅涉及一個 composable，
      與任何遊戲伺服端邏輯無關

## 4. 文件交付

- [x] 完成 `proposal.md`／`design.md`／`tasks.md`／`validation.md`
- [x] 新增 `docs/Engineering Evidence/fix-admin-report-month-timezone.md`
