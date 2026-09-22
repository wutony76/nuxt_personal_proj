## ADDED Requirements

### Requirement: 查詢 NPC 活動日誌
系統 SHALL 提供一個後台 API，彙整所有 NPC 角色會員的 `balanceChanges`，依時間新→舊排序，支援分頁與篩選。

#### Scenario: 取得最新活動紀錄
- **WHEN** 管理員 GET `/api/admin/npc/activity-log`（無篩選參數）
- **THEN** 回傳最新 200 筆、跨所有 NPC 的 balanceChanges，每筆包含 `memberId`、`memberName`、`id`、`type`、`amount`、`before`、`after`、`note`、`createdAt`

#### Scenario: 依 NPC 會員篩選
- **WHEN** 請求帶 `?memberId=<id>`
- **THEN** 只回傳該 NPC 的紀錄

#### Scenario: 依類型篩選
- **WHEN** 請求帶 `?types=game-reward,admin-topup`
- **THEN** 只回傳符合指定類型的紀錄

#### Scenario: 分頁載入更多
- **WHEN** 請求帶 `?cursor=<createdAt_id>` 且筆數仍有剩餘
- **THEN** 回傳 cursor 之後（更舊）的下一頁紀錄，並附帶新的 `nextCursor`；已到底則 `nextCursor` 為 null

### Requirement: NpcPanel 活動日誌分頁
系統 SHALL 在 `/admin/npc` 的 NpcPanel 內新增「活動日誌」tab，呈現統合紀錄。

#### Scenario: 開啟日誌 tab
- **WHEN** 管理員切換到「活動日誌」tab
- **THEN** 自動載入最新 200 筆紀錄，顯示時間、NPC 名稱、類型標籤（中文）、金額（綠色正 / 紅色負）、餘額、備註

#### Scenario: 篩選 NPC
- **WHEN** 從下拉選單選擇特定 NPC
- **THEN** 重新查詢並只顯示該 NPC 的紀錄

#### Scenario: 篩選類型
- **WHEN** 點選類型 tab（全部 / 遊戲結算 / 自動儲值 / 手動調整 / 其他）
- **THEN** 只顯示該類型紀錄

#### Scenario: 載入更多
- **WHEN** 點擊「載入更多」
- **THEN** 追加下一頁到列表末尾；若 `nextCursor` 為 null，按鈕隱藏
