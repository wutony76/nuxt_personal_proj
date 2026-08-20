## ADDED Requirements

### Requirement: EGGS 與 KL10 SHALL 各提供一種彩池玩法分頁
系統 SHALL 在 `egg.vue`／`kl10.vue` 提供一個獨立於既有固定賠率分頁的「選號（彩池）」分頁，
MUST NOT 出現在 `eggscd/plays.js`／`kl10cd/plays.js` 的看板網格設定內（比照 K3-OF 的
`xuanhao` 玩法，沒有對應的看板分頁）。

#### Scenario: 顯示彩池玩法分頁
- **WHEN** 使用者進入 `/lottery/bg/egg` 或 `/lottery/bg/kl10`
- **THEN** 玩法分頁列多一顆「選號（彩池）」，點擊後顯示選號 UI 與靜態分層獎金表

### Requirement: 彩池玩法 SHALL 依命中顆數分層派彩
EGGS 彩池玩法 SHALL 為選 3 個數字（0~9，可重複），依命中顆數（3/2/1）對照
`EGGS_POOL_PRIZE_TIERS` 分層派彩；KL10 彩池玩法 SHALL 為選 4 個號碼（1~20，不重複），
依命中顆數（4/3/2）對照 `KL10_POOL_PRIZE_TIERS` 分層派彩。`pool` 類型的層 SHALL 依
「該層下注額比例」分配該層池額（`totalPool × ratio`），頭獎 SHALL 有 `minAmount` 保底；
`fixed` 類型的層 SHALL 為固定倍數。

#### Scenario: EGGS 全中（3/3）
- **WHEN** 開獎為 3 個數字，使用者選號與開獎號完全相同（含重複數字的 multiset 交集）
- **THEN** 判定為頭獎，依 `EGGS_POOL_PRIZE_TIERS` 頭獎層規則派彩

#### Scenario: KL10 全中（4/4）
- **WHEN** 使用者選 4 個號碼，全部出現在當期 8 個開獎號中
- **THEN** 判定為頭獎，依 `KL10_POOL_PRIZE_TIERS` 頭獎層規則派彩

#### Scenario: 某層無人中獎時整層滾存
- **WHEN** 某分層在該期沒有任何注單命中
- **THEN** 該層池額（`totalPool × ratio`）整筆滾存至下期，不發放

#### Scenario: 頭獎保底
- **WHEN** 頭獎層依下注比例算出的自然派彩金額低於 `minAmount`
- **THEN** 依 `minAmount` 派彩（保底金額可能超出該層池額）

### Requirement: 彩池玩法 SHALL 有獨立的池底與抽水機制
系統 SHALL 為 EGGS／KL10 各自維護一個獨立於既有爆池的彩金池，具備池底（`EGGS_POOL_BASE_MIN/MAX`／
`KL10_POOL_BASE_MIN/MAX`，隨機重骰）、依全部注項下注額抽水（`XXX_POOL_RAKE_RATIO`）、
未派出金額滾存至下期。此池 MUST NOT 與既有爆池（`shared/config/jackpot.ts` 骨架）共用
狀態或抽水來源；兩者可同時從同一筆下注各自抽水。

#### Scenario: 池底不足時重骰
- **WHEN** 目前可派發金額低於頭獎保底所需門檻（`ceil(頭獎minAmount ÷ 頭獎ratio)`）
- **THEN** 系統重新產生一個介於 `MIN`／`MAX` 之間的隨機池底

#### Scenario: 抽水並行不互相影響
- **WHEN** 使用者在任一分頁（含彩池玩法本身）下注
- **THEN** 該筆金額同時依 `XXX_POOL_RAKE_RATIO` 抽水進彩金池、依既有 `XXX_JACKPOT_SETTINGS.rakeRatio`
  抽水進爆池，兩池金額與滾存互不影響

### Requirement: 彩池玩法注單 SHALL 一併參與既有爆池分配
彩池玩法的注單 SHALL 依 fallback 權重常數（`EGGS_POOL_PLAY_WEIGHT`／`KL10_POOL_PLAY_WEIGHT`）
參與既有爆池（豹子／奇偶一邊倒）的分配，與一般固定賠率注單一視同仁。

#### Scenario: 爆池期彩池玩法注單也能分得獎金
- **WHEN** 當期觸發既有爆池條件，且玩家在彩池玩法分頁也下了注
- **THEN** 該注單依 fallback 權重計入爆池分配，與其他分頁的注單一起依注金比例分錢

### Requirement: 下注後 SHALL 立即刷新彩池與爆池顯示金額
系統 SHALL 在下注成功後立即重新拉取爆池（`creditJackpot`）與彩金池（`poolState`）金額，
MUST NOT 只依賴換期輪詢才更新。

#### Scenario: 下注後畫面立即反映新增的抽水
- **WHEN** 使用者在 EGGS 或 KL10 任一分頁成功送出下注
- **THEN** 畫面上的爆池與彩金池金額在下注成功後立即更新，不需等到本期結束
