# 全站 Socket 架構計劃 —— 廣播 + 聊天室

> 狀態：**規劃中（尚未實作）。** 本檔為 reference 調查與架構草案，供拍板決策與後續開 openspec change 使用。
> 分析日期：2026-08-27　範圍：`nuxt.config.ts`、`server/**`、`app/composables/**`、`app/components/**/block/footer/Chat.vue`
>
> 需求原文：「幫我架構一個 socket 的計劃，主要用於全站的廣播與聊天室」

---

## 0. 一句話結論

**用 Nitro 內建的原生 WebSocket（crossws），單一連線、單一端點，用訊息 `type` 分流「系統廣播」與「聊天室」兩種頻道。**
不引入 `socket.io`（專案目前零 socket 相依套件，`nitropack@2.13.2` 已內帶 `crossws@0.3.5`，開一個 nitro flag 就能用，符合專案一貫的精簡依賴風格）。

---

## 1. 現況盤點

| 項目 | 現況 |
|---|---|
| Socket / WebSocket 相關程式碼 | **完全沒有**，目前彩池等即時性資料靠 `setInterval` 輪詢（`useEggs.ts` 每 3 秒） |
| 部署方式 | 未指定 nitro preset → 預設 `node-server`，支援長連線，WebSocket 可行 |
| WebSocket 底層套件 | `crossws@0.3.5`（`nitropack` 相依已安裝，免加套件） |
| 登入機制 | Cookie session：`portfolio_auth_token` → `Storage.get.sessions()`（記憶體 Map，見 `server/services/auth.ts`） |
| 是否有 DB / Redis | 沒有，所有狀態都是記憶體內的 `Storage` 單例 |
| 聊天室 UI 佔位 | **已存在**：11 個彩種各自有 `app/components/lottery/bg/<game>/block/footer/Chat.vue`，內容都是同一段靜態 placeholder（`<div class="chat-warp">CHAT</div>`），已用 diff 確認彼此完全相同 |
| 全域掛載點 | `app/app.vue`，`<NuxtPage>` 外層已掛 `<Dialog />`、`<BgAutoPanel />` 兩個全站單例元件，`useAuth().init()` 在 `onMounted` 執行 —— 這是新增全站 socket 連線 bootstrap 的天然掛點 |
| 公開／需登入的既有先例 | `server/middleware/auth.ts` 的 `PUBLIC_LOTTERY_SUFFIXES`：`jackpot` / `pool` 兩個 GET 端點對訪客也開放（大廳頁不登入也要看得到彩池金額），其餘 `/api/lottery/*` 一律要求登入 |

**關鍵發現：聊天室的 UI 骨架已經被前人卡好位置了（11 份 Chat.vue），這次要做的是把它們背後接上同一個真的聊天室，而不是重新設計版面。**

---

## 2. 三層架構

沿用專案既有的 `app/` + `server/` 分層慣例，新增一個橫向 domain：`social`（不掛在 `game` 底下，因為廣播/聊天不屬於任何一個彩種）。

```
Transport 層   nuxt.config.ts (開 websocket flag) + server/routes/api/ws/social.ts
                → 只做 upgrade 與事件轉發，不放業務邏輯

Service 層     server/services/social/
                socketHub.ts        連線註冊表、topic 訂閱/廣播、上線人數
                chatService.ts      訊息驗證、rate limit、記憶體歷史 ring buffer
                broadcastService.ts 系統廣播觸發（給其他 service 呼叫，例如爆池中獎通知全站）

Client 層      app/composables/useSocket.ts   底層連線單例（reconnect、心跳、依 type 分派）
                app/composables/useBroadcast.ts  訂閱 system:broadcast，餵給全域公告 Banner
                app/composables/useChat.ts       訂閱 chat:*，供 ChatPanel 用

UI 層          app/components/social/BroadcastBanner.vue（新增，掛在 app.vue）
                app/components/social/ChatPanel.vue（新增，唯一真正實作）
                11 份既有 Chat.vue → 改成 1 行 `<ChatPanel />` wrapper
```

一個 WebSocket 連線、兩個邏輯頻道（用訊息 `type` 分流），理由：
- 全站只需要一條長連線，沒必要為廣播和聊天各開一條 socket，多一次 handshake 只有壞處
- 兩者都要走同一套登入辨識（cookie → user），共用一份連線管理最省事

---

## 3. 訊息協定（Message Envelope）

