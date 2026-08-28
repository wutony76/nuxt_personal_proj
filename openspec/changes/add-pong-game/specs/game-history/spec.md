## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: PONG 打滿選定局數
- **WHEN** 玩家在 PONG 選擇的局數（3／5／10）全部比賽完畢
- **THEN** 系統寫入一筆 `gameKey: 'pong'` 的紀錄，`score` 為玩家整場獲勝的局數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: pong 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 pong 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: PONG 的分數 SHALL 定義為玩家整場比賽的獲勝局數，而非單局內的來回比分
PONG 的 `score` SHALL 等於玩家在一場比賽中獲勝的局數（範圍 0 至該場選定的總局數），單局內的來回比分僅為
遊戲進行中的暫態顯示，MUST NOT 作為寫入 `useGameHistory` 的 `score`。

#### Scenario: 5 局制打完，玩家贏 3 局輸 2 局
- **WHEN** 玩家選擇 5 局制，最終在 5 局中獲勝 3 局
- **THEN** 系統寫入的紀錄 `score` 為 `3`，不是任何一局的來回比分加總

#### Scenario: 單局內來回比分不影響最終分數
- **WHEN** 某一局的來回比分為 5:4（玩家小分險勝）
- **THEN** 該局只計入玩家 `roundsWon` +1，不會把 5 或 4 這兩個數字寫入最終 `score`

### Requirement: 開局時玩家 SHALL 能選擇本場比賽的局數（3／5／10），且比賽 SHALL 打滿選定局數才結束
系統 SHALL 在 PONG 開局的 WELCOME 畫面提供 3／5／10 三種局數選項；一旦選定，本場比賽 SHALL 打滿該局數才進入結算，
MUST NOT 因任一方提前取得多數局勝場（如傳統 best-of-N 賽制）而提前結束。

#### Scenario: 選擇 3 局制，玩家首兩局全勝
- **WHEN** 玩家選擇 3 局制，且在前兩局都獲勝
- **THEN** 系統 MUST NOT 提前結束比賽，仍須完成第 3 局才進入最終結算

#### Scenario: 未選擇局數前無法開始比賽
- **WHEN** 玩家尚未在 WELCOME 畫面選擇局數選項
- **THEN** 系統 MUST NOT 開始任何一局的比賽

### Requirement: PONG 單局 SHALL 採定點賽制，先達目標分數者贏得該局
每一局 SHALL 由玩家與 CPU 各自的來回得分決定勝負，任一方來回得分先達到 `ROUND_POINT_TARGET`（初始值 5）
SHALL 視為贏得該局，並計入整場的 `roundsWon` 或 `roundsLost`。

#### Scenario: 玩家先達到目標分數贏得單局
- **WHEN** 玩家在本局的來回得分達到 `ROUND_POINT_TARGET`
- **THEN** 系統判定玩家贏得該局，`roundsWon` +1，並在局數未打滿時自動進入下一局

#### Scenario: CPU 先達到目標分數贏得單局
- **WHEN** CPU 在本局的來回得分達到 `ROUND_POINT_TARGET`
- **THEN** 系統判定 CPU 贏得該局，`roundsLost` +1，並在局數未打滿時自動進入下一局
