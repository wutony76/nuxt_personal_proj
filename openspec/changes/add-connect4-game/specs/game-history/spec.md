## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／connect4 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／連成 4 子或棋盤填滿判定勝負）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: CONNECT 4 玩家獲勝
- **WHEN** 玩家的棋子率先在 Horizontal／Vertical／Diagonal 任一方向連成 4 子
- **THEN** 系統立即結束遊戲並顯示 `YOU WIN`，寫入一筆 `gameKey: 'connect4'` 的紀錄，`score` 依 design.md Decision 5 的計分規則計算（含固定基礎分與依落子效率的加成，或使用者定案後的替代模型）

#### Scenario: CONNECT 4 棋盤填滿判定平手
- **WHEN** 棋盤 42 格全部落滿棋子，且雙方皆未連成 4 子
- **THEN** 系統立即結束遊戲並顯示 `DRAW`，寫入一筆 `gameKey: 'connect4'` 的紀錄，`score` 為固定平手分數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／connect4 SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: connect4 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 connect4 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: CONNECT 4 Win Detection SHALL 集中為單一函式判定 Horizontal／Vertical／Diagonal 四方向連線
系統 SHALL 提供單一 Win Detection 純函式，從剛落子的座標往 Horizontal、Vertical、Diagonal（左下-右上、左上-右下）共四個軸雙向掃描；任一軸連續同一方（玩家或 AI）棋子達 4 顆即判定連線成立；此函式 SHALL 同時被「正式落子後的勝負判定」與「AI 評估某欄是否可直接獲勝或需要阻擋」兩處呼叫，MUST NOT 存在兩套不同的連線判定邏輯。

#### Scenario: 水平方向連成 4 子判定獲勝
- **WHEN** 某一方在同一列連續 4 格皆為己方棋子
- **THEN** 系統判定該方獲勝，立即結束遊戲

#### Scenario: 垂直方向連成 4 子判定獲勝
- **WHEN** 某一方在同一欄連續 4 格皆為己方棋子
- **THEN** 系統判定該方獲勝，立即結束遊戲

#### Scenario: 對角線方向連成 4 子判定獲勝
- **WHEN** 某一方沿任一對角線方向（左下到右上，或左上到右下）連續 4 格皆為己方棋子
- **THEN** 系統判定該方獲勝，立即結束遊戲

#### Scenario: AI 試下評估與正式判定共用同一套規則
- **WHEN** AI 評估「若在某欄落子是否會形成連線」
- **THEN** 系統 SHALL 呼叫與正式落子後判定勝負相同的 Win Detection 函式進行模擬，MUST NOT 使用另一套簡化或不同的連線判斷邏輯

### Requirement: CONNECT 4 AI SHALL 依「優先獲勝→優先阻擋→隨機合法欄」順序決策
AI 的每一回合 SHALL 依序評估：(1) 是否存在可讓 AI 立即獲勝的合法欄位，有則選擇該欄；(2) 若無，是否存在玩家下一步可立即獲勝的合法欄位，有則選擇該欄進行阻擋；(3) 若皆無，SHALL 從所有合法（未滿）欄位中隨機選擇一欄；AI MUST NOT 選擇已滿的欄位。

#### Scenario: AI 存在直接獲勝的欄位時優先選擇獲勝
- **WHEN** 輪到 AI 決策，且存在至少一個合法欄位使 AI 落子後立即連成 4 子
- **THEN** AI SHALL 選擇該欄位落子，MUST NOT 選擇其他欄位

#### Scenario: AI 無法直接獲勝但可阻擋玩家獲勝
- **WHEN** 輪到 AI 決策，AI 自身無法一步獲勝，但存在至少一個合法欄位是玩家下一步的獲勝欄位
- **THEN** AI SHALL 選擇該欄位落子進行阻擋

#### Scenario: AI 既無法獲勝也無需阻擋時隨機選擇合法欄位
- **WHEN** 輪到 AI 決策，且不存在 AI 可直接獲勝或需要阻擋玩家的欄位
- **THEN** AI SHALL 從所有未滿的合法欄位中隨機選擇一欄，MUST NOT 選擇已滿的欄位

### Requirement: CONNECT 4 棋盤填滿且無人連線 SHALL 判定為平手
當棋盤 7×6 共 42 格全部落滿棋子，且最後一步落子後 Win Detection 判定雙方皆未連成 4 子時，系統 SHALL 立即結束遊戲並判定為 `DRAW`；系統 MUST NOT 在仍有空格可落子時判定平手。

#### Scenario: 棋盤填滿且無連線時判定平手
- **WHEN** 玩家或 AI 落下最後一顆棋子使棋盤 42 格全滿，且該次落子未形成任何連線
- **THEN** 系統顯示 `DRAW` 並結束遊戲，寫入固定的平手分數

#### Scenario: 棋盤未滿時不判定平手
- **WHEN** 棋盤仍存在至少一個未滿的欄位
- **THEN** 系統 MUST NOT 判定遊戲為平手或結束

### Requirement: CONNECT 4 SHALL 採回合制交替落子，玩家與 AI 共用同一套合法欄位判斷
系統 SHALL 讓玩家先手，玩家與 AI 交替選擇欄位落子；任一方 MUST NOT 連續落子兩次；欄位是否合法（是否已滿）SHALL 使用同一套判斷邏輯供玩家點擊與 AI 決策共用；AI 回合 SHALL 延遲 400 至 1000 毫秒才執行落子，MUST NOT 立即完成。

#### Scenario: 玩家與 AI 交替落子
- **WHEN** 玩家完成一次合法落子且未結束遊戲
- **THEN** 系統切換為 AI 回合，AI 落子完成且未結束遊戲後才切換回玩家回合

#### Scenario: 已滿欄位不可被選擇
- **WHEN** 玩家或 AI 嘗試選擇一個已經落滿 6 顆棋子的欄位
- **THEN** 系統 MUST NOT 執行落子，且 MUST NOT 消耗當前回合

#### Scenario: AI 回合有延遲
- **WHEN** 遊戲進入 AI 回合
- **THEN** 系統 SHALL 等待一段時間（400~1000 毫秒）後才顯示 AI 的落子結果，MUST NOT 在同一影格內立即完成

### Requirement: CONNECT 4 Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置棋盤、回合狀態、分數、已用步數與計時器，MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後棋盤與回合狀態皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新開局，棋盤 42 格皆為空、輪到玩家先手，分數與步數歸零
