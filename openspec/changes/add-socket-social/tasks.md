## 1. Transport 層

- [ ] 1.1 `nuxt.config.ts`：新增 `nitro.experimental.websocket = true`
- [ ] 1.2 `server/api/ws/social.ts`：薄轉發層，`open`/`message`/`close` 三個 hook 各自 try/catch（見 design.md 對策①）

## 2. Service 層

- [ ] 2.1 `server/utils/socketAuth.ts`：從 `peer.request.headers` 解析 cookie，查 `Storage.get.sessions()`
- [ ] 2.2 `server/services/social/socketHub.ts`：連線註冊表、`init()`（server boot 啟動全域心跳計時器，對策②）、`broadcast()`、`onlineCount()`
- [ ] 2.3 `server/services/social/chatService.ts`：ring buffer（上限 50 筆）、`handleSend()`（每次重查身分即對策③、長度驗證、rate limit）
- [ ] 2.4 `server/services/social/broadcastService.ts`：`systemBroadcast(text, level)`
- [ ] 2.5 `server/plugins/init.ts`：新增 `socketHub.init()` 呼叫

## 3. 前端 Transport 層

- [ ] 3.1 `app/composables/useSocket.ts`：連線單例、指數退避重連、`type` 分派、ping/pong 回應
- [ ] 3.2 `app/composables/useBroadcast.ts`：訂閱 `system:broadcast`
- [ ] 3.3 `app/composables/useChat.ts`：訂閱 `chat:*`、`actions.sendMessage()`（含前端節流）

## 4. UI 層

- [ ] 4.1 `app/components/social/BroadcastBanner.vue`：新增，掛進 `app.vue`
- [ ] 4.2 `app/components/social/ChatPanel.vue`：新增，唯一真實聊天室實作
- [ ] 4.3 `app/app.vue`：`onMounted` 啟動 `useSocket().actions.connect()`，掛載 `<BroadcastBanner />`
- [ ] 4.4 11 個 `app/components/lottery/bg/**/block/footer/Chat.vue` 改為 `<ChatPanel />` wrapper

## 5. OpenSpec 文件

- [ ] 5.1 `proposal.md` / `design.md` / `tasks.md` / `specs/social-realtime/spec.md`（本次變更文件本身）

## 6. 驗證

- [ ] 6.1 `npm run dev` 啟動後，已登入身分連線成功，立即收到 `chat:history`
- [ ] 6.2 訪客連線成功，收得到廣播與聊天訊息；送 `chat:send` 收到 `error`，不會被廣播
- [ ] 6.3 兩個瀏覽器分頁（不同帳號）互相看得到對方訊息，`chat:online` 即時 +1/-1
- [ ] 6.4 繞過前端節流直接呼叫 `actions.send`，連續快速送出 → 超過門檻收到 rate-limit `error`
- [ ] 6.5 呼叫 `broadcastService.systemBroadcast()`（臨時測試路由，測完刪除）→ 所有分頁即時收到 Banner
- [ ] 6.6 驗證錯誤隔離：故意送一個畸形/超長訊息 → 該連線收到 error 或被安全關閉，其他連線與其他系統（例如彩票下注）不受影響
- [ ] 6.7 驗證心跳：模擬連線不回 pong → 逾時後從註冊表移除、`chat:online` 正確遞減
- [ ] 6.8 驗證身分複查：登入後連線，另開分頁登出 → 原連線再送 `chat:send` 應收到未登入 `error`
- [ ] 6.9 11 個彩種頁面的聊天室外觀與行為一致
- [ ] 6.10 `npx nuxt typecheck` 無新增型別錯誤
