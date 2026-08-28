## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: MINESWEEPER 踩到地雷
- **WHEN** 玩家在任一關翻開了地雷格
- **THEN** 系統立即結束整場遊戲，寫入一筆 `gameKey: 'minesweeper'` 的紀錄，`score` 為已過關卡的分數加總

#### Scenario: MINESWEEPER 5 關全破
- **WHEN** 玩家依序通過第 5 關（最後一關）
- **THEN** 系統寫入一筆 `gameKey: 'minesweeper'` 的紀錄，`score` 為 5 關分數加總

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: minesweeper 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 minesweeper 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: MINESWEEPER SHALL 採 5 關固定關卡制，過關才能進入下一關
系統 SHALL 提供固定 5 個關卡，難度（棋盤大小、地雷數）依序遞增；玩家 SHALL 只能依序從第 1 關開始，
成功清除當前關卡（翻開所有非地雷格）才會進入下一關；任一關踩到地雷 SHALL 立即結束整場遊戲，
MUST NOT 提供跳關或重試單一關卡的機制。

#### Scenario: 清除第 1 關進入第 2 關
- **WHEN** 玩家翻開第 1 關所有非地雷格
- **THEN** 系統計入第 1 關的分數，並生成第 2 關的棋盤讓玩家繼續

#### Scenario: 踩雷立即結束整場
- **WHEN** 玩家在任一關翻開地雷格
- **THEN** 系統立即結束遊戲，MUST NOT 允許玩家繼續操作該關或重新開始該關

### Requirement: MINESWEEPER 首次翻格 SHALL 保證安全，地雷佈局延後生成
系統 SHALL 在玩家對某一關第一次翻格之前不生成地雷佈局；第一次翻格後，
系統 SHALL 排除該格與其相鄰 8 格後，於剩餘格子中隨機佈置地雷。

#### Scenario: 第一次翻格必不是地雷
- **WHEN** 玩家對一個全新關卡進行第一次翻格
- **THEN** 系統保證該格與其相鄰 8 格皆不是地雷

### Requirement: MINESWEEPER 分數 SHALL 依關卡耗時反向計算，耗時越短分數越高
每一關的分數 SHALL 依「基礎分 － 花費秒數 × 每秒扣分」計算，並以該關保底分為下限；
整場最終分數 SHALL 為已成功清除關卡的分數加總。

#### Scenario: 更快清除關卡得到更高分數
- **WHEN** 玩家清除同一關卡所花費的秒數較少
- **THEN** 該關計入的分數較高（在保底分與基礎分之間）

#### Scenario: 耗時過長分數以保底分計算
- **WHEN** 玩家清除某一關所花費的秒數，依公式計算的分數低於該關保底分
- **THEN** 系統以該關保底分計入分數，不會低於保底分

### Requirement: MINESWEEPER SHALL 支援翻格與插旗兩種操作，並提供觸控替代方案
玩家 SHALL 能以左鍵／點擊翻開格子，以右鍵標記／取消標記疑似地雷的旗子；
系統 SHALL 額外提供「插旗模式」切換，開啟後一般點擊 SHALL 視為插旗操作而非翻格。

#### Scenario: 右鍵插旗
- **WHEN** 玩家對未翻開的格子按右鍵
- **THEN** 系統標記該格為旗子，且 MUST NOT 觸發瀏覽器原生右鍵選單

#### Scenario: 插旗模式下點擊格子
- **WHEN** 玩家開啟「插旗模式」後點擊未翻開的格子
- **THEN** 系統標記／取消標記該格為旗子，MUST NOT 翻開該格
