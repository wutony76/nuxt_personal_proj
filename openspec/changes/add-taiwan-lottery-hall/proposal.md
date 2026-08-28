## Why

現有 `app/pages/taiwan-lottery-hall.vue` 只是一個唯讀「最後開獎號碼」列表頁，串接
`server/api/taiwan-lottery/last-number.get.ts` → 台彩官方 `LastNumber` API，只有開獎號碼，完全沒有「中獎」
（各獎項中獎注數／單注獎金）資訊。這跟既有 `lottery-hall.vue`（BG 六合彩體系，含下注/路珠/報表）比起來功能
單薄，也是 `game-hall.vue` 裡目前刻意隱藏（註解掉）「台彩大廳」分頁的原因。使用者要求把它強化成一個內容完整
的「資訊型大廳」：保留唯讀（台彩本身不開放線上代購/下注），但新增「開獎＋中獎」真實資料，並把路由改成跟既有
`/lottery-hall` 對稱的 `/lottery-hall-taiwan`。

## What Changes

- 新增頁面 `app/pages/lottery-hall-taiwan.vue`，取代 `app/pages/taiwan-lottery-hall.vue`，品牌識別為
  **「台彩柑仔店」**：
  - 視覺主題沿用 `SAMPLE/Can you see this_/柑仔店彩票大廳.dc.html` 的台灣懷舊雜貨店風格（暖米色底、
    赭橙／橄欖綠雙主色、Caprasimo/Noto Serif TC 標題字、pill 按鈕、跑馬燈跑馬字條、瓦楞紙紋裝飾條），
    比照專案既有「每個遊戲頁面自帶主題色＋自訂捲軸」慣例落地為 scoped `.theme-taiwan-lottery` 樣式與新的
    `.taiwan-lottery-scrollbar` 全域捲軸類別（詳見 design.md Decision 5）。
  - 8 款台彩遊戲的開獎號碼以「貨架卡片」呈現，沿用現有三段式（loading/success/error）狀態慣例。
  - 每張卡片新增「查看中獎明細」按鈕，點擊才 lazy-fetch 並快取，以新元件 `TaiwanLotteryPrizeDialog.vue`
    （比照 `GameRuleDialog.vue` 的專屬 Dialog 慣例，套用柑仔店主題與自訂捲軸）呈現：威力彩／大樂透／
    今彩539／39樂合彩／49樂合彩／3星彩／4星彩皆顯示各獎項的中獎注數與單注獎金；賓果賓果因玩法結構完全不同
    （5 分鐘一期、固定賠率玩法），改顯示大小／單雙／特別號標籤，不提供中獎明細按鈕。
  - 跑馬燈跑馬字條顯示真實開獎資訊摘要（各遊戲最新期別）與法定提示文字（未滿 18 歲不得購買等），不使用
    假造數字。
  - 舊路徑 `/taiwan-lottery-hall` 轉址到新路由，避免既有連結／書籤失效。
- 新增 server 端 API `server/api/taiwan-lottery/prize.get.ts`（query: `gameCode`, `period`），依 gameCode
  對照表 dispatch 到台彩官方對應的期別查詢端點，正規化成統一的中獎明細格式回傳（詳見 design.md 的驗證結果表）。
- `app/services/api.ts` 新增 `api.taiwanLottery.prize()` 與對應型別；`app/services/taiwanLotteryService.ts`
  新增 `fetchPrizeDetail()`。
- `app/components/AppTopbar.vue` 的導覽連結、`app/pages/game-hall.vue` 的台彩 link-panel 連結，皆改指向
  `/lottery-hall-taiwan`；順手解除 `game-hall.vue` 目前註解掉的 `{ key: 'taiwan', label: '台彩大廳' }` 分頁
  （功能強化後沒理由繼續隱藏）。

## Capabilities

### Added Capabilities

- `taiwan-lottery-hall`：唯讀顯示台彩 8 款遊戲的最新開獎號碼，並提供其中 7 款（除賓果賓果）的真實中獎明細
  （中獎注數／單注獎金），資料來源為台彩官方公開 API，非模擬資料。

## Impact

- 新增檔案（client）：`app/pages/lottery-hall-taiwan.vue`
- 刪除檔案（client）：`app/pages/taiwan-lottery-hall.vue`（邏輯搬移到新頁面，不留重複檔案）
- 修改檔案（client）：`app/components/AppTopbar.vue`、`app/pages/game-hall.vue`、`app/services/api.ts`、
  `app/services/taiwanLotteryService.ts`
- 新增檔案（server）：`server/api/taiwan-lottery/prize.get.ts`（視正規化邏輯複雜度，可能再加
  `server/services/taiwanLotteryPrize.ts`）
- 新增檔案（client，視覺主題）：`app/components/TaiwanLotteryPrizeDialog.vue`、`app/assets/style/taiwan_lottery.scss`
- 修改檔案（client，視覺主題）：`app/assets/style/base.scss`（新增一行 `@use`）
- 不涉及資料庫、不涉及登入以外的權限模型；沿用現有 `useAuth` 未登入導向 `/login` 的行為
- 不影響既有 BG 六合彩體系（`lottery-hall.vue` 及其下所有 `bg/` 組件、composables）
