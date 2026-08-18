## 1. 玩法設定來源盤點（唯讀，不寫程式）

- [x] 1.1 讀取 `bglottery` `pceggs/config_play.js`、`dict.js`、`header.vue`、`zhengheTraditional/play.vue`、`tool_right.vue`，確認 5 大分類 33 個 playId 與已知判定邏輯（大小門檻、色波表）
- [x] 1.2 交叉比對後台 `svn-all/lotteryAdmin/**/pcdd/**` 的 `config_paly.js`／`config_play.js`／`hunhe/config.js`，確認玩法名稱與 playId 完全一致、且門檻邏輯同樣缺漏
- [x] 1.3 確認 `pcv2_0223` 尚未有 PC蛋蛋 config（只有 pk10/sc/k3），本次沒有第二來源可對帳，一律以 `bglottery` 為準
- [x] 1.4 极大/极小門檻與使用者確認：极小 = 0~5、极大 = 22~27（記錄於 `design.md`）

## 2. Config 核心層（`shared/config/eggs.ts`）

- [x] 2.1 建立 `shared/config/eggs.ts`：3 球、每球 0~9、共 1000 種等機率結果；提供 `eggsDigitsOf`、`eggsSumOf`（0~27）、`eggsPatternOf`（豹子/对子/顺子，沿用 `ssc.ts` 的 `sscTriplePatternOf` 判定邏輯但独立實作，避免跨遊戲 import）、`EGGS_TOTAL_OUTCOMES`、`EGGS_SUM_COUNTS`（窮舉建表）
- [x] 2.2 加入具名常數並附來源註解：`EGGS_BIG_LINE`（>13 大）、`EGGS_WAVE_MAP`（紅/藍/綠/灰四色表，來源 `dict.js`）、`EGGS_EXTREME_BIG_RANGE`＝[22,27]、`EGGS_EXTREME_SMALL_RANGE`＝[0,5]（使用者確認、非原始碼依據）
- [x] 2.3 用 esbuild bundle 後以 node 執行一支對帳腳本：驗證 `EGGS_SUM_COUNTS` 總和 = 1000、豹子/对子/顺子組合數合計與窮舉一致

## 3. Config 判定層（`shared/config/eggs-cd.ts`）

- [x] 3.1 建立 `EggsBet` descriptor 型別（`side` / `wave` / `pattern` / `sum`，比照 `ssc-cd.ts` 的 `_parseBet` 模式）
- [x] 3.2 實作 `_parseBet`：辨識大/小/单/双/极大/极小/大单/小单/大双/小双/红波/蓝波/绿波/豹子/对子/顺子/0~27
- [x] 3.3 實作 `eggsChanceOf`（各注項的 hit/total，供賠率推導）與 `eggsIsHit`（是否命中）
- [x] 3.4 實作 `eggsOddsOf`（公平賠率 × RTP，無條件捨去 2 位小數，`EGGS_RTP_FALLBACK = 0.97`）與 `judgeEggsBet`（含鎖定賠率、payout 計算）
- [x] 3.5 撰寫 `EGGS_PLAY_DEFINITIONS`（玩法分頁清單，供前端玩法列與伺端註冊對帳）

## 4. Config 看板設定層（`shared/config/eggscd/`）

- [x] 4.1 建立 `shared/config/eggscd/plays.js`（5 大分類合一個檔案；每個玩法項目含 `playId`、`name`、`columns` 等 UI 佈局提示）—— 一律 `.js` 且不 import 任何東西（Nitro 限制，同 K3/SSC 慣例）
- [x] 4.2 建立 `shared/config/eggscd/helpers.ts`：`findEggsTab`、`eggsQuotaOf`、`eggsRtpOf`、`eggsTabOddsOf`、`eggsHasBetCode`（比照 `k3cd/helpers.ts`）
- [x] 4.3 對帳：33 個注項的 `playId`／`name` 逐項唯一，且與 `bglottery` `config_play.js` 逐項比對一致

## 5. Server 服務層

- [x] 5.1 `app/config/constants.js` 新增 `LOTTERY.EGGS`（單一鍵值、無 `sub` 欄位）
- [x] 5.2 建立 `server/services/game/lottery/bg/eggs.ts`：繼承 `LOTTERY_BASE`（比照 `k3Cd.ts` 但拿掉 `k3Shared` 共用期表／彩池與抽水機制，因無官方盤可共用）
  - `randomOpenCode`：3 球 0~9
  - `buildDayRecords` / `prdOpenCode`：自行持有期表（不透過 Shared 單例）
  - `openCodePlay`：回傳 3 球資料
  - `validateBetQuota` / `buildOrderRows` / `settleIssuePrize`：一注一注項，賠率鎖進注單
  - `get.userInfo()`（必須，否則 `/api/lottery/userInfo` 會 500）
  - `get.userDialogRecord()`、`actions.claimOneIssue()`
  - `user.eggsRecord` 獨立紀錄欄位
