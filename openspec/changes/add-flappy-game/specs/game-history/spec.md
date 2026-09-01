## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／flappy 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／撞到管道或地面）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: FLAPPY 撞到管道或地面結束遊戲
- **WHEN** 玩家控制的角色撞到管道任一段或觸底（地面）
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'flappy'` 的紀錄，`score` 為本局通過的管道組數

#### Scenario: BATTLESHIP 玩家獲勝
- **WHEN** 玩家將 AI 的所有戰艦全部擊沉
- **THEN** 系統立即結束遊戲並顯示 `YOU WIN`，寫入一筆 `gameKey: 'battleship'` 的紀錄，`score` 為固定值 1729（17 格 HIT + 5 艘 SUNK + WIN 加總）

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／flappy SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: flappy 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 flappy 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: FLAPPY 角色 SHALL 持續受重力影響下墜，操作 SHALL 給予一次性向上衝力
系統 SHALL 讓玩家控制的角色每個 tick 持續受重力加速下墜；當玩家點擊、按下 Space 或觸控畫面時，
系統 SHALL 立即將角色的垂直速度設為固定的向上衝力值，MUST NOT 疊加先前殘留的向上速度；
沒有任何操作時，角色 MUST NOT 維持固定高度或停止下墜。

#### Scenario: 沒有操作時角色持續下墜
- **WHEN** 玩家在遊戲進行中沒有任何點擊／按鍵／觸控操作
- **THEN** 角色的垂直速度持續累加重力、垂直位置持續下降

#### Scenario: 操作觸發一次性向上衝力
- **WHEN** 玩家點擊、按下 Space 或觸控畫面
- **THEN** 系統立即將角色垂直速度設為固定的向上衝力值，角色開始上升

#### Scenario: 連續快速操作不會疊加速度飛出畫面
- **WHEN** 玩家在極短時間內連續多次觸發向上衝力
- **THEN** 角色垂直速度維持在單次向上衝力的固定值，MUST NOT 因連續觸發而持續疊加加速

### Requirement: FLAPPY SHALL 自動向右捲動並生成成對管道，通過管道空隙即得分
系統 SHALL 讓遊戲畫面自動持續向右捲動（管道相對角色向左移動）；系統 SHALL 定時生成成對管道（上管道與下管道，中間留有固定大小的空隙）；
當角色通過一組管道的空隙（該組管道尚未計分且已完全越過角色）時，系統 SHALL 將分數加一，且同一組管道 MUST NOT 被重複計分。

#### Scenario: 通過管道空隙正確加分
- **WHEN** 一組管道完全越過角色且尚未被計分
- **THEN** 系統將分數加一，並將該組管道標記為已計分

#### Scenario: 同一組管道不會被重複計分
- **WHEN** 已經被計分過的管道持續向左捲動並已離開畫面
- **THEN** 系統 MUST NOT 針對同一組管道再次加分

#### Scenario: 捲動速度隨分數提升但夾住上限
- **WHEN** 玩家分數持續提升
- **THEN** 系統將捲動速度隨分數提升，但 MUST NOT 超過預先設定的最高捲動速度上限

### Requirement: FLAPPY SHALL 判定角色與管道／地面的碰撞，撞到管道或地面即結束遊戲
系統 SHALL 判定角色矩形範圍是否與任一管道的上管道段或下管道段重疊，或角色是否觸及畫面底部（地面）；
任一條件成立時，系統 SHALL 立即結束遊戲；角色觸及畫面頂端 MUST NOT 判定為遊戲結束，系統 SHALL 將角色位置限制在畫面頂端範圍內。

#### Scenario: 撞到管道判定遊戲結束
- **WHEN** 角色矩形範圍與任一管道的上管道段或下管道段重疊
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`

#### Scenario: 觸底判定遊戲結束
- **WHEN** 角色垂直位置到達畫面底部（地面）
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`

#### Scenario: 撞頂不判定遊戲結束
- **WHEN** 角色垂直位置到達畫面頂端
- **THEN** 系統 MUST NOT 結束遊戲，改為將角色位置限制在畫面頂端範圍內

### Requirement: FLAPPY 遊戲結束時 SHALL 依當下分數判定並顯示結果，不影響已通過的計分
系統 SHALL 在遊戲結束當下，將目前已累積的分數（即已通過的管道組數）作為本局最終分數，
不因遊戲結束的觸發原因（撞管道／觸底）而調整或扣除已累積的分數。

#### Scenario: 遊戲結束時分數即為已通過管道組數
- **WHEN** 角色撞到管道或觸底導致遊戲結束
- **THEN** 系統顯示的本局分數等於結束當下已累積的通過管道組數，不做額外增減

### Requirement: FLAPPY Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置角色位置與垂直速度、管道陣列、分數、捲動速度與遊戲狀態，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後角色與管道皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統將角色重置到初始位置與零速度、清空所有管道、分數與捲動速度歸零，重新進入 READY 狀態
