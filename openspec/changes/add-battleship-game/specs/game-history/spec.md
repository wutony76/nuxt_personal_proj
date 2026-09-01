## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: BATTLESHIP 玩家獲勝
- **WHEN** 玩家將 AI 的所有戰艦全部擊沉
- **THEN** 系統立即結束遊戲並顯示 `YOU WIN`，寫入一筆 `gameKey: 'battleship'` 的紀錄，`score` 為固定值 1729（17 格 HIT + 5 艘 SUNK + WIN 加總）

#### Scenario: BATTLESHIP 玩家落敗
- **WHEN** AI 將玩家的所有戰艦全部擊沉
- **THEN** 系統立即結束遊戲並顯示 `YOU LOSE`，寫入一筆 `gameKey: 'battleship'` 的紀錄，`score` 為玩家落敗當下已累積的 HIT/SUNK 分數加總（無 WIN 加成）

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: battleship 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 battleship 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: BATTLESHIP SHALL 提供 10×10 雙棋盤，敵方未攻擊格 MUST NOT 顯示船隻位置
系統 SHALL 為玩家與 AI 各自建立一個 10×10 棋盤；玩家 SHALL 能看到自己棋盤上的完整船隻位置與被攻擊結果，
但敵方棋盤 MUST NOT 顯示尚未被攻擊格子的船隻位置；當敵方某艘船被擊沉後，系統 SHALL 顯示該船的完整船身位置。

#### Scenario: 敵方未攻擊格看不到船
- **WHEN** 玩家查看敵方棋盤上尚未攻擊過的格子
- **THEN** 即使該格底下有敵方戰艦，畫面 MUST NOT 顯示任何船隻標記

#### Scenario: 戰艦被擊沉後顯示完整船身
- **WHEN** 某艘敵方戰艦的所有格子都被擊中（`hits === length`）
- **THEN** 系統在敵方棋盤上顯示該船的完整船身位置

### Requirement: BATTLESHIP 佈局階段 SHALL 採零拖曳的點擊式流程，5 種戰艦共 17 格
系統 SHALL 提供 5 種戰艦（Carrier=5／Battleship=4／Cruiser=3／Submarine=3／Destroyer=2，共 17 格）；
玩家 SHALL 以「選取戰艦→切換方向→點擊棋盤格預覽→再次點擊確認」的方式完成佈局，
系統 MUST NOT 要求或提供拖曳（drag-and-drop）操作；戰艦 MUST NOT 超出棋盤或與其他已放置戰艦重疊，
但 SHALL 允許戰艦彼此相鄰。

#### Scenario: 點擊完成一艘戰艦的佈局
- **WHEN** 玩家選取一艘戰艦、選定方向後點擊棋盤上一個合法起始格
- **THEN** 系統將該戰艦放置於棋盤上，並自動選取下一艘尚未放置的戰艦

#### Scenario: 佈局預覽超出棋盤時標示為非法
- **WHEN** 玩家選定的起始格與方向會讓戰艦的任何一格超出 10×10 棋盤範圍
- **THEN** 系統顯示紅色（非法）預覽，且點擊該格 MUST NOT 完成放置

#### Scenario: 佈局預覽與既有戰艦重疊時標示為非法
- **WHEN** 玩家選定的起始格與方向會讓戰艦與任何已放置戰艦的格子重疊
- **THEN** 系統顯示紅色（非法）預覽，且點擊該格 MUST NOT 完成放置

#### Scenario: 允許戰艦彼此相鄰
- **WHEN** 玩家將一艘戰艦放置在與另一艘已放置戰艦緊鄰、但沒有格子重疊的位置
- **THEN** 系統視為合法佈局並允許放置

### Requirement: BATTLESHIP AI SHALL 自動完成佈局且不對玩家顯示
系統 SHALL 在 PLACEMENT 階段自動為 AI 隨機佈局 5 種戰艦，佈局邏輯 SHALL 與玩家佈局共用相同的合法性驗證規則（不超界、不重疊、允許相鄰）；
AI 的戰艦位置在 BATTLE 階段開始前 MUST NOT 顯示給玩家。

