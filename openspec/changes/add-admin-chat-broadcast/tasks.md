## 1. Server 端：管理者身分發言

- [x] 1.1 `server/services/social/chatService.ts`：`ChatMessage` 新增 `asAdmin?: boolean`；`handleSend(peer, text, options)` 新增 `options.asAdmin`，伺服器重新查驗 `ADMIN_USER_IDS` 白名單，非管理員帶 `asAdmin: true` 回傳 `forbidden`
- [x] 1.2 新增 `chatService.pushAdminMessage(text, userName?)`：排程專用，不經 peer、不走 rate limit
- [x] 1.3 `server/services/social/socketHub.ts`：解析 `chat:send` payload 的 `asAdmin` 欄位並傳給 `handleSend`

## 2. Server 端：聊天室排程

- [x] 2.1 新增 `server/services/social/chatSchedule.ts`：`ChatSchedule` 型別、`list/add/remove/tick`，`MAX_SCHEDULES=30`、`MAX_TEXT_LENGTH=200`、`lastFiredKey` 防同分鐘重發
- [x] 2.2 `server/plugins/init.ts`：`BaseClass.runCircle` 回呼內新增 `chatScheduleService.tick()`
- [x] 2.3 新增 `server/api/admin/chat/schedules.get.ts`（`requireAdmin` + `list()`）
- [x] 2.4 新增 `server/api/admin/chat/schedules.post.ts`（`requireAdmin` + 解析 `time: "HH:mm"` 或 `hour/minute` + `add()`）
- [x] 2.5 新增 `server/api/admin/chat/schedules/[id].delete.ts`（`requireAdmin` + `remove()`）

## 3. Client 端

- [x] 3.1 `app/composables/useChat.ts`：`sendMessage(text, options)` 新增 `asAdmin` 選項
- [x] 3.2 `app/services/api.ts`：`ChatSchedule`／`ChatScheduleRepeat` 型別，`api.admin.chat.{listSchedules,addSchedule,removeSchedule}`
- [x] 3.3 新增 `app/components/admin/AdminChatPanel.vue`：即時聊天室面板，送出固定帶 `asAdmin: true`，顯示名為「管理者: {name}」
- [x] 3.4 新增 `app/components/admin/AdminChatSchedule.vue`：排程表單（訊息／時間 picker／重複頻率）＋排程列表＋刪除
- [x] 3.5 `app/pages/admin/index.vue`（總覽）：新增「聊天室」區塊，並排放置兩個面板

## 4. 驗證

- [x] 4.1 一般使用者（非管理員）帶 `asAdmin: true` 送出：確認伺服器回傳 `forbidden`，訊息不會以管理者身分廣播
- [ ] 4.2 Playwright 實機驗證：後台總覽登入後開啟聊天室面板送出訊息、確認顯示名為「管理者: {name}」且一般使用者端也能即時收到——**尚未執行**
- [ ] 4.3 Playwright 實機驗證：新增一筆「1 分鐘後」的 `once` 排程，等待觸發，確認訊息以「管理者: 排程」發出且排程自動從列表移除——**尚未執行**
- [ ] 4.4 確認排程新增的前端／後端驗證訊息一致（時間格式、文字長度上限、`MAX_SCHEDULES` 上限的錯誤文案）——**尚未逐一核對**
