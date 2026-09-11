## ADDED Requirements

### Requirement: 大樂透 SHALL 使用官方大樂透實際開出的號碼，MUST NOT 自建 RNG 開獎
系統 MUST NOT 自行產生開獎號碼；每期開獎結果 SHALL 直接取自台灣彩券官方大樂透
（`gameCode=5118`）當期實際開出的 6 個一般號碼與 1 個特別號。

#### Scenario: 開獎結果來自官方資料
- **WHEN** 官方大樂透某期實際開出 6 個一般號碼與 1 個特別號
- **THEN** 本站對應期別的開獎結果與官方完全一致，不經過任何本站自建的隨機邏輯

### Requirement: 玩家 SHALL 投注恰好 6 個不重複號碼，金額 SHALL 固定為 50
一注 SHALL 包含 6 個介於 1~49 且互不重複的號碼，下注金額 SHALL 固定為 50（coin），
玩家 MUST NOT 自訂其他金額；不符合此格式或金額的注單 SHALL 於伺端整筆拒絕，MUST NOT 部分接受。

#### Scenario: 號碼個數不符時拒單
- **WHEN** 送出的注碼號碼個數不為 6、或含重複號碼、或超出 1~49
- **THEN** 伺端整筆拒絕投注，且不扣款

#### Scenario: 非固定金額的注單被拒絕
- **WHEN** 送出的下注金額不等於 50
- **THEN** 伺端整筆拒絕投注，且不扣款

### Requirement: 一次送單 SHALL 可包含 1~5 組各自獨立的注碼，MUST NOT 視為複式
系統 SHALL 允許玩家一次送單包含 1 至 5 組各自獨立的 6 碼組合（比照官方紙本投注單的 A~E 注格），
每組各自固定 50 coin、各自獨立判定與派彩，彼此 MUST NOT 互相影響或稀釋。這與「複式」（選超過
6 個號碼、系統自動展開成多種組合）是不同機制，本次 MUST NOT 提供複式展開。每組 SHALL 可各自
啟用「電腦選號」由系統隨機產生 6 個不重複號碼，玩家啟用後仍可手動修改。

#### Scenario: 一次送單含多組互不影響
- **WHEN** 玩家一次送單包含 A、B 兩組號碼，開獎後 A 組判定為頭獎、B 組不中獎
- **THEN** A 組依頭獎 `perPrize` 派彩，B 組不派彩，兩組互不稀釋對方的派彩金額

#### Scenario: 超過 5 組時拒單
- **WHEN** 一次送單包含超過 5 組獨立注碼
- **THEN** 伺端整筆拒絕投注，且不扣款

#### Scenario: 電腦選號
- **WHEN** 玩家對某一組啟用電腦選號
- **THEN** 該組立即產生 6 個不重複的 1~49 號碼，玩家仍可再手動調整

### Requirement: 中獎判定 SHALL 依官方 8 個獎項的對中條件分類
系統 SHALL 依 `(k, hasSpecial)` 二維狀態（`k` = 對中一般號碼數、`hasSpecial` = 是否對中特別號）
判定獎項，對照官方 `Lotto649Result` 的 8 個獎項欄位：頭獎（k=6）、二獎（k=5 且中特別號）、
三獎（k=5 不中特別號）、四獎（k=4 且中特別號）、五獎（k=4 不中特別號）、六獎（k=3 且中特別號）、
七獎（k=3 不中特別號）、普獎（k=2 且中特別號）；其餘情況 SHALL 判定為不中獎。

#### Scenario: 頭獎判定
- **WHEN** 玩家投注的 6 個號碼與當期 6 個一般號碼完全相同
- **THEN** 該注判定為頭獎

#### Scenario: 二獎與三獎的區別
- **WHEN** 玩家投注中有 5 個號碼落在當期一般號碼內，且第 6 個號碼恰為特別號
- **THEN** 判定為二獎；若第 6 個號碼不是特別號（也不在一般號碼內）
- **THEN** 判定為三獎

#### Scenario: 七獎與普獎的區別
- **WHEN** 玩家投注對中 3 個一般號碼但未中特別號
- **THEN** 判定為七獎；若對中 2 個一般號碼且對中特別號
- **THEN** 判定為普獎

#### Scenario: 對中組合不足最低門檻時不中獎
- **WHEN** 玩家投注對中 2 個一般號碼但未中特別號（或更低）
- **THEN** 判定為不中獎，本金不退還亦不派彩

### Requirement: 派彩金額 SHALL 直接採用官方當期實際分配金額，MUST NOT 套用賠率公式或彩池
系統 MUST NOT 使用「公平賠率 × RTP」或任何本站自建的賠率公式計算派彩，MUST NOT 建立彩池
或摃龜滾存機制。玩家某注判定屬於某獎項時，派彩金額 SHALL 直接等於官方當期該獎項的
`perPrize`（1 官方金額單位對應 1 coin）。

#### Scenario: 派彩金額等於官方當期實際分配金額
- **WHEN** 官方大樂透當期「四獎」`perPrize` 為 20000
- **THEN** 本站當期判定為四獎的注單，每注派彩為 20000

#### Scenario: 官方某獎項當期無人中獎
- **WHEN** 官方當期「頭獎」`winnerCount` 為 0
- **THEN** 本站當期不會有任何注單被判定為頭獎（因為判定使用同一組官方開獎號），
  MUST NOT 出現「官方無人中但本站有人中」的矛盾情況

