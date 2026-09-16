## ADDED Requirements

### Requirement: Toy shelf sits on the Taiwan lottery hall

系統 MUST 在 `/lottery-hall-taiwan` 的玩法貨架下方、頁尾上方顯示「柑仔店櫥仔」。此區塊 MUST NOT 取代既有彩票卡，也 MUST NOT 使用 `/game/` 或另開 `/toy-hall`。遊戲頁 MUST 放在 `/toys/`，且 MUST NOT 註冊進 `RETRO_GAMES`、`BG_GAMES` 或 `TW_GAMES`。

#### Scenario: Shelf appears below the lottery cards

- **WHEN** 訪客開啟 `/lottery-hall-taiwan` 且彩票卡已顯示
- **THEN** 玩法貨架下方出現標題為「柑仔店櫥仔」、副標為「懷舊零嘴 · 古早玩具」的區塊，頁尾仍在該區塊之後

#### Scenario: Existing game access middleware ignores toy routes

- **WHEN** 訪客開啟 `/toys/lucky-draw`
- **THEN** `game-access` middleware 不把該路徑當成 retro、bg 或 tw 遊戲攔截

### Requirement: Shelf lists eight toys and only opens implemented games

櫥仔 MUST 顯示 8 張圓章卡片，名稱、種類與圓章字依序為：大豬公／懷舊零嘴／豬、抽抽樂／懷舊零嘴／抽、橡皮糖／懷舊零嘴／糖、哨子糖／懷舊零嘴／哨、尪仔標／古早玩具／標、竹蜻蜓／古早玩具／蜓、汽水笛／古早玩具／笛、紙牌／古早玩具／牌。未實作的遊戲 MUST NOT 導向不存在的路由。

#### Scenario: Lucky draw card starts the game

- **WHEN** 玩家在櫥仔按下抽抽樂
- **THEN** 系統導向 `/toys/lucky-draw`

#### Scenario: Unimplemented card cannot be started

- **WHEN** 玩家查看尚未實作的櫥仔卡
- **THEN** 該卡不可導航

#### Scenario: Shelf failure does not clear lottery cards

- **WHEN** 櫥仔目錄讀取失敗
- **THEN** 玩法貨架的彩票卡仍保持顯示，櫥仔只顯示自己的錯誤

### Requirement: Shared header shows hall return and account F-coin

所有 `/toys/` 遊戲頁 MUST 使用同一個 Header。Header MUST 提供回到 `/lottery-hall-taiwan#tw-shelf` 的控制項，並顯示目前帳號 F 幣。系統 MUST NOT 新增童玩幣或其他幣別。

#### Scenario: Header balance matches account F-coin

- **WHEN** 帳號 F 幣為 12580
- **THEN** Header 顯示 12580

#### Scenario: Return control leaves the game page

- **WHEN** 玩家在遊戲頁按下轉去大廳
- **THEN** 系統導向 `/lottery-hall-taiwan#tw-shelf`

### Requirement: Bets and claims use the account F-coin wallet

下注扣款與領取入帳 MUST 經由 `walletBalanceService.appendChange` 寫入帳號 F 幣。扣款類型 MUST 為 `toy-bet`，入帳類型 MUST 為 `toy-reward`。頁面 MUST NOT 直接改餘額，也 MUST NOT 建立第二個餘額欄位。餘額不足時扣款 MUST 失敗且 F 幣不變。未登入 MUST NOT 開局。

#### Scenario: Debit rejects insufficient F-coin

- **WHEN** 帳號 F 幣為 30 且扣款 50
- **THEN** 扣款失敗、F 幣仍為 30，並回傳可顯示的錯誤

#### Scenario: Claim credits F-coin once

- **WHEN** 未領金額為 20 且領取成功
- **THEN** 帳號 F 幣增加 20，且餘額變動類型為 `toy-reward`

### Requirement: All toy games share one prize pool

toys 領域 MUST 只有一份彩池，8 款遊戲讀寫同一份。彩池 MUST NOT 寫進彩票彩池，也 MUST NOT 每款遊戲各備一份。彩池記錄該使用者目前未領金額。抽到空 MUST 把未領金額歸零且不入帳。有未領金額時，其他 toys 遊戲 MUST NOT 另開一局。

#### Scenario: Second toy game sees the same unclaimed amount

- **WHEN** 抽抽樂產生未領金額 120，玩家改開另一款 toys 遊戲
- **THEN** 該遊戲讀到的未領金額仍是 120，且不能另開新局

#### Scenario: Leaving the page keeps the unclaimed amount

- **WHEN** 未領金額為 120，玩家離開遊戲頁
- **THEN** F 幣不增加，伺服器彩池的未領金額仍為 120

### Requirement: Shared round state uses three statuses

每一局 MUST 使用共用狀態 `idle`、`playing`、`result`。`playing` 期間 MUST NOT 接受新的開局。離開遊戲頁 MUST NOT 把未領金額自動入帳，也 MUST NOT 把它歸零。

#### Scenario: Re-entry shows the server pool

- **WHEN** 一局處於 `result` 且未領金額為 120，玩家離開後再次進入任一 toys 遊戲
- **THEN** 畫面讀到未領金額 120，F 幣仍是離開前的值

### Requirement: Bet choices come from config

下注選項 MUST 為 10、50、100、500 與自訂。自訂金額 MUST 是大於等於 1 的整數，且小於等於目前帳號 F 幣。籌碼、起始餘額與倍率 MUST 定義在集中設定，MUST NOT 寫死在版面模板。

#### Scenario: Custom bet above balance is rejected

- **WHEN** 餘額為 80 且玩家提交自訂注額 90
- **THEN** 系統拒絕開始，局狀態維持 `idle`，餘額仍為 80

### Requirement: Settlement actions are idempotent under rapid clicks

開局、繼續與領取 MUST 在 `settling` 為 true 時直接返回，且 MUST NOT 再次扣款或入帳。同一局領取成功後，再次領取 MUST NOT 再次入帳。

#### Scenario: Second claim does not credit again

- **WHEN** 同一局已經領取成功
- **THEN** 再次領取不改變錢包餘額

### Requirement: Toy visuals reuse the Taiwan lottery theme

櫥仔與 `/toys/` 遊戲頁 MUST 使用既有 `.theme-taiwan-lottery` token，MUST NOT 新增另一套主題樣式表，也 MUST NOT 使用 Canvas。動畫 MUST 使用 CSS `transform`、`transition` 或 `animation`。

#### Scenario: No new global toy stylesheet

- **WHEN** 實作完成後檢查全站 CSS 入口
- **THEN** `nuxt.config` 的全域 `css` 陣列沒有新增童玩館樣式表
