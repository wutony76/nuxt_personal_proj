## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／towerStack 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／堆疊方塊完全沒有重疊）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: TOWER STACK 完全沒有重疊時結束並寫入紀錄
- **WHEN** 玩家落下的方塊與塔頂現有層完全沒有重疊（Overlap Detection 交集寬度為 0）
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'towerStack'` 的紀錄，`score` 為當下已累積的塔高基礎分＋Perfect／Combo 加成總和

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／towerStack SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: towerStack 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 towerStack 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: TOWER STACK SHALL 以一維水平區間交集判定重疊，並依交集結果縮減新層寬度
系統 SHALL 在方塊落下時，以新方塊的水平範圍與塔頂現有層的水平範圍計算交集寬度（Overlap Detection）；
當交集寬度大於 0 且未達 Perfect 判定時，系統 SHALL 將新層的寬度與位置設定為交集範圍（Block Resize），
且下一顆移動方塊的初始寬度 SHALL 沿用本次計算出的新層寬度，MUST NOT 沿用初始寬度或前一層縮減前的寬度。

#### Scenario: 位置偏移時新層寬度依交集縮減
- **WHEN** 玩家落下的方塊與塔頂現有層有部分重疊（交集寬度大於 0 且未達 Perfect 判定）
- **THEN** 系統將新層寬度設為交集寬度、位置設為交集起點，且下一顆移動方塊的初始寬度等於本次新層寬度

#### Scenario: 未重疊部分產生掉落碎片視覺
- **WHEN** 方塊落下後有部分區域未落入交集範圍
- **THEN** 系統為該未重疊部分建立一個掉落碎片物件，碎片 SHALL 隨 tick 更新下落位置，離開畫面或存在時間超過上限後 MUST NOT 再被渲染

### Requirement: TOWER STACK 完全沒有重疊時 SHALL 立即判定 Game Over
當方塊落下後計算出的交集寬度小於等於 0 時，系統 SHALL 立即結束遊戲，MUST NOT 允許塔身以零寬度或負寬度的層繼續疊放。

#### Scenario: 完全沒有重疊時立即結束遊戲
- **WHEN** 新方塊的水平範圍與塔頂現有層的水平範圍完全沒有交集
- **THEN** 系統立即將遊戲狀態切換為結束，MUST NOT 產生新的塔身層，且 MUST NOT 允許玩家繼續操作 Drop

### Requirement: TOWER STACK SHALL 提供 Perfect 判定與 Combo 機制
當新方塊與塔頂現有層的偏移量在 `perfectThreshold` 範圍內時，系統 SHALL 判定為 Perfect：維持新層原始寬度（不縮減、不產生掉落碎片）、Combo 計數加一、並給予額外加分；
當疊放結果為非 Perfect 的成功疊放（交集寬度大於 0 但超出 `perfectThreshold`）時，系統 SHALL 將 Combo 計數重置為 0。

#### Scenario: 幾乎完全重疊判定為 Perfect 並維持寬度
- **WHEN** 新方塊與塔頂現有層的偏移量在 `perfectThreshold` 範圍內
- **THEN** 系統將新層寬度維持與塔頂現有層相同，MUST NOT 產生掉落碎片，Combo 計數加一，並給予高於一般疊放的額外分數

#### Scenario: 非 Perfect 疊放中斷 Combo 連續紀錄
- **WHEN** 玩家在 Combo 計數大於 0 時，完成一次交集寬度大於 0 但偏移超出 `perfectThreshold` 的疊放
- **THEN** 系統將 Combo 計數重置為 0，本次疊放不給予 Perfect 額外加分

### Requirement: TOWER STACK Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置塔身層陣列、移動方塊、掉落碎片、Combo 計數、分數與方塊移動速度，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後塔身與方塊皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新進入初始狀態，塔身層陣列為空、移動方塊寬度回到初始值、掉落碎片陣列清空，分數與 Combo 計數歸零，方塊移動速度回到初始 `blockSpeed`
