## ADDED Requirements

### Requirement: Pog deals five cards each from one shuffled deck

尪仔標 MUST 用 12 張牌發牌：點數 1–8，以及王、盾、換、炸各一。洗牌後雙方各 5 張，剩餘 2 張只給重抽。發牌結果 MUST 在對戰開始前決定。NPC MUST 從剩餘手牌均勻選一張，MUST NOT 預測玩家。

#### Scenario: Both hands come from the same injected shuffle

- **WHEN** 測試注入一組洗牌結果
- **THEN** 玩家與 NPC 的 5 張牌就是該結果的前 10 張，頁面不得重發

### Requirement: Five tricks settle once against F-coin

雙方 MUST 打滿五回合。玩家贏的回合較多 MUST 以 ×1.9 入帳。回合數相同 MUST 退回下注。玩家贏的回合較少 MUST NOT 入帳。整局 MUST 在五回合結束後一次結清，MUST NOT 把未領金額留在共用彩池。

#### Scenario: More tricks credit one point nine

- **WHEN** 五回合結束且玩家贏的回合較多，且王的加倍未觸發
- **THEN** F 幣增加 `round(bet * 1.9)`，且只入帳一次

### Requirement: First-version specials stay limited

王在該回合取勝時，整局倍率 MUST 再 ×2，且只生效一次。盾 MUST 抵消一次失敗。換 MUST 只在出牌前，用剩餘牌重抽一張。炸 MUST 使 NPC 下一張點數 -2，最低為 0。超出這四張效果的規則 MUST NOT 在第一版出現。

#### Scenario: Shield cancels one lost trick

- **WHEN** 玩家打出盾，且該回合點數較低
- **THEN** 該次失敗不計入 NPC 的勝場
