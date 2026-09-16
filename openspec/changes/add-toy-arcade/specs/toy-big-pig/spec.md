## ADDED Requirements

### Requirement: Both dice rolls are resolved before the dice animation

大豬公 MUST 先決定玩家兩顆與 NPC 兩顆的點數，再播骰子動畫。動畫 MUST 停在這四個點數。頁面 MUST NOT 在滾動中重擲。

#### Scenario: Shown totals match the resolved dice

- **WHEN** 服務抽出玩家 4 與 5、NPC 3 與 2
- **THEN** 畫面顯示 4 + 5 = 9 對 3 + 2 = 5，且勝負依這組點數

### Requirement: Specials apply only after the sum comparison

點數和相同 MUST 退回下注，包含雙方都是 1+1。玩家點數和較高時，6+6 MUST 以 ×5 入帳，其他對子 MUST 以 ×2.5 入帳，其餘 MUST 以 ×1.9 入帳。玩家 1+1 且點數和較低 MUST 以 ×0 結算，且 MUST NOT 退回下注。此款 MUST 在同一請求結清 F 幣，MUST NOT 留下未領金額。

#### Scenario: Equal sums refund the stake

- **WHEN** 雙方點數和相同
- **THEN** 已扣的注額退回 F 幣，不再另發獎勵

#### Scenario: Golden pig pays five times

- **WHEN** 玩家擲出 6 與 6，且點數和大於 NPC
- **THEN** 入帳金額為 `round(bet * 5)`
