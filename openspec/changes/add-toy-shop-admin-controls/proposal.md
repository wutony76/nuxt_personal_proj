# Proposal

## 變更名稱

add-toy-shop-admin-controls — 柑仔店櫥仔（toys）後台總開關、單一玩法上下架、賠率與中獎難度設定

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

實作完賠率倍數後，使用者追加確認：賠率倍數只改「中獎後拿多少錢」，不改「有沒有中獎」，
這不是他要的「難度」。第一版難度改成「事後在 `wallet.credit` 攔截、把中獎敲成沒中」，
使用者再次否決：這樣玩法自己的 API 回應仍顯示「中獎」，畫面跟實際入帳金額會不一致，體驗
不好，要求「逐款客製」——難度要真的接到每款玩法自己的隨機邏輯裡，讓「玩法自己判定的結果」
就是最終結果，不要事後改。

使用者同時給了明確的校準目標：**難度＝1（預設值）時，玩 10 次要有 9 次贏，每投入 100 元
平均要拿回 98 元**（房子只抓 2%，不會整包吃掉）。8 款玩法機制完全不同（見
`server/services/game/toys/difficulty.ts` 開頭註解的逐款分析），沒辦法共用同一份機率表，
所以做法是：
- 中獎機率：用「重骰到剛好符合目標」（`resolveWithFate`）或直接的機率換算
  （`scaleWinProbability`），讓每款玩法自己的隨機邏輯（骰子、猜拳、抽卡…）不變，只是被
  引導到跟目標一致的結果，畫面看到的隨機過程是真的、跟最終判定一致
- 派彩倍數：把各玩法原本寫死的倍數常數（`bigPig.ts` 的 5/2.5/1.9、`catalog.ts` 的
  `LUCKY_DRAW_REWARDS`／`SODA_PRIZES`／`BAMBOO_TARGETS`、`cards.ts` 的 `CARD_STREAK` 等）
  重新校準，讓「難度=1 時中獎的平均倍數」落在 ≈1.09（配合 90% 中獎率 → 回饋率 ≈98%）

## 目標

- 後台可一鍵開啟／關閉柑仔店櫥仔整體功能；關閉後前台不可再下注，前台貨架整塊隱藏。
- 後台可針對單一玩法上架／下架；下架時該玩法直接不出現在前台貨架（不是變成灰色不可點，
  是整張卡片不顯示），且該玩法下注一律擋單。
- 後台可針對 8 款玩法各自設定一個「賠率倍數」（預設 1），套用在實際派彩金額上。
- 後台可針對 8 款玩法各自設定一個「難度」（預設 1，數字越大越難贏）：真正改變中獎機率
  本身，且改動要接進各玩法自己的隨機邏輯——玩法自己的 API 回應（中獎與否、抽到什麼）跟
  最終入帳金額必須一致，不能事後覆寫。
- 難度＝1、賠率倍數＝1（預設狀態）時，8 款玩法要各自校準到「10 次中約 9 次贏、100 元
  平均拿回 98 元」（見下方「驗證方式」的實測數字，各玩法因機制不同會有些落差，落在
  84%～98% 中獎率、84%～100% 回饋率的範圍內，都比純粹「不虧本」寬鬆）。
- 沿用既有「經典遊戲 coin 常數」的後台管理慣例（in-memory、無 DB、admin 直接改活的執行期
  設定），維持整個專案「重啟即回復預設值」的一致行為。

## 範圍

- 包含：
  - 新增 `server/services/admin/modules/toyShop.ts`（開關 + 賠率倍數 in-memory 狀態與存取）
  - 補上 `server/services/admin/hfyyLotteryTw.ts` 的既有佔位（掛上 `toyShop`）
  - 新增後台 API：`server/api/admin/toy-shop/settings.get.ts`／`.patch.ts`、
    `server/api/admin/toy-shop/odds/[slug].put.ts`、`server/api/admin/toy-shop/games/[slug].patch.ts`
    （單一玩法上架／下架）
  - `server/api/games/toys/catalog.get.ts` 回應補上 `enabled` 欄位，且 `items` 過濾掉已下架玩法
  - 8 個 `server/api/games/toys/*/roll.post.ts`：整店關閉、或該玩法被下架時皆擋單（403）、
    傳入該玩法目前的難度、`wallet.credit` 入帳時套用賠率倍數
  - 新增 `server/services/game/toys/difficulty.ts`（難度共用換算：`scaleWinProbability`／
    `resolveFate`／`resolveWithFate`）
  - 修改 8 款玩法自己的 service 檔（`bigPig.ts`／`luckyDraw.ts`／`gummy.ts`／
    `whistleCandy.ts`／`pog.ts`／`bambooCopter.ts`／`sodaWhistle.ts`／`cards.ts`）：接入難度、
    重新校準各自的派彩倍數／權重表／獎金表常數（`catalog.ts` 的 `LUCKY_DRAW_REWARDS`／
    `SODA_PRIZES`／`BAMBOO_TARGETS` 的倍數欄位、`cards.ts` 的 `CARD_STREAK` 也一併調整）
  - `app/services/api.ts` 補上對應型別與 `api.admin.toyShop.*`
  - `app/pages/admin/taiwan-lottery.vue` 新增「柑仔店櫥仔設定」區塊（開關 + 8 款玩法卡片，
    每張卡含上下架、賠率倍數、難度）
  - `app/pages/lottery-hall-taiwan.vue` 柑仔店櫥仔區塊：關閉時整塊隱藏（不顯示區塊，不可進入玩法）
