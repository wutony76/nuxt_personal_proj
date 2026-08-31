## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: PAC-MAN 命數歸零
- **WHEN** 玩家的命數（生命值）歸零
- **THEN** 系統立即結束整場遊戲，寫入一筆 `gameKey: 'pacman'` 的紀錄，`score` 為跨關卡累加的總分，`level` 為本局抵達的最高關卡數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: pacman 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 pacman 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: PAC-MAN 鬼魂 AI 難度 SHALL 依目前關卡數分三層遞增
系統 SHALL 依「目前關卡數」決定 4 隻鬼魂的 AI 決策邏輯層級：第 1–2 關為簡化層（共用貪心追擊＋路口隨機）；
第 3–4 關為中等層（4 隻鬼魂各自套用固定性格）；第 5 關以上為高擬真層（沿用中等層性格並加上 scatter/chase 交替）。
第 5 關以上 MUST NOT 再新增或加深 AI 決策邏輯，僅 SHALL 透過整體移動速度遞增呈現後續關卡的難度提升。

#### Scenario: 第 1 關鬼魂行為為簡化層
- **WHEN** 玩家在第 1 關或第 2 關遊玩
- **THEN** 4 隻鬼魂 SHALL 共用同一套貪心追擊＋路口隨機邏輯，移動頻率為玩家的一半

#### Scenario: 第 3 關鬼魂行為切換為中等層
- **WHEN** 玩家進入第 3 關或第 4 關
- **THEN** 4 隻鬼魂 SHALL 各自依固定性格決定目標（直接追擊／預判包抄／側翼夾擊／怕生迴避），移動頻率與玩家相同

#### Scenario: 第 5 關以上鬼魂行為為高擬真層，且之後不再加深
- **WHEN** 玩家進入第 5 關或以上
- **THEN** 4 隻鬼魂 SHALL 在中等層性格的基礎上加入 scatter／chase 交替行為；第 6 關及以後 MUST NOT 再改變 AI 決策邏輯，僅 SHALL 以更快的移動速度呈現難度提升

### Requirement: PAC-MAN SHALL 支援驚嚇模式與吃鬼連鎖加分
玩家吃到大力丸時，系統 SHALL 讓所有非「已被吃」狀態的鬼魂進入驚嚇（逃跑）狀態一段時間；
驚嚇狀態下玩家 SHALL 能吃掉鬼魂並獲得分數，連續吃鬼 SHALL 依 200／400／800／1600 倍增計分，
吃到下一顆大力丸 SHALL 重置倍增計數。

#### Scenario: 吃大力丸後可反殺鬼魂
- **WHEN** 玩家吃到大力丸後，在驚嚇時間內與一隻驚嚇狀態的鬼魂重疊
- **THEN** 系統判定為吃掉該鬼魂並獲得對應分數，該鬼魂 SHALL 立即轉為返回出生點的狀態，不扣玩家生命

#### Scenario: 連續吃鬼分數倍增
- **WHEN** 玩家在同一次驚嚇時間內連續吃掉第 2 隻鬼魂
- **THEN** 該次吃鬼分數 SHALL 為第 1 次的兩倍（依 200/400/800/1600 序列遞增）

### Requirement: PAC-MAN 過關與計分 SHALL 為開放式無上限，跨關卡累加
玩家吃光當前迷宮所有豆子與大力丸時，系統 SHALL 進入下一關（重置迷宮豆子與所有角色位置，分數與命數延續）；
關卡數與分數 MUST NOT 設有上限，直到玩家命數歸零為止。

#### Scenario: 過關後分數與命數延續
- **WHEN** 玩家吃光當前關卡所有豆子與大力丸
- **THEN** 系統進入下一關，玩家的累加分數與剩餘命數 SHALL 維持不變，迷宮的豆子與大力丸 SHALL 重新佈滿

#### Scenario: 關卡數沒有上限
- **WHEN** 玩家持續破關且尚未命數歸零
- **THEN** 系統 SHALL 持續生成下一關，MUST NOT 因關卡數達到某個固定值而強制結束遊戲
