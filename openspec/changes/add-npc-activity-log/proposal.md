## Why

NPC 自動遊玩功能上線後，管理員沒有統一視圖可以追蹤「哪個 NPC 玩了什麼、花了多少、何時儲值」，只能進個別會員查餘額變動，效率很低。需要一個彙整所有 NPC 活動的日誌頁面。

## What Changes

- 新增後台 API：彙整所有 NPC 會員的 `balanceChanges`，依時間新→舊回傳
- `NpcPanel.vue` 新增「活動日誌」分頁，顯示跨 NPC 的統合活動紀錄
- 支援依 NPC 會員篩選、依異動類型篩選（全部 / 遊戲結算 / 自動儲值 / 手動調整）
- 每筆紀錄顯示：時間、NPC 名稱、類型、金額（±）、前後餘額、備註

## Capabilities

### New Capabilities
- `npc-activity-log`: 後台查詢所有 NPC 會員活動日誌（跨會員彙整 balanceChanges）

### Modified Capabilities
<!-- 無 -->

## Impact

- 新增 `server/api/admin/npc/activity-log.get.ts`
- 修改 `app/components/admin/NpcPanel.vue`（新增日誌分頁 UI）
- 僅讀取既有 `user.record.balanceChanges`，不修改任何資料結構