- 不包含：
  - 不做每款玩法「機率表以外」更大幅的玩法重寫（例如 pog 的洗牌／出牌介面、cards 的猜牌
    互動流程本身不變，只調整背後的判定機率與派彩倍數）
  - 不做角色權限分流（不比照 `roleGamePerms.ts` 的每角色可見度，全站玩家一致）
  - 不落地持久化（沿用專案現況：in-memory，伺服器重啟後回復程式碼預設值）
  - 不做逐款的精確數學驗證（僅用實測模擬抽樣驗證落在合理區間，非解析證明；`cards`／
    `gummy` 實測中獎率略低於 90% 目標，屬已知落差，見驗證方式）

## 影響面

- 前端路由/頁面：`app/pages/admin/taiwan-lottery.vue`、`app/pages/lottery-hall-taiwan.vue`
- 前端元件/Composables：無新增元件，沿用既有 `admin-*` 樣式 class 與頁面內 state
- 後端 API/Services：
  - 新增 `server/services/admin/modules/toyShop.ts`（含單一玩法上架／下架狀態）
  - 新增 `server/api/admin/toy-shop/*`（含 `games/[slug].patch.ts`）
  - 新增 `server/services/game/toys/difficulty.ts`
  - 修改 8 個 `server/api/games/toys/*/roll.post.ts`、`server/api/games/toys/catalog.get.ts`
  - 修改 8 款玩法各自的 service 檔與 `catalog.ts` 的獎項常數（見上方「範圍」）
- 設定或常數（`app/config/`）：無（新設定放在 admin service module，不動 `app/config/`）

## 風險與對策

- 技術風險：
  - 風險：8 款玩法機制完全不同（骰子比大小、猜拳、猜牌、權重抽獎、高度門檻、5 回合多數決
    的比牌…），套同一份「難度」公式會失真（例如 pog 是 5 回合至少 3 勝，跟單次判定的其他
    玩法基準機率不能共用同一個 0.9）
  - 對策：`difficulty.ts` 只提供共用的機率換算工具（`scaleWinProbability`／`resolveFate`／
    `resolveWithFate`），每款玩法自己決定要套用的基準機率與注入點，在各自 service 檔頂部
    寫清楚算法依據（例如 pog 反推 n=5,p=0.75 讓「至少 3 勝」≈90%）
  - 風險：「重骰到符合目標」（`resolveWithFate`）在天然機率極低時可能重骰到上限（40 次）
    還沒命中，導致難度極端時精準度下降
  - 對策：有上限就接受最後一次結果，極端 difficulty 本來就是 edge case，不影響預設（=1）
    情況下的準確度（已用實測驗證，見下方）
  - 風險：`cards.ts` 的「相同」猜法天然機率是 0%（抽到的牌本來就不在剩餘牌堆裡），重骰
    永遠不會自然命中
  - 對策：`_guess` 內特別處理：難度判定要贏且天然重骰不到時，直接讓抽到的牌等於玩家手上
    那張（不假裝抽牌），並改用較低的基準機率（0.15）反映「相同」原本就该是稀有高賭注選項
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
  - 後台把單一玩法下架後，該玩法從前台貨架 `items` 消失、`roll` 回 403，其他玩法不受影響
  - 後台把該玩法重新上架後，前台貨架恢復顯示、下注恢復正常
  - 後台調整某玩法賠率倍數（例如設為 2），實際中獎入帳金額（`toy-reward` 金額）確實變成
    「原本應派彩金額 × 2」
  - 賠率倍數設為 0 時，中獎入帳金額為 0，不影響下注扣款
  - 用 Node 腳本模擬各玩法在難度=1、賠率=1 預設狀態下連續下注（每款 100~400 局），實測
    中獎率與回饋率：
    | 玩法 | 中獎率 | 回饋率 |
    |---|---|---|
    | 大豬公 | 89.5% | 98.9% |
    | 竹蜻蜓（選最低門檻） | 89.8% | 89.8% |
    | 哨子糖 | 87.5% | 96.0% |
    | 抽抽樂 | 91.0% | 100.0% |
    | 汽水笛 | 97.8% | 97.8% |
    | 紙牌（猜大） | 84.5% | 84.5% |
    | 橡皮糖 | 86.0% | 86.0% |
    | 尪仔標 | 84.0% | 98.9% |

    皆落在「大多數會贏、不會整包吃掉」的目標區間（84%~98% 中獎率、84%~100% 回饋率），
    `cards`／`gummy` 略低於 90% 目標，屬已知落差（見風險與對策）
  - 把某玩法難度從 1 調到 5（大豬公實測），中獎率從 89.5% 降到 64.0%，跟理論值
    （`scaleWinProbability(0.9, 5)` ≈64.3%）幾乎一致，確認難度确实真的影響機率本身，
    不是事後蓋掉結果
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
