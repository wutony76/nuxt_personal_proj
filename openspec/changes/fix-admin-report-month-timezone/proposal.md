# Proposal

## 變更名稱

fix-admin-report-month-timezone — 修正後台報表月份初始值在伺服器／瀏覽器
時區不同時可能不一致的問題

## 背景

Review 發現：`useAdminReportData.ts` 的 `month` 用
`ref(dayjs().format('YYYY-MM'))` 初始化。這段程式碼在 SSR 與 client
hydration 各自執行一次（Vue/Nuxt 元件 `setup()` 在伺服器渲染與瀏覽器接管時
都會跑一次），`dayjs()` 分別讀取「伺服器的系統時區」與「瀏覽器的本地時區」。
若伺服器時區是 UTC、瀏覽器在台灣（UTC+8），每月 1 號台灣時間 00:00~08:00
這段窗口，伺服器還算在上個月（UTC 還沒跨月），瀏覽器已經算到這個月——兩邊
算出來的 `YYYY-MM` 不一致。

這不只是畫面文字對不起來的 hydration mismatch，連帶 `useAsyncData` 的
`{ watch: [month] }` 都會拿到不一致的初始月份去打 API，可能讓使用者在這段
窗口看到的報表資料跟實際想查的月份對不上。

## 目標

- `month` 的初始值由伺服器算好一次，序列化帶到瀏覽器，client hydration 直接
  複用同一個值，不再各自重算
- 不改變既有的對外介面（`{ month, status, error, summary }`）與呼叫慣例
  （5 個報表頁的 template／script 完全不用改）

## 範圍

- 包含：
  - `app/composables/useAdminReportData.ts`
- 不包含：
  - 不改 5 個報表頁本身（`app/pages/admin/reports/*.vue`）——介面完全不變
  - 不處理「使用者手動切換月份」情境的時區問題（那是使用者主動操作後的
    client-only 狀態變化，不涉及 SSR／hydration 初始值一致性）

## 影響面

- 前端元件/Composables：`app/composables/useAdminReportData.ts`
- 前端路由/頁面：無直接修改，但 5 個報表頁皆受益
- 後端 API/Services：無

## 風險與對策

- 技術風險：
  - 風險：`useState` 的 key 若 5 個報表頁共用同一個，會讓「目前選的月份」
    變成跨頁共享狀態，改變既有「每頁各自獨立、預設都是當月」的行為
  - 對策：key 用 `` `admin-report-month-${key}` ``（`key` 是呼叫端已經為
    `useAsyncData` 準備好的、每頁不同的唯一值），確保 5 個報表頁的月份狀態
    彼此獨立，跟修正前行為一致
- UI/UX 風險：
  - 風險：無——只是把「誰決定初始月份」從「兩邊各自算」改成「伺服器算一次、
    瀏覽器複用」，使用者操作（上月／下月切換）完全不受影響

## 驗證方式

- 功能驗證：
  - Playwright 驗證無 hydration mismatch 相關 console 警告
  - 驗證 `AdminMonthPicker` 的「上月／下月」`v-model` 切換仍正常運作
- 回歸驗證：`npm test`（36 支既有測試腳本）全數通過或確認失敗項目與本次變更
  無關

## 成功標準

- [x] SSR 與 client hydration 的初始月份一致，不受伺服器/瀏覽器時區差異影響
- [x] 無新增 hydration mismatch 或 runtime error
- [x] 月份選擇器行為與修正前一致
