## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／whackAMole 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／60 秒倒數計時歸零）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: WHACK-A-MOLE 倒數計時歸零觸發 Game Over
- **WHEN** WHACK-A-MOLE 的 60 秒倒數計時歸零
- **THEN** 系統立即結束遊戲並顯示最終分數，寫入一筆 `gameKey: 'whackAMole'` 的紀錄，`score` 為當局累積的擊中得分總和

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在 WHACK-A-MOLE 進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／whackAMole SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: whackAMole 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 whackAMole 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: WHACK-A-MOLE SHALL 於 3×3 洞穴中隨機生成地鼠，同一時間最多一隻
系統 SHALL 提供 3×3（9 格）洞穴版面；地鼠 SHALL 隨機出現於目前空的洞穴中；同一時間畫面上 MUST NOT 同時存在超過一隻地鼠；地鼠消失（被擊中或存活時間逾時）後，系統 SHALL 於一段隨機間隔後於任一空洞穴重新生成下一隻地鼠。

#### Scenario: 地鼠隨機出現於空洞穴
- **WHEN** Spawn Timer 到期且目前畫面上沒有地鼠
- **THEN** 系統從 9 個洞穴中隨機挑選一個生成地鼠

#### Scenario: 同一時間不會有兩隻地鼠並存
- **WHEN** 畫面上已經有一隻地鼠處於存活狀態
- **THEN** 系統 MUST NOT 在其消失前於其他洞穴生成新的地鼠

### Requirement: WHACK-A-MOLE 正確點擊地鼠 SHALL 得分並累積 Combo
玩家點擊或觸控畫面上正在冒出的地鼠時，系統 SHALL 立即判定為命中，得分為基礎分數乘上當下 Combo 倍率，並使 Combo 累加一次；點擊沒有地鼠的洞穴（含地鼠已消失的格子）SHALL 判定為 miss，MUST NOT 增加分數，且 SHALL 使 Combo 歸零。

#### Scenario: 點擊正在冒出的地鼠得分
- **WHEN** 玩家點擊一個 `moleActive === true` 的洞穴
- **THEN** 系統增加分數（基礎分 × 當下倍率）並將 Combo 加一

#### Scenario: 點擊沒有地鼠的洞穴判定為 miss
- **WHEN** 玩家點擊一個 `moleActive === false` 的洞穴
- **THEN** 系統 MUST NOT 增加分數，並將 Combo 歸零

### Requirement: WHACK-A-MOLE Combo SHALL 依門檻分段提高得分倍率
系統 SHALL 依累積的 Combo 次數，依既定門檻分段提高得分倍率（比照 `typing.vue` 的 `calcMultiplier` 模式）；Combo 因 miss 歸零後，倍率 SHALL 回到最低倍率。

#### Scenario: Combo 達到門檻時倍率提高
- **WHEN** 玩家連續命中使 Combo 累積達到某一門檻值
- **THEN** 系統將得分倍率提高至該門檻對應的倍率

#### Scenario: Combo 歸零後倍率回到最低
- **WHEN** 玩家發生一次 miss 導致 Combo 歸零
- **THEN** 系統將得分倍率重設為最低倍率（1 倍）

### Requirement: WHACK-A-MOLE 地鼠存活時間 SHALL 隨遊戲進行時間增加而逐漸縮短
系統 SHALL 依「已經過的遊戲時間」動態計算目前地鼠存活時間的上限，且該上限 SHALL 隨時間增加而遞減至一個下限值後不再繼續縮短；新生成的地鼠 SHALL 依當下的存活時間上限決定其實際存活時間。

#### Scenario: 遊戲後段地鼠存活時間比開局短
- **WHEN** 比較遊戲開始後第 5 秒生成的地鼠與第 50 秒生成的地鼠
- **THEN** 第 50 秒生成之地鼠的存活時間上限 SHALL 小於或等於第 5 秒生成之地鼠的存活時間上限

#### Scenario: 存活時間上限不會低於下限值
- **WHEN** 遊戲進行時間持續增加超過難度公式的縮短區間
- **THEN** 系統計算出的存活時間上限 MUST NOT 低於既定下限值

### Requirement: WHACK-A-MOLE 倒數計時歸零 SHALL 立即結束遊戲
系統 SHALL 提供 60 秒倒數計時；計時歸零時，系統 SHALL 立即進入 Game Over 狀態，停用所有洞穴的點擊輸入，並清除所有進行中的 Spawn Timer 與 Lifetime Timer。

#### Scenario: 倒數計時歸零進入 Game Over
- **WHEN** 剩餘時間從 1 秒遞減至 0 秒
- **THEN** 系統立即顯示 Game Over 畫面與最終分數，且洞穴 MUST NOT 再回應點擊

### Requirement: WHACK-A-MOLE Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置洞穴陣列（含地鼠出現狀態）、Spawn Timer、Lifetime Timer、分數、Combo 與倒數計時，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後洞穴與分數皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新進入可開始遊戲的狀態，9 個洞穴皆為空、分數與 Combo 歸零、倒數計時重設為 60 秒
