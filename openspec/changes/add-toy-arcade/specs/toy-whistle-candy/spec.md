## ADDED Requirements

### Requirement: Counter choices resolve before the countdown animation

哨子糖 MUST 先決定玩家與 NPC 的短、中、長，再播 3、2、1。短 MUST 勝長，長 MUST 勝中，中 MUST 勝短。相同 MUST 退回下注。玩家勝 MUST 以 ×1.9 入帳，敗 MUST NOT 入帳。倒數結束 MUST NOT 重抽。

#### Scenario: Short beats long

- **WHEN** 玩家選短，且服務抽出 NPC 為長
- **THEN** 判定玩家勝，入帳為 `round(bet * 1.9)`

#### Scenario: Same choice refunds

- **WHEN** 雙方選擇相同
- **THEN** 注額退回 F 幣

### Requirement: NPC history is the actual recent rolls

NPC 最近選擇 MUST 顯示最近 8 次實際抽出的結果。第一版 NPC MUST 使用可注入的均勻隨機，MUST NOT 另做預測模型。

#### Scenario: History appends the revealed NPC choice

- **WHEN** 本回 NPC 抽出中
- **THEN** 歷史最新一筆是中，且不是另一次隨機
