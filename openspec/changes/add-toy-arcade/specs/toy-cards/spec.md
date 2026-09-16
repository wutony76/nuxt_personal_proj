## ADDED Requirements

### Requirement: Cards resolve the next rank before animation

紙牌 MUST 由 `server/services/game/toys` 先抽出下一張 1–13 的牌，再交給 UI 翻面。牌組 MUST 不放回。牌發完 MUST 重洗。頁面 MUST NOT 自己抽牌。

#### Scenario: Injected draw returns the next rank

- **WHEN** 目前牌面是 7，且測試注入的下一張是 9
- **THEN** 結果牌面為 9，動畫不得改成另一張

### Requirement: High and low follow the streak table

猜大或猜小且猜中時，未領金額 MUST 依連勝次數使用 ×1.8、×3、×5、×8、×15。第 5 勝後 MUST 只能領取，MUST NOT 再繼續。猜錯 MUST 把共用彩池未領金額歸零，且 MUST NOT 入帳。

#### Scenario: Second high guess uses the second streak multiplier

- **WHEN** 注額為 100，已連勝 1 次，本回猜大且下一張更大
- **THEN** 未領金額依 ×3 寫進共用彩池，且不再扣 F 幣

#### Scenario: Wrong guess zeroes the pool

- **WHEN** 未領金額為 180 且本回猜錯
- **THEN** 未領金額變為 0，F 幣不加帳

### Requirement: Same rank pays ten times

猜相同且牌面相等時，該回 MUST 以 ×10 計算，並計入連勝。相同 MUST NOT 改用連勝表的倍率。

#### Scenario: Equal rank pays ten times the stake basis

- **WHEN** 注額為 100 且玩家猜相同、下一張同點數
- **THEN** 該回倍率為 10，連勝次數加 1
