## ADDED Requirements

### Requirement: Next gummy color is drawn before the guess resolves

橡皮糖 MUST 先抽出下一顆顏色，再顯示結果。紅、黃、藍、綠 MUST 各為 25%。畫面 MUST 顯示最近四顆，且最近四顆 MUST 是先前真正抽出的顏色。頁面 MUST NOT 自己抽色。

#### Scenario: Injected color is the shown next candy

- **WHEN** 玩家猜紅，且測試注入的下一顆是紅
- **THEN** 畫面下一顆是紅，並算猜中

### Requirement: Correct guesses use the streak table and wrong guesses bust

猜中 MUST 依連勝次數使用 ×1.8、×3、×5、×8、×15，寫進共用彩池，且繼續 MUST NOT 再扣 F 幣。猜錯 MUST 歸零且不加帳。第 5 勝後 MUST 只能領取。

#### Scenario: Wrong color zeroes the pool

- **WHEN** 未領金額為 300 且下一顆不是所猜顏色
- **THEN** 未領金額變為 0，F 幣不加帳
