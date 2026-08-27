## ADDED Requirements

### Requirement: Match3 消除 SHALL 支援特殊方塊生成與觸發
Match3 RUSH／CLASSIC 的消除偵測 SHALL 依連消形狀產生對應特殊方塊：4 連消產生 Line Bomb（清整排或整列）、
5 連消以上產生 Color Bomb（清全場同色）、L 或 T 型連消產生 Bomb（清 3×3）。玩家直接交換任一特殊方塊
SHALL 視為合法移動，MUST NOT 因未形成新的三消而復位。

#### Scenario: 4 連消產生 Line Bomb
- **WHEN** 玩家交換後形成一個橫向 4 連消
- **THEN** 系統清除其中 3 格，在生成位置產生一顆會清除整排的 Line Bomb

#### Scenario: 5 連消產生 Color Bomb
- **WHEN** 玩家交換後形成一個 5 連消（不限方向）
- **THEN** 系統在生成位置產生一顆 Color Bomb

#### Scenario: L 型連消產生 Bomb
- **WHEN** 玩家交換後同時形成一個恰好 3 格的橫向連消與一個恰好 3 格的縱向連消，且兩者共用一格
- **THEN** 系統在共用格產生一顆 Bomb，觸發後清除以該格為中心的 3×3 範圍

#### Scenario: 交換特殊方塊必定觸發
- **WHEN** 玩家交換一顆特殊方塊與其相鄰的普通方塊，且交換後未形成任何新的三連消
- **THEN** 系統仍視為合法移動，該特殊方塊立即引爆，MUST NOT 將方塊復位回交換前的位置

### Requirement: Match3 計分 SHALL 採用 Combo 倍率模型
Match3 RUSH／CLASSIC 的計分 SHALL 依「本輪清除格數 × 每格基礎分 × 目前 Combo」計算；Combo SHALL 在每次
玩家操作時從 1 起算，每多一輪連鎖遞增 1，整條連鎖結束後 SHALL 歸零。

#### Scenario: 連鎖時 Combo 遞增
- **WHEN** 玩家交換後觸發連鎖，第一輪消除後方塊掉落補位又形成新的消除
- **THEN** 第二輪的 Combo 為 2，計分依第二輪的清除格數 × 每格基礎分 × 2 計算

#### Scenario: 連鎖結束後 Combo 歸零
- **WHEN** 一條連鎖結束（沒有新的消除產生）
- **THEN** 下一次玩家操作的 Combo 重新從 1 起算

### Requirement: Match3 無解洗牌 SHALL 保留既有特殊方塊
當盤面上不存在任何可以形成顏色連消的合法交換時，系統 SHALL 自動重新排列棋盤；此洗牌 MUST NOT
清除或改變盤面上既有的特殊方塊（顏色與種類皆保留），只重新隨機化普通方塊格。

#### Scenario: 洗牌保留特殊方塊
- **WHEN** 盤面上有一顆既有的 Bomb，且沒有任何交換可以形成顏色連消
- **THEN** 系統自動重新排列普通方塊，該顆 Bomb 在原位置保留、種類不變
