# Tasks

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/驗證方式）
- [x] 完成 design 定稿（state/flow/API/token mapping）
- [x] 確認設定介面放在 `app/pages/admin/taiwan-lottery.vue`（使用者指定，不另開分頁）

## 2. 後端 Service 與資料模型

- [x] 新增 `server/services/admin/modules/toyShop.ts`（開關 + 8 款玩法賠率倍數，in-memory）
- [x] `server/services/admin/hfyyLotteryTw.ts` 掛上 `toyShop`

## 3. 後端 API

- [x] `server/api/admin/toy-shop/settings.get.ts`
- [x] `server/api/admin/toy-shop/settings.patch.ts`
- [x] `server/api/admin/toy-shop/odds/[slug].put.ts`
- [x] `server/api/games/toys/catalog.get.ts` 回應補 `enabled`
- [x] 8 個 `server/api/games/toys/*/roll.post.ts`：關閉擋單（403）+ credit 套用賠率倍數

## 4. 前端 API 與型別

- [x] `app/services/api.ts` 新增 `ToyShopOddsItem`/`ToyShopSettings` 型別
- [x] `app/services/api.ts` 新增 `api.admin.toyShop.settings/setEnabled/setOdds`
- [x] `app/services/api.ts` 既有 `ToyCatalogResponse` 補 `enabled` 欄位

## 5. 前端頁面

- [x] `taiwan-lottery.vue` 新增 `toyShop` reactive state
- [x] `taiwan-lottery.vue` 新增「柑仔店櫥仔設定」區塊（開關 + 賠率表）
- [x] `taiwan-lottery.vue` 實作 `click.toggleShop`/`click.startEditOdds`/`click.cancelEditOdds`
      與對應 `actions.*`（loading guard + early return + 錯誤處理）
- [x] `lottery-hall-taiwan.vue` 柑仔店櫥仔區塊補上「暫停開放」提示與進入攔阻

## 6. 錯誤處理與體驗

- [x] 開關切換、賠率編輯皆有 loading / success / error 狀態
- [x] 錯誤訊息可被 UI 感知（讀 `err.data.message`），不吞錯

## 7. 視覺與互動驗證

- [x] 新區塊與頁面既有風格一致（`admin-panel`／`admin-table`／`admin-input`）
- [x] 手動驗證：開關關閉時 8 款玩法 API 皆回 403、前台貨架顯示提示
- [x] 手動驗證：賠率倍數調整後，中獎入帳金額正確依倍數縮放

## 8. 交付檢查

- [x] 確認 `npm run dev` 可正常啟動
- [x] 用 Playwright 或等效方式驗證後台頁面與前台貨架頁行為
- [x] 補齊 `validation.md` 與 `engineering-evidence.md`
