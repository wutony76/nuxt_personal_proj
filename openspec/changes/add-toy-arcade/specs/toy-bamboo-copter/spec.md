## ADDED Requirements

### Requirement: One height drives both odds and animation

竹蜻蜓 MUST 先抽出一個高度，動畫 MUST 顯示同一個高度。高度帶 MUST 為：小於 10m 占 10%，10–19 占 20%，20–29 占 25%，30–39 占 25%，40–49 占 15%，50m 以上占 5%。頁面 MUST NOT 再抽一次決定是否達標。

#### Scenario: A thirty-seven meter draw is the shown and judged height

- **WHEN** 服務抽出 37m，玩家目標是 ≥30m
- **THEN** 動畫停在 37m，且判定為達標

### Requirement: Target payout settles in the same request

目標與倍率 MUST 為 ≥10m ×1.1、≥20m ×1.4、≥30m ×2、≥40m ×4、≥50m ×15。達標 MUST 在同一請求把 `round(bet * 倍率)` 寫入 F 幣。未達標 MUST NOT 入帳。此款 MUST NOT 把未領金額留在共用彩池。若共用彩池已有未領金額，MUST NOT 開局。

#### Scenario: Missed target does not credit

- **WHEN** 注額已扣，抽出高度低於所選目標
- **THEN** F 幣不再增加
