## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷／敵機隊形觸底／牌局完成或玩家主動結束）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: SOLITAIRE 完成牌局
- **WHEN** 玩家的 4 個 Foundation 全部依花色由 A 排列到 K（52 張牌全數進入 Foundation）
- **THEN** 系統判定 WIN，寫入一筆 `gameKey: 'solitaire'` 的紀錄，`score` 為當局累計分數，`meta` 包含 `moves` 與 `elapsedSeconds`

#### Scenario: SOLITAIRE 玩家主動結束
- **WHEN** 玩家在牌局尚未完成時主動按下結束
- **THEN** 系統依目前累計分數寫入一筆 `gameKey: 'solitaire'` 的紀錄，不視為失敗，只是提早結算

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: solitaire 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 solitaire 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: SOLITAIRE Tableau SHALL 僅允許交替顏色且點數遞減的牌疊放
系統 SHALL 只允許將一張正面牌（或一組合法排列的正面牌）疊放到 Tableau 某欄目前最上面一張牌上，
且目標牌與被疊放的牌 SHALL 顏色不同（紅/黑交替）、點數 SHALL 恰好遞減 1。

#### Scenario: 合法疊放
- **WHEN** 玩家將一張黑色 J 疊放到一張正面朝上的紅色 Q 上
- **THEN** 系統允許此次移動

#### Scenario: 顏色相同時不允許疊放
- **WHEN** 玩家嘗試將一張紅色 J 疊放到一張正面朝上的紅色 Q 上
- **THEN** 系統 MUST NOT 允許此次移動

#### Scenario: 點數不連續時不允許疊放
- **WHEN** 玩家嘗試將一張黑色 10 疊放到一張正面朝上的紅色 Q 上
- **THEN** 系統 MUST NOT 允許此次移動

### Requirement: Tableau 中合法排列的連續牌組 SHALL 可整組一起搬動
若 Tableau 某欄由上而下的一段連續正面牌，彼此皆符合交替顏色且點數遞減，系統 SHALL 允許將這整組牌一起搬動到合法目標位置；
若這段牌組本身不符合交替遞減規則，系統 MUST NOT 允許整組搬動。

#### Scenario: 合法牌組整組搬動
- **WHEN** 某欄由上而下依序為黑K、紅Q、黑J，玩家搬動黑K整組
- **THEN** 系統允許將黑K、紅Q、黑J三張一起移動到空欄

#### Scenario: 不合法牌組不允許整組搬動
- **WHEN** 某欄由上而下依序為紅Q、黑J（不連續於下一張非法排列的牌），玩家嘗試搬動不構成合法遞減序列的牌組
- **THEN** 系統 MUST NOT 允許整組搬動

### Requirement: 空的 Tableau 欄位 SHALL 僅允許以 King 開頭的牌或牌組放入
系統 SHALL 只允許將點數為 K 的單張牌，或以 K 開頭且合法遞減排列的牌組，放入空的 Tableau 欄位；
非 K 開頭的牌或牌組 MUST NOT 放入空欄。

#### Scenario: K 可以放入空欄
- **WHEN** 玩家將一張 K（或以 K 為首的合法牌組）搬動到空的 Tableau 欄位
- **THEN** 系統允許此次移動

#### Scenario: 非 K 不可放入空欄
- **WHEN** 玩家嘗試將一張 Q（或以 Q 為首的牌組）搬動到空的 Tableau 欄位
- **THEN** 系統 MUST NOT 允許此次移動

### Requirement: Foundation SHALL 僅允許同花色且由 A 依序遞增疊放
系統 SHALL 只允許將某花色的 A 放入該花色對應的空 Foundation；
非空 Foundation SHALL 只允許放入與目前最上面那張牌同花色、點數恰好大 1 的牌。

#### Scenario: A 可以放入空 Foundation
- **WHEN** 玩家將紅心 A 搬動到一個空的 Foundation
- **THEN** 系統允許此次移動，該 Foundation 從此固定對應紅心花色

#### Scenario: 依序遞增疊放
- **WHEN** 某 Foundation 目前最上面是紅心 5，玩家搬動紅心 6 到此 Foundation
- **THEN** 系統允許此次移動

#### Scenario: 花色不符或點數不連續時不允許
- **WHEN** 某 Foundation 目前最上面是紅心 5，玩家嘗試搬動黑桃 6 或紅心 7 到此 Foundation
- **THEN** 系統 MUST NOT 允許此次移動

### Requirement: Tableau 某欄最上面正面牌被移走後，若下方仍有反面牌 SHALL 自動翻為正面
系統 SHALL 在 Tableau 某欄最上面的正面牌因搬動離開後，檢查該欄新的最上面一張牌，
若該牌為反面 SHALL 自動翻為正面；該欄若已無牌則不執行任何動作。

#### Scenario: 自動翻牌
- **WHEN** Tableau 某欄最上面的正面牌被搬走，且該欄下方還有一張反面牌
- **THEN** 系統自動將新的最上面那張牌翻為正面