```ts
/**
 * @typedef {Object} SocketEnvelope
 * @property {string} type - 訊息種類，見下表
 * @property {number} seq - 流水號，見下方說明
 * @property {unknown} payload
 * @property {number} ts - server 時間戳（ms）
 */
```

| type（Server → Client） | payload | 說明 |
|---|---|---|
| `chat:history` | `{ messages: ChatMessage[] }` | 連線建立後主動推一次最近 N 筆 |
| `chat:message` | `ChatMessage` | 有新訊息（含自己發的，server 回送作為 ack） |
| `chat:online` | `{ count: number }` | 上線人數變化 |
| `system:broadcast` | `{ level: 'info'\|'warning'\|'success', text: string }` | 系統公告 |
| `error` | `{ code: string, message: string }` | 例如未登入卻嘗試發言、超過 rate limit |

| type（Client → Server） | payload | 說明 |
|---|---|---|
| `chat:send` | `{ text: string }` | 發送聊天訊息，server 驗證後才會廣播回 `chat:message` |

`ChatMessage = { id, userId, userName, text, ts }`

### `seq`（流水號）

- **綁在單一連線上**，不是全站訊息的永久編號：每次重新連線（新的 WS handshake）都從 1 重新算起
  - Server → Client：server 對這個 peer 每送一個 envelope 就 +1
  - Client → Server：client 自己維護一份遞增計數，server 不驗證大小，純粹方便雙邊 log 對照
- **用途**：
  1. 掉包/斷線偵測 —— client 收到的 `seq` 跳號（例如 5 之後直接收到 8）代表中間漏了訊息，可主動觸發重連
  2. 去重 —— 重連後 server 可能重送未 ack 訊息，client 用 `seq` 判斷是否已處理過
  3. 除錯 —— 比 `ts` 可靠（`ts` 可能同毫秒撞號），方便對照兩邊 log
- **v1 範圍**：只做「跳號偵測 + 除錯」，**不**做 resume-by-seq（斷線後用 `seq` 跟 server 要回漏掉的訊息）。
  之後若真的需要，可在 `chat:history` 的 request 加 `sinceSeq` 參數擴充，本次先不做。

---

## 4. 三個要拍板的設計決策（已給建議值，可直接照用或覆蓋）

### 決策 1：Transport —— 建議「Nitro 原生 WebSocket」

| 方案 | 優點 | 缺點 |
|---|---|---|
| **Nitro 原生（crossws）**（建議） | 零新增依賴（已在 `nitropack` 相依樹裡）、與現有 Nitro server 同進程、部署方式不變 | 沒有 socket.io 那些現成功能（房間／自動重連／降級為 polling），要自己刻，但需求單純，刻起來不重 |
| socket.io | 生態成熟、reconnect/room 現成 | 多一個相依、多一份 client bundle、對這個規模的需求是殺雞用牛刀 |

專案目前對依賴一向精簡（`axios` 都還在但主力是 `ofetch`），建議走原生。

### 決策 2：訪客可不可以看聊天室／廣播 —— 建議「可讀不可寫」

比照 `server/middleware/auth.ts` 裡 `jackpot`/`pool` 對訪客開放 GET 的既有先例：
- 訪客（未帶有效 `portfolio_auth_token`）：連線可成功、收得到 `system:broadcast` 與 `chat:history`/`chat:message`、`chat:online` 人數含訪客
- 訪客送 `chat:send` → server 直接回 `error`，不廣播（不能用「未登入不能連線」這種寫法，否則大廳訪客連公告都看不到）

### 決策 3：系統廣播的觸發方式 —— 建議「v1 只做 server 內部事件觸發，不做管理後台」

`broadcastService.systemBroadcast(text, level)` 是一個 service 函式，誰都能 import 呼叫（例如未來某彩種爆池中獎時順手呼叫一下），先不做「管理員發公告」的 admin API/UI —— 專案目前沒有 admin 角色概念，貿然加一個要多決定權限模型，先把地基做完，公告來源之後再擴充即可。

---

## 5. 檔案改動清單（依相依序）

### Transport 層

**① `nuxt.config.ts`**
```ts
export default defineNuxtConfig({
  // ...既有設定
  nitro: {
    experimental: { websocket: true }
  }
})
```

