# Proposal

## 變更名稱

add-toy-shop-admin-controls — 柑仔店櫥仔（toys）後台總開關與各玩法賠率設定

## 背景

柑仔店櫥仔 8 款玩法（大豬公、抽抽樂、橡皮糖、哨子糖、尪仔標、竹蜻蜓、汽水笛、紙牌，見
`server/services/game/toys/catalog.ts` `TOY_CATALOG`）上線後，目前完全沒有後台可控制的
開關或參數：

- 沒有「整個柑仔店暫停開放」的機制——`server/api/games/toys/*/roll.post.ts` 一律受理下注。
- 各玩法的派彩倍數散落在各自 service 檔內（部分寫進 `catalog.ts` 常數，部分直接寫死在
  service 邏輯裡，`gummy`／`cards` 甚至共用同一份 `CARD_STREAK` 常數），沒有任何一處可讓
  後台調整。

使用者要求補上「開關」與「賠率」兩項後台可調參數，並指定設定介面放在既有「彩運來」後台頁
（`app/pages/admin/taiwan-lottery.vue`）新增一個「柑仔店櫥仔設定」區塊，不另開新分頁。

## 目標

- 後台可一鍵開啟／關閉柑仔店櫥仔整體功能；關閉後前台不可再下注，並顯示對應提示。
- 後台可針對 8 款玩法各自設定一個「賠率倍數」，套用在實際派彩金額上，不需要逐一改動 8 份
  service 檔內部的機率／獎項判定邏輯。
- 沿用既有「經典遊戲 coin 常數」的後台管理慣例（in-memory、無 DB、admin 直接改活的執行期
  設定），維持整個專案「重啟即回復預設值」的一致行為。

## 範圍

- 包含：
  - 新增 `server/services/admin/modules/toyShop.ts`（開關 + 賠率倍數 in-memory 狀態與存取）
  - 補上 `server/services/admin/hfyyLotteryTw.ts` 的既有佔位（掛上 `toyShop`）
  - 新增後台 API：`server/api/admin/toy-shop/settings.get.ts`／`.patch.ts`、
    `server/api/admin/toy-shop/odds/[slug].put.ts`
  - `server/api/games/toys/catalog.get.ts` 回應補上 `enabled` 欄位
  - 8 個 `server/api/games/toys/*/roll.post.ts`：關閉時擋單（403）、`wallet.credit` 套用賠率倍數
  - `app/services/api.ts` 補上對應型別與 `api.admin.toyShop.*`
  - `app/pages/admin/taiwan-lottery.vue` 新增「柑仔店櫥仔設定」區塊（開關 + 8 款玩法賠率表）
  - `app/pages/lottery-hall-taiwan.vue` 柑仔店櫥仔區塊：關閉時整塊隱藏（不顯示區塊，不可進入玩法）
- 不包含：
  - 不重構 8 款玩法內部的機率／獎項判定邏輯（`gummy`/`cards` 共用 `CARD_STREAK` 的既有耦合
    不動），賠率倍數只在最終派彩金額上乘一個係數
  - 不做每款玩法各自的獨立開關（僅做「整個柑仔店」一顆總開關），細粒度開關留待有需求再補
  - 不做角色權限分流（不比照 `roleGamePerms.ts` 的每角色可見度，全站玩家一致）
  - 不落地持久化（沿用專案現況：in-memory，伺服器重啟後回復程式碼預設值）

## 影響面

- 前端路由/頁面：`app/pages/admin/taiwan-lottery.vue`、`app/pages/lottery-hall-taiwan.vue`
- 前端元件/Composables：無新增元件，沿用既有 `admin-*` 樣式 class 與頁面內 state
- 後端 API/Services：
  - 新增 `server/services/admin/modules/toyShop.ts`
  - 新增 `server/api/admin/toy-shop/*`
  - 修改 8 個 `server/api/games/toys/*/roll.post.ts`、`server/api/games/toys/catalog.get.ts`
- 設定或常數（`app/config/`）：無（新設定放在 admin service module，不動 `app/config/`）

## 風險與對策

- 技術風險：
  - 風險：8 款玩法各自 service 檔的「派彩金額」計算方式不一致（有的用倍率表、有的寫死常數），
    若在各自 service 內部套用賠率倍數，改動面過大且容易漏改
  - 對策：統一在 `roll.post.ts` 的 `wallet.credit` 呼叫點套用倍率（乘在最終要入帳的金額上），
    8 個檔案的改法完全一致、不動任何 service 內部邏輯
  - 風險：關閉開關後，若只擋前端 UI、後端仍受理下注，玩家可繞過 UI 直接打 API 下注
  - 對策：8 個 `roll.post.ts` 一律在伺端檢查 `toyShop.isEnabled()`，關閉時回 403，前端 UI 只是
    體驗層的提示，真正防線在伺端
- UI/UX 風險：
  - 風險：關閉時玩家若已在玩法頁面（非貨架頁），沒有即時通知
  - 對策：下注會直接被 403 擋下並顯示錯誤訊息，屬可接受的既有錯誤處理慣例（不做即時推播）

## 驗證方式

- 功能驗證：
  - 後台切換開關為關閉後，8 款玩法任一 `roll` 下注皆回 403，前台貨架的柑仔店櫥仔區塊整塊隱藏
  - 後台切換開關為開啟後，下注恢復正常
  - 後台調整某玩法賠率倍數（例如設為 2），實際中獎入帳金額（`toy-reward` 金額）確實變成
    「原本應派彩金額 × 2」
  - 賠率倍數設為 0 時，中獎入帳金額為 0，不影響下注扣款
- 視覺驗證：
  - 「柑仔店櫥仔設定」區塊沿用 `admin-panel`／`admin-table`／`admin-input` 既有樣式，跟頁面其餘
    區塊視覺一致
- 回歸驗證：
  - 既有中獎明細／玩法明細（`tw-lottery-payout`）報表不受影響（柑仔店與台彩鏡射玩法是兩套
    獨立資料）
  - 既有「經典遊戲」coin 常數編輯功能不受影響

## 成功標準

- [ ] 功能符合需求且行為正確
- [ ] UI 與既有後台頁面風格一致
- [ ] 無新增重大 console / runtime error
- [ ] 相關測試或手動驗證完成（Playwright 或等效手動驗證）
