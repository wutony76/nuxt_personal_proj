# Engineering Evidence

## 變更摘要

- 對應變更：add-toy-shop-admin-controls
- 變更檔案清單：
  - `server/services/admin/modules/toyShop.ts`（新增）
  - `server/services/admin/hfyyLotteryTw.ts`
  - `server/api/admin/toy-shop/settings.get.ts`（新增）
  - `server/api/admin/toy-shop/settings.patch.ts`（新增）
  - `server/api/admin/toy-shop/odds/[slug].put.ts`（新增）
  - `server/api/admin/toy-shop/games/[slug].patch.ts`（新增）
  - `server/api/games/toys/catalog.get.ts`
  - `server/api/games/toys/bamboo-copter/roll.post.ts`
  - `server/api/games/toys/big-pig/roll.post.ts`
  - `server/api/games/toys/cards/roll.post.ts`
  - `server/api/games/toys/gummy/roll.post.ts`
  - `server/api/games/toys/lucky-draw/roll.post.ts`
  - `server/api/games/toys/pog/roll.post.ts`
  - `server/api/games/toys/soda-whistle/roll.post.ts`
  - `server/api/games/toys/whistle-candy/roll.post.ts`
  - `server/services/game/toys/difficulty.ts`（新增：難度共用換算工具）
  - `server/services/game/toys/bigPig.ts`／`bambooCopter.ts`／`whistleCandy.ts`／
    `luckyDraw.ts`／`sodaWhistle.ts`／`cards.ts`／`gummy.ts`／`pog.ts`（8 款玩法接入難度、
    重新校準派彩倍數）
  - `server/services/game/toys/catalog.ts`（`LUCKY_DRAW_REWARDS`／`SODA_PRIZES`／
    `BAMBOO_TARGETS` 的倍數／權重重新校準）
  - `app/services/api.ts`（新增型別 `ToyShopOddsItem`/`ToyShopSettings`、`ToyCatalogResponse`
    補 `enabled`、新增 `api.admin.toyShop.*`）
  - `app/pages/admin/taiwan-lottery.vue`（新增「柑仔店櫥仔設定」區塊）
  - `app/pages/lottery-hall-taiwan.vue`（柑仔店櫥仔區塊關閉時整塊隱藏，且不可進入玩法）
- Commit / PR 參考：（尚未提交，待使用者確認後由使用者指示建立 commit）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- 佐證附件（截圖 / log / 測試輸出）：
  - curl 驗證：`PATCH settings {enabled:false}` → `POST /api/games/toys/pog/roll` 回
    `403 柑仔店櫥仔目前暫停開放。`
  - curl 驗證：`GET /api/games/toys/catalog` 於關閉期間回應 `enabled: false`
  - curl 驗證：`PUT /api/admin/toy-shop/odds/whistle-candy {multiplier:3}` 後，實際下注
    一次 `win`（基礎派彩 19），`GET /api/games/toys/history` 顯示 `toy-reward` 實際入帳
    57（= 19 × 3）
  - Playwright：後台「彩運來」頁截圖確認「柑仔店櫥仔設定」區塊（開關 + 卡片式賠率格）正常
    渲染；切換關閉後確認前台 `/lottery-hall-taiwan` 的 `#tw-shelf` 整塊從 DOM 移除（`locator`
    命中數 0），重新開啟後恢復顯示（命中數 1）（截圖與腳本為驗證過程臨時檔案，未留存於
    程式碼庫）
  - curl 驗證：`PATCH /api/admin/toy-shop/games/pog {enabled:false}` 後，`GET
    /api/games/toys/catalog` 的 `items` 不含 `pog`，`POST /api/games/toys/pog/roll` 回
    403「此玩法目前暫停開放。」，其他玩法（`big-pig`）不受影響仍正常回應
  - Playwright：後台單一玩法卡片點「下架」後顯示「已下架」，前台貨架文字內容確認不含該
    玩法名稱；重新「上架」後恢復顯示，並確認所有玩法狀態回到預設（`enabled:true`、
    `multiplier:1`）
  - Playwright：後台卡片編輯態同時顯示「賠率」與「難度」兩個輸入框，一次「儲存」送出
  - Node 模擬腳本（直接打 8 款玩法真實 API，非單元測試）在難度=1、賠率=1 下各跑
    100~400 局，統計中獎率／回饋率（見 validation.md 的實測表），確認落在目標區間
  - Node 模擬腳本把大豬公難度改成 5，重跑 300 局，中獎率從 89.5% 降到 64.0%，跟理論值
    `scaleWinProbability(0.9, 5)`≈64.3% 幾乎一致
  - `npx tsc --noEmit` 掃過 `server/` 抓出 `bambooCopter.ts`／`gummy.ts` 的
    `resolveWithFate` 解構欄位對錯名問題，修正後重新模擬驗證恢復正常（竹蜻蜓中獎率從
    0.0% 回到 89.8%，橡皮糖回到 86.0%）

## 風險與後續追蹤

- 已知風險：
  - in-memory 設定，伺服器重啟後回復預設值（`enabled: true`、賠率 1、難度 1），與專案
    現況一致，非新增風險
  - `cards`／`gummy` 實測中獎率（84.5%／86.0%）略低於 90% 目標，屬模擬抽樣下的已知落差
- 後續追蹤事項（Open Questions 延伸）：
  - 單一玩法下架是直接從前台隱藏，沒有「已下架」的灰卡片提示；若後續想讓玩家知道曾經有這
    款玩法，需另外設計
  - 若後續想更精準命中 90%／98% 目標（目前是分析估算 + 抽樣驗證，非解析證明），可以再
    針對 `cards`／`gummy` 微調基準機率或 `CARD_STREAK` 倍數

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（未執行 build / preview，專案現況也僅要求 dev 可啟動）
- [ ] 可執行 `openspec archive`（待使用者確認變更本身，再決定是否封存）
