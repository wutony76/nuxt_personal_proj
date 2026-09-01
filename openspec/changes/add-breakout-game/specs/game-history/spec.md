## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷／敵機隊形觸底／牌局完成或玩家主動結束／單字漏接導致生命值歸零／球掉出底部導致生命值歸零）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: BREAKOUT 生命值歸零
- **WHEN** 玩家操作 BREAKOUT 的剩餘生命值歸零（球掉出畫面底部達 3 次）
- **THEN** 系統寫入一筆 `gameKey: 'breakout'` 的紀錄，`score` 為當局累計分數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: breakout 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 breakout 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: BREAKOUT 球 SHALL 依撞擊相對位置決定反彈角度
球碰到牆壁（左／右／頂）時，SHALL 將對應軸的速度分量反向；球碰到 Paddle 時，SHALL 依球與 Paddle 中心的相對水平位置決定反彈後的水平速度方向與幅度，而非單純鏡面反射。

#### Scenario: 球碰到牆壁反彈
- **WHEN** 球的位置到達畫面左側、右側或頂端邊界
- **THEN** 系統將球對應軸（水平或垂直）的速度分量反向

#### Scenario: 球碰到 Paddle 依位置反彈
- **WHEN** 球碰到 Paddle 且撞擊點偏離 Paddle 中心
- **THEN** 系統依偏離方向與幅度調整球反彈後的水平速度，偏離越多水平反彈角度越大

### Requirement: BREAKOUT 球碰到磚塊 SHALL 摧毀該磚塊並依撞擊面反彈
球與存活磚塊的碰撞範圍重疊時，系統 SHALL 摧毀該磚塊、依該磚塊所在列給予對應分數；並 SHALL 依重疊範圍判斷撞擊面（水平方向重疊較小視為撞擊左右側、垂直方向重疊較小視為撞擊上下側），將球對應軸的速度分量反向。同一時間點 MUST NOT 因單顆球同時處理多顆磚塊的碰撞。

#### Scenario: 球從上方或下方撞擊磚塊
- **WHEN** 球與磚塊的垂直方向重疊範圍小於水平方向重疊範圍
- **THEN** 系統摧毀該磚塊、加分，並將球的垂直速度分量反向

#### Scenario: 球從左右側撞擊磚塊
- **WHEN** 球與磚塊的水平方向重疊範圍小於垂直方向重疊範圍
- **THEN** 系統摧毀該磚塊、加分，並將球的水平速度分量反向

#### Scenario: 磚塊為單次擊破
- **WHEN** 球碰到任一存活磚塊
- **THEN** 系統直接摧毀該磚塊，MUST NOT 要求同一磚塊被擊中多次才摧毀

### Requirement: BREAKOUT SHALL 採關卡制，清光當前關卡全部磚塊即進入下一關
系統 SHALL 依固定關卡陣列生成每一關的磚塊佈局；當目前關卡的存活磚塊數量為 0 時，系統 SHALL 判定過關，載入下一關的磚塊佈局，並將球與 Paddle 重置到初始位置等待玩家重新發球。過關時累積分數與生命值 MUST NOT 被重置。

#### Scenario: 清光磚塊進入下一關
- **WHEN** 玩家擊破目前關卡的最後一顆存活磚塊
- **THEN** 系統判定過關，載入下一關的磚塊佈局，球與 Paddle 重置到初始位置

#### Scenario: 過關不重置分數與生命值
- **WHEN** 玩家從某一關過關進入下一關
- **THEN** 系統保留玩家目前的累積分數與剩餘生命值，不歸零

### Requirement: BREAKOUT SHALL 提供發球機制，球在玩家觸發前不進入物理模擬
系統 SHALL 在遊戲開始、球掉出畫面重置、或過關重置後，將球固定於 Paddle 正上方且不隨時間移動；僅當玩家觸發發球操作（例如按下空白鍵）時，系統 SHALL 賦予球初始速度並開始套用球物理。

#### Scenario: 遊戲開始球等待發球
- **WHEN** READY 倒數結束、進入 PLAYING 狀態
- **THEN** 球固定顯示於 Paddle 正上方，不會自行開始移動

#### Scenario: 玩家觸發發球
- **WHEN** 玩家在球尚未發射的狀態下按下發球操作
- **THEN** 系統賦予球初始速度，球開始依物理規則移動

### Requirement: BREAKOUT SHALL 採生命值機制，球掉出畫面底部扣血，命數歸零才判定遊戲結束
玩家 SHALL 擁有 3 條命；球的位置超出畫面底部邊界時，系統 SHALL 扣除玩家 1 條命，並將球與 Paddle 重置到初始位置等待重新發球；僅當生命值歸零時系統 SHALL 判定遊戲結束並依目前分數結算。

#### Scenario: 球掉出底部扣命但遊戲繼續
- **WHEN** 球的位置超出畫面底部邊界，且玩家剩餘生命大於 1
- **THEN** 系統扣除 1 條命，球與 Paddle 重置到初始位置，遊戲繼續進行

#### Scenario: 生命值歸零才結束遊戲
- **WHEN** 玩家的剩餘生命值因球掉出底部降為 0
- **THEN** 系統判定遊戲結束並依目前分數寫入紀錄
