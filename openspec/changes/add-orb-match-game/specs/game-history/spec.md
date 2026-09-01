## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷／敵機隊形觸底／牌局完成或玩家主動結束／單字漏接導致生命值歸零／球掉出底部導致生命值歸零／整場倒數歸零）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: ORB MATCH 整場倒數歸零
- **WHEN** ORB MATCH 的整場倒數（90 秒）歸零
- **THEN** 系統寫入一筆 `gameKey: 'orbMatch'` 的紀錄，`score` 為當局累計分數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: orbMatch 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 orbMatch 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: ORB MATCH SHALL 支援連續拖曳跨格交換珠子
玩家按住任一珠子後，SHALL 能連續拖曳跨越多格；拖曳路徑經過的每一格 SHALL 依序與目前手上的珠子交換位置；拖曳過程中 MUST NOT 檢查或觸發消除。

#### Scenario: 拖曳跨越多格
- **WHEN** 玩家按住一顆珠子並連續拖曳經過 3 個以上不同格子
- **THEN** 系統依序將珠子與經過的每一格交換位置，盤面即時反映交換結果

#### Scenario: 拖曳中暫時排出連線不會消除
- **WHEN** 玩家拖曳過程中盤面暫時出現 3 個以上同色連線，但玩家尚未放開手指
- **THEN** 系統 MUST NOT 立即消除該連線，僅在放開手指或拖曳倒數歸零時才統一結算

### Requirement: ORB MATCH SHALL 限制單次拖曳時間，逾時自動結算
玩家拿起珠子後 SHALL 有固定秒數（5 秒）可以拖曳；拖曳倒數歸零時，系統 SHALL 自動視為玩家放開手指，並統一掃描結算目前盤面。

#### Scenario: 拖曳倒數歸零自動結算
- **WHEN** 玩家持續拖曳超過 5 秒未放開手指
- **THEN** 系統自動結算目前盤面，比照玩家主動放開手指的行為

### Requirement: ORB MATCH 放開手指時 SHALL 統一掃描消除並套用連鎖
玩家放開手指（或拖曳倒數歸零）時，系統 SHALL 掃描盤面是否存在 3 個以上同色連線；若存在，SHALL 消除該連線、依連鎖輪數套用加分倍率、由上往下補齊新珠子，並重複掃描直到沒有新的連線為止。

#### Scenario: 放開手指觸發消除與連鎖
- **WHEN** 玩家放開手指時盤面存在 3 個以上同色連線
- **THEN** 系統消除該連線並得分；若補齊後又形成新的連線，系統 SHALL 繼續消除並依連鎖輪數提高加分倍率

#### Scenario: 放開手指時盤面沒有連線
- **WHEN** 玩家放開手指時盤面不存在任何 3 個以上同色連線
- **THEN** 系統 MUST NOT 消除任何珠子、MUST NOT 增加分數，盤面維持拖曳後的最終狀態

### Requirement: ORB MATCH SHALL 採整場限時制，時間到強制結算
玩家 SHALL 有固定秒數（90 秒）的整場遊戲時間；時間內 SHALL 能拖曳任意多次；時間歸零時，系統 SHALL 判定遊戲結束並依目前分數結算，即使玩家當下正在拖曳中。

#### Scenario: 整場時間歸零時正在拖曳
- **WHEN** 整場倒數歸零，且玩家當下正在拖曳珠子
- **THEN** 系統先結算目前盤面的拖曳結果，再判定遊戲結束並依最終分數寫入紀錄
