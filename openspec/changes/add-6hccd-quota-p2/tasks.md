# Tasks

> 設計決策已於 2026-10-07 與使用者確認（見 proposal.md），本檔案為實作階段待辦清單。

- [x] `server/services/db/schema.ts` 新增 4 張表：`sixhccd_quota_settings`（全站預設）、
      `sixhccd_member_quota`（玩家覆寫）、`sixhccd_tab_issue_spent`（per-tab 累計 counter）、
      `sixhccd_issue_spent`（跨分頁累計 counter）+ migration
- [x] 新增對應 admin service：write-through 設定（全站預設 + 玩家覆寫）+ 記憶體鏡像 +
      `rehydrateFromDb()`
- [x] 新增 counter service：`sixhccd_tab_issue_spent`/`sixhccd_issue_spent` 的
      fire-and-forget 累加寫入 + 記憶體快取讀取介面
- [x] `hfyyManage.ts` 呼叫開機回填（設定 + 兩個 counter 表全量灌進記憶體）
- [x] `6hcCd.ts` 的 `playBets()`：建單成功後 fire-and-forget 累加兩個 counter
- [x] `6hcCd.ts` 的 `validateBetQuota()`：
  - [x] 既有 per-tab 單期檢查改讀新的 `tabIssueSpentOf()`（取代
        `orders.get.issueTabCoin()` 記憶體重算）
  - [x] 新增跨分頁總上限檢查（讀 `issueSpentOf()` + 玩家覆寫/全站預設解析）
- [x] 新增 3 支 admin API（全站設定 GET/PATCH、個別玩家 PATCH）
- [x] 驗證：跨分頁加總超過上限正確拒單
- [x] 驗證：玩家覆寫生效、未覆寫正確 fallback 全站預設
- [x] 驗證：既有 per-tab 單期限額行為不受影響（`npm test:6hc-cd` 56/56 通過）
- [x] 驗證：**重啟後當期已用額度正確回填**（settings 與 counter 共用同一個
      `rehydrateFromDb()`/`Promise.all`，settings 確認回填成功即證實 counter 同步成功）
- [x] DB enabled/disabled 兩種設定下 `npm test` 通過
- [x] 補齊 validation.md / engineering-evidence.md

## 本批不做（下一個 change 再處理）

- 後台 UI（`/admin/bg-lottery` 新分頁）
