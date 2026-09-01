## Why

`add-socket-social` 已經有一個全站聊天室（`social-realtime` capability），任何登入使用者都能發言，但沒有「官方／管理者」發言管道——公告、活動預告、系統維護通知目前沒有統一的發送方式。後台（`add-admin-backend`）總覽頁本來就是管理員的工作入口，順勢加上「以管理者身分發言」與「到點自動發送」這兩個能力，補上這塊空缺，不需要另外開一個新的公告系統。

## What Changes

- 既有聊天室發言（`chat:send`）新增 `asAdmin` 選項：管理員勾選後，伺服器重新驗證白名單身分（不信任前端宣稱），顯示名改為「管理者: {name}」
- 新增聊天室排程：管理員在後台設定「訊息內容＋時間（HH:mm）＋重複頻率（每天／一次）」，伺服器既有的心跳循環（`BaseClass.runCircle`）每次觸發時檢查是否到點，到點以「管理者: 排程」名義發送，`once` 發完即刪除、`daily` 用當分鐘的 key 防止同一分鐘重複觸發
- 後台總覽頁（`/admin`）新增聊天室即時面板（`AdminChatPanel.vue`）與排程管理面板（`AdminChatSchedule.vue`），取代原本規劃的純導覽卡片版面
- 新增 3 支後台 API：`GET/POST /api/admin/chat/schedules`、`DELETE /api/admin/chat/schedules/:id`，皆走 `sessionController.requireAdmin`

## Capabilities

- `social-realtime`（既有 capability，本次擴充）：`chat:send` 支援 `asAdmin` 選項與伺服器端白名單重驗

## Impact

- 受影響：`server/services/social/chatService.ts`（`handleSend` 簽章新增 `options`、新增 `pushAdminMessage`）、`server/services/social/socketHub.ts`（解析 `asAdmin` 欄位）、`server/plugins/init.ts`（`runCircle` 內新增 `chatScheduleService.tick()` 呼叫）
- 新增：`server/services/social/chatSchedule.ts`、`server/api/admin/chat/schedules.get.ts`、`schedules.post.ts`、`schedules/[id].delete.ts`、`app/components/admin/AdminChatPanel.vue`、`AdminChatSchedule.vue`
- 不影響既有訪客／一般使用者的聊天室行為（`asAdmin` 未帶或非管理員一律視為一般發言，見 `chatService.handleSend` 的白名單檢查）
- 沿用 in-memory 慣例：排程清單伺服器重啟即清空，跟 `add-admin-backend` 的其餘後台狀態一致
