## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／lightsOut 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／目前關卡步數超過上限仍未全部熄燈）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: LIGHTS OUT 步數用盡判定 Game Over
- **WHEN** 玩家在目前關卡的累計步數達到該關 `moveLimit`，但棋盤仍有 Cell 為 ON
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'lightsOut'` 的紀錄，`score` 為跨關累計的 `ClearBonus + EfficiencyScore` 加總

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／lightsOut SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: lightsOut 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 lightsOut 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: LIGHTS OUT 點擊 Cell SHALL 同時切換自己與上下左右鄰格
系統 SHALL 讓玩家點擊棋盤上任一格時，將該格與其上／下／左／右四個方向的合法鄰格一起切換 ON/OFF 狀態（XOR 語意）；
點擊 MUST NOT 只切換被點擊的單一格，也 MUST NOT 影響對角方向的鄰格。

#### Scenario: 點擊中央格切換自己與四個方向鄰格
- **WHEN** 玩家點擊一個四周都有鄰格的 Cell
- **THEN** 系統將該 Cell 與其上、下、左、右共 5 格的 ON/OFF 狀態全部切換一次，其餘 Cell（含對角格）狀態不變

### Requirement: LIGHTS OUT 超出棋盤範圍的鄰居 SHALL 被忽略
系統 SHALL 在計算點擊格的鄰格時，排除任何超出棋盤邊界的座標；
超出邊界的鄰居 MUST NOT 被切換，也 MUST NOT 產生錯誤或例外。

#### Scenario: 點擊邊角格只切換棋盤內存在的鄰格
- **WHEN** 玩家點擊棋盤的四個角落其中一格（只有 2 個合法方向鄰格）
- **THEN** 系統只切換該格本身與棋盤範圍內存在的鄰格，超出棋盤的方向 MUST NOT 產生任何切換效果

### Requirement: LIGHTS OUT 全部 Cell 為 OFF SHALL 判定過關並進入下一關
當棋盤上所有 Cell 皆為 OFF 時，系統 SHALL 立即判定本關過關，顯示過關提示，並在短暫延遲後進入下一關；
下一關 SHALL 依關卡資料表重新產生棋盤（棋盤大小可能變大、`moveLimit` 可能變少），本關的 `moves` SHALL 歸零重新計算。

#### Scenario: 全部熄燈判定過關並進入下一關
- **WHEN** 玩家的某次點擊讓棋盤上所有 Cell 皆變為 OFF
- **THEN** 系統顯示過關訊息，`level` 加一，棋盤依新關卡的資料表重建，`moves` 歸零

#### Scenario: 尚有 Cell 為 ON 時 MUST NOT 判定過關
- **WHEN** 玩家點擊後棋盤上仍有任何一個 Cell 為 ON
- **THEN** 系統 MUST NOT 判定過關、MUST NOT 進入下一關

### Requirement: LIGHTS OUT Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置棋盤、關卡（回到第 1 關）、Move Counter、分數與遊戲狀態，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後回到第 1 關的初始狀態
- **WHEN** 玩家在遊戲進行中或 Game Over 後觸發 Restart
- **THEN** 系統重新進入第 1 關的初始棋盤，`moves` 與 `score` 皆歸零，`status` 回到 `'playing'`

### Requirement: LIGHTS OUT MUST NOT 提供 Undo 功能
本次（MVP）系統 MUST NOT 提供復原上一步 Toggle 操作的功能；
Undo 為第二階段項目，本次 UI 上 MUST NOT 出現任何 Undo 按鈕或快捷鍵。

#### Scenario: 畫面上不存在 Undo 操作入口
- **WHEN** 玩家在 LIGHTS OUT 遊戲進行中尋找復原上一步的方式
- **THEN** 畫面 MUST NOT 提供任何 Undo 按鈕、選單項目或快捷鍵
