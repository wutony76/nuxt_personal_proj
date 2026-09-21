# Engineering Evidence

## 變更摘要

- 對應變更：add-toy-shop-admin-controls
- 變更檔案清單：
  - `server/services/admin/modules/toyShop.ts`（新增）
  - `server/services/admin/hfyyLotteryTw.ts`
  - `server/api/admin/toy-shop/settings.get.ts`（新增）
  - `server/api/admin/toy-shop/settings.patch.ts`（新增）
  - `server/api/admin/toy-shop/odds/[slug].put.ts`（新增）
  - `server/api/games/toys/catalog.get.ts`
  - `server/api/games/toys/bamboo-copter/roll.post.ts`
  - `server/api/games/toys/big-pig/roll.post.ts`
  - `server/api/games/toys/cards/roll.post.ts`
  - `server/api/games/toys/gummy/roll.post.ts`
  - `server/api/games/toys/lucky-draw/roll.post.ts`
  - `server/api/games/toys/pog/roll.post.ts`
  - `server/api/games/toys/soda-whistle/roll.post.ts`
  - `server/api/games/toys/whistle-candy/roll.post.ts`
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
  - Playwright：後台「彩運來」頁截圖確認「柑仔店櫥仔設定」區塊（開關 + 賠率表）正常渲染；
    切換關閉後確認前台 `/lottery-hall-taiwan` 的 `#tw-shelf` 整塊從 DOM 移除（`locator`
    命中數 0），重新開啟後恢復顯示（命中數 1）（截圖與腳本為驗證過程臨時檔案，未留存於
    程式碼庫）

## 風險與後續追蹤

- 已知風險：
  - in-memory 設定，伺服器重啟後回復預設值（`enabled: true`、賠率 1），與專案現況一致，
    非新增風險
- 後續追蹤事項（Open Questions 延伸）：
  - 目前僅整店總開關，無單一玩法各自開關；若後續需要更細粒度控制，需另開變更
  - 賠率倍數目前只作用在最終派彩金額，未變動各玩法內部中獎機率；若未來需求是調整機率而非
    倍數，需另行設計

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（未執行 build / preview，專案現況也僅要求 dev 可啟動）
- [ ] 可執行 `openspec archive`（待使用者確認變更本身，再決定是否封存）
