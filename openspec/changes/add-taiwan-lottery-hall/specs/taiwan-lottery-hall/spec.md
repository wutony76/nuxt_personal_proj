## ADDED Requirements

### Requirement: 系統 SHALL 顯示台彩 8 款遊戲的最新開獎號碼
系統 SHALL 在 `/lottery-hall-taiwan` 顯示威力彩、大樂透、今彩539、39樂合彩、49樂合彩、3星彩、4星彩、
賓果賓果共 8 款遊戲的最新一期開獎號碼與期別，資料來源為台彩官方 API，MUST NOT 使用假資料或快取過久的
過期資料當作「最新」呈現。

#### Scenario: 進入大廳看到 8 款遊戲開獎號碼
- **WHEN** 已登入使用者進入 `/lottery-hall-taiwan`
- **THEN** 系統顯示 8 款遊戲各自最新一期的期別與開獎號碼

### Requirement: 系統 SHALL 提供 7 款遊戲（賓果賓果除外）的真實中獎明細
系統 SHALL 針對威力彩、大樂透、今彩539、39樂合彩、49樂合彩、3星彩、4星彩提供「查看中獎明細」功能，
點擊後 SHALL 以柑仔店主題的 Dialog（`TaiwanLotteryPrizeDialog.vue`）顯示該期各獎項的中獎注數與單注獎金
（或倍率），資料 SHALL 即時查詢台彩官方 API，MUST NOT 使用模擬或假造數值。

#### Scenario: 開啟大樂透中獎明細 Dialog
- **WHEN** 使用者點擊大樂透卡片的「查看中獎明細」
- **THEN** 系統即時查詢台彩官方資料，開啟柑仔店主題 Dialog 顯示該期各獎項（頭獎～普獎）的中獎注數與單注獎金

#### Scenario: 中獎明細延遲載入
- **WHEN** 使用者尚未點擊任何卡片的「查看中獎明細」
- **THEN** 系統 MUST NOT 預先呼叫全部 7 款遊戲的中獎明細 API，只在點擊時才查詢

#### Scenario: 同一款遊戲重複開啟不重複請求
- **WHEN** 使用者關閉 Dialog 後、再重新點擊同一款遊戲的「查看中獎明細」
- **THEN** 系統使用本次頁面停留期間已快取的資料開啟 Dialog，MUST NOT 重複呼叫上游 API

### Requirement: 賓果賓果 SHALL 顯示開獎標籤，不提供中獎明細
賓果賓果因玩法結構與其他 7 款遊戲不同、且無對應的官方中獎明細端點，系統 SHALL 只顯示其開獎號碼與
大小／單雙／特別號標籤，MUST NOT 顯示「查看中獎明細」按鈕或任何推測/占位的中獎數字。

#### Scenario: 賓果賓果卡片內容
- **WHEN** 使用者查看賓果賓果卡片
- **THEN** 系統顯示開獎號碼、特別號、大小標籤、單雙標籤，且不出現中獎明細相關按鈕或數字

### Requirement: 中獎明細單一款失敗 MUST NOT 影響其他卡片
當任一款遊戲的中獎明細上游 API 呼叫失敗時，系統 SHALL 只在該款遊戲的 Dialog 內顯示錯誤與可重試操作，
MUST NOT 影響其他卡片的開獎號碼顯示或其他遊戲的中獎明細查詢。

#### Scenario: 單一遊戲中獎明細查詢失敗
- **WHEN** 某一款遊戲的中獎明細上游 API 呼叫失敗
- **THEN** 該款遊戲的 Dialog 顯示錯誤訊息與重試按鈕，其他卡片的開獎號碼與中獎明細功能不受影響

### Requirement: 舊路由 SHALL 轉址到新路由
`/taiwan-lottery-hall` SHALL 轉址到 `/lottery-hall-taiwan`，MUST NOT 回傳 404 或顯示空白頁面。

#### Scenario: 訪問舊網址
- **WHEN** 使用者訪問 `/taiwan-lottery-hall`
- **THEN** 系統自動轉址到 `/lottery-hall-taiwan` 並正常顯示大廳內容

### Requirement: 未登入 SHALL 導向登入頁
未登入使用者訪問 `/lottery-hall-taiwan` SHALL 被導向 `/login`，MUST NOT 顯示任何開獎或中獎資料。

#### Scenario: 未登入訪問大廳
- **WHEN** 未登入使用者訪問 `/lottery-hall-taiwan`
- **THEN** 系統導向 `/login`，不顯示任何台彩開獎或中獎資料
