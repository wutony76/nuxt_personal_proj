## 1. Server 端中獎明細 API

- [ ] 1.1 新增 `server/api/taiwan-lottery/prize.get.ts`（query: `gameCode`, `period`），內建
      `gameCode → { endpoint, resKey, buildTiers }` 設定表（見 design.md 驗證結果表，涵蓋 5134/5118/1197/5120/1121/2108/2109）
- [ ] 1.2 賓果賓果（1102）查表查不到時回傳空陣列（不視為錯誤）
- [ ] 1.3 上游呼叫失敗要 `catch` 並 `createError`，比照 `last-number.get.ts` 現有慣例
- [ ] 1.4（可選，視正規化邏輯複雜度）抽出 `server/services/taiwanLotteryPrize.ts`

## 2. Client 服務與型別

- [ ] 2.1 `app/services/api.ts` 新增 `TaiwanLotteryPrizeTier` / `TaiwanLotteryPrizeResponse` 型別與
      `api.taiwanLottery.prize(gameCode, period)`
- [ ] 2.2 `app/services/taiwanLotteryService.ts` 新增 `fetchPrizeDetail(gameCode, period)`

## 3. 視覺主題（台彩柑仔店）

- [ ] 3.1 新增 `app/assets/style/taiwan_lottery.scss`：`.theme-taiwan-lottery` scoped 色票／字體變數（沿用
      `SAMPLE/Can you see this_/_ds/organic-.../styles.css` 的 organic tokens），新增全域
      `.taiwan-lottery-scrollbar`（赭橙色系，比照 `base.scss` 現有 `.lottery-scrollbar` 結構）
- [ ] 3.2 `app/assets/style/base.scss` 新增一行 `@use "./taiwan_lottery.scss";`
- [ ] 3.3 新增 `app/components/TaiwanLotteryPrizeDialog.vue`（結構比照 `GameRuleDialog.vue`：mask + panel +
      header + body，scoped SCSS，套用柑仔店色票與自訂捲軸，含 loading/error/success 三段狀態）

## 4. 前端頁面

- [ ] 4.1 新增 `app/pages/lottery-hall-taiwan.vue`：沿用 `taiwan-lottery-hall.vue` 現有三段式狀態與
      `_actions.loadLastNumber`，state 改為單一 `reactive` 同時管理 `results` 與 `prizeByGame`（per-gameCode 快取）
- [ ] 4.2 套上 `.theme-taiwan-lottery`：品牌識別「台彩柑仔店」子標題列、跑馬燈跑馬字條（真實開獎摘要＋法定
      提示文字）、瓦楞紙紋裝飾條、貨架卡片網格（沿用既有球色 `_handlers.getBallClass`）
- [ ] 4.3 每張卡片新增「查看中獎明細」按鈕，點擊才 lazy-fetch，打開 `TaiwanLotteryPrizeDialog`，含 loading/error 顯示
- [ ] 4.4 中獎明細內容：獎項名稱、中獎注數（`winnerCount`）、單注獎金（`perPrize`）／倍率（`multiple`/`bonus`）
- [ ] 4.5 賓果賓果卡片不顯示「查看中獎明細」按鈕，改顯示 `lotBigSmall`／`lotOddEven`／`lotSpecial` 標籤
- [ ] 4.6 邏輯依專案規範分層：`_handlers`（球色、獎項文案轉換）、`_actions`（loading guard + early return）
- [ ] 4.7 未登入導向 `/login`（沿用既有 `useAuth` 檢查）
- [ ] 4.8 `useHead` 掛 Google Fonts：Caprasimo / Noto Serif TC / Figtree / Noto Sans TC（比照 `game-hall.vue`
      既有頁面自掛字體做法）

## 5. 路由與導覽

- [ ] 5.1 刪除 `app/pages/taiwan-lottery-hall.vue` 舊邏輯，改為轉址殼（`definePageMeta({ redirect:
      '/lottery-hall-taiwan' })`，或於 `nuxt.config.ts` 加 `routeRules`，二者擇一）
- [ ] 5.2 `app/components/AppTopbar.vue` 導覽連結改為 `/lottery-hall-taiwan`
- [ ] 5.3 `app/pages/game-hall.vue`：解除 `TABS` 裡 `{ key: 'taiwan', label: '台彩大廳' }` 的註解；
      link-panel 連結改為 `/lottery-hall-taiwan`

## 6. OpenSpec 文件

- [ ] 6.1 `proposal.md` / `design.md` / `tasks.md` / `specs/taiwan-lottery-hall/spec.md`（本次變更文件本身）

## 7. 驗證

- [ ] 7.1 `npm run dev` 啟動後，實際瀏覽 `/lottery-hall-taiwan`：8 款遊戲開獎號碼皆正常顯示、柑仔店主題
      （色票／字體／跑馬燈／瓦楞紙紋）套用正確
- [ ] 7.2 點開威力彩／大樂透／今彩539／39樂合彩／49樂合彩／3星彩／4星彩的中獎明細 Dialog，確認為真實台彩
      資料（數字合理、非假資料／非固定值），Dialog 樣式（含捲軸）符合柑仔店主題
- [ ] 7.3 賓果賓果卡片顯示標籤、無中獎明細按鈕、不報錯
- [ ] 7.4 舊路由 `/taiwan-lottery-hall` 能正確轉址到 `/lottery-hall-taiwan`
- [ ] 7.5 `AppTopbar` 導覽「台彩」連結與 `game-hall.vue` 的台彩分頁皆可正常導航到新頁面
- [ ] 7.6 未登入狀態下訪問 `/lottery-hall-taiwan` 會導向 `/login`
- [ ] 7.7 模擬上游其中一款遊戲的中獎明細呼叫失敗，確認只影響該 Dialog 的錯誤顯示，其餘卡片與開獎號碼不受影響
- [ ] 7.8 `npx nuxt typecheck` 確認新增/修改檔案無型別錯誤
