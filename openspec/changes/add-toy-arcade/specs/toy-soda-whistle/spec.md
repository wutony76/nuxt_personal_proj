## ADDED Requirements

### Requirement: Soda whistle stakes map the sample prizes onto the bet

汽水笛 MUST 把需求表的 100、150、250、400、700、1200 當成注額 100 的示意。第 n 次成功的未領金額 MUST 為 `round(bet * 表定金額 / 100)`。繼續吹 MUST NOT 再扣 F 幣。

#### Scenario: A fifty stake uses half of the sample prize

- **WHEN** 注額為 50 且第 2 次吹成功
- **THEN** 未領金額為 75

### Requirement: Bust chance rises by step and zeroes the pool

爆掉機率 MUST 依序為 2%、4%、7%、12%、20%、30%。爆掉 MUST 把共用彩池未領金額歸零，且 MUST NOT 入帳。第 6 次成功後 MUST 只能領取。是否爆掉 MUST 在動畫前決定。

#### Scenario: Injected bust zeroes the unclaimed amount

- **WHEN** 未領金額為 250，且測試注入的隨機值落在該次爆掉區間
- **THEN** 未領金額變為 0，F 幣不加帳，動畫不得改判成成功