#### Scenario: AI 佈局合法且對玩家隱藏
- **WHEN** 玩家完成自己的佈局進入 READY
- **THEN** 系統確認 AI 已完成合法佈局（不超界、不重疊），且玩家在敵方棋盤上看不到任何 AI 戰艦位置

### Requirement: BATTLESHIP SHALL 採回合制攻擊，玩家與 AI 共用同一套攻擊判定規則
系統 SHALL 讓玩家先手，雙方輪流攻擊對方棋盤上的一格；玩家 SHALL 只能攻擊敵方棋盤、MUST NOT 攻擊己方棋盤；
攻擊結果 SHALL 判定為 `HIT`（該格有船）或 `MISS`（該格無船），玩家與 AI 的攻擊 SHALL 使用同一套判定邏輯；
已被攻擊過的格子 MUST NOT 再被選擇，且 MUST NOT 消耗回合。

#### Scenario: 玩家攻擊敵方有船的格子判定為 HIT
- **WHEN** 玩家選擇的座標底下有敵方戰艦
- **THEN** 系統回傳 `HIT`，該格狀態變為 `HIT`，對應戰艦的 `hits` 加一

#### Scenario: 玩家攻擊敵方無船的格子判定為 MISS
- **WHEN** 玩家選擇的座標底下沒有敵方戰艦
- **THEN** 系統回傳 `MISS`，該格狀態變為 `MISS`

#### Scenario: 重複攻擊已攻擊過的格子被阻擋
- **WHEN** 玩家或 AI 選擇一個先前已經是 `HIT` 或 `MISS` 狀態的格子
- **THEN** 系統 MUST NOT 執行任何攻擊判定、MUST NOT 消耗當前回合，並提示該格已被攻擊過

#### Scenario: 戰艦所有格子被命中後判定為 SUNK
- **WHEN** 某艘戰艦的 `hits` 等於其 `length`
- **THEN** 系統將該戰艦標記為 `sunk`，並顯示該戰艦的擊沉通知

### Requirement: BATTLESHIP AI 攻擊 SHALL 採隨機策略並延遲執行
AI 的回合 SHALL 從敵方（玩家）棋盤所有尚未攻擊的格子中隨機選擇一格進行攻擊；
系統 SHALL 在進入 AI 回合後延遲 500 至 1000 毫秒才執行攻擊，MUST NOT 立即完成。

#### Scenario: AI 從未攻擊格中隨機選擇目標
- **WHEN** 輪到 AI 攻擊
- **THEN** AI 選擇的座標 SHALL 是玩家棋盤上尚未被攻擊過的格子

#### Scenario: AI 回合有延遲
- **WHEN** 遊戲進入 AI 回合
- **THEN** 系統 SHALL 等待 500 至 1000 毫秒後才顯示 AI 的攻擊結果，MUST NOT 在同一影格內立即完成

### Requirement: BATTLESHIP 勝負 SHALL 依戰艦是否全滅判定
當任一方的全部戰艦皆為 `sunk` 狀態時，系統 SHALL 立即結束遊戲並判定勝負；
系統 MUST NOT 在雙方皆尚有存活戰艦時判定遊戲結束。

#### Scenario: 敵方戰艦全滅判定玩家獲勝
- **WHEN** AI 的 5 艘戰艦皆為 `sunk`
- **THEN** 系統顯示 `YOU WIN` 並結束遊戲

#### Scenario: 玩家戰艦全滅判定玩家落敗
- **WHEN** 玩家的 5 艘戰艦皆為 `sunk`
- **THEN** 系統顯示 `YOU LOSE` 並結束遊戲

### Requirement: BATTLESHIP Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置棋盤、戰艦、佈局狀態、攻擊歷史、回合狀態、分數與計時器，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後棋盤與船隻皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新進入 PLACEMENT 階段，雙方棋盤皆為空白、戰艦皆為未放置狀態，分數與回合數歸零
