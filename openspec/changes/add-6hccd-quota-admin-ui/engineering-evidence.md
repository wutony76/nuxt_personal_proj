# Engineering Evidence

## 變更摘要

- 對應變更：`add-6hccd-quota-admin-ui`
- 變更檔案清單：
  - `app/services/api.ts`（新增型別 + `bgLottery.sixhccdQuota/setSixhccdQuota/setSixhccdMemberQuota`）
  - `app/components/admin/SixhccdQuotaPanel.vue`（新檔）
  - `app/pages/admin/bg-lottery.vue`（新增第 4 個分頁）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- API 資料流實測：元件會呼叫的 5 種情境（載入設定、設定全站值、套用覆寫、清除覆寫、
  非法值防呆）共 17 項斷言全數通過，且驗證包含「重新讀取確認落地」而非只看單次回應
- 元件掛載實測：登入後 SSR 回應的 `<head>` 內出現該元件的 scoped 樣式連結，證實
  Vite/Nuxt 正確解析並掛載了新元件
- 已知限制：此環境沒有瀏覽器自動化工具，無法實際點擊測試分頁切換、搜尋框、
  `isDemo` 鎖定視覺效果；這部分以程式碼走查（比照 `NpcPanel.vue`/`CreateMember.vue`
  既有寫法）取代
- typecheck：新增/異動三個檔案無新增型別錯誤（比對 `git stash` 前後確認既有 4 筆
  `Excessive stack depth` 錯誤與本次無關）
- 回歸測試：`test:bg`（14/14）、`test:6hc-cd`（56/56）、`test:roles`（34/34）全數通過
- 驗證用測試資料已清理回原始狀態

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常，API 端對端驗證通過
- [x] 可執行 `openspec archive`
