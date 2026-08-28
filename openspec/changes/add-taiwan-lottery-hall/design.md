## Context

- 現況 `app/pages/taiwan-lottery-hall.vue` 只呼叫 `server/api/taiwan-lottery/last-number.get.ts`（台彩官方
  `LastNumber` API），只有 `gameCode/drawDate/period/lotNumber`，賓果賓果額外有 `lotSpecial/lotBigSmall/lotOddEven`，
  完全沒有中獎（獎項／中獎注數／獎金）資料。
- 規劃階段已直接呼叫台彩官方 API 逐一驗證「中獎明細」端點是否存在（因為現有程式碼從未處理過這塊，無前例可循），
  結果 8 款遊戲中有 7 款可用 `period`（取自 `LastNumber` 回應）查到官方期別結果，且都含中獎注數／獎金：

  | gameCode | 遊戲 | Endpoint | 回應陣列 key | 獎項欄位 pattern | 欄位 |
  |---|---|---|---|---|---|
  | 5134 | 威力彩 | `SuperLotto638Result` | `superLotto638Res` | `super638{Jackpot,Second,Third,Fourth,Fifth,Sixth,Seventh,Eighth,Normal,Ninth}Assign` | `prize, lastPrize, winnerCount, perPrize` |
  | 5118 | 大樂透 | `Lotto649Result` | `lotto649Res` | `{jackpot,second,third,fourth,fifth,sixth,seventh,normal}Assign` | `prize, lastPrize, winnerCount, perPrize` |
  | 1197 | 今彩539 | `Daily539Result` | `daily539Res` | `d539{Jackpot,Second,Third,Fourth}Assign` | `winnerCount, perPrize` |
  | 5120 | 39樂合彩 | `39M5Result` | `m539Res` | `m539{Two,Three,Four}Assign` | `multiple, perPrize, winnerCount` |
  | 1121 | 49樂合彩 | `49M6Result` | `m649Res` | `m649{Two,Three,Four}Assign` | `multiple, perPrize, winnerCount` |
  | 2108 | 3星彩 | `3DResult` | `lotto3DRes` | `lotto3D{First,Second,Third}Assign` | `bonus, winnerCount, perPrize` |
  | 2109 | 4星彩 | `4DResult` | `lotto4DRes` | `lotto4D{First,Second,Third}Assign` | `bonus, winnerCount, perPrize` |
  | 1102 | 賓果賓果 | ❌ 無對應端點 | — | — | 沿用 `LastNumber` 已有的 `lotSpecial/lotBigSmall/lotOddEven` |

  Base URL：`https://api.taiwanlottery.com/TLCAPIWeB/Lottery/<Endpoint>?period=<期別>&pageNum=1&pageSize=1`。
  這些端點沒有官方文件保證穩定，是直接呼叫驗證得到的實際回應（驗證時間：2026-08-28）。
- 既有 `game-hall.vue` 已預留 `HallTab = 'lobby' | 'lottery' | 'taiwan'`，`'taiwan'` 分頁目前註解掉、link-panel
  暫時指向 `/taiwan-lottery-hall`；`AppTopbar.vue` 也已有「台彩」導覽連結。這次是把「已存在但功能單薄」的入口
  補完，不是從零建立新入口。
- 使用者指定視覺主題：沿用 `SAMPLE/Can you see this_/柑仔店彩票大廳.dc.html`（design-system tokens 在同目錄
  `_ds/organic-52e23790-14cc-46c8-8a5e-622d09c687a5/styles.css`）的「柑仔店」台灣懷舊雜貨店視覺語言——暖米色
  底（`#f5ead8`）、赭橙／橄欖綠雙主色、Caprasimo（配 Noto Serif TC）標題字、圓角膨膨的 pill 按鈕、跑馬燈
  跑馬字條、瓦楞紙紋裝飾條。品牌名稱訂為「台彩柑仔店」。
- 專案既有慣例：每個遊戲頁面自帶主題色＋專屬 Dialog 元件＋自訂捲軸（見 `GameRuleDialog.vue`／
  `GameRateDialog.vue` 的 `accentColor` prop 與 `::-webkit-scrollbar` 客製寫法），以及 BG 彩票體系全域共用的
  `.lottery-scrollbar`（`app/assets/style/base.scss`，紅色系）。這次比照同一套慣例，但換成「台彩柑仔店」的
  赭橙／橄欖綠色票，不沿用 BG 彩票的紅色系，也不是憑空發明新的樣式系統。

## Goals / Non-Goals

**Goals:**
- 8 款台彩遊戲的開獎號碼與（除賓果賓果外）7 款的中獎明細，皆為即時串接台彩官方資料，不用假資料。
- 路由改為 `/lottery-hall-taiwan`，舊路由保留轉址，不破壞既有連結。
- `game-hall.vue` 的台彩分頁與 `AppTopbar.vue` 導覽連結同步更新並解除隱藏。

