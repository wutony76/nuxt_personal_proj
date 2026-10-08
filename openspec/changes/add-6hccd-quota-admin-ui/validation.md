# Validation

- 對應變更：`add-6hccd-quota-admin-ui`（6hc-cd 跨分頁單期總上限後台 UI）
- 日期：2026-10-08

## 實作內容確認

- `app/services/api.ts` 新增 `SixhccdQuotaMemberOverride`/`SixhccdQuotaSettings` 型別，
  `bgLottery` 命名空間新增 `sixhccdQuota()`/`setSixhccdQuota()`/`setSixhccdMemberQuota()`
  三個方法，分別對應 `add-6hccd-quota-p2` 已完成的 3 支 admin API，純前端串接、無新增後端邏輯
- 新增 `app/components/admin/SixhccdQuotaPanel.vue`：全站預設值輸入框+儲存、可搜尋會員
  （比對 name/email/id）的逐會員覆寫列表（套用/清除），沿用 `AsyncStatus` 三段式狀態機
  與 `_actions`/`click` 封裝慣例，寫入控制項包在 `admin-fieldset-reset` fieldset 並以
  `:disabled="isDemo"` 鎖住
- `app/pages/admin/bg-lottery.vue`：新增 `useAdminAuth()` 取得 `isDemo`、`activeTab` 型別
  擴充為包含 `'quota'`、新增第 4 個 tab 按鈕「限額設定」，掛載
  `<AdminSixhccdQuotaPanel :is-demo="isDemo" />`（自行管理 fetch/狀態，不混進既有
  `state.reseed`/`state.overpay` 的 fetch 流程）

## 核心驗證：API 資料流（對應元件實際呼叫的端點與參數）

以 `admin@example.com` 登入後，依序打元件會觸發的每一支 API，驗證回應與資料一致性
（17 項斷言全數通過）：

- `onMounted` 的 `Promise.all([sixhccdQuota(), api.admin.roles()])`：兩支皆 200，
  `globalCrossTabIssueMax` 為數字、`memberOverrides` 為陣列、`roles().users` 為陣列
- `saveGlobal()`：設定全站值為 88888 → 200，回傳值正確；重新 GET 確認值維持（非僅記憶體
  暫存）
- `applyMemberOverride()`：對一名非 admin 會員套用覆寫值 5000 → 200，回傳
  `{userId, crossTabIssueMax}` 正確；重新 GET 確認該筆出現在 `memberOverrides`
- `clearMemberOverride()`：清除同一筆覆寫（傳 `null`）→ 200，回傳值為 `null`；重新 GET
  確認該筆已從 `memberOverrides` 消失
- 前端防呆對應後端行為：送出負數（-5）給全站設定 API，未以 -5 成功落地（後端拒絕非法值，
  與元件 `_actions.saveGlobal()` 的前端檢查一致，雙層防呆）
- 驗證完畢後將全站預設值還原為驗證前的原始值

## 元件掛載驗證（無瀏覽器自動化工具，以 SSR bundle 佐證）

- 以登入後的 cookie 直接 GET `/admin/bg-lottery`，回應 200；頁面 `<head>` 內出現
  `SixhccdQuotaPanel.vue?vue&type=style&index=0&scoped=...` 的 scoped 樣式連結，證實
  Vite 正確解析、編譯並掛載了新元件（元件名稱/路徑解析無誤，沒有 `Failed to resolve
  component` 或 import 錯誤）
- 此專案頁面內容為 CSR（客戶端渲染後補齊 DOM），SSR 回應本身不含完整互動內容，因此無法
  單靠這次的 HTTP 驗證直接看到「限額設定」分頁文字或實際點擊互動效果；**已知限制**：
  沒有瀏覽器自動化工具可實際點擊測試分頁切換、搜尋框篩選、套用/清除按鈕的畫面行為與
  `isDemo` 鎖定的視覺呈現，這部分以程式碼走查方式確認（`:disabled="isDemo"` 與既有
  `NpcPanel.vue`/`CreateMember.vue` 寫法完全比照）

## 既有行為無回歸驗證

- `npm run dev` 重啟後乾淨開機無錯誤
- `npx nuxi typecheck`：新增/異動的三個檔案（`api.ts`、`bg-lottery.vue`、
  `SixhccdQuotaPanel.vue`）無新增型別錯誤；比對 `git stash` 前後，既有的 4 筆
  「Excessive stack depth」型別錯誤（`api.ts` 第 1839 行附近，`LOTTERY_CURRENT_REGISTRY`
  的巨型聯集型別）在改動前就存在，與本次變更無關
- `test:bg`（涵蓋 14 款 BG 遊戲）：14/14 全數通過
- `test:6hc-cd`：56/56 全數通過（含彩池安全性、冪等性等既有情境，確認 6hc-cd 下注流程
  未被這次純前端變更影響）
- `test:roles`：34/34 全數通過（確認權限/`isDemo` 相關既有行為無回歸）

## 測試資料清理

驗證用的全站預設值（88888）已還原為驗證前讀到的原始值，驗證用的會員覆寫（5000）已於
驗證流程內清除，DB 內無殘留測試資料。

## 成功標準檢核

- [x] 新分頁完成，UI 可完整操作既有 3 支 API（以直接呼叫 API 方式驗證資料流正確）
- [x] 既有測試無回歸（`test:bg` 14/14、`test:6hc-cd` 56/56、`test:roles` 34/34 全數通過）
