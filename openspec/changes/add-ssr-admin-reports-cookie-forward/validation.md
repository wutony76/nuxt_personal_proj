# Validation

## 驗證範圍

- 對應變更：`add-ssr-admin-reports-cookie-forward`
- 驗證環境：本機 dev server（`http://localhost:6100`）

## 功能驗證

- [x] 5 個報表頁 SSR 回應皆含真實資料 — 實際結果：`curl` 帶 admin cookie，5 個頁面
      （`index`/`fcoin`/`members`/`plays`/`settlement`）皆能在原始 HTML 裡找到真實數字
      （例如 `ard-kpi-num` 內容是 `F13,300`，不是 0 或空字串）
- [x] `AdminShell` 權限檢查 SSR 階段正確運作：
      - 匿名（無 cookie）：SSR 直接輸出「登入已過期」＋「登入」連結，不再是
        「正在確認管理員權限...」
      - 已登入 admin：SSR 輸出含完整導覽列（`ash-user`）與報表 KPI 數字
      - demo 帳號（test04）：SSR 輸出含 KPI 數字**且** demo 唯讀提示（`ash-notice-demo`）
        同時可見
- [x] `npm test`：36/36 支既有測試通過（`test:roles` 涵蓋角色/權限/setRole 流程，
      對這次改動 `useAuth`/`useAdminAuth` 是很好的間接回歸信號）

## 視覺驗證

- 不適用（無版面/Figma 變動）

## 回歸驗證

- Playwright 檢查（用程式化登入取得 cookie 後注入 context，不透過 UI 表單）：
  - admin 登入後直接 SSR 載入 `/admin/reports`：**hydration 警告 0 筆**
  - client-side 導覽（真實點擊 `<NuxtLink>`）`/admin` → `/admin/roles` → `/admin/reports`：
    導覽到 `/admin/roles` 耗時 111ms、導覽到 `/admin/reports` 耗時 68ms，**沒有被卡住**，
    資料正確重新顯示（`F13,300`），hydration 警告 0 筆
  - demo 帳號（test04）：hydration 警告 0 筆
- 發現 `/login` 頁面本身有既有的 hydration mismatch 警告（`[Vue warn]: Hydration node
  mismatch ... at <Login>`），用 `git stash` 暫時還原 `useAuth.ts`/`useAdminAuth.ts`
  （本次變更前的版本）後重測，**警告依然一模一樣出現**——證實這是跟本次變更無關的既有
  問題，不在本次處理範圍（也不是本次引入的新問題）

## 效能驗證（誠實呈現，不只看單一指標）

依 `add-ssr-lottery-hall-pools` review 的教訓，同時量 4 個指標，改造前後各 5 次
取中位數（完整樣本見 `ssr-performance-log.md`）：

| 指標 | 改造前 | 改造後 | 說明 |
|---|---|---|---|
| TTFB | 12ms | 25ms | SSR 多了「等 cookie 驗證 + 報表資料都回來」的代價，符合預期方向 |
| 首次真實數字 | 390ms | 485ms | **比改造前還慢**，且改造後樣本變異很大（158ms~769ms） |
| settled | 390ms | 485ms | 同上（這個情境下沒有動畫，所以跟首次真實數字相同） |
| LCP | 384ms | 460ms | 同上 |

**這次的效能數據不像 `lottery-hall.vue` 那麼好看，誠實說明可能原因**：

1. `lottery-hall.vue` 只有一個非同步相依（彩池資料），這次疊加了兩個
   （`AdminShell` 的權限檢查 2 次 API 呼叫 + 報表頁自己的資料獲取 1 次 API 呼叫），
   不管 SSR 或 CSR，使用者實際要等的「關鍵路徑」請求數都差不多，SSR 把這些請求
   從「client hydrate 後才發」提前到「伺服器端渲染前」，但沒有減少請求數量本身，
   在這種多個依賴鏈的情境下，SSR 帶來的淨改善本來就比單一依賴的 lottery-hall 小
2. 用 Playwright 診斷確認：改造後的畫面內容從第一次偵測到就是穩定值（`F18,560`，
   連續 20 次輪詢都沒變過），**沒有**出現「先顯示錯的、再更新成對的」這種 CSR
   waterfall 的典型症狀；也用 curl 直接確認過 SSR 原始回應就含正確數字——架構上
   「cookie 有正確轉發、SSR 真的抓到資料」這件事本身是成立的，只是這次量到的
   瀏覽器端時間指標沒有同步呈現優勢
3. 樣本數小（5 次）、本機環境雜訊，加上這次測試用全新 `browser.newContext()`
   （而非固定一個 page 反覆導覽），每次都是全新 TLS/connection 建立，可能放大了
   時間量測的變異，沒有進一步加大樣本數排查，誠實記錄這個限制

**結論：這次的改動在「架構正確性」（cookie 真的轉發成功、SSR 真的輸出含資料的 HTML、
无 hydration mismatch）上是成立且已驗證的，但「使用者實際感受到的載入時間變快」這個
效益在本次量測中沒有像 lottery-hall 那樣清楚展現，甚至中位數略為變慢，如實記錄，
不做沒有數據支撐的效益宣稱。**

## 問題與修正紀錄

- 問題：`useNuxtApp()` 在 `refresh()`/`check()` 的 `finally` 區塊（await 之後）呼叫，
  丟出 `[nuxt] A composable that requires access to the Nuxt instance was called
  outside of a plugin...`
  - 發現方式：改完 Shell.vue 後第一次 curl 測試直接 500
  - 修正方式：把 `useNuxtApp()` 呼叫移到 `useAuth()`/`useAdminAuth()` 函式最頂層
    （還沒 await 之前），透過閉包在後面的 async 邏輯裡沿用
  - 是否已重新驗證：已驗證，見上方「功能驗證」
- 問題：`useAdminReportData` 的 `useAsyncData` 沒加 `await`，SSR 輸出停在「載入中…」
  - 發現方式：curl 確認 `__NUXT_DATA__` payload 裡已經有真實數字，但 HTML 裡卻顯示
    「載入中…」而非 KPI 數字——資料有抓到、畫面卻看不出來，兩者對不起來才追出根因
  - 修正方式：`useAsyncData(...)` 前面加上 `await`（比照 `lottery-hall.vue` 已經踩過
    同一個坑的做法），5 個頁面呼叫 composable 的地方也跟著加 `await`
  - 是否已重新驗證：已驗證，curl 與 Playwright 皆確認 KPI 數字正確顯示

## 結論

- 是否通過：**通過（功能/架構正確性），效能數據誠實呈現為「不如預期顯著」**
- 已知限制或風險：
  - 效能量測樣本數小（5 次）、變異大，未進一步加大樣本數排查原因
  - `useGameAccess.ts`/`useSocket.ts` 仍是模組層級單例，若未來也想讓它們在 SSR
    執行，需要比照這次 `useAuth`/`useAdminAuth` 的方式處理，本次未涵蓋
- 後續追蹤事項：
  - 若之後想繼續提升後台頁面的 SSR 效益，可以考慮讓 `AdminShell` 的權限檢查跟報表頁
    的資料獲取**合併成一次請求**（例如後端提供一個「驗證身分＋回報表資料」的合併
    端點），減少關鍵路徑上的請求數，而不是只把既有的多個請求從 client 搬到 server
  - 其餘 `/admin/**` 頁面（角色/權限、遊戲設定、NPC）的資料獲取仍是 client-only，
    可視需要比照辦理
