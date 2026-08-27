## ADDED Requirements

### Requirement: 全站 SHALL 提供單一 WebSocket 連線，用訊息 type 分流廣播與聊天室
系統 SHALL 在 `/api/ws/social` 提供單一 WebSocket 端點，前端 SHALL 只建立一條連線並用訊息 `type`
分流「系統廣播」與「聊天室」兩個邏輯頻道，MUST NOT 為兩者各自開一條連線。

#### Scenario: 使用者進站建立一條連線
- **WHEN** 使用者開啟任一頁面
- **THEN** `app.vue` 掛載時建立一條 WebSocket 連線，同時可接收 `system:broadcast` 與 `chat:*` 訊息

### Requirement: 訪客 SHALL 可讀取廣播與聊天室，MUST NOT 能發言
未登入的訪客 SHALL 能成功建立連線並接收 `system:broadcast`、`chat:history`、`chat:message`、
`chat:online`；訪客送出 `chat:send` 時系統 SHALL 回傳 `error`，MUST NOT 將該訊息廣播出去。

#### Scenario: 訪客送出聊天訊息
- **WHEN** 未登入的訪客透過連線送出 `chat:send`
- **THEN** 系統回傳 `error` envelope，MUST NOT 呼叫廣播、MUST NOT 寫入聊天歷史

### Requirement: 聊天訊息 SHALL 受伺服器端 rate limit 保護
系統 SHALL 對每位已登入使用者的 `chat:send` 套用伺服器端節流（同一使用者兩次送出間隔需 ≥ 1.5 秒），
超過門檻 SHALL 回傳 `error`，MUST NOT 僅依賴前端節流。

#### Scenario: 短時間內連續發送
- **WHEN** 已登入使用者在 1.5 秒內連續呼叫兩次 `chat:send`
- **THEN** 第二次呼叫收到 rate-limit `error`，訊息不會進入聊天歷史或被廣播

### Requirement: WebSocket 入口 SHALL 做錯誤隔離，MUST NOT 影響其他系統
`open`／`message`／`close` 三個入口 SHALL 個別攔截例外；任何未預期的錯誤 SHALL 只影響觸發例外的
該條連線（回傳 `error` 或關閉連線），MUST NOT 使例外往上傳播影響同一 process 內的其他系統
（下注、開獎結算、其他遊戲）。

#### Scenario: 單一連線收到畸形訊息
- **WHEN** 某條連線送出無法解析或格式錯誤的訊息
- **THEN** 系統只對該連線回傳 `error` 或安全關閉該連線，其他連線與其他系統功能不受影響

### Requirement: 系統 SHALL 透過心跳機制清理逾時未回應的連線
系統 SHALL 定期（預設 30 秒）對所有已註冊連線送出心跳；連線超過逾時時間（預設 60 秒）未回應
SHALL 被視為失效並從連線註冊表移除，同時更新 `chat:online` 人數。

#### Scenario: 連線逾時未回應心跳
- **WHEN** 某連線超過 60 秒未回應心跳
- **THEN** 系統將該連線從註冊表移除、關閉底層連線，並廣播更新後的 `chat:online` 人數

### Requirement: 聊天發言 SHALL 於每次送出時重新驗證登入身分
系統 MUST NOT 只依賴連線建立當下（`open` 事件）快取的身分做為後續發言授權依據；每次收到
`chat:send` SHALL 重新查驗目前的 session 是否仍然有效，若使用者已登出或 session 已過期，
SHALL 回傳 `error`，等同未登入。

#### Scenario: 連線期間使用者登出
- **WHEN** 使用者建立連線後，在其他分頁登出或 session 已過期
- **THEN** 該連線再送出 `chat:send` 時系統重新查驗發現未登入，回傳 `error`，MUST NOT 廣播該訊息
