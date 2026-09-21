# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（state/flow/API/token mapping）
- [x] 確認設定介面放在 `app/pages/admin/taiwan-lottery.vue`（使用者指定，不另開分頁）

## 2. 後端 Service 與資料模型

- [x] 新增 `server/services/admin/modules/toyShop.ts`（整店開關 + 單一玩法上下架 +
      8 款玩法賠率倍數 + 難度，in-memory，難度預設 1）
- [x] `server/services/admin/hfyyLotteryTw.ts` 掛上 `toyShop`
- [x] 新增 `server/services/game/toys/difficulty.ts`（`scaleWinProbability`／`resolveFate`／
      `resolveWithFate` 共用工具，難度=1 時完全還原原機率）
- [x] 8 款玩法 service 檔接入難度（各自在自己的隨機邏輯注入點套用，不事後覆寫結果）：
      `bigPig.ts`／`bambooCopter.ts`／`whistleCandy.ts`／`luckyDraw.ts`／`sodaWhistle.ts`／
      `cards.ts`／`gummy.ts`／`pog.ts`
- [x] 重新校準各玩法派彩倍數／權重表，讓難度=1、賠率=1 時的中獎率與回饋率落在目標區間
      （`catalog.ts` 的 `LUCKY_DRAW_REWARDS`／`SODA_PRIZES`／`BAMBOO_TARGETS`、`cards.ts`
      的 `CARD_STREAK`、`bigPig.ts`／`whistleCandy.ts`／`pog.ts` 內建常數）

## 3. 後端 API

- [x] `server/api/admin/toy-shop/settings.get.ts`
- [x] `server/api/admin/toy-shop/settings.patch.ts`
- [x] `server/api/admin/toy-shop/odds/[slug].put.ts`（同時接收 `multiplier`/`difficulty`）
- [x] `server/api/admin/toy-shop/games/[slug].patch.ts`（單一玩法上架／下架）
- [x] `server/api/games/toys/catalog.get.ts` 回應補 `enabled`，且 `items` 過濾已下架玩法
- [x] 8 個 `server/api/games/toys/*/roll.post.ts`：整店關閉或該玩法下架皆擋單（403）+
      呼叫玩法時多帶 `difficulty` 參數 + credit 套用賠率倍數（難度已在玩法內部處理完）

## 4. 前端 API 與型別

- [x] `app/services/api.ts` 新增 `ToyShopOddsItem`/`ToyShopSettings` 型別（`ToyShopOddsItem`
      補 `enabled`/`difficulty` 欄位）
- [x] `app/services/api.ts` 新增 `api.admin.toyShop.settings/setEnabled/setOdds/setGameEnabled`
      （`setOdds` 改吃 `{ multiplier, difficulty }`）
- [x] `app/services/api.ts` 既有 `ToyCatalogResponse` 補 `enabled` 欄位

## 5. 前端頁面

- [x] `taiwan-lottery.vue` 新增 `toyShop` reactive state（含 `gameTogglePending`）
- [x] `taiwan-lottery.vue` 新增「柑仔店櫥仔設定」區塊（開關 + 卡片式賠率格，符合既有
      `admin-grid1` 髮絲線卡片視覺語言，開啟時卡片邊框轉綠色）
- [x] `taiwan-lottery.vue` 每張玩法卡片補上上架／下架切換
- [x] `taiwan-lottery.vue` 每張玩法卡片補上「難度」欄位，與賠率倍數同一編輯態一起送出
- [x] `taiwan-lottery.vue` 實作 `click.toggleShop`/`click.toggleGame`/`click.startEditOdds`/
      `click.cancelEditOdds` 與對應 `actions.*`（loading guard + early return + 錯誤處理）
- [x] `lottery-hall-taiwan.vue` 柑仔店櫥仔區塊：整店關閉時整塊隱藏；單一玩法下架時該玩法
      卡片不出現（由 catalog API 過濾，前端不需額外邏輯）

## 6. 錯誤處理與體驗

- [x] 開關切換、賠率編輯皆有 loading / success / error 狀態
- [x] 錯誤訊息可被 UI 感知（讀 `err.data.message`），不吞錯

## 7. 視覺與互動驗證

- [x] 新區塊與頁面既有風格一致（`admin-grid1`／`admin-panel`／`admin-input`／
      `admin-btn-secondary`／`admin-btn-ghost`）
- [x] 手動驗證：開關關閉時 8 款玩法 API 皆回 403、前台貨架區塊整塊隱藏
- [x] 手動驗證：單一玩法下架時該玩法從 catalog 消失、該玩法 roll 回 403，其他玩法不受影響
- [x] 手動驗證：賠率倍數調整後，中獎入帳金額正確依倍數縮放
- [x] 用模擬腳本驗證 8 款玩法在難度=1、賠率=1 時的中獎率／回饋率落在目標區間（見
      proposal.md 驗證方式的實測表）
- [x] 用模擬腳本驗證調高難度後中獎率確實下降、且接近理論值（大豬公難度 5 實測 64.0%
      vs 理論 64.3%）
- [x] TypeScript 型別檢查（`npx tsc --noEmit`）掃過 8 款玩法檔案，抓到並修正 2 處
      `resolveWithFate` 解構欄位對錯名的 bug（`bambooCopter.ts`／`gummy.ts`，dev server 用
      esbuild transpile 不會擋這種型別錯誤，得另外跑 tsc 才抓得到）

## 8. 交付檢查

- [x] 確認 `npm run dev` 可正常啟動
- [x] 用 Playwright 或等效方式驗證後台頁面與前台貨架頁行為
- [x] 補齊 `validation.md` 與 `engineering-evidence.md`
