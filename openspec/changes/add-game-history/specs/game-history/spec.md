## ADDED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos 任一遊戲進入明確結束狀態（game over 或通關）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: 貪吃蛇撞到自己
- **WHEN** 玩家操作貪吃蛇撞到自己身體，遊戲進入 gameover 狀態
- **THEN** 系統寫入一筆 `gameKey: 'snake'` 的紀錄，包含當局分數與等級

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: 遊戲紀錄 SHALL 於瀏覽器端持久化並在重整後保留
系統 SHALL 將遊戲紀錄寫入 localStorage，SHALL 在重新載入頁面後仍可讀出既有紀錄；
紀錄筆數超過上限（50 筆）時 SHALL 自動裁剪最舊的紀錄。

#### Scenario: 重整頁面後紀錄仍存在
- **WHEN** 玩家玩完一局遊戲後重新整理瀏覽器
- **THEN** 開啟遊戲紀錄 Dialog 仍能看到該局紀錄

#### Scenario: 超過筆數上限自動裁剪
- **WHEN** 既有紀錄已達 50 筆，又新增一筆紀錄
- **THEN** 系統寫入新紀錄並移除時間最舊的一筆，總筆數維持 50

### Requirement: game-hall 頁面上方 SHALL 提供遊戲紀錄查看入口
系統 SHALL 在 `game-hall.vue` 頂部導覽區提供一個可點擊的「遊戲紀錄」入口，
點擊後 SHALL 開啟遊戲紀錄 Dialog。

#### Scenario: 點擊遊戲紀錄按鈕開啟 Dialog
- **WHEN** 玩家點擊 game-hall 頂部的「遊戲紀錄」按鈕
- **THEN** 畫面顯示遊戲紀錄 Dialog，列出目前已儲存的紀錄

### Requirement: 遊戲紀錄 Dialog SHALL 支援依遊戲篩選與摘要統計
Dialog SHALL 提供「全部／SNAKE／RACING／TETRIMINOS」篩選 tab，並顯示各遊戲的最高分與已玩局數摘要；
無任何紀錄時 SHALL 顯示空狀態文案。

#### Scenario: 篩選特定遊戲
- **WHEN** 玩家在 Dialog 內點擊「SNAKE」篩選 tab
- **THEN** 清單只顯示 `gameKey: 'snake'` 的紀錄，摘要卡顯示貪吃蛇的最高分與局數

#### Scenario: 尚無任何紀錄
- **WHEN** 玩家從未完成過任何一局遊戲即開啟 Dialog
- **THEN** 清單區域顯示「尚無遊戲紀錄」等空狀態文案，不顯示錯誤

### Requirement: 玩家 SHALL 能清除所有遊戲紀錄
Dialog SHALL 提供「清除紀錄」動作，執行後 SHALL 清空目前資料來源（localStorage 或 server）內的所有遊戲紀錄，
清單 SHALL 立即反映為空狀態。

#### Scenario: 清除紀錄
- **WHEN** 玩家點擊「清除紀錄」並確認
- **THEN** 所有遊戲紀錄被移除，清單顯示空狀態，重新整理頁面後紀錄仍為空

### Requirement: 已登入使用者的遊戲紀錄 SHALL 透過 server API 讀寫，MUST NOT 使用 localStorage
當使用者已登入時，`useGameHistory` SHALL 改為呼叫 `server/api/games/retro/<game>/history.*` 讀寫紀錄，
MUST NOT 以 localStorage 作為登入使用者的資料來源。

#### Scenario: 已登入時寫入紀錄呼叫 server API
- **WHEN** 已登入的玩家完成一局貪吃蛇並觸發 gameover
- **THEN** 系統呼叫 `POST /api/games/retro/snake/history` 寫入該筆紀錄，MUST NOT 寫入 localStorage

#### Scenario: 未登入時寫入紀錄僅用 localStorage
- **WHEN** 未登入的玩家完成一局遊戲
- **THEN** 系統只寫入瀏覽器 localStorage，MUST NOT 呼叫任何 `/api/games/retro/*` 路由

### Requirement: 遊戲紀錄 server API SHALL 要求登入
`server/api/games/retro/<game>/history.get.ts` 與 `history.post.ts` SHALL 透過 `sessionController.require()`
驗證登入狀態；未登入請求 SHALL 回傳既有的未登入錯誤（業務代碼 40001），MUST NOT 回傳任何紀錄資料。

#### Scenario: 未登入呼叫遊戲紀錄 API
- **WHEN** 未帶有效登入 session 的請求呼叫 `GET /api/games/retro/snake/history`
- **THEN** 系統回傳未登入錯誤，MUST NOT 回傳任何紀錄資料

