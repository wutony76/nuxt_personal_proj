## 1. 後端 API

- [x] 1.1 新增 `server/api/admin/npc/activity-log.get.ts`：彙整所有 NPC 的 `balanceChanges`、支援 `memberId`／`types`／`cursor` 查詢參數，每頁最多 200 筆，回傳含 `nextCursor`
- [x] 1.2 在 `app/services/api.ts` 新增 `api.admin.npc.listActivityLog()` 方法

## 2. 前端 UI

- [x] 2.1 在 `NpcPanel.vue` 增加「活動日誌」分頁入口（與現有 tab 並排）
- [x] 2.2 實作日誌列表 state：`logs`、`cursor`、`hasMore`、`loading`、`error`、篩選 `filterMemberId`、`filterType`
- [x] 2.3 實作 `fetchActivityLog(reset?)` action：reset 時清空列表重新載入，否則追加（載入更多）
- [x] 2.4 渲染日誌表格：時間、NPC 名稱、類型標籤（中文對照）、金額（+/-，正綠負紅）、前後餘額、備註
- [x] 2.5 NPC 篩選下拉（選項從 `state.members` 取）切換時 reset 重載
- [x] 2.6 類型篩選 tab（全部 / 遊戲結算 / 自動儲值 / 手動調整 / 其他）切換時 reset 重載
- [x] 2.7 「載入更多」按鈕（`hasMore` 時顯示）、無更多時隱藏
- [x] 2.8 補上 SCSS 樣式（`.np-log-*`，限 `.theme-admin` scope）
