## Why

全站目前沒有任何即時推播能力，彩池等即時性資料一律靠 `setInterval` 輪詢（例如 `useEggs.ts` 每 3 秒）。使用者要求「架構一個 socket 的計劃，主要用於全站的廣播與聊天室」。11 個彩種頁面已經各自預留了 `Chat.vue` 佔位元件（皆為一字不差的靜態 placeholder），聊天室的 UI 卡位已經存在，這次要接上真正的即時聊天室與系統廣播。

完整的架構調查、方案比較、踩雷點與穩定性評估已寫在 `openspec/reference/socket-broadcast-chat-plan.md`（狀態：規劃中），本變更依該文件第 8 節的建議正式立案，設計細節不重複展開，直接引用該文件。

## What Changes

- 新增 Nitro 原生 WebSocket 端點（`crossws`，已是 `nitropack` 內帶依賴，不新增套件），單一連線用訊息 `type` 分流「系統廣播」與「聊天室」兩個邏輯頻道。
- 新增 server 端 `social` domain：`socketHub`（連線註冊表、心跳、廣播）、`chatService`（訊息驗證、rate limit、記憶體歷史）、`broadcastService`（系統廣播觸發）、`socketAuth`（WS 專用的 cookie/session 辨識，因為 crossws 的 peer 不是 H3Event）。
- 新增前端 `useSocket`／`useBroadcast`／`useChat` composables 與 `BroadcastBanner.vue`／`ChatPanel.vue` 元件。
- 11 個彩種的 `Chat.vue` 佔位元件全部改為 `<ChatPanel />` wrapper，邏輯與樣式只維護一份。
- 落實三項「必修」穩定性對策（詳見 design.md）：入口統一 try/catch 錯誤隔離、server 端心跳清理殭屍連線、每次發言重新查驗登入身分。

## Capabilities

### New Capabilities

- `social-realtime`：全站即時系統廣播與聊天室能力，含連線管理、身分辨識（訪客可讀不可寫）、訊息 rate limit、心跳保活。

## Impact

- 新增檔案：`server/utils/socketAuth.ts`、`server/services/social/{socketHub,chatService,broadcastService}.ts`、`server/api/ws/social.ts`、`app/composables/{useSocket,useBroadcast,useChat}.ts`、`app/components/social/{BroadcastBanner,ChatPanel}.vue`
- 修改檔案：`nuxt.config.ts`（開 `nitro.experimental.websocket`）、`server/plugins/init.ts`（新增 `socketHub.init()`）、`app/app.vue`（掛載 `BroadcastBanner` + 啟動連線）、11 個 `app/components/lottery/bg/**/block/footer/Chat.vue`
- 不涉及資料庫，聊天歷史與連線狀態沿用專案既有的 in-memory 模式（重啟即清空，與現有 `Storage` 限制一致）
- 不影響任何既有的下注／開獎/遊戲紀錄邏輯；WebSocket 入口與這些系統共用同一個 Nitro process，但透過錯誤隔離確保互不影響
