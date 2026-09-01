## Context

- `add-socket-social` 已定義全站單一 WebSocket 連線與聊天室（`chatService.ts`／`socketHub.ts`），任何登入使用者發言一律走同一條 `chat:send` 路徑，目前沒有「官方身分」的概念。
- `add-admin-backend` 的 design.md Decision 2 原本規劃總覽頁只放「4 個關鍵數字摘要＋3 張導覽卡片」，本次改成在總覽頁塞入即時聊天室面板與排程管理面板，是對原規劃版面的實際調整（詳見下方 Decision 3）。
- 伺服器已有一個 300ms 週期的心跳循環（`BaseClass.runCircle`，`server/plugins/init.ts` 內驅動所有彩票／遊戲的 `circle()`），排程檢查直接掛在這個既有循環上，不需要另開一個 `setInterval`。

## Decisions

### 1. 擴充既有聊天室，不新增獨立公告頻道

- **理由**：管理員發言在使用者端看起來就是聊天室裡的一則訊息（只是顯示名不同），沒有必要另開一個獨立的公告系統、獨立的 UI 元件、獨立的已讀狀態。
- **做法**：`chat:send` 的 payload 新增 `asAdmin?: boolean`；`socketHub.ts` 解析後傳給 `chatService.handleSend(peer, text, { asAdmin })`。
- **安全性（關鍵）**：`asAdmin` 是前端宣稱的欄位，伺服器 **不信任** 這個布林值本身，而是重新查驗 `socketAuth.identify(peer)` 解出的使用者 `id` 是否在 `ADMIN_USER_IDS`（`server/config/admin.ts`）白名單內；不在白名單時即使帶了 `asAdmin: true` 也直接回傳 `forbidden` error，不會被當成一般發言誤發，也不會被靜默降級——這是刻意的行為，避免「權限不足時退化成一般發言」讓管理員誤以為自己是用管理者身分發的。
- **排程發言走另一條路徑**（`chatService.pushAdminMessage`）：不經過 WebSocket peer（伺服器排程觸發時沒有對應的使用者連線），不走 `handleSend` 的 rate limit（那是給「使用者手動連續發言」設計的節流，排程本身已經由「同一分鐘只觸發一次」的 `lastFiredKey` 機制防重複，不需要再套用 1.5 秒節流），直接寫入歷史並回傳訊息物件供 `socketHub.broadcast()` 廣播。

### 2. 排程觸發機制：掛在既有 300ms 心跳循環上，分鐘級精度

- **做法**：`chatScheduleService.tick(now)` 由 `server/plugins/init.ts` 的 `runCircle` 回呼內每次呼叫（約每 300ms 一次），比對 `now.getHours()/getMinutes()` 是否等於排程設定的 `hour`/`minute`。
- **防重複**：`lastFiredKey`（`YYYYMMDDHHMM` 字串）記錄「這筆排程上次是在哪一分鐘觸發的」，同一分鐘內即使被呼叫上百次（300ms 週期），只會真正發送一次。
- **`once` 排程**：觸發後立即從陣列移除；`daily` 排程保留、僅更新 `lastFiredKey`，隔天同一分鐘會因為 `lastFiredKey` 不匹配而再次觸發。
- **精度的代價**：這是分鐘級排程，不是秒級精準鬧鐘；若伺服器在該分鐘內短暫停滯超過一分鐘（例如 GC 卡頓、debugger 中斷），有極小機率整分鐘被跳過而錯過一次 `daily` 觸發——在單機、低流量的專案規模下風險可接受，且錯過的下一個週期（隔天同一時間）仍會正常觸發，不需要額外的「補發」機制。

### 3. 後台總覽頁面版面調整：即時聊天室取代原本規劃的摘要數字卡片

- **跟 `add-admin-backend` design.md 的差異**：該文件 Decision 2 原本規劃總覽頁要有「今日活躍會員數、彩池補貼累計、池底重新擲骰次數、可調遊戲常數數量」4 個摘要數字，本次實作改成放「即時聊天室＋排程管理」兩個面板，前述 4 個數字目前仍未實作（記錄在 `add-admin-backend/tasks.md` 第 2 節，非本次變更負責範圍）。
- **理由**：管理員發言／排程這兩個能力本質上需要「總覽頁常駐、隨時可用」的位置，總覽頁作為登入後台的第一站是合理的落腳點；不影響角色權限／遊戲管理/報表分析等其餘導覽卡片的既有位置。
- **範圍界線**：這個版面調整本身不是本次變更要解決的問題，只是在這裡記錄下來，避免日後對照 `add-admin-backend` design.md 時誤以為總覽頁還缺 4 個數字卡片是遺漏——那是獨立、尚未排入時程的另一件事。

### 4. 排程與訊息內容的上限

- `MAX_SCHEDULES = 30`：避免管理員誤觸或濫用堆出大量排程拖垮 `tick()` 的每次迴圈成本（300ms 週期 × 30 筆全部是簡單數值比較，效能可忽略，上限主要是防呆而非效能考量）。
- `MAX_TEXT_LENGTH = 200`：跟既有聊天室訊息的長度限制（`chatService.ts` 既有的 `MAX_TEXT_LENGTH`）對齊，排程訊息不應該比手動發言允許更長的內容。

## Risks / Trade-offs

- [風險] 排程清單 in-memory，伺服器重啟即清空，管理員需要重新設定；跟後台其餘設定（coin 常數、迷宮樣板）的既有限制一致，非本次新增風險。
- [風險] `asAdmin` 白名單重驗依賴 `ADMIN_USER_IDS` 常數是否即時同步——若管理員名單異動需要重啟伺服器才生效，這是沿用 `add-admin-backend` Decision 1 已接受的既有限制。
- [已排除風險] 前端偽造 `asAdmin: true`：伺服器端一律重新查驗白名單，不信任前端宣稱值（見 Decision 1）。

## Migration Plan

不涉及既有資料遷移。`chatService.ChatMessage` 新增的 `asAdmin?: boolean` 欄位是可選欄位，既有訊息歷史（`history` 陣列，重啟即空）與既有 client 顯示邏輯不受影響；`chat:send` 沒有帶 `asAdmin` 時行為與擴充前完全一致。
