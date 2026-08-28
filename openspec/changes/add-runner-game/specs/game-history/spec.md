## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: RUNNER 撞到障礙物
- **WHEN** 玩家操作 RUNNER 角色撞到地面或空中障礙物
- **THEN** 系統寫入一筆 `gameKey: 'runner'` 的紀錄，`score` 為當局存活距離

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: runner 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 runner 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: RUNNER 障礙物 SHALL 分地面與空中兩類，玩家 SHALL 依對應動作閃避
地面障礙 SHALL 只能透過跳躍閃避，空中障礙 SHALL 只能透過下蹲閃避；角色處於一般站立狀態時，
撞到任一類障礙物 SHALL 判定為遊戲結束。

#### Scenario: 跳躍成功閃避地面障礙
- **WHEN** 角色在地面障礙進入碰撞範圍前已處於跳躍中的上升／滯空高度
- **THEN** 系統判定閃避成功，角色不受影響、遊戲繼續

#### Scenario: 下蹲成功閃避空中障礙
- **WHEN** 角色在空中障礙進入碰撞範圍前已處於下蹲狀態
- **THEN** 系統判定閃避成功，角色不受影響、遊戲繼續

#### Scenario: 站立狀態撞到地面障礙
- **WHEN** 角色以一般站立狀態（非跳躍、非下蹲）與地面障礙的碰撞範圍重疊
- **THEN** 系統判定遊戲結束

#### Scenario: 跳躍中撞到空中障礙
- **WHEN** 角色處於跳躍中的滯空高度，與空中障礙的碰撞範圍重疊
- **THEN** 系統判定遊戲結束（下蹲才能閃避空中障礙，跳躍無法）

### Requirement: RUNNER 分數 SHALL 為存活距離，隨時間持續累加且無上限
RUNNER 的 `score` SHALL 隨遊戲進行時間持續累加（比照 racing.vue 既有的存活計分設計），
不設計分上限；等級 SHALL 隨分數門檻提升，並帶動捲動速度與障礙生成密度同步提高。

#### Scenario: 存活越久分數越高
- **WHEN** 玩家持續閃避障礙物、遊戲維持進行中狀態
- **THEN** 系統每經過固定時間間隔即累加分數，不設上限

#### Scenario: 分數達到門檻時等級提升、難度同步提高
- **WHEN** 玩家的累計分數跨過等級門檻
- **THEN** 系統將等級提升，捲動速度加快、障礙物生成間隔縮短
