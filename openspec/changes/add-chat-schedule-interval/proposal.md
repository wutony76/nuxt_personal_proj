## Why

現有聊天室自動發言排程只支援「每天／一次＋固定時分（HH:mm）」，無法設定「每 N 秒重複發送」。後台測試或營運需要固定節奏的循環訊息時，只能手動一直發或開很多一次性排程，效率差且容易漏。

## What Changes

- 排程重複類型新增 `interval`：「每 N 秒發一次」，直到管理員手動刪除為止
- 新增／列表 API 與型別支援 `intervalSeconds`
- 後台 `AdminChatSchedule` 表單可選「間隔」，並輸入秒數；列表顯示「每 N 秒」
- 既有 `daily`／`once` 行為不變

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `social-realtime`: 聊天室排程新增間隔重複（`interval` + `intervalSeconds`）觸發規則

## Impact

- Server：`server/services/social/chatSchedule.ts`、`server/api/admin/chat/schedules.post.ts`
- Frontend：`app/components/admin/AdminChatSchedule.vue`、`app/services/api.ts` 型別與 `addSchedule` payload
- 仍掛在既有 `runCircle` 心跳上檢查，不另開 timer