### Requirement: Stock 抽完後 SHALL 允許將 Waste 重新洗回 Stock 繼續抽牌，次數不限
系統 SHALL 在 Stock 沒有牌可抽時，允許玩家將 Waste 目前所有的牌依原順序放回 Stock（重新變為反面）並繼續抽牌（Draw 1），
此循環 MUST NOT 限制次數。

#### Scenario: Stock 空了重新循環
- **WHEN** 玩家在 Stock 沒有牌時觸發重新循環
- **THEN** 系統將 Waste 的牌放回 Stock（反面朝上）並允許重新開始抽牌，不限制已循環的次數

### Requirement: SOLITAIRE 翻牌動作本身 MUST NOT 產生任何分數
系統 SHALL 只在牌被實際移動並接上合法序列（Tableau 或 Foundation）時計分；
翻牌本身（Tableau 自動翻牌、Stock 抽牌到 Waste）純粹是狀態變化，MUST NOT 因此增加分數，不論是否為該牌本局第一次翻正面。

#### Scenario: 自動翻牌不加分
- **WHEN** Tableau 某欄因牌被移走而自動翻出下一張正面牌
- **THEN** 系統 MUST NOT 因這次翻牌增加分數

#### Scenario: Stock 抽牌不加分
- **WHEN** 玩家點擊 Stock 抽一張牌到 Waste
- **THEN** 系統 MUST NOT 因這次抽牌增加分數，不論這張牌是否為本局第一次翻正面

### Requirement: 同一張牌反覆移到同一個目的地 MUST NOT 重複計分
系統 SHALL 只在某張牌（或以其為錨點搬動的合法牌組）**第一次**移動到某個目的地（某個 Tableau 欄、或某個 Foundation）時給予對應分數；
之後這張牌不論被移走幾次、又移回同一個目的地幾次，都 MUST NOT 因為「回到之前已經計過分的位置」而重複給分。移動本身（包含來回搬動）MUST NOT 被禁止，只有重複的計分事件被排除。

#### Scenario: 來回搬動同一張牌到已計分過的 Tableau 欄不重複給分
- **WHEN** 玩家把某張牌移到 Tableau 欄 A（已計過分），又移到欄 B，再移回欄 A
- **THEN** 系統只在第一次移到欄 A 與第一次移到欄 B 時給分，第二次移回欄 A MUST NOT 再給分

#### Scenario: 把牌移回已經計分過的 Foundation 不重複給分
- **WHEN** 玩家把已經在 Foundation 上並拿過分數的牌移回 Tableau，再移回同一個 Foundation
- **THEN** 系統 MUST NOT 因為這次移回 Foundation 再次給予 Foundation 分數

#### Scenario: 移動到全新的目的地仍正常計分
- **WHEN** 玩家把一張牌移到它在本局中從未移動過去的 Tableau 欄或 Foundation
- **THEN** 系統正常給予該次移動對應的分數

### Requirement: SOLITAIRE SHALL 以點擊選取＋點擊目標區完成移動，且所有移動皆須通過同一套規則驗證
系統 SHALL 提供點擊操作：第一次點擊選取一張牌（或合法的連續牌組），第二次點擊目標區嘗試移動；
不論選取的是單張牌或牌組，最終的合法性判定 SHALL 使用同一套規則驗證邏輯，不可另外實作不同的判定標準。

#### Scenario: 點擊目標區完成合法移動
- **WHEN** 玩家已選取一張牌（或合法牌組），並點擊一個符合規則的目標區
- **THEN** 系統執行此次移動並清除選取狀態

#### Scenario: 點擊不合法目標區時不執行移動
- **WHEN** 玩家已選取一張牌，並點擊一個不符合規則的目標區
- **THEN** 系統不執行此次移動，牌維持在原本的位置

### Requirement: 雙擊一張正面牌 SHALL 嘗試自動移動到合法的 Foundation
系統 SHALL 在玩家雙擊一張正面朝上、且位於牌組最上面（可操作）的牌時，依序嘗試 4 個 Foundation，
若存在合法目標 SHALL 自動執行移動；若不存在合法目標 MUST NOT 執行任何移動。

#### Scenario: 雙擊自動上疊成功
- **WHEN** 玩家雙擊一張可以合法移動到某個 Foundation 的牌
- **THEN** 系統自動將該牌移動到符合規則的 Foundation

#### Scenario: 雙擊無合法目標時不動作
- **WHEN** 玩家雙擊一張目前無法移動到任何 Foundation 的牌
- **THEN** 系統 MUST NOT 執行任何移動

### Requirement: 4 個 Foundation 全部完成（各花色 A 到 K）SHALL 判定為 WIN
系統 SHALL 在每次成功將牌移動到 Foundation 後檢查勝利條件；當 4 個 Foundation 各自都完整疊有該花色 A 到 K 共 13 張（總計 52 張牌全數進入 Foundation）時，
SHALL 判定遊戲進入 WIN 狀態並停止計時。

#### Scenario: 判定勝利
- **WHEN** 最後一張牌被移動到 Foundation，使 4 個 Foundation 皆滿 13 張
- **THEN** 系統判定 WIN、停止計時器，並顯示結算畫面