**② `server/routes/api/ws/social.ts`** —— 新檔，薄轉發層
```ts
export default defineWebSocketHandler({
  open(peer) { socketHub.onOpen(peer) },
  message(peer, message) { socketHub.onMessage(peer, message) },
  close(peer) { socketHub.onClose(peer) },
  error(peer, error) { socketHub.onError(peer, error) }
})
```

### Service 層（新 domain：`server/services/social/`）

**③ `server/utils/socketAuth.ts`** —— 新檔
- 從 `peer.request.headers.get('cookie')` 手動解析 `portfolio_auth_token`（crossws 的 peer 不是 H3Event，`sessionController.get()` 用不了）
- 直接查 `Storage.get.sessions()`（與 `sessionController.get()` 同一份 store，邏輯照抄即可，不用動 `auth.ts`）
- 回傳 `AuthUser | null`

**④ `server/services/social/socketHub.ts`** —— 新檔
- 連線註冊表（`Map<peer, { user: AuthUser | null }>`）
- `init()`：初始化註冊表／ring buffer／rate-limit map，**在 server boot 時被呼叫，不是等第一個連線進來才建立**
- `broadcast(type, payload)`：對所有連線送 envelope
- `onlineCount()`：連線數（含訪客）
- open 時：呼叫 `socketAuth` 辨識身分 → 存進註冊表 → 送 `chat:history`（呼叫 `chatService.recent()`）→ 廣播新的 `chat:online`
- message 時：解析 envelope，`chat:send` 轉給 `chatService.handleSend()`
- close 時：移除註冊表 → 廣播新的 `chat:online`

**啟動時機（比照現有 `Storage.init()` 慣例）**：`server/plugins/init.ts` 已經是「server boot 時跑一次」的既有掛勾（目前呼叫 `Storage.init()` + 啟動 `BaseClass().runCircle()`），這次在同一支檔案裡加一行 `socketHub.init()`，讓連線註冊表在**第一個 WS 連線進來之前**就確定存在，不依賴 module import 的隱性時機。WebSocket 本身沒有獨立的 server 進程——跟現有 Nitro HTTP server 同一個 process、同一個 port，`npm run dev` / production 啟動時就一起起來，只是 WS upgrade 這個路徑要等 client 實際連線才會觸發 `open()`。

**⑤ `server/services/social/chatService.ts`** —— 新檔
- 記憶體 ring buffer（陣列，上限 50 筆，超過砍最舊）
- `handleSend(peer, user, text)`：
  1. `user == null` → 回 `error`（未登入）
  2. `text` 為空或超過長度上限（建議 200 字）→ 回 `error`
  3. rate limit：`Map<userId, lastSentAt>`，同一使用者間隔 < 1.5s → 回 `error`（**server 端做，不能只信前端 debounce**，不然開 devtools 直接送 WS frame 就繞過去了）
  4. 通過 → 存進 ring buffer → `socketHub.broadcast('chat:message', message)`
- `recent()`：回傳目前 ring buffer

**⑥ `server/services/social/broadcastService.ts`** —— 新檔
- `systemBroadcast(text, level = 'info')`：呼叫 `socketHub.broadcast('system:broadcast', { text, level })`
- 給其他 service 之後 import 使用（例如爆池中獎時順手廣播，屬於各彩種自己的擴充，本次不動既有彩種程式碼）

### 前端 Transport 層

**⑦ `app/composables/useSocket.ts`** —— 新檔，全站單例（module 級 state，比照 `useEggs.ts` 的 `pollTimer` 寫法）
- `state`：`{ connected: false, onlineCount: 0 }`
- `actions.connect()`：`new WebSocket(...)`，指數退避重連（斷線後 1s/2s/4s.../上限 30s），連線成功時重置退避
- `actions.send(type, payload)`
- 內部 event bus：`Map<type, Set<handler>>`，`actions.on(type, handler)` / `off(type, handler)` 給上層 composable 訂閱
- **只在 `app.vue` 的 `onMounted` 呼叫一次 `connect()`**（跟 `useAuth().init()` 同層級），不要在各元件各自 connect

**⑧ `app/composables/useBroadcast.ts`** —— 新檔
- 訂閱 `system:broadcast`，維護 `state.messages`（最近 N 則）供 Banner 顯示

