## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: SPACE SHOOTER 生命值歸零
- **WHEN** 玩家操作 SPACE SHOOTER 的剩餘生命值歸零
- **THEN** 系統寫入一筆 `gameKey: 'spaceShooter'` 的紀錄，`score` 為當局擊落敵機的加權總分

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: spaceShooter 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 spaceShooter 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: SPACE SHOOTER SHALL 採生命值機制，被擊中不立即結束遊戲
玩家 SHALL 擁有 3 條命；被敵機或敵彈擊中時 SHALL 扣除 1 條命並進入短暫無敵狀態，
無敵狀態期間 MUST NOT 因任何碰撞再次扣命；僅當生命值歸零時 SHALL 判定遊戲結束。

#### Scenario: 被擊中扣命但遊戲繼續
- **WHEN** 玩家在剩餘生命大於 1 的情況下被敵機或敵彈擊中
- **THEN** 系統扣除 1 條命、玩家進入短暫無敵並重生於畫面下方中央，遊戲繼續進行

#### Scenario: 無敵狀態下不重複扣命
- **WHEN** 玩家處於扣命後的無敵狀態期間，再次與敵機或敵彈的碰撞範圍重疊
- **THEN** 系統 MUST NOT 扣除任何生命值

#### Scenario: 生命值歸零才結束遊戲
- **WHEN** 玩家的剩餘生命值降為 0
- **THEN** 系統判定遊戲結束並依目前分數寫入紀錄

### Requirement: SPACE SHOOTER SHALL 區分玩家子彈與敵方拋射物，分別判定碰撞
玩家發射的子彈 SHALL 只能擊中敵機（不影響玩家本體）；敵機本體與敵方子彈 SHALL 只能影響玩家（不影響其他敵機）。

#### Scenario: 玩家子彈擊中敵機
- **WHEN** 玩家子彈的碰撞範圍與某敵機重疊
- **THEN** 系統扣減該敵機血量，血量歸零時移除該敵機並依其類型加上對應分數

#### Scenario: 敵方子彈或敵機本體與玩家碰撞
- **WHEN** 敵方子彈或敵機本體的碰撞範圍與玩家（非無敵狀態）重疊
- **THEN** 系統扣除玩家 1 條命，觸發無敵與重生流程

### Requirement: SPACE SHOOTER 敵機 SHALL 分基本與強化兩型，強化型會發射敵彈
基本敵機 SHALL 為低血量、低分、不主動攻擊；強化敵機 SHALL 為高血量、高分，且 SHALL 不定期向下發射子彈。
敵機生成比例與頻率 SHALL 隨分數等級提升而調整。

#### Scenario: 擊落基本敵機
- **WHEN** 玩家子彈擊落一隻基本敵機
- **THEN** 系統加上基本敵機對應的分數（低於強化敵機）

#### Scenario: 擊落強化敵機
- **WHEN** 玩家子彈擊落一隻強化敵機
- **THEN** 系統加上強化敵機對應的分數（高於基本敵機）

#### Scenario: 等級提升時敵機生成更頻繁、強化敵機比例提高
- **WHEN** 玩家的累計分數跨過等級門檻
- **THEN** 系統將等級提升，敵機生成間隔縮短，強化敵機的生成比例提高

### Requirement: SPACE SHOOTER SHALL 提供連擊倍率，連續擊殺提升分數倍率、被擊中歸零
系統 SHALL 追蹤玩家的連續擊殺數（連擊數），連擊數 SHALL 隨每次擊落任一敵機（含里程碑強敵）遞增；
玩家被擊中扣命時，連擊數 SHALL 歸零。每次擊殺的加分 SHALL 為該敵機基礎分數乘以當下連擊倍率。

#### Scenario: 連續擊殺提升倍率
- **WHEN** 玩家在未被擊中的情況下連續擊落敵機，連擊數跨過倍率門檻
- **THEN** 系統提升當下的分數倍率，後續擊殺的加分依新倍率計算

#### Scenario: 被擊中扣命時連擊歸零
- **WHEN** 玩家被敵機或敵彈擊中並扣除生命值
- **THEN** 系統將連擊數與倍率重置為初始值（連擊 0、倍率 x1）

### Requirement: SPACE SHOOTER 敵機被擊落 SHALL 有機率掉落道具，玩家 SHALL 能拾取以取得限時強化或護盾
敵機被擊落時 SHALL 有機率掉落一個道具（護盾／加速射擊／散射彈），道具 SHALL 緩慢下落，
玩家飛船與道具的碰撞範圍重疊時 SHALL 視為拾取。加速射擊與散射彈 SHALL 為限時效果且互斥（新拾取覆蓋舊效果並重新計時），
護盾 SHALL 為一次性效果，在下次被擊中時抵銷本次傷害並消耗。

#### Scenario: 拾取武器強化道具
- **WHEN** 玩家飛船與「加速射擊」或「散射彈」道具的碰撞範圍重疊
- **THEN** 系統套用對應的限時武器強化效果，若玩家原本已持有另一種限時武器強化，SHALL 被新效果覆蓋並重新計時

#### Scenario: 拾取護盾道具後被擊中
- **WHEN** 玩家持有護盾狀態下被敵機或敵彈擊中
- **THEN** 系統 MUST NOT 扣除生命值，護盾狀態消耗並移除

#### Scenario: 武器強化效果時間到期
- **WHEN** 玩家持有的限時武器強化效果持續時間耗盡
- **THEN** 系統將武器行為還原為預設的單發子彈

### Requirement: SPACE SHOOTER SHALL 在分數每跨過固定門檻時生成一隻里程碑強敵
系統 SHALL 在玩家累計分數每跨過一個固定門檻時，額外生成一隻里程碑強敵（血量與分數皆高於強化敵機，
移動方式為左右橫掃）；里程碑強敵被擊落時 SHALL 必定掉落一個道具。

#### Scenario: 分數跨過門檻生成里程碑強敵
- **WHEN** 玩家的累計分數跨過里程碑門檻
- **THEN** 系統額外生成一隻里程碑強敵，不影響既有的一般敵機生成節奏

#### Scenario: 擊落里程碑強敵必定掉落道具
- **WHEN** 玩家子彈擊落一隻里程碑強敵
- **THEN** 系統加上里程碑強敵對應的高額分數，並必定掉落一個道具（不受一般敵機的掉落機率限制）
