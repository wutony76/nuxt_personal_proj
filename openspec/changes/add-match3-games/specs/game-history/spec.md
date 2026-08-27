## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic 任一遊戲進入明確結束狀態（game over／時間到／步數用完）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: Match3 RUSH 時間到
- **WHEN** 玩家操作 Match3 RUSH 倒數時間歸零
- **THEN** 系統寫入一筆 `gameKey: 'match3rush'` 的紀錄，包含當局分數

#### Scenario: Match3 CLASSIC 步數用完
- **WHEN** 玩家操作 Match3 CLASSIC 剩餘步數歸零
- **THEN** 系統寫入一筆 `gameKey: 'match3classic'` 的紀錄，包含當局分數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: match3rush 與 match3classic 各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 match3rush 與 match3classic
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: Match3 三消消除規則 SHALL 由共用核心引擎統一處理
Match3 RUSH／CLASSIC 的棋盤交換合法性、連鎖消除、掉落補位、無解自動洗牌邏輯 SHALL 由共用的
`Match3CoreEngine`（`app/utils/match3Engine.ts`）統一提供，兩款遊戲頁面 MUST NOT 各自重複實作消除演算法。

#### Scenario: 交換相鄰寶石形成三連消
- **WHEN** 玩家交換兩個相鄰寶石，交換後任一方向形成 3 個以上同色連線
- **THEN** 系統清除該連線、觸發掉落補位、重新偵測是否有新的連鎖消除，並依連鎖輪數給予加成分數

#### Scenario: 交換未形成消除自動復位
- **WHEN** 玩家交換兩個相鄰寶石，交換後沒有任何 3 連消
- **THEN** 系統將兩個寶石復位回交換前的位置，不計分、不消耗步數

#### Scenario: 無合法移動時自動洗牌
- **WHEN** 一輪消除結算後，棋盤上不存在任何一次交換可以形成消除
- **THEN** 系統自動重新產生一個保證有解的棋盤，不影響玩家目前分數與計時／步數

### Requirement: Match3 難度 SHALL 隨分數自動升級
Match3 RUSH／CLASSIC SHALL 依目前分數自動計算等級（比照 snake／racing／tetriminos 既有的 Lv 慣例），
等級提升時 SHALL 擴大棋盤可抽取的寶石種類數以提高難度；結算寫入紀錄時 SHALL 一併帶上 `level` 欄位。

#### Scenario: 分數達到門檻時等級提升
- **WHEN** 玩家在一局中累計分數跨過等級門檻（例如從 150 分消除後變成 250 分）
- **THEN** 系統將等級由 1 提升為 2，之後棋盤補位／洗牌時可抽取的寶石種類數增加

#### Scenario: 結算紀錄帶上等級
- **WHEN** 玩家的一局 Match3 進入明確結束狀態
- **THEN** 系統寫入的遊戲紀錄包含當時的 `level` 欄位

### Requirement: Match3 CLASSIC 僅在成功消除的交換時消耗步數
`match3classic` SHALL 僅在一次交換形成消除（即觸發連鎖）時消耗一步；未形成消除而自動復位的交換 MUST NOT 消耗步數。

#### Scenario: 誤觸相鄰寶石未形成消除
- **WHEN** 玩家在 Match3 CLASSIC 交換兩個相鄰寶石但未形成消除
- **THEN** 系統將寶石復位，剩餘步數不變

#### Scenario: 步數用完強制結算
- **WHEN** 玩家在 Match3 CLASSIC 的剩餘步數歸零
- **THEN** 系統進入結束狀態並依目前分數寫入紀錄，玩家 MUST NOT 能再進行交換
