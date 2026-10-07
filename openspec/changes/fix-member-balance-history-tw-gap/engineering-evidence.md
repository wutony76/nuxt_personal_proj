# Engineering Evidence

## 變更摘要

- 對應變更：`fix-member-balance-history-tw-gap`
- 變更檔案清單：
  - `server/services/admin/modules/memberBalanceHistory.ts`（補 8 個台彩來源，`list()`
    改 async 合併 DB）
  - `server/api/admin/members/[id]/balance-changes.get.ts`（補 `await`）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 既有缺陷修正實測：後台會員個人異動明細過去完全看不到台彩下注/派彩紀錄（8 個來源遺漏），
  修正後全部 22 個來源皆正確顯示
- DB 合併查詢實測：重啟後記憶體幾乎清空時立即查詢，回傳 300 筆（上限），證實資料來自 DB
  完整歷史，不是只讀記憶體
- `npm test`（38 支）：DB enabled/disabled 兩種設定下皆全數通過，0 失敗
- typecheck：異動檔案無新增型別錯誤

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認是否要一併封存全部已完成的 openspec changes
