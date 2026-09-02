## ADDED Requirements

### Requirement: 系統 SHALL 支援管理員設定「每 N 秒」間隔自動發言排程
系統 SHALL 允許管理員新增 `repeat: interval` 的聊天室排程，並指定正整數
`intervalSeconds`（須介於伺服器定義的上下限內）。此類排程 SHALL 在新增後依間隔週期
以「管理者: 排程」名義重複發送，直到管理員刪除為止；MUST NOT 因心跳週期短於間隔
而在同一間隔視窗內重複觸發。`daily`／`once` 排程行為 MUST 維持不變。

#### Scenario: 間隔排程到點重複發送
- **WHEN** 一筆 `repeat: interval`、`intervalSeconds: N` 的排程，距上次發送（或建立時間）已滿 N 秒
- **THEN** 系統發送一則「管理者: 排程」訊息並廣播，該排程仍保留在清單中供下次間隔觸發

#### Scenario: 同一間隔視窗內心跳多次不重複發送
- **WHEN** 心跳循環在距上次發送未滿 `intervalSeconds` 內對同一筆 interval 排程呼叫多次 `tick()`
- **THEN** 該排程 MUST NOT 再次廣播訊息

#### Scenario: 間隔秒數超出允許範圍
- **WHEN** 管理員新增 interval 排程但 `intervalSeconds` 非整數、小於下限或大於上限
- **THEN** 系統回傳驗證錯誤，MUST NOT 建立該排程

#### Scenario: 後台可設定並顯示間隔排程
- **WHEN** 管理員在排程面板選擇「間隔」並輸入秒數後新增成功
- **THEN** 列表顯示該訊息與「每 N 秒」標示，且不依賴固定 HH:mm 時間欄位