### Requirement: 結算 SHALL 等待官方資料到位，未到位時 SHALL 維持 pending-settlement，MUST NOT 誤判無人中獎
系統 SHALL 在開獎時間後才開始嘗試結算：需同時取得官方開獎號碼與 8 個獎項的 `perPrize` 才能結算。
任一項尚未到位時，該期 SHALL 維持 `pending-settlement` 狀態並定期重試，MUST NOT 將「資料尚未到位」
誤判為「本期無人中獎」而提前結算。已成功結算的期別 MUST NOT 被重複結算。

#### Scenario: 官方資料尚未到位
- **WHEN** 開獎時間已過，但官方 API 尚未回傳該期的獎金明細
- **THEN** 該期維持 `pending-settlement`，玩家注單不會被判定為未中獎或已結算

#### Scenario: 官方資料到位後正確結算
- **WHEN** 官方開獎號碼與 8 個獎項 `perPrize` 皆已可查得
- **THEN** 系統依 `dltTierOf()` 逐注分類並派彩，該期標記為已結算

#### Scenario: 已結算期別不重複結算
- **WHEN** 某期已經完成結算
- **THEN** 後續的結算輪詢不會對該期重複派彩

### Requirement: 下注單位與開獎週期 SHALL 比照官方每週二、五
開獎日 SHALL 為每週二、五，投注截止時間 SHALL 為開獎當日 20:00，開獎時間 SHALL 為開獎當日 20:30。
期別 SHALL 直接沿用官方回傳的期別字串，MUST NOT 另行編碼再做映射。

#### Scenario: 鎖單後不接受新注單
- **WHEN** 目前時間已過當期開獎日 20:00
- **THEN** 該期不再接受新注單，新送出的注單歸入下一個開獎日（週二或週五）的期別

### Requirement: 近期開獎與冷熱號統計 SHALL 由本站逐期累積官方結果，MUST NOT 依賴不存在的官方歷史查詢
系統 SHALL 在每期成功結算後，將該期官方開獎號碼寫入本站既有的近期開獎記錄機制
（`LOTTERY_BASE.recordOpenCode`），近期開獎清單與冷熱號統計 SHALL 僅由本站累積的記錄計算，
MUST NOT 呼叫任何官方「歷史多期查詢」端點（因為官方不提供此類端點）。累積筆數不足時，
UI SHALL 正常呈現目前實際筆數，MUST NOT 視為錯誤。

#### Scenario: 上線初期資料不足
- **WHEN** 本站累積的開獎記錄少於預期顯示筆數（例如僅有 3 期）
- **THEN** 近期開獎與冷熱號區塊正常顯示現有的 3 期資料，不顯示錯誤訊息

### Requirement: 大樂透 SHALL 僅提供單一信用盤
系統 SHALL 只建立單一盤口（`dlt.ts` service、`dlt.vue` page），
MUST NOT 建立官方盤服務、路由、頁面或共用期表層（`dltShared.ts`）。

#### Scenario: 大廳僅顯示一張大樂透卡片
- **WHEN** 使用者進入大廳頁
- **THEN** 大樂透只出現一張卡片，點擊後導向 `/lottery/tw/dlt`

### Requirement: 大樂透 SHALL 歸屬獨立的 `tw` 分類，MUST NOT 併入既有 `BG_GAMES`
系統 SHALL 在 `shared/config/gameSlugs.js` 新增獨立的 `TW_GAMES` 分類陣列與 `findTwByPageSlug()`，
`app/middleware/game-access.global.ts` SHALL 新增 `/lottery/tw/` 前綴的權限檢查分支；
大樂透 MUST NOT 被加入既有 `BG_GAMES` 陣列，既有 `bg` 系列玩法的路由與權限檢查邏輯 MUST NOT 被修改。

#### Scenario: tw 路由的權限檢查獨立生效
- **WHEN** 使用者未登入時嘗試進入 `/lottery/tw/dlt`
- **THEN** middleware 依 `findTwByPageSlug` 查得的權限設定攔截，且不影響 `/lottery/bg/**` 既有分支的行為

### Requirement: 大樂透的自動下注面板 SHALL 為獨立複製版本，MUST NOT 與既有 bg 系列共用
系統 SHALL 新增 `app/composables/useTwAutoActive.ts` 與 `app/components/lottery/tw/TwAutoPanel.vue`
作為大樂透（及未來 `tw` 系列玩法）專用的自動下注面板，MUST NOT 修改既有
`app/composables/useBgAutoActive.ts`／`app/components/lottery/bg/BgAutoPanel.vue`，
兩者為各自獨立維護的檔案。

#### Scenario: tw 自動下注面板獨立運作
- **WHEN** 使用者在大樂透頁面開啟自動下注
- **THEN** 僅 `TwAutoPanel.vue`／`useTwAutoActive.ts` 的狀態受影響，既有 `bg` 系列玩法的
  `BgAutoPanel.vue`／`useBgAutoActive.ts` 狀態不受任何影響

### Requirement: 既有台彩資料端點的對外行為 MUST NOT 因本次重構而改變
`server/api/lottery-tw/last-number.get.ts`／`prize.get.ts` 可重構為呼叫可重用的 service
function，但兩者對外的請求參數與回應格式 MUST NOT 改變，既有頁面（`lottery-hall-taiwan.vue`、
`TaiwanLotteryPrizeDialog.vue`）的行為 MUST NOT 受影響。

#### Scenario: 既有台彩資訊頁不受影響
- **WHEN** 使用者進入 `/lottery-hall-taiwan` 頁面查看開獎號與中獎明細
- **THEN** 顯示行為與本次變更前完全一致