**⑨ `app/composables/useChat.ts`** —— 新檔
- 訂閱 `chat:history` / `chat:message` / `chat:online`，維護 `state.messages` / `state.online`
- `actions.sendMessage(text)`：loading guard + early return（空字串/超長）+ 呼叫 `useSocket().actions.send('chat:send', { text })`；client 端也做一層節流（`useThrottleFn`，符合專案「高頻事件優先 debounce/throttle」規範）當第一道防線，真正防護在 server

### UI 層

**⑩ `app/components/social/BroadcastBanner.vue`** —— 新檔，掛進 `app.vue`（`<Dialog />` / `<BgAutoPanel />` 旁邊）

**⑪ `app/components/social/ChatPanel.vue`** —— 新檔，唯一的真實聊天室實作（訊息列表 + 輸入框 + 上線人數）

**⑫ 11 份 `app/components/lottery/bg/<game>/.../block/footer/Chat.vue`** —— 全部改成：
```vue
<template>
  <ChatPanel />
</template>

<script setup>
import ChatPanel from '~/components/social/ChatPanel.vue'
</script>
```
維持各彩種既有的檔案位置（不打破目錄慣例），但邏輯與樣式只在 `ChatPanel.vue` 寫一份。

---

## 6. 踩雷點

**① Nitro 的 WebSocket 標記 experimental，忘記開 flag 連線會直接失敗。**
`nuxt.config.ts` 一定要加 `nitro.experimental.websocket = true`，否則 `defineWebSocketHandler` 的路由不會做 upgrade。

**② crossws 的 `peer` 不是 `H3Event`，不能直接用 `sessionController.get()`。**
要自己從 `peer.request.headers.get('cookie')` 解析 cookie 字串取出 `portfolio_auth_token`，再查 `Storage.get.sessions()`。这是新寫的 `socketAuth.ts`，不是改 `auth.ts`。

**③ Rate limit 必須做在 server（`chatService.handleSend`），不能只靠前端節流。**
前端 `useThrottleFn` 只是 UX 優化，惡意使用者可以直接開 devtools 打 WS frame 繞過。

**④ 記憶體 hub、單一 process、無持久化。**
跟現有 `Storage` 的既定限制一致：重啟/重新部署會清空所有連線、上線人數、聊天歷史。這不是本次新增的風險，只是延續既有慣例，先讓使用者知道即可，不用為此加 DB。

**⑤ 11 份 Chat.vue 目前是各自獨立的 placeholder，統一前先確認沒人客製過。**
已用 diff 逐一比對，除了 `11x5` / `6hc/of` 兩份少一個結尾換行外，其餘 9 份逐字元相同 —— 可以放心統一改成 wrapper，不會漏掉任何客製內容。

**⑥ `nuxt dev` 走 Vite middleware，WebSocket upgrade 要實測。**
Nitro dev server 通常對 WS upgrade 有整合，但沒在這個專案驗證過，實作完第一件事就是 `npm run dev` 手動連線確認，不要假設能動。

**⑦（重要）`socketHub` 跟遊戲引擎同一個 process，錯誤必須被隔離，不能往上炸穿。**
`socketHub` / `chatService` 跑在跟彩票下注、開獎結算完全同一個 Nitro process（跟 `Storage`、`BaseClass.runCircle()` 同進程）。`onOpen` / `onMessage` / `onClose` 三個入口**必須整段包 try/catch**，任何例外只能回一個 `error` envelope 或安靜斷開該連線，絕不能讓例外往上炸穿到 process 層級——聊天室的 bug 沒有資格弄垮下注／結算系統。

**⑧（重要）沒有心跳會產生殭屍連線，`onlineCount` 會飄走。**
WebSocket 在網路瞬斷、手機切背景、NAT timeout 時，`close` 事件不一定觸發。`socketHub` 要自己維護心跳：server 端定期（例如 30 秒）對每個 peer 送 ping，超過 timeout（例如 60 秒）沒收到 pong 就強制從註冊表移除並更新 `chat:online`。沒有這層，連線註冊表只會單調往上長，人數永遠不準。

**⑨（重要）身分只在 `open` 當下驗證一次，之後不會自動過期。**
`open` 時查一次 `Storage.get.sessions()` 存進註冊表後，只要連線活著就一路信任這個身分——就算使用者在別的分頁登出、或 session 已過期（7 天 TTL），這條 WS 連線依然能繼續發言。修法：`chatService.handleSend()` 每次送訊息時都重新查一次 `Storage.get.sessions()`（成本只是一次 Map 查找），不要完全信任 `open` 時的快取身分。

