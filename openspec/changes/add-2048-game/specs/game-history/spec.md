## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／2048 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／棋盤填滿且四方向皆無法移動或合併）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: 2048 棋盤無法再移動時記錄一筆紀錄
- **WHEN** 2048 棋盤已填滿 16 格，且上下左右四個方向皆無法再移動或合併
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: '2048'` 的紀錄，`score` 為本局所有合併事件的合併後數值加總

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／2048 SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: 2048 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 2048 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: 2048 SHALL 於相鄰同值 Tile 碰撞時合併，且同一次移動每格僅合併一次
系統 SHALL 在玩家觸發任一方向移動時，將該方向上相鄰且數值相同的 Tile 合併為一個數值加倍的新 Tile；
同一次移動中，由合併產生的新 Tile MUST NOT 再與下一個相鄰 Tile 進行第二次合併。

#### Scenario: 兩個相同數值的 Tile 合併
- **WHEN** 玩家觸發移動，且移動方向上有兩個相鄰且數值相同的 Tile（例如兩個 `4`）
- **THEN** 系統將其合併為一個數值 `8` 的新 Tile，並將 `8` 加總進本局分數

#### Scenario: 一次移動中禁止連鎖二次合併
- **WHEN** 移動方向上排列為 `[2, 2, 2, 2]`
- **THEN** 系統的合併結果為 `[4, 4]`，MUST NOT 產生 `[8]`（即合併後的 `4` MUST NOT 再與另一個合併後的 `4` 於同一次移動中繼續合併）

### Requirement: 2048 SHALL 僅在有效移動後於隨機空格產生新 Tile，數值 2 機率 90%、數值 4 機率 10%
系統 SHALL 僅在玩家觸發的移動造成棋盤至少一格位置或數值改變時，於棋盤所有空格中隨機選擇一格產生新 Tile，
新 Tile 數值 SHALL 有 90% 機率為 `2`、10% 機率為 `4`；
若該次移動未造成棋盤任何變化，系統 MUST NOT 產生新 Tile、MUST NOT 消耗回合。

#### Scenario: 有效移動後產生新 Tile
- **WHEN** 玩家觸發的移動造成至少一個 Tile 的位置或數值改變
- **THEN** 系統在移動結算後，於任一空格新增一個數值為 `2` 或 `4` 的新 Tile

#### Scenario: 無效移動不產生新 Tile
- **WHEN** 玩家觸發移動的方向上所有 Tile 皆已靠齊、無任何格子可移動或合併
- **THEN** 系統 MUST NOT 新增任何 Tile，且不將此次操作計入有效移動

### Requirement: 2048 SHALL 支援 Touch Swipe 手勢，依 pointerdown 至 pointerup 的座標差量判斷滑動方向
系統 SHALL 在棋盤容器記錄 `pointerdown` 時的起點座標，並在 `pointerup` 時計算與起點的座標差量，
取水平與垂直差量絕對值較大的一軸判斷滑動方向；當座標差量絕對值的最大值低於判定閾值時，系統 MUST NOT 觸發任何方向移動。

#### Scenario: 水平滑動距離足夠時觸發左右移動
- **WHEN** 玩家從 `pointerdown` 到 `pointerup` 的水平座標差量絕對值大於閾值，且大於垂直座標差量絕對值
- **THEN** 系統依水平差量的正負號觸發向左或向右移動

#### Scenario: 垂直滑動距離足夠時觸發上下移動
- **WHEN** 玩家從 `pointerdown` 到 `pointerup` 的垂直座標差量絕對值大於閾值，且大於水平座標差量絕對值
- **THEN** 系統依垂直差量的正負號觸發向上或向下移動

#### Scenario: 滑動距離不足時視為點按，不觸發移動
- **WHEN** 玩家從 `pointerdown` 到 `pointerup` 的水平與垂直座標差量絕對值皆低於判定閾值
- **THEN** 系統 MUST NOT 觸發任何方向的移動

### Requirement: 2048 達成時 SHALL 顯示勝利提示但不強制結束遊戲
系統 SHALL 在棋盤上任一 Tile 數值達到 `2048` 時，顯示一次性的勝利提示；
達成 2048 之後，系統 MUST NOT 強制結束遊戲，玩家 SHALL 可以選擇繼續進行或重新開始。

#### Scenario: 首次合成 2048 顯示勝利提示
- **WHEN** 玩家的移動造成棋盤上出現一個數值為 `2048` 的 Tile
- **THEN** 系統顯示勝利提示，並提供「繼續遊戲」與「重新開始」兩種選項

#### Scenario: 選擇繼續遊戲後可持續操作
- **WHEN** 玩家在勝利提示中選擇繼續遊戲
- **THEN** 系統關閉提示並允許玩家繼續移動棋盤，直到之後真正無法移動為止才結束

### Requirement: 2048 Game Over SHALL 依「棋盤填滿且四方向皆無法移動或合併」判定
系統 SHALL 在棋盤所有格子皆已被 Tile 佔滿、且上下左右四個方向皆不存在可移動或可合併的情形時，判定 Game Over 並立即結束遊戲；
只要棋盤仍有空格，或任一方向存在可移動/可合併的情形，系統 MUST NOT 判定遊戲結束。

#### Scenario: 棋盤填滿且無法移動時判定 Game Over
- **WHEN** 棋盤 16 格皆有 Tile，且四個方向皆無法造成任何位置或數值改變
- **THEN** 系統判定 Game Over 並結束遊戲

#### Scenario: 棋盤填滿但仍有可合併格時不判定 Game Over
- **WHEN** 棋盤 16 格皆有 Tile，但至少存在一組相鄰且數值相同的 Tile
- **THEN** 系統 MUST NOT 判定遊戲結束

### Requirement: 2048 Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置棋盤、分數、Tile id 計數器、勝利提示狀態與 GameState，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後棋盤與分數皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新產生一個僅含初始 Tile 的空棋盤，分數歸零，且勝利提示狀態重置為未達成
