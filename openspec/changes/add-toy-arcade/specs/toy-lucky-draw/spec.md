## ADDED Requirements

### Requirement: Lucky draw resolves from a single weighted roll

抽抽樂 MUST 在玩家選格當下，由 `server/services/game/toys` 用集中設定的加權表抽出唯一結果，再把該結果交給 UI。頁面 MUST NOT 自己抽獎。選中的格子 MUST 只決定翻開哪一格，MUST NOT 決定獎項。動畫進行中 MUST NOT 再呼叫隨機函式來改變結果。未選中的格子 MUST 保持蓋著。

獎勵表 MUST 為：空 4500 基點 ×0、小獎 3000 基點 ×1.2、中獎 1500 基點 ×2、大獎 800 基點 ×5、特獎 180 基點 ×15、超級獎 20 基點 ×50。基點合計 MUST 為 10000。

#### Scenario: Injected rng selects the configured reward

- **WHEN** 測試對 service 注入一個落在超級獎區間的隨機值並選取任一格
- **THEN** 結果為超級獎、倍率為 50，且被翻開的格子就是玩家選的那一格

#### Scenario: Animation end does not reroll

- **WHEN** 翻牌動畫結束
- **THEN** 畫面上的獎項仍等於開抽當下寫入的 `result`，系統不再抽一次

### Requirement: Opening a round debits the stake once

開始抽抽樂 MUST 先扣一次目前注額。扣款失敗時 MUST 停留 `idle`、餘額不變、不產生結果。扣款成功後 MUST 進入 `playing`，直到該次結果可顯示才進入 `result`。

#### Scenario: Successful start debits once

- **WHEN** 餘額為 1000、注額為 100，且玩家開始並選格
- **THEN** 餘額先變為 900，且本動作只扣款一次

#### Scenario: Failed debit does not start

- **WHEN** 餘額不足以支付注額，玩家按下開始
- **THEN** 局狀態維持 `idle`，沒有結果，餘額不變

### Requirement: Reward is an integer pot from the stake and multiplier

第一次抽中的未領金額 MUST 寫進 toys 共用彩池，值為 `round(bet * multiplier)` 的整數。倍率為 0 時彩池 MUST 為 0，且本局 MUST 結束，MUST NOT 提供繼續抽。倍率計算 MUST 使用既有的 `number-precision`，MUST NOT 用未處理的浮點數直接入帳。

#### Scenario: Small prize pot is rounded from the stake

- **WHEN** 注額為 100 且結果倍率為 1.2
- **THEN** 彩池為 120，且尚未入帳

#### Scenario: Empty result ends the round

- **WHEN** 結果倍率為 0
- **THEN** 彩池為 0，錢包不再變動，且不顯示繼續抽

### Requirement: Continue compounds the pot or busts it to zero

有未領金額時，系統 MUST 提供領取與繼續抽。繼續抽 MUST NOT 再扣 F 幣。繼續抽到倍率 0 時，共用彩池的未領金額 MUST 歸零且 MUST NOT 入帳。繼續抽到正倍率時，新未領金額 MUST 為 `round(前未領金額 * 新倍率)`。未領金額 MUST NOT 超過 `bet * maxPotMultiplier`，`maxPotMultiplier` MUST 為 500。達到上限後 MUST 只允許領取，MUST NOT 再繼續。

#### Scenario: Continue hit multiplies the existing pot

- **WHEN** 目前彩池為 120，繼續抽到倍率 2，且未超過上限
- **THEN** 新彩池為 240，錢包餘額不變

#### Scenario: Continue miss zeroes the pot

- **WHEN** 目前彩池為 240，繼續抽到倍率 0
- **THEN** 彩池變為 0，錢包不加帳，本局結束

#### Scenario: Pot cap blocks another continue

- **WHEN** 連乘後的彩池會超過 `bet * maxPotMultiplier`
- **THEN** 彩池被夾在上限，且繼續抽不可用

### Requirement: Claim credits the pot once

領取 MUST 把目前彩池入帳一次，並把該局標成已領取。已領取或彩池為 0 時，領取 MUST NOT 再入帳。`playing` 或 `settling` 期間 MUST NOT 領取。

#### Scenario: Claim credits the displayed pot

- **WHEN** 未領取彩池為 240 且玩家領取
- **THEN** 錢包增加 240，該局不可再領取

#### Scenario: Rapid second claim is ignored

- **WHEN** 領取尚未完成或已經完成時再次按下領取
- **THEN** 錢包不會第二次增加 240

### Requirement: Round can be replayed only after settlement

結果顯示後，系統 MUST 提供再玩一次與回遊戲館。尚有未領取彩池時，再玩一次 MUST NOT 丟棄該彩池去開新局；玩家必須先領取，或因繼續抽到空獎而結束。回遊戲館 MUST 丢掉未領取彩池且不入帳。

#### Scenario: Replay after claim starts idle

- **WHEN** 玩家已領取並按下再玩一次
- **THEN** 局狀態回到 `idle`，彩池與結果清空，注額選擇保留，錢包保留領取後餘額

#### Scenario: Replay is blocked while pot is unclaimed

- **WHEN** 彩池大於 0 且尚未領取，玩家按下再玩一次
- **THEN** 系統不開新局，彩池仍在