**Non-Goals:**
- 不做任何形式的線上代購／下注／中獎兌獎流程（台彩官方本身不開放第三方代理這些行為，此頁純資訊展示）。
- 不做歷史期別查詢／分頁瀏覽（v1 只顯示每款遊戲「最新一期」的開獎與中獎，不提供期別選擇器）。
- 不做賓果賓果的中獎明細（未找到官方對應端點，且賓果賓果玩法結構跟其他 7 款差異太大，勉強套用同一套 UI
  只會讓資料錯誤或誤導）。
- 不做使用者收藏／中獎提醒／推播等加值功能。
- 不更動既有 BG 六合彩體系（`lottery-hall.vue` 與其下所有 `bg/` 組件）的任何邏輯。

## Decisions

1. **中獎明細用「單一 dispatch 端點＋設定表」，不是每款遊戲各開一支 server API**
   - 理由：8 款遊戲的上游回應結構差異很大（欄位名稱、獎項數量都不同），但呼叫模式完全一致（`period` 查最新
     一期），照專案「不要為了一兩處差異複製成兩份」的組件分類精神，這裡用一份 `gameCode → { endpoint, resKey,
     tierBuilder }` 的設定表比開 8 個幾乎一樣的路由檔案更合理，正規化邏輯集中一處好維護。
   - 做法：`server/api/taiwan-lottery/prize.get.ts?gameCode=&period=`，內部依表 dispatch 並統一轉成
     `TaiwanLotteryPrizeTier[]`；賓果賓果（1102）查表查不到直接回空陣列，前端據此不顯示中獎區塊。
   - 替代方案：每款遊戲一支路由（比照 retro 遊戲 `history.*.ts` 那種「一款一份」慣例）——放棄，這裡的差異只在
     「上游 endpoint 名稱與欄位」，不是業務邏輯分岔，開 8 支檔案是重複而非清晰的分層。

2. **中獎明細採「點擊才 lazy-fetch＋per-gameCode 快取」，用獨立主題化 Dialog 呈現，不是進頁一次打 8 個 API、也不是卡片內 accordion**
   - 理由：中獎明細不是使用者一進頁就需要看到的核心資訊（開獎號碼才是），一次打 8 個上游 API 會拖慢首屏、
     也增加台彩官方端點被判定異常流量的風險；呈現方式比照專案既有「每款遊戲一個專屬 Dialog 元件」慣例
     （`GameRuleDialog.vue`）而非卡片內 accordion，理由是中獎明細是「多獎項的表格資料」，獨立 Dialog 比卡片
     內展開更適合放這種表格內容，也更貼合使用者要求的「柑仔店」Dialog 視覺（見 Decision 5）。
   - 做法：新增 `app/components/TaiwanLotteryPrizeDialog.vue`（結構比照 `GameRuleDialog.vue`：mask + panel +
     header + body，自包含 scoped SCSS，不依賴全域 `useDialog`）。卡片上的「查看中獎明細」按鈕點擊時才呼叫
     `prize.get.ts`，成功後存進 `state.prizeByGame[gameCode]` 快取並開啟 Dialog，同一次頁面停留不重複打；
     Dialog 內有 loading／error／success 三段狀態。

3. **賓果賓果不強行套用中獎明細 UI，改顯示既有的大小／單雙／特別號標籤**
   - 理由：賓果賓果是 5 分鐘一期、多種固定賠率玩法（大小/單雙/正1~5/邊1~5/龍虎等），跟其他 7 款「單一組
     號碼、按獎項分級」的結構完全不同，且沒找到官方對應的「中獎注數」端點；勉強拼湊會顯示錯誤或誤導資訊。
   - 做法：賓果賓果卡片沿用現有 `LastNumber` 回應裡的 `lotSpecial/lotBigSmall/lotOddEven` 顯示成標籤，不提供
     「查看中獎明細」按鈕。

4. **舊路由轉址，`game-hall.vue` 解除隱藏台彩分頁**
   - 理由：`/taiwan-lottery-hall` 已存在一段時間，直接刪除會讓外部書籤/連結 404；`game-hall.vue` 的
     `'taiwan'` 分頁當初是因為功能單薄才註解隱藏，這次補完後沒理由繼續隱藏。
   - 做法：新建 `app/pages/lottery-hall-taiwan.vue` 承載完整邏輯，舊檔 `taiwan-lottery-hall.vue` 改成
     `definePageMeta({ redirect: '/lottery-hall-taiwan' })` 的轉址殼（或直接在 `nuxt.config.ts` 加
     `routeRules` 轉址，二者擇一，實作時依專案既有慣例決定）；`game-hall.vue` 解除 `TABS` 裡 `'taiwan'` 項目的
     註解，並把 link-panel 連結改為新路由。