---

## 7. 驗證清單（實作完成後逐項過）

- [ ] `npm run dev` 啟動後，已登入身分連線成功，立即收到 `chat:history`
- [ ] 訪客（未登入）連線成功，收得到 `system:broadcast` 與 `chat:history`／`chat:message`；送 `chat:send` 收到 `error`，不會被廣播出去
- [ ] 兩個瀏覽器分頁（不同帳號）互相看得到對方訊息，`chat:online` 人數即時 +1/-1
- [ ] 連續快速送出訊息（繞過前端節流，直接呼叫 `actions.send`）→ 超過門檻後收到 rate-limit `error`，不會進聊天室
- [ ] 呼叫 `broadcastService.systemBroadcast()`（可先寫臨時測試路由，測完刪除，比照 eggs 爆池的驗證方式）→ 所有分頁即時收到 Banner
- [ ] 斷線重連：關掉本機網路模擬斷線 → 重新連上後 `state.connected` 恢復、`chat:history` 重新拿到
- [ ] 11 個彩種頁面的聊天室外觀與行為一致（因為背後是同一個 `ChatPanel.vue`）
- [ ] `npm run build` exit code 0，無新增 console/runtime error

---

## 8. 落成 openspec change 時的建議切法

本檔是 reference（架構調查與草案）。正式動工建議開 `openspec/changes/add-socket-social/`：

- `proposal.md` —— Why（全站廣播與聊天室需求）／What Changes（第 5 節檔案清單）／
  Capabilities（New: `social-realtime`）／Impact（新增 `server/services/social/`、`app/components/social/`）
- `design.md` —— 第 3 節訊息協定、第 4 節三個決策、第 6 節踩雷點
- `tasks.md` —— 依第 5 節四層（Transport 2 / Service 4 / 前端 3 / UI 2）拆成可勾選項，驗證對照第 7 節

---

## 9. 本次未涵蓋（明確排除，避免範圍蔓延）

- 多房間／多聊天室（例如各彩種各自獨立房間）——目前需求是「全站」，先做單一大廳房間
- 訊息持久化 / 歷史查詢 API——沿用專案現況（記憶體即可，無 DB）
- 管理後台發公告 UI——見決策 3，先做 service 函式讓程式碼觸發
- 水平擴展（多 Node process 共享連線狀態）——目前單一 process 部署，未來若要多開再引入 Redis pub/sub adapter

---

## 10. 後台穩定性評估

### 必修（v1 實作時就要做，屬於正確性問題，不是加分項）

| 項目 | 風險 | 對策 |
|---|---|---|
| 錯誤隔離 | `socketHub` 與遊戲引擎同 process，未接住的例外會拖垮整個 server（見踩雷點⑦） | `onOpen`/`onMessage`/`onClose` 全部包 try/catch，錯誤只回 `error` envelope 或斷線，不往外拋 |
| 心跳／殭屍連線清理 | `close` 事件不保證觸發，連線註冊表只會單調變大，`onlineCount` 永遠不準（見踩雷點⑧） | server 定期 ping／逾時未收到 pong 就強制移除註冊 |
| 身分複查 | 登入身分只在 `open` 時查一次，之後永遠信任，登出/session 過期後連線仍可發言（見踩雷點⑨） | `chatService.handleSend()` 每次都重查 `Storage.get.sessions()` |

### 已知限制（先接受，不影響 v1 上線）

| 限制 | 說明 |
|---|---|
| 不能水平擴展 | 單一 process 記憶體 hub，多開 instance 會各自為政；跟現有 `Storage` 同樣限制，目前也是單一部署 |
| 無持久化 | 重啟清空聊天歷史與連線狀態；跟現有 `Storage` 模式一致 |
| `crossws` 相對年輕 | 已是 `nitropack` 內帶依賴，API 可能隨版本調整，但換成 socket.io 風險更高，不換 |
| 無自動化測試/監控 | 與專案現況一致，非本次新增缺口 |

### 結論

架構分層（Transport / Service / Client）本身是穩的，沿用既有 `Storage` 記憶體模式與 `server/plugins/init.ts` 啟動慣例，沒有引入新技術債。但**必修三項不做的話不能算穩**——尤其錯誤隔離，聊天室的 bug 沒有資格拖垮下注／結算系統。已知限制則是與專案現況一致的既定取捨，不需要為了這次功能特別加 DB 或 Redis。
