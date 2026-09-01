> 本文件內容為「若方案 A 定案」的暫定規劃（見 design.md `## Open Questions`），本次分析階段不落地，僅作為方案評估的一部分呈現規格形狀。

## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／dinoRun 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或 5 關全破／完成接龍／己方戰艦全滅或敵方戰艦全滅／撞到地面或空中障礙物）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: DINO RUN 撞到障礙物結束
- **WHEN** 玩家角色撞到地面障礙或空中障礙
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'dinoRun'` 的紀錄，`score` 為當下累積的存活距離

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing／breakout／orbMatch／battleship／dinoRun SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: dinoRun 與 runner 各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 dinoRun 與 runner（或其他任一款遊戲）
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度；即使兩款遊戲的計分公式與難度曲線設計相同，紀錄與 coin 結算仍完全獨立，不共用同一份資料

## ADDED Requirements

### Requirement: DINO RUN SHALL 提供自動奔跑、跳躍、下蹲以閃避地面與空中障礙
角色 SHALL 固定位置自動向前奔跑（畫面向左捲動）；玩家 SHALL 能觸發跳躍以閃避地面障礙、觸發下蹲以閃避空中障礙；
無論跳躍高度多高 MUST NOT 能閃避空中障礙，下蹲 MUST NOT 能閃避地面障礙；角色撞到任一障礙物時系統 SHALL 立即結束遊戲。

#### Scenario: 跳躍閃避地面障礙
- **WHEN** 地面障礙即將到達角色位置且玩家已觸發跳躍
- **THEN** 角色 SHALL 在障礙物上方通過，MUST NOT 判定為碰撞

#### Scenario: 下蹲閃避空中障礙
- **WHEN** 空中障礙即將到達角色位置且玩家已觸發下蹲
- **THEN** 角色 SHALL 在障礙物下方通過，MUST NOT 判定為碰撞

#### Scenario: 跳躍無法閃避空中障礙
- **WHEN** 空中障礙即將到達角色位置，玩家僅觸發跳躍（未下蹲）
- **THEN** 系統 SHALL 判定為碰撞並結束遊戲

#### Scenario: 撞到地面障礙結束遊戲
- **WHEN** 角色未及時跳躍，與地面障礙發生碰撞
- **THEN** 系統 SHALL 立即結束遊戲並顯示 `GAME OVER`

### Requirement: DINO RUN SHALL 提供 Double Jump 作為與 RUNNER 的差異化機制
系統 SHALL 允許玩家在空中觸發第二次跳躍（Double Jump），且每次著地後重置為可再次進行雙跳；
玩家 MUST NOT 在單次跳躍循環內觸發兩次以上的額外跳躍（即最多允許一次二段跳）；下蹲狀態 MUST NOT 觸發 Double Jump。

#### Scenario: 空中再次觸發跳躍進行二段跳
- **WHEN** 角色處於跳躍狀態（尚未著地）且玩家再次按下跳躍鍵
- **THEN** 系統 SHALL 讓角色再次獲得向上位移，且此後在同一次跳躍循環內 MUST NOT 再允許第三次跳躍

#### Scenario: 著地後重置 Double Jump 次數
- **WHEN** 角色重新回到地面（`playerState` 變回 `standing`）
- **THEN** 系統 SHALL 重置二段跳次數，允許下一次跳躍循環再次使用一次 Double Jump

#### Scenario: 下蹲狀態不可觸發 Double Jump
- **WHEN** 角色處於下蹲狀態，玩家按下跳躍鍵
- **THEN** 系統 MUST NOT 觸發二段跳

### Requirement: DINO RUN SHALL 隨存活時間與距離提升難度，但不可升到無法遊玩
系統 SHALL 依累積分數（存活距離）分段提高捲動速度與障礙生成密度；
分數 SHALL 隨時間與距離持續累加、無上限；難度提升 MUST NOT 達到玩家無法反應的程度（各難度分段的捲動速度與障礙間距須保留可反應的最短時間窗）。

#### Scenario: 分數達到門檻後難度提升
- **WHEN** 累積分數達到下一個難度分段門檻
- **THEN** 系統 SHALL 提高捲動速度並縮短障礙生成間隔、提高空中障礙出現比例

#### Scenario: 存活時間持續增加分數
- **WHEN** 遊戲進行中且未結束
- **THEN** 系統 SHALL 持續累加分數，不設分數上限

### Requirement: DINO RUN Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置角色位置與狀態、障礙物列表、Double Jump 次數、分數、等級與計時器，
MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後角色與障礙皆為初始狀態
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統重新進入 waiting/ready 流程，角色回到初始站立狀態、障礙物列表清空、分數與等級歸零