- [x] 5.3 `server/services/storage.ts` 註冊 `new EggsClass()`
- [x] 5.4 建立 4 支 API：`server/api/lottery/eggs/{current,claim,user-record,opencode-history}`（比照 k3-cd 對應檔案，拿掉 `pool` 欄位）

## 6. 前端 API 層與 Composable

- [x] 6.1 `app/services/api.ts` 新增 `EggsCurrent`／`EggsUserRecordResponse`／`EggsUserBetHistory` 型別與 4 支 `$fetch` 方法；`currentInfo()` 補上 `EGGS` case
- [x] 6.2 建立 `app/composables/useEggs.ts`（比照 `useK3.ts`，拿掉 `setMode`／官方盤分支／彩池狀態）：`state.select`／`selectTabId`／`select.pool`、`fetch.current`／`fetch.userRecord`／`fetch.bets`／`fetch.claim`／`fetch.autoBets`

## 7. 前端元件（`app/components/lottery/bg/eggs/**`，不分 cd/of）

- [x] 7.1 `base/Ball.vue`：PC蛋蛋開獎球視覺元件（比照 `k3/base/Dice.vue`，改為 0~9 數字球）
- [x] 7.2 `block/Header.vue`：期別／倒數／開獎球／和值大小單雙標示（比照 `k3/block/Header.vue`）
- [x] 7.3 `block/History.vue`：近五期開獎
- [x] 7.4 `block/Road.vue`：路珠走勢（比照 `k3/block/Road.vue`，PC蛋蛋沒有圍骰/和局，只有大小／單雙兩種結果）
- [x] 7.5 `base/Board.vue`：下注面板，依 `eggscd/plays.js` 動態渲染 5 大分類（比照 `k3/cd/base/Board.vue` 的 `layout` computed 與 `registerSelectPool`）
- [x] 7.6 `block/CurrItems.vue`：已選注項列表
- [x] 7.7 `block/Controls.vue`：投注金額／快捷金額／確認投注
- [x] 7.8 `block/Report.vue`：下注紀錄表格
- [x] 7.9 `block/DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue`／`DialogShell.vue`
- [x] 7.10 `block/footer/Chat.vue`（沿用既有聊天室元件模式，placeholder）
- [x] 7.11 `block/footer/Auto.vue`：自動下注面板

## 8. 頁面

- [x] 8.1 建立 `app/pages/lottery/bg/egg.vue`（單頁，layout 參考 `k3-cd.vue`：Top → Header → 用戶資訊/歷史/路珠 → 投注區 → Report → 三個 Dialog，拿掉盤口切換）

## 9. 大廳與自動下注面板整合

- [x] 9.1 `app/pages/lottery-hall.vue`：新增 `GAME_META.EGGS` 文案；新增 `GAME_MODES` 覆寫機制，`EGGS` 只產生單一模式卡片（`suffix` 留空，routeKey 直接是 `'EGGS'` 不加後綴）；`ROUTE_DICT` 新增 `'EGGS': '/lottery/bg/egg'`
- [x] 9.2 `app/composables/useBgAutoActive.ts`：`LotteryType` 加入 `'eggs'`
- [x] 9.3 `app/components/lottery/bg/BgAutoPanel.vue`：新增 `EggsAuto`／`EggsChat` 分支
- [x] 9.4 新增 SCSS（`app/assets/style/lhc_eggs.scss`）並掛進 `base.scss` manifest

## 10. 驗證

- [x] 10.1 對帳：`eggsChanceOf` 各注項機率窮舉、`judgeEggsBet` 與規格文件情境逐一核對（和值 14/13、极大 22/极小 5、色波、豹子/顺子/环狀連號、特碼直選）
- [x] 10.2 `npm run dev` 手動測試（以 curl + session cookie 走完整 API 流程）：登入 → 對「大小」「特殊玩法」下注 3 筆 → 等待開獎（和值 9+0+5=14＞13＝大）→ 確認「大」中獎 19.4（賠率 1.94 鎖進注單）、「小」「豹子」未中，餘額變化與 `balanceChanges` 一致 → 領獎後 `claimableIssues` 清空、餘額進帳 19.4
- [x] 10.3 `/lottery-hall`、`/lottery/bg/egg` 兩頁皆回應 200，且頁面回傳的樣式清單正確引入所有 eggs 元件（`eggs/block/Header.vue`／`eggs/base/Ball.vue` 等 chunk 都有掛上），確認沒有編譯或路由錯誤；頁面為 client render（SPA），實際卡片數量／既有 4 個玩法卡片未受影響需使用者在瀏覽器目測確認
- [x] 10.4 確認 `npm run build` 無編譯錯誤（已跑過兩次全量 build，exit code 0）
