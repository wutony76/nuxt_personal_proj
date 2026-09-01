## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／frogger 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／撞車或落水耗盡全部 Life）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: FROGGER Life 歸零結束遊戲
- **WHEN** 玩家的 Life 因撞車或落水而歸零
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'frogger'` 的紀錄，`score` 為玩家本局累計的 HOP/GOAL/LEVEL CLEAR 分數加總

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／frogger SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: frogger 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 frogger 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: FROGGER 車輛碰撞 SHALL 使玩家失去 1 條 Life
當玩家所在的道路（ROAD）格子與任一車輛目前佔用的格子重疊時，系統 SHALL 判定為撞車，玩家 Life SHALL 減少 1，
並將玩家重置回起點（HOME）位置；車輛佔用格 SHALL 以整數格判定，不做像素級碰撞。

#### Scenario: 玩家跳進車輛佔用格判定撞車
- **WHEN** 玩家按方向鍵跳進的格子當下正好被一輛車輛佔用
- **THEN** 系統立即判定撞車，Life 減少 1，並將玩家重置回起點

#### Scenario: 車輛移動經過靜止玩家判定撞車
- **WHEN** 玩家靜止在某道路格子上，車輛因連續移動而移動到該格
- **THEN** 系統在該次車輛移動的 tick 判定撞車，Life 減少 1，並將玩家重置回起點

### Requirement: FROGGER 河流落水判定 SHALL 在玩家所在格失去平台覆蓋時使玩家失去 1 條 Life
當玩家位於河流（RIVER）列且所在欄位當下沒有任何漂浮平台覆蓋時，系統 SHALL 判定為落水，玩家 Life SHALL 減少 1，
並將玩家重置回起點；落水判定 SHALL 同時涵蓋「玩家主動跳進無平台覆蓋的欄位」與「原本站立的平台移動離開、導致腳下淨空」兩種情境。

#### Scenario: 玩家跳進無平台覆蓋的河流欄位判定落水
- **WHEN** 玩家按方向鍵跳進的河流列欄位當下沒有任何平台覆蓋
- **THEN** 系統立即判定落水，Life 減少 1，並將玩家重置回起點

#### Scenario: 平台漂走導致玩家腳下淨空判定落水
- **WHEN** 玩家站在平台上，該平台因連續移動而漂離玩家所在欄位、且該欄位未被其他平台接手覆蓋
- **THEN** 系統在該次平台移動的 tick 判定落水，Life 減少 1，並將玩家重置回起點

### Requirement: FROGGER 平台跟隨移動 SHALL 使站立中的玩家隨平台一起水平位移
當玩家站在河流列的漂浮平台上且未落水時，玩家的欄位座標 SHALL 隨該平台的移動方向與速度持續更新，
玩家 MUST NOT 在平台移動時停留在原本的絕對欄位不動；若平台跟隨移動導致玩家欄位超出棋盤左右邊界，系統 SHALL 判定為落水。

#### Scenario: 玩家隨平台移動而改變欄位
- **WHEN** 玩家站在一個持續往右移動的平台上，經過數個 tick
- **THEN** 玩家的欄位座標 SHALL 依平台的方向與速度同步右移，而非停留在原欄位

#### Scenario: 平台跟隨移動將玩家帶出棋盤邊界判定落水
- **WHEN** 玩家隨平台移動到棋盤最右（或最左）欄位後，平台繼續朝棋盤外移動
- **THEN** 系統判定玩家落水，Life 減少 1，並將玩家重置回起點

### Requirement: FROGGER 到達終點 SHALL 依蓮花座命中判定，5 個蓮花座全部佔用視為完成一輪
終點列（GOAL）SHALL 提供 5 個固定欄位的蓮花座；玩家跳進尚未被佔用的蓮花座欄位時，系統 SHALL 將該蓮花座標記為已佔用、
給予 GOAL 分數，並將玩家重置回起點以進行下一趟；跳進終點列上非蓮花座欄位或已被佔用的蓮花座時，系統 SHALL 判定為落水並扣 1 條 Life；
當 5 個蓮花座皆已佔用時，系統 SHALL 判定完成一輪，難度依 Level 規則遞增（見難度遞增 Requirement）。

#### Scenario: 跳進未佔用的蓮花座
- **WHEN** 玩家跳進終點列上一個尚未被佔用的蓮花座欄位
- **THEN** 系統將該蓮花座標記為已佔用、給予 GOAL 分數，並將玩家重置回起點

#### Scenario: 跳進非蓮花座欄位或已佔用蓮花座判定落水
- **WHEN** 玩家跳進終點列上非蓮花座的欄位，或跳進一個已經被佔用的蓮花座欄位
- **THEN** 系統判定為落水，Life 減少 1，並將玩家重置回起點

#### Scenario: 5 個蓮花座全部佔用完成一輪並提升難度
- **WHEN** 終點列的 5 個蓮花座皆已被佔用
- **THEN** 系統給予 LEVEL CLEAR 分數、Level 加 1、所有車道與河道的速度／密度依新 Level 重新計算，並將 5 個蓮花座重置為未佔用狀態

### Requirement: FROGGER Life 歸零 SHALL 立即結束遊戲並進入 Game Over
當玩家的 Life 因撞車或落水扣減至 0（或以下）時，系統 SHALL 立即結束當前對局並顯示 `GAME OVER`，
MUST NOT 在 Life 歸零後允許玩家繼續移動或觸發任何進一步的計分/判定。

#### Scenario: Life 扣至 0 立即結束遊戲
- **WHEN** 玩家的 Life 因撞車或落水扣減後等於 0
- **THEN** 系統立即顯示 `GAME OVER`，停用玩家輸入與 NPC tick 的進一步計分/判定

### Requirement: FROGGER Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置 Grid（含所有車道與河道的實體位置）、玩家位置、蓮花座佔用狀態、Life、Score、Level 與 GameStatus，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後 Grid 與玩家皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統將玩家重置回起點、所有蓮花座重置為未佔用、所有車道與河道實體依 Level 1 設定重新產生、Life 回到初始值、Score 與 Level 歸零
