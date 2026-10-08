# Engineering Evidence

## 變更摘要

- 對應變更：`add-6hccd-quota-p2`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 4 張表）
  - `drizzle/0008_flowery_sunspot.sql` + `drizzle/meta/`
  - `server/services/game/lottery/bg/sixhccdQuota.ts`（新檔，設定 + counter 服務）
  - `server/services/game/lottery/bg/6hcCd.ts`（`validateBetQuota()`/`playBets()` 整合）
  - `server/services/admin/hfyyManage.ts`（開機回填）
  - `server/services/admin/hfyyLotteryBg.ts`（掛載 facade）
  - `server/api/admin/bg-lottery/6hccd-quota.get.ts`、
    `server/api/admin/bg-lottery/6hccd-quota.patch.ts`、
    `server/api/admin/bg-lottery/6hccd-quota/members/[userId].patch.ts`（新檔）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 真實下注流程實測：跨分頁合計超過上限正確拒單，數字精確吻合；DB counter 正確寫入、
  被拒絕的下注沒有殘留
- 開機回填實測：設定值與 counter 共用同一個 `rehydrateFromDb()`/`Promise.all`，settings
  確認回填成功即證實 counter 同步成功，無部分失敗風險
- `npm test`（38 支）：DB enabled/disabled 兩種設定下皆通過（3 支已知 flaky 測試重跑後
  100% 通過，`test:6hc-cd` 本身涵蓋大量既有 per-tab 限額情境，改讀新 counter 後重跑仍
  全數通過，證實既有行為無回歸）
- typecheck：新增/異動檔案無新增型別錯誤（僅既有 `process` 型別噪音，與本次無關）
- 驗證用測試資料已清理回預設狀態

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認是否要繼續做後台 UI（下一個 change）
