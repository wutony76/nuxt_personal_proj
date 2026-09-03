## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在既有 26 款遊戲與 **pinball** 任一遊戲進入明確結束狀態（含 pinball 的「生命值歸零」）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: PINBALL 生命值歸零結束遊戲
- **WHEN** 玩家的 `lives` 歸零（球落入 Death Zone 且沒有剩餘球可重新發射）
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'pinball'` 的紀錄，`score` 為當下累積的 Combo/Fever 加權分數，`meta` 記錄 `maxCombo`／`feverCount`／`coinsCollected`

### Requirement: Server 端服務層 SHALL 比照既有架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別，既有 26 款遊戲與 **pinball** SHALL 各自有獨立服務檔繼承基底；
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: pinball 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 pinball 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: PINBALL Combo SHALL 於命中有效目標時遞增並重置倒數，掉球或倒數歸零 MUST 重置為 0
系統 SHALL 在球撞擊 Bumper／Target／Golden Hole 時使 `combo` 遞增 1 並將 `comboTimer` 重置為設定值；
`comboTimer` 倒數歸零，或球落入 Death Zone，SHALL 立即將 `combo` 重置為 0；
分數計算 MUST 以當下 `comboMultiplier` 加權，MUST NOT 在 Combo 重置後沿用重置前的倍率計分。

#### Scenario: 連續命中提升 Combo 倍率
- **WHEN** 球連續撞擊 Bumper、Target、Bumper 三次且皆未超過 `comboTimer` 時限
- **THEN** 系統依序將 `combo` 累加為 1、2、3，`comboMultiplier` 同步提升，每次命中的得分皆以當下倍率計算

#### Scenario: 掉球立即重置 Combo
- **WHEN** 球落入 Death Zone
- **THEN** 系統立即將 `combo` 與 `comboTimer` 歸零，MUST NOT 保留到下一顆球

### Requirement: PINBALL Fever SHALL 於 4 個 Target 全部命中時觸發，MUST NOT 需要額外操作
當 A／B／C／D 四個 Target 的 `hit` 狀態全部為 `true` 時，系統 SHALL 立即觸發 Fever（`feverActive = true`，持續固定秒數），
玩家 MUST NOT 需要額外按鍵才能進入 Fever；Fever 期間 SHALL 對分數與 Combo 倒數視窗套用加成；
Fever 結束時系統 SHALL 將全部 Target 的 `hit` 重置為 `false`，使玩家可以再次挑戰觸發下一次 Fever。

#### Scenario: 四個 Target 全亮觸發 Fever
- **WHEN** 玩家依序命中 A、B、C、D 四個 Target
- **THEN** 系統立即設定 `feverActive = true` 並開始固定秒數倒數，MUST NOT 等待玩家任何額外操作

#### Scenario: Fever 結束後 Target 狀態重置
- **WHEN** Fever 倒數歸零
- **THEN** 系統將 `feverActive` 設為 `false`，並把四個 Target 的 `hit` 全部重置為 `false`

### Requirement: PINBALL Golden Hole 進球 MUST NOT 視為 Death，球 SHALL 重新發射回場上
球心進入 Golden Hole 判定範圍時，系統 SHALL 給予固定分數與 Combo 加成，
MUST NOT 扣除生命值，且 SHALL 將球以固定初速從 Launcher 位置重新發射回場上，讓對局繼續進行。

#### Scenario: 球進入 Golden Hole 後continue遊戲
- **WHEN** 球心進入 Golden Hole 的判定半徑
- **THEN** 系統給予分數與 Combo 加成，MUST NOT 扣除 `lives`，並將球重新從 Launcher 位置發射回場上

### Requirement: PINBALL 掉球後若尚有剩餘生命，SHALL 顯示 3 選 1 隨機 Upgrade 供玩家選擇
球落入 Death Zone 且扣除一命後，若 `lives` 大於 0，系統 SHALL 從 Upgrade 池中不重複隨機選出 3 個選項並暫停對局，
等待玩家選擇其中 1 個；選擇後 SHALL 立即將該 Upgrade 套用到 `modifiers` 並重新發射下一顆球；
若 `lives` 歸零，MUST NOT 顯示 Upgrade 選擇，直接進入 `GAME OVER`。

#### Scenario: 掉球後尚有生命，顯示 Upgrade 選擇
- **WHEN** 球落入 Death Zone 後 `lives` 遞減為 1（尚有剩餘）
- **THEN** 系統從 12 個 Upgrade 中隨機選出不重複的 3 個顯示給玩家選擇，並暫停 tick 直到玩家做出選擇

#### Scenario: 生命歸零不顯示 Upgrade，直接結束
- **WHEN** 球落入 Death Zone 後 `lives` 遞減為 0
- **THEN** 系統 MUST NOT 顯示 Upgrade 選擇畫面，直接顯示 `GAME OVER`

### Requirement: PINBALL Restart SHALL 完整重置所有對局狀態與 Upgrade 效果
執行 Restart 時，系統 SHALL 重置 Ball／Flipper／Bumper／Target／Golden Hole 狀態、Combo、Fever、分數、生命、
局內趣味幣（`coinsCollected`）與已套用的 Upgrade `modifiers`，MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後所有狀態與 Upgrade 效果回到初始值
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新進入初始狀態，`modifiers` 恢復預設值，所有 Target 恢復未命中、分數與 Combo 歸零、生命恢復為 3
