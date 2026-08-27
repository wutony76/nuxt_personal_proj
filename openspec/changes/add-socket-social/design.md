## Context

完整的現況盤點、方案比較、三層架構圖、訊息協定設計、11 份 `Chat.vue` 逐字元 diff 確認、以及 9 個踩雷點，都已寫在 `openspec/reference/socket-broadcast-chat-plan.md`，本文件不重複展開，只記錄跟該文件的差異與正式定案的補充決策。

## Decisions

沿用 reference 文件第 4 節的三個決策：
1. Transport 用 Nitro 原生 WebSocket（`crossws`），不用 socket.io。
2. 訪客可讀不可寫：連線可成功、收得到廣播與聊天訊息，`chat:send` 會被 server 擋下並回 `error`。
3. 系統廣播 v1 只做 `broadcastService.systemBroadcast()` 這個 service 函式供程式碼呼叫，不做管理後台。

### 與 reference 文件的差異：WS 路由檔案位置

reference 文件建議 `server/routes/api/ws/social.ts`。專案目前所有 API 路由（`/api/lottery/*`、`/api/games/*` 等）都是放在 `server/api/**`（Nitro 自動加上 `/api` 前綴），沒有任何檔案使用 `server/routes/`。為維持慣例一致，改放 `server/api/ws/social.ts`（同樣解析為 `/api/ws/social`，行為等價，Nitro 對 `defineWebSocketHandler` 在 `server/api/` 底下運作正常）。`server/middleware/auth.ts` 的 `PROTECTED_PREFIXES` 只比對 `/api/lottery`、`/api/taiwan-lottery`、`/api/games` 三個前綴，`/api/ws/social` 不在其中，天然不受登入閘門限制，不需要额外修改 middleware。

### 三項必修對策的具體實作方式

**① 錯誤隔離**：`server/api/ws/social.ts` 的 `open`/`message`/`close` 三個 hook 各自包 try/catch，例外只在該 peer 範圍內處理（`message`/`open` 失敗回一個 `error` envelope 或直接關閉該連線；`close` 失敗只記 log，因為連線已經不存在，沒有對象可以回應），絕不允許例外往上炸穿到 process 層級。`socketHub` 呼叫 `chatService`/`broadcastService` 內部方法時，這些方法自己也不假設輸入一定合法（例如 `text` 型別檢查），屬於縱深防禦，不是唯一防線。

**② 心跳機制**：`socketHub.init()`（server boot 時，比照 `Storage.init()` 的既有啟動慣例）啟動一個**全域單一** `setInterval`（30 秒一次，不是每連線各開一個計時器），對所有已註冊 peer 送 `type: 'ping'`；若某 peer 超過 60 秒沒有回應對應的 `type: 'pong'`，視為殭屍連線，從註冊表移除、呼叫 `peer.close()`、廣播更新後的 `chat:online`。Client 端 `useSocket.ts` 收到 `ping` 立即回 `pong`。

**③ 身分複查**：連線註冊表存的 `user`（`open()` 時查一次）只用來初始化與 `chat:online` 計數，**不是**發言授權依據。`chatService.handleSend()` 每次收到 `chat:send` 都重新呼叫 `socketAuth.identify(peer)` 現查 `Storage.get.sessions()`，若 session 已不存在或過期，一律視為未登入回 `error`，不信任註冊表裡的快取身分。

## Non-Goals

比照 reference 文件第 9 節：不做多房間、不做訊息持久化、不做管理後台發公告 UI、不做水平擴展（多 process 共享連線狀態）。

## Risks / Trade-offs

比照 reference 文件第 10 節的「已知限制」：單一 process、無持久化、`crossws` 相對年輕但已是內帶依賴、無自動化測試——這些都與專案現況的既有取捨一致，不是本次新增的風險，不需要為此加 DB 或 Redis。

## Migration Plan

全新能力，無既有資料需要遷移。部署順序（比照 reference 文件精神，每一步可獨立驗證）：
1. Transport＋Service 層（`nuxt.config.ts`、`socketAuth.ts`、`socketHub.ts`、`chatService.ts`、`broadcastService.ts`、`server/api/ws/social.ts`、`server/plugins/init.ts`）——尚未有前端連線，無風險。
2. 前端 Transport 層（`useSocket.ts`／`useBroadcast.ts`／`useChat.ts`）——尚未掛進任何頁面，無風險。
3. UI 層（`BroadcastBanner.vue`／`ChatPanel.vue`／`app.vue` 掛載）——此步驟起使用者才看得到廣播與聊天室。
4. 11 個 `Chat.vue` 改為 wrapper——此步驟起彩種頁面的聊天室才是真正可用的（而非 placeholder）。

## Follow-up

比照 reference 文件第 7 節的驗證清單，實作完成後逐項手動驗證（多分頁互看訊息、rate limit、斷線重連、心跳逾時清理）。
