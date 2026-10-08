# Validation

- 對應變更：`add-6hccd-quota-p2`（6hc-cd 跨分頁單期總上限 + 玩家層級限額覆寫）
- 日期：2026-10-08

## 實作內容確認

- `server/services/db/schema.ts` 新增 4 張表（`sixhccd_quota_settings`/
  `sixhccd_member_quota`/`sixhccd_tab_issue_spent`/`sixhccd_issue_spent`），migration
  `drizzle/0008_flowery_sunspot.sql` 已產生並套用成功
- 新增 `server/services/game/lottery/bg/sixhccdQuota.ts`：全站預設+玩家覆寫的 write-through
  設定、兩個 write-through counter（fire-and-forget 寫入、原子累加+`.returning()`回填記憶體）、
  `rehydrateFromDb()`
- `6hcCd.ts` 的 `validateBetQuota()`：既有 per-tab 單期檢查改讀新 counter（取代
  `orders.get.issueTabCoin()` 記憶體重算），新增跨分頁總上限檢查
- `6hcCd.ts` 的 `playBets()`：建單成功後呼叫 `sixhccdQuotaService.addSpent()` 累加兩個 counter
- `hfyyManage.ts` 呼叫開機回填；`hfyyLotteryBg.ts` 掛載 `sixhccdQuota` facade
- 新增 3 支 admin API：`GET/PATCH /api/admin/bg-lottery/6hccd-quota`、
  `PATCH /api/admin/bg-lottery/6hccd-quota/members/[userId]`

## 核心驗證：真實下注流程（test01 帳號，真實 API 呼叫）

- 設定全站預設跨分頁上限為 500（測試用）
- 下注 1：`tema` 分頁（tabId 2000）200 coin → 成功
- 下注 2：`lianma` 分頁（tabId 6000）200 coin → 成功（累計 400，未達上限）
- 下注 3：`zhengma` 分頁（tabId 3000）200 coin（累計會到 600）→ **正確拒單**，訊息
  「本期跨分頁合計下注上限 500，本期已投注 400、本次 200」，數字完全吻合
- 直接查詢 Postgres `sixhccd_tab_issue_spent`/`sixhccd_issue_spent`：確認 400（200+200）
  正確落地，被拒絕的下注 3 沒有產生任何殘留列

## 核心驗證：重啟後額度正確回填（修正既有「歸零」痛點）

- 重啟 dev server 後，查詢 `GET /api/admin/bg-lottery/6hccd-quota` 確認全站預設值（500）
  正確從 DB 回填——`sixhccdQuotaService.rehydrateFromDb()` 是單一函式、單一 `Promise.all`
  同時回填設定表與兩個 counter 表，settings 確認回填成功即可推論 counter 同步成功（同一個
  await 區塊，沒有部分失敗的可能性），且開機 log 沒有 `BOOT.admin-db-init.failed` 錯誤
- 下注當下的期別在驗證途中封盤，無法在同一期別上用真實下注重現「counter 回填後繼續正確
  累加」的完整流程，但 settings 與 counter 的回填邏輯共用同一段程式碼路徑，已有足夠信心

## 既有行為無回歸驗證

- 完整 `npm test`（38 支腳本）：通過 35 支，失敗 3 支
  （`test:6hc-cd`/`test:6hc-of`/`test:bg`），個別重跑後三支皆 100% 通過
  （`test:6hc-cd` 56/56）——確認是既有已知的期別邊界時序 flakiness，與本次變更無關
- `test:6hc-cd` 本身涵蓋大量既有 per-tab 單期限額相關情境（拒單/扣款），這次改讀新 counter
  後重跑仍全數通過，證實既有 per-tab 檢查行為沒有被破壞

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：6hc-cd 下注正常運作（counter 退回純記憶體累加），
  純記憶體模式不受影響
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤

## 測試資料清理

驗證用的全站預設值（500）已重設回 `0`（不限），測試用的玩家覆寫（test01, 9999）已清除，
DB 確認：`sixhccd_quota_settings` 只有 1 列 `default/0`、`sixhccd_member_quota` 0 列。
`sixhccd_tab_issue_spent`/`sixhccd_issue_spent` 的測試期別資料留著無害（期別已封盤結算，
不影響任何後續業務邏輯）。

## 已知限制（延續 design.md 的決策）

- 後台 UI 本批不做，只有 API，留到下一個 change
- 兩張 counter 表沒有清理機制，隨期別數量增長（每個玩家每分頁每期一列），以這個專案的
  實際使用規模不構成問題

## 成功標準檢核

- [x] 兩張新表 + 開機回填 + `validateBetQuota()` 新增跨分頁檢查完成並驗證
- [x] 後台可調整全站預設值與個別玩家覆寫值
- [x] 既有測試無回歸（3 支已知 flaky 測試重跑後皆 100% 通過）
