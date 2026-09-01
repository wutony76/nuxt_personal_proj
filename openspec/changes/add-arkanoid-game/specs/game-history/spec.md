## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／arkanoid 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／清除全部關卡磚塊或生命值歸零）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: ARKANOID 生命值歸零結束遊戲
- **WHEN** 玩家的 `lives` 歸零（`balls.length === 0` 且無剩餘生命可重新發球）
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'arkanoid'` 的紀錄，`score` 為當下累積的基礎分數＋Multi-Hit 加成＋Combo 倍率加總

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／arkanoid SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: arkanoid 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 arkanoid 與其他任一款遊戲（含 breakout）
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: ARKANOID Multi-Hit Brick SHALL 依 `hitPoints` 遞減判定摧毀
系統 SHALL 為部分磚塊指定 `hitPoints`（大於 1）；球每次擊中該磚塊 SHALL 使 `hitPoints` 遞減 1，
磚塊 MUST NOT 在 `hitPoints` 大於 0 時被視為摧毀或移出場地；僅當 `hitPoints` 遞減至 0 時，系統 SHALL 摧毀該磚塊並給予對應分數。

#### Scenario: 磚塊尚有剩餘 hitPoints 時維持存在
- **WHEN** 球擊中一個 `hitPoints` 為 2 的磚塊
- **THEN** 系統將該磚塊 `hitPoints` 遞減為 1，磚塊 MUST NOT 被摧毀，僅切換視覺樣式

#### Scenario: 磚塊 hitPoints 歸零時摧毀
- **WHEN** 一個 `hitPoints` 為 1 的磚塊被球擊中
- **THEN** 系統將該磚塊摧毀、給予對應分數，並觸發碎屑視覺效果

### Requirement: ARKANOID Moving Brick 移動 MUST NOT 超出自身所屬欄位範圍或與其他磚塊重疊
被標記為可移動的磚塊 SHALL 在系統預先計算的 `minX`／`maxX` 範圍內來回移動，
移動過程 MUST NOT 使該磚塊與任何其他磚塊的位置重疊，MUST NOT 超出磚塊區域邊界。

#### Scenario: 移動磚塊到達邊界時反向
- **WHEN** 一個移動中磚塊的座標到達其 `minX` 或 `maxX`
- **THEN** 系統將該磚塊的移動方向反向，磚塊 MUST NOT 越過該邊界

### Requirement: ARKANOID Power-Up SHALL 於擋板接住後依類型生效，MUST NOT 需要額外操作觸發
磚塊被摧毀時系統 SHALL 有機率掉落 Power-Up 膠囊（本次僅 `WIDE`／`MULTI_BALL`／`SLOW` 三種）；
擋板接住膠囊時系統 SHALL 立即依類型生效：`WIDE`／`SLOW` SHALL 為限時效果，`MULTI_BALL` SHALL 為即時效果；
玩家 MUST NOT 需要額外按鍵或操作才能使 Power-Up 生效；膠囊落到場地底部未被接住時 MUST NOT 影響生命值。

#### Scenario: 擋板接住 WIDE 膠囊後擋板暫時變寬
- **WHEN** 擋板碰到掉落中的 `WIDE` 膠囊
- **THEN** 系統立即放大擋板寬度並開始倒數，倒數結束後擋板恢復原始寬度

#### Scenario: 擋板接住 MULTI_BALL 膠囊後立即分裂出新球
- **WHEN** 擋板碰到掉落中的 `MULTI_BALL` 膠囊，且目前 `balls.length` 未達上限
- **THEN** 系統立即為每顆存活的球各自複製一顆新球加入 `balls` 陣列，MUST NOT 等待任何額外觸發

#### Scenario: 膠囊未被接住不影響生命值
- **WHEN** 掉落中的 Power-Up 膠囊未被擋板接住、落到場地底部
- **THEN** 系統移除該膠囊，MUST NOT 扣除生命值或產生任何懲罰

### Requirement: ARKANOID Multi Ball 存在時，MUST NOT 在仍有球存活時判定失去一命
當 `balls` 陣列中同時存在多顆球時，系統 SHALL 僅在 `balls.length` 歸零（所有球皆已離開場地）時才判定玩家失去一命；
MUST NOT 因單一顆球離開場地、但陣列中仍有其他球存活時就扣除生命值。

#### Scenario: 部分球離開場地但仍有球存活時不扣命
- **WHEN** `balls` 陣列中有 2 顆球，其中 1 顆離開場地底部
- **THEN** 系統將該顆球從 `balls` 陣列移除，MUST NOT 扣除生命值，遊戲繼續進行

#### Scenario: 所有球都離開場地時判定失去一命
- **WHEN** `balls` 陣列中最後一顆球離開場地底部，使 `balls.length` 歸零
- **THEN** 系統扣除一命，若尚有剩餘生命則重新發球，若生命歸零則結束遊戲

### Requirement: ARKANOID Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置擋板寬度、`balls` 陣列、磚塊（含 `hitPoints` 與 Moving Brick 位置）、
生效中的 Power-Up 效果與倒數、分數、關卡、生命與 Combo 計數，MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後所有狀態回到初始值
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新進入初始關卡，擋板恢復原始寬度、`balls` 陣列僅剩 1 顆初始球、所有磚塊恢復初始 `hitPoints`、Power-Up 效果全部清除、分數與 Combo 歸零