### Requirement: 遊戲紀錄資料來源 SHALL 隨登入狀態自動切換，呼叫端 MUST NOT 需要感知目前模式
`useGameHistory` 對外提供的 `records` / `actions.record()` / `actions.clear()` 介面 SHALL 在模式 A
（localStorage）與模式 B（server API）下保持一致簽章；遊戲頁與 `GameHistoryDialog` MUST NOT 需要判斷
目前是哪個模式。

#### Scenario: 登入狀態改變時資料來源切換
- **WHEN** 玩家從未登入狀態登入帳號後開啟遊戲紀錄 Dialog
- **THEN** Dialog 顯示的紀錄改為來自 server（該帳號的歷史），而非先前的本地 localStorage 內容

### Requirement: Dialog SHALL 只在頂部顯示一次目前身分，清單各列 MUST NOT 重複標示身分
遊戲紀錄 Dialog SHALL 在頂部（標題或副標）依目前資料來源顯示身分：未登入時顯示「訪客（本機保存）」，
已登入時顯示「會員 {使用者名稱}」。清單本體的每一列 MUST NOT 重複顯示身分欄位（GUEST 或帳號名稱），
只呈現遊戲／分數／等級／時間等紀錄本身的欄位。

#### Scenario: 未登入時的身分顯示
- **WHEN** 未登入的玩家開啟遊戲紀錄 Dialog
- **THEN** Dialog 頂部顯示「訪客（本機保存）」，清單每一列只顯示遊戲、分數、時間，不重複顯示身分

#### Scenario: 已登入時的身分顯示
- **WHEN** 已登入使用者 TTT 開啟遊戲紀錄 Dialog
- **THEN** Dialog 頂部顯示「會員 TTT」，清單每一列只顯示遊戲、分數、時間，不重複顯示身分

### Requirement: 已登入使用者結算後 SHALL 依固定比例把分數轉換為 coin
當已登入使用者觸發遊戲結束並寫入 `history.post.ts` 時，系統 SHALL 依該遊戲的固定倍率
（`coin = floor(score × rate[gameKey])`）計算 coin 獎勵，並計入使用者既有的 `coin` 錢包餘額；
此轉換 SHALL 與寫入遊戲紀錄在同一次請求內完成。未登入玩家 MUST NOT 觸發此轉換。

#### Scenario: 已登入玩家結算後獲得 coin
- **WHEN** 已登入使用者完成一局貪吃蛇，分數為 20
- **THEN** 系統依 snake 的倍率換算 coin 獎勵，計入該使用者的錢包餘額，並回傳本次獲得的 coin 數量

#### Scenario: 未登入玩家不觸發轉換
- **WHEN** 未登入的玩家完成一局遊戲
- **THEN** 系統 MUST NOT 進行任何 coin 轉換（未登入沒有伺服器端錢包可歸屬）

### Requirement: coin 轉換 SHALL 受單局上限與每日上限雙重保護
系統 SHALL 對每次 coin 轉換套用單局上限（`RETRO_GAME_COIN_CAP_PER_RUN`）與每人每遊戲每日上限
（`RETRO_GAME_COIN_DAILY_CAP`），實際核發金額 MUST NOT 超過任一上限；伺服器端 SHALL 對 client
回報的分數做合理性驗證，MUST NOT 直接信任未經驗證的分數計算 coin。

#### Scenario: 單局分數超高被夾住上限
- **WHEN** 某次結算依公式計算出的 coin 超過該遊戲的單局上限
- **THEN** 系統只核發單局上限額度的 coin，不核發超過上限的部分

#### Scenario: 當日累計已達上限
- **WHEN** 使用者當日在同一款遊戲已核發的 coin 總額達到每日上限
- **THEN** 該局結算後系統 MUST NOT 再核發任何 coin，並於回應中標示已達每日上限

### Requirement: coin 入帳 SHALL 留下可稽核的餘額異動紀錄
每次因遊戲結算核發 coin，系統 SHALL 在使用者的 `balanceChanges` 留下一筆異動紀錄（比照既有彩票
下注／領獎的稽核方式），紀錄 SHALL 可區分為遊戲獎勵類型，MUST NOT 與下注／領獎紀錄混淆為同一類型。

#### Scenario: 核發 coin 後可在餘額異動紀錄查到
- **WHEN** 已登入使用者的一局遊戲結算並核發 coin
- **THEN** 該使用者的 `balanceChanges` 新增一筆遊戲獎勵類型的紀錄，可與下注／領獎紀錄區分開來

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: 新增第四款遊戲時的擴充方式
- **WHEN** 未來要新增第四款小遊戲的伺服器端支援
- **THEN** 開發者新增一個繼承共用基底的服務檔與對應 API 路由資料夾，不需修改既有三款遊戲的服務檔
