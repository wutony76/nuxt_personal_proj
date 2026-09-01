## ADDED Requirements

### Requirement: 管理員 SHALL 能以管理者身分發言，伺服器 MUST NOT 信任前端宣稱的身分
系統 SHALL 允許 `chat:send` 帶 `asAdmin: true`；伺服器收到後 MUST NOT 直接信任這個欄位，
SHALL 重新查驗發送者目前的登入身分是否在管理員白名單（`ADMIN_USER_IDS`）內。在白名單內時，
訊息 SHALL 以「管理者: {使用者名稱}」的顯示名廣播；不在白名單內時 SHALL 回傳 `forbidden`
錯誤，MUST NOT 將該訊息廣播出去（也 MUST NOT 靜默降級成一般發言）。

#### Scenario: 管理員以管理者身分發言
- **WHEN** 管理員白名單內的使用者送出 `chat:send`，payload 帶 `asAdmin: true`
- **THEN** 訊息被廣播，顯示名為「管理者: {使用者名稱}」，且訊息物件的 `asAdmin` 為 `true`

#### Scenario: 非管理員嘗試冒用管理者身分
- **WHEN** 不在白名單內的已登入使用者送出 `chat:send`，payload 帶 `asAdmin: true`
- **THEN** 伺服器回傳 `forbidden` error，MUST NOT 廣播該訊息、MUST NOT 寫入聊天歷史

### Requirement: 系統 SHALL 支援管理員設定聊天室排程，到點以系統管理者身分自動發送
系統 SHALL 提供排程管理 API（僅管理員可用），允許新增「訊息內容＋時間（時：分）＋重複頻率
（每天／一次）」的排程；伺服器 SHALL 於既有心跳循環中檢查是否到點，到點時 SHALL 以
「管理者: 排程」名義發送訊息並廣播，同一分鐘 MUST NOT 因心跳週期短於一分鐘而重複觸發。
`一次` 排程觸發後 SHALL 自動移除；`每天` 排程 SHALL 保留供隔天同一時間再次觸發。

#### Scenario: 每天排程到點觸發
- **WHEN** 一筆 `repeat: daily` 的排程設定時間到達（伺服器目前時分與排程一致）
- **THEN** 系統發送一則「管理者: 排程」訊息並廣播，該排程仍保留在清單中供下次觸發

#### Scenario: 一次性排程觸發後自動移除
- **WHEN** 一筆 `repeat: once` 的排程設定時間到達
- **THEN** 系統發送訊息後，該排程從清單中被移除，之後不再觸發

#### Scenario: 同一分鐘內心跳多次觸發不重複發送
- **WHEN** 心跳循環在同一分鐘內對同一筆到點排程呼叫多次 `tick()`
- **THEN** 該排程僅實際發送一次訊息，後續同分鐘內的呼叫不會重複廣播

#### Scenario: 非管理員嘗試存取排程管理 API
- **WHEN** 非管理員（或未登入）呼叫排程的新增／查詢／刪除 API
- **THEN** 系統回傳權限錯誤，MUST NOT 執行任何排程異動
