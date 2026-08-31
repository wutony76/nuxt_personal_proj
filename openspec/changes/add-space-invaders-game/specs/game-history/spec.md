## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／spaceInvaders 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷／敵機隊形觸底）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: SPACE INVADERS 生命值歸零
- **WHEN** 玩家操作 SPACE INVADERS 的剩餘生命值歸零
- **THEN** 系統寫入一筆 `gameKey: 'spaceInvaders'` 的紀錄，`score` 為當局依敵機列數與 UFO 獎勵分累加的總分

#### Scenario: SPACE INVADERS 敵機隊形觸底
- **WHEN** SPACE INVADERS 任一存活敵機的隊形位置下降超過底線
- **THEN** 系統不論玩家剩餘生命數為何，立即判定遊戲結束，寫入一筆 `gameKey: 'spaceInvaders'` 的紀錄

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／spaceInvaders SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: spaceInvaders 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 spaceInvaders 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: SPACE INVADERS 敵機 SHALL 以固定隊形整批同步移動，碰邊界下降並反向
系統 SHALL 將所有存活敵機視為單一隊形整批移動：隊形以固定間隔同步水平移動；當隊形觸及畫面左右邊界時，
SHALL 整批下降一列並反轉水平移動方向；隊形移動間隔 SHALL 隨存活敵機數量減少而縮短（加速）。

#### Scenario: 隊形觸及邊界時整批下降反向
- **WHEN** 隊形中任一存活敵機的水平位置到達畫面邊界
- **THEN** 系統將整批存活敵機下降一列，並反轉後續水平移動方向

#### Scenario: 存活敵機減少時移動加速
- **WHEN** 隊形中的存活敵機數量減少到特定比例門檻以下
- **THEN** 系統縮短隊形移動間隔，使整批移動變快

### Requirement: SPACE INVADERS SHALL 限制玩家同時最多 1 發子彈
玩家 SHALL 在畫面上同時最多存在 1 發己方子彈；該發子彈擊中敵機、UFO 或飛出畫面上緣之前，
玩家的開火操作 MUST NOT 產生新的子彈。

#### Scenario: 已有子彈存在時再次開火無效
- **WHEN** 玩家目前已有一發子彈存在於畫面上，且再次觸發開火操作
- **THEN** 系統 MUST NOT 產生新的子彈

#### Scenario: 子彈消滅後可再次開火
- **WHEN** 玩家的子彈擊中目標或飛出畫面上緣而消失
- **THEN** 系統允許玩家的下一次開火操作產生新的子彈

### Requirement: SPACE INVADERS SHALL 提供可被摧毀的防禦掩體
系統 SHALL 提供 4 座防禦掩體，各自由多個可獨立摧毀的格子組成；玩家子彈、敵方子彈或敵機本體
與掩體格子的碰撞範圍重疊時，SHALL 摧毀該格子，被摧毀的格子 MUST NOT 再次出現。

#### Scenario: 子彈打中掩體格子
- **WHEN** 玩家子彈或敵方子彈的碰撞範圍與某掩體的一個存活格子重疊
- **THEN** 系統摧毀該格子並消耗該發子彈

#### Scenario: 敵機本體移動經過掩體
- **WHEN** 隊形移動使某敵機本體的碰撞範圍與某掩體的存活格子重疊
- **THEN** 系統摧毀該格子，且不影響該敵機本體繼續移動

### Requirement: SPACE INVADERS SHALL 不定期出現神秘 UFO，被擊中給予隨機獎勵分
系統 SHALL 不定期於畫面上方生成一艘 UFO 並水平飛越畫面；UFO SHALL 不主動攻擊、
不參與敵機隊形的觸底判定；玩家子彈擊中 UFO 時 SHALL 給予隨機獎勵分並移除該 UFO。

#### Scenario: 擊中 UFO 獲得隨機獎勵分
- **WHEN** 玩家子彈的碰撞範圍與畫面上的 UFO 重疊
- **THEN** 系統加上隨機獎勵分之一，並移除該 UFO、消耗該發子彈

#### Scenario: UFO 飛出畫面未被擊中
- **WHEN** UFO 水平飛越畫面直到飛出邊界仍未被擊中
- **THEN** 系統移除該 UFO，不給予任何獎勵分

### Requirement: SPACE INVADERS 敵機隊形觸底 SHALL 立即結束遊戲，不受玩家剩餘生命值影響
當任一存活敵機的隊形位置下降超過畫面上定義的底線時，系統 SHALL 立即判定遊戲結束並依目前分數結算，
此結束條件 MUST NOT 受玩家當下剩餘生命值多寡影響。

#### Scenario: 隊形觸底時立即結束
- **WHEN** 任一存活敵機的隊形位置下降超過底線，且玩家當下仍有剩餘生命
- **THEN** 系統仍立即判定遊戲結束，依目前累積分數寫入紀錄

### Requirement: SPACE INVADERS SHALL 採波次制，清空當前隊形後生成下一波更高難度的滿編隊形
系統 SHALL 在當前隊形所有敵機被擊落後，波次計數 +1 並重新生成一批滿編隊形（重新從畫面頂部開始）；
新一波的基礎移動速度與敵機開火機率 SHALL 高於前一波；掩體損毀狀態、玩家生命值與累積分數 MUST NOT 因進入新波次而重置。

#### Scenario: 清空隊形後進入下一波
- **WHEN** 當前波次的所有敵機皆被擊落
- **THEN** 系統波次計數加一，重新生成滿編隊形，且新一波的基礎移動速度與開火機率高於前一波

#### Scenario: 波次切換不重置掩體與生命值
- **WHEN** 遊戲從一個波次切換到下一波次
- **THEN** 掩體目前的損毀狀態、玩家剩餘生命值與累積分數 MUST NOT 被重置