5. **視覺主題用 scoped class `.theme-taiwan-lottery` 包住整頁，不污染全域 `:root`；比照 `.lottery-scrollbar` 前例新增 `.taiwan-lottery-scrollbar`**
   - 理由：`SAMPLE` 設計稿的色票／字體只給這個新頁面（與未來同系列頁面）用，不該混進全域 `:root`（會跟其他
     頁面的既有 CSS 變數搶命名空間）；比照 project.md 已明文的「管理後台樣式包在 `.theme-admin {}` scope 內」
     慣例，這裡包成 `.theme-taiwan-lottery`。捲軸則比照 `base.scss` 現有 `.lottery-scrollbar`（BG 彩票紅色系
     全域捲軸類別）新增一個同構但换成赭橙色系的 `.taiwan-lottery-scrollbar`，一樣掛在 `base.scss`（新增
     `app/assets/style/taiwan_lottery.scss` 並 `@use`）。
   - 做法：
     - 新增 `app/assets/style/taiwan_lottery.scss`：`.theme-taiwan-lottery { --color-bg: #f5ead8; --color-accent-500: #d67f48; ...（比照 SAMPLE 的 organic tokens 全套抄入，變數命名直接沿用方便對照）; }`，以及全域
       `.taiwan-lottery-scrollbar { scrollbar-color: ...; &::-webkit-scrollbar-thumb { background: #b2622d; } ... }`。
     - `base.scss` 頂部加一行 `@use "./taiwan_lottery.scss";`（跟 `lhc_*.scss` 同一批 `@use` 放在一起）。
     - 字體：比照 `game-hall.vue` 既有「頁面自己用 `useHead` 掛 Google Fonts `<link>`」做法，在
       `lottery-hall-taiwan.vue` 掛 `Caprasimo` + `Noto+Serif+TC` + `Figtree` + `Noto+Sans+TC`。
     - `TaiwanLotteryPrizeDialog.vue` 的自訂捲軸沿用同一色票（可直接掛 `.taiwan-lottery-scrollbar`，或比照
       `GameRuleDialog.vue` 內嵌同色系 `::-webkit-scrollbar` 寫法，二者擇一，實作時依內容是否需要獨立微調決定）。
   - 替代方案：把這套色票直接寫進全域 `:root`（比照 `base.scss` 現有 `--color-red-*` 那批）——放棄，那批是
     「BG 彩票全站共用」的既有全域變數，這次是全新的、只給台彩系列頁面用的獨立色票，硬塞進全域 `:root` 會讓
     未來讀 `base.scss` 的人搞不清楚哪些變數是誰在用，scoped class 才符合專案已有的 `.theme-admin` 慣例精神。

## Risks / Trade-offs

- [風險] 台彩官方 `api.taiwanlottery.com` 是未公開文件的內部 API（前端網站在用，但沒有對外 API 文件保證），
  未來改版可能導致端點消失或欄位變動——因應：`prize.get.ts` 對上游呼叫失敗要 `catch` 並回傳明確錯誤，前端
  該卡片的中獎明細區塊顯示「暫時無法取得」並提供重試，不影響其他卡片或開獎號碼本身的顯示。
- [風險] 8 款遊戲各自的欄位命名（`prize`/`bonus`/`multiple` 等）不統一，正規化時如果漏看某款的特例欄位，
  UI 可能顯示 `undefined`——因應：`TaiwanLotteryPrizeTier` 型別把 `multiple`/`bonus` 設為可選欄位，UI 依
  欄位是否存在決定顯示哪種標示（倍率 vs 定額），並在實作時逐款遊戲手動核對一次真實回應。
  - [風險] 賓果賓果沒有中獎明細是本次規劃階段的呼叫驗證結果，不是官方文件保證的「絕對不存在」——因應：若之後
  找到正確端點，`prize.get.ts` 的設定表可以直接補一筆，不影響其他 7 款的架構。

## Migration Plan

- 全新資訊頁面，無既有資料需要遷移；沿用現有登入檢查（`useAuth`），不影響其他頁面權限模型。
- 部署順序（每步可獨立驗證，比照專案既有分步慣例）：
  1. Server 端 `prize.get.ts`（尚未被前端呼叫，無風險）
  2. Client `app/services/api.ts` / `taiwanLotteryService.ts` 擴充
  3. 新頁面 `lottery-hall-taiwan.vue`（含開獎＋中獎 UI）
  4. 舊路由轉址殼、`AppTopbar.vue`／`game-hall.vue` 連結與分頁更新（此步驟起使用者才會經由新入口看到成果）

## Open Questions

- v1 只顯示「最新一期」，未來若要補「歷史期別查詢」（例如選擇期別回看過去中獎明細），需要另外設計期別選擇
  UI 與分頁邏輯，不影響本次架構。
- 是否需要在 server 端對台彩上游回應做短時間快取（例如 60 秒 in-memory cache 降低對官方端點的呼叫頻率）？
  屬於實作細節，留待實作階段依實測流量決定，不影響本次的路由與資料流架構。
