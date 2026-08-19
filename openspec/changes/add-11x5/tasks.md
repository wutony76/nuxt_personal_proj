## 1. 玩法設定來源盤點（唯讀，不寫程式）

- [x] 1.1 讀取 `bglottery` `11x5/config_11x5_credit.js`、`creditTraditional/creditPlay{.vue,_script.js}`、`index{.vue,_script.js}`、`header.vue`，確認信用盤 3 個來源 playTabId 被前端切成 4 張分頁、共 112 個注項
- [x] 1.2 讀取 `11x5/config_11x5.js`、`official/{tabs.vue,play.vue,play_script.js}`、`official/js/{algorithm.js,select_num_tool.js}`，確認官方盤 8 個分頁與膽拖／任選的注數展開規則（階段 2 用）
- [x] 1.3 由 `common/roadMap.vue` 反推判定門檻：單球大小界線 7、總和大小界線 31、單雙奇偶、龍虎無和局（`roadMap.vue:480-530`）
- [x] 1.4 確認來源 `config_11x5_credit.js` 無名稱與賠率（原專案由伺端 `LotteryPlayOdds` 回傳後 `mergeCreditData()` 併入），名稱依 `design.md` 的推導鏈由 UI 行為反推
- [x] 1.5 窮舉腳本產出全部機率（C(11,5)=462 母數）：總和分佈、爆池候選、任選 N 中 M、猜中位、定單雙
- [x] 1.6 與使用者確認三個決策：爆池條件＝五球全單或全雙（7/462）、總和 6 項＝大小單雙+尾大尾小、交付切法＝先 CD＋彩池

## 2. Config 核心層（`shared/config/x5.ts`）

- [x] 2.1 建立 `shared/config/x5.ts`：`X5_BALL_COUNT = 5`、`X5_NUMBER_MIN = 1`、`X5_NUMBER_MAX = 11`、`X5_BALL_NAMES`、`X5_TOTAL_COMBOS = 462`、`X5_TOTAL_PERMS = 55440`
- [x] 2.2 判定門檻常數（附來源註解）：`X5_BIG_LINE = 7`（`roadMap.vue:490`）、`X5_SUM_BIG_LINE = 31`（`roadMap.vue:497`）、`X5_SUM_TAIL_BIG_LINE = 5`（**使用者確認、非原始碼依據**）
- [x] 2.3 純函式：`x5NumbersOf()`（驗證 5 個、1~11、**不重複**）、`x5SumOf()`、`x5SumTailOf()`、`x5DragonOf()`、`x5AllCombos()`（窮舉 462 並快取）、`x5SumCounts()`
- [x] 2.4 esbuild bundle + node 跑對帳腳本：`x5AllCombos().length === 462`、`x5SumCounts()` 各值合計 = 462、分佈對稱於 30、範圍 15~45

## 3. Config 判定層（`shared/config/x5-cd.ts`）

- [x] 3.1 `X5Bet` descriptor 型別（`ballNumber` / `ballSide` / `sumSide` / `anyHit` / `dragon`）與 `_parseBet()`（比照 `ssc-cd.ts`）
- [x] 3.2 `x5ChanceOf()`：單球號碼 1/11、單球兩面 5或6/11、總和 6 項查窮舉表、全5中1 5/11、龍虎 1/2
- [x] 3.3 `x5IsHit()`：對同一 descriptor 逐 kind 判定（龍虎**無和局**，五碼不重複故不可能相等）
- [x] 3.4 `x5OddsOf()`（公平賠率 × RTP，無條件捨去 2 位）、`judgeX5Bet()`、`X5_RTP_FALLBACK = 0.97`
- [x] 3.5 爆池：`X5_JACKPOT_SETTINGS`（`hitLabel: '五球全開單或全開雙'`、`hitRate: 7/462`）、`x5JackpotHit()`、`x5JackpotLabel()`
- [x] 3.6 `X5_PLAY_DEFINITIONS`（4 個 playKey，順序即前端玩法列順序，需與 `x5cd/plays.js` 一致）
- [x] 3.7 ⚠️ 本檔不可 import `x5cd/helpers`（會循環）；需要設定值一律由呼叫端傳入

## 4. Config 看板設定層（`shared/config/x5cd/`）

- [x] 4.1 建立 `shared/config/x5cd/plays.js`：4 分頁 112 注項，每項含 `playId`／`name`／`odds` 快照／`weight`／群組 `columns`；⚠️ 一律 `.js` 且**不得出現任何 import**（Nitro 對 shared 走 Node 原生 ESM、不認 `#shared` 別名）
- [x] 4.2 用腳本產生 `plays.js`（112 項手寫易錯），機率與賠率註解由窮舉直接帶出
- [x] 4.3 建立 `shared/config/x5cd/helpers.ts`：`x5Plays`／`findX5Play`／`findX5Tab`／`x5QuotaOf`／`x5RtpOf`／`x5MaxOddsOf`／`x5TabOddsOf`／`x5HasBetCode`／`x5JackpotWeightOf`（比照 `ssccd/helpers.ts`）
- [x] 4.4 ⚠️ `x5JackpotWeightOf()` 解析順序 `item.weight → group.weight → 0`，必須用 `== null` 判斷（明確 `weight: 0` = 排除，「沒設定」= 退 `weightFallback`，兩者語意不同）
- [x] 4.5 對帳：112 個 `playId`／`name` 逐項唯一；每項 `x5TabOddsOf()` 與 `plays.js` 的 odds 快照一致

## 5. Server 服務層

- [x] 5.1 `app/config/constants.js` 新增 `LOTTERY['X5']` 與 `LOTTERY['X5-CD']`（比照 `SSC`／`SSC-CD`）
      ⚠️ `X5-OF` **不在階段 1 登記** —— 實測過：鍵一存在，`/api/lottery/userInfo?lottery=X5-OF`
      會去拿 `Storage.games['X5-OF']`（不存在）而噴 500，等階段 2 有服務再登記
- [x] 5.2 建立 `server/services/game/lottery/bg/x5Shared.ts`（比照 `sscShared.ts`）：當日期表、開獎號（1~11 取 5 不重複）、共用彩池、兩盤口結算編排
- [x] 5.3 建立 `server/services/game/lottery/bg/x5Cd.ts`（比照 `sscCd.ts`）：`validateBetQuota`／`buildOrderRows`／`playBets`（含爆池抽水）／`settleIssuePrize`（含 `buildJackpotShares` 分配）／`get.userInfo()`／`get.creditJackpot()`／`get.userDialogRecord()`／`actions.claimOneIssue()`
- [x] 5.4 ⚠️ 爆池 share 必須併進 `payoutByUser`，且在寫 `claimableIssues` **之前**，否則玩家領不到
- [x] 5.5 `server/services/storage.ts` 註冊 `new X5CdClass()`
- [x] 5.6 建立 API：`server/api/lottery/x5-cd/{current,claim,user-record,opencode-history}` + `jackpot.get.ts`（服務未初始化時回 `EMPTY` 而非 500）

## 6. 前端 API 層與 Composable

- [x] 6.1 `app/services/api.ts`：新增 `X5Current`／`X5UserRecordResponse`／`X5UserBetHistory` 型別與 5 支 `$fetch`；`jackpotX5Cd` 重用既有 `CreditJackpotState`（不新增型別）；`currentInfo()` 補 `X5-CD` case
- [x] 6.2 建立 `app/composables/useX5.ts`（比照 `useSsc.ts`）：module-level singleton、cd/of 共用一支、`state.select`／`selectTabId`／`jackpot`／`isCd`、`fetch.current`／`userRecord`／`bets`／`claim`／`jackpot`／`startPolling`

## 7. 前端元件（`app/components/lottery/bg/11x5/**`）

- [x] 7.1 `base/Ball.vue`：1~11 號碼球（兩位數顯示）
- [x] 7.2 `block/Header.vue`：期別／倒數／開獎球／總和與大小單雙標示／爆池池額（滾動數字可參考 k3 Header 的 `_poolAnim`）
- [x] 7.3 `block/History.vue`：近五期開獎
- [x] 7.4 `block/Road.vue`：路珠（依來源 `roadMap.vue`：大小／單雙 × 第一~五球＋總，龍虎鬥 10 組球對，全5中1 冷熱遺漏）
- [x] 7.5 `block/CurrItems.vue`／`block/Controls.vue`／`block/Report.vue`（Report 需顯示 `jackpotAmount`）
- [x] 7.6 `block/DialogShell.vue`／`DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue`（爆池說明用 `hitLabel`／`hitRate`／`payoutRatio`／`minPool` 動態渲染，不寫死文案）
- [x] 7.7 `block/footer/Chat.vue`
- [x] 7.8 `cd/base/Board.vue`：依 `x5cd/plays.js` 動態渲染 4 分頁（比照 `ssc/cd/base/Board.vue`）
- [x] 7.9 `cd/block/footer/Auto.vue`（⚠️ 必須自成一份，不可與 of 共用 —— `project.md:52-55` 的 instance 殘留踩雷點）

## 8. 頁面

- [x] 8.1 建立 `app/pages/lottery/bg/11x5-cd.vue`（骨架比照 `ssc-cd.vue`：Top → Header → 使用者卡/歷史/路珠 → 投注區 → Report → Dialogs）

## 9. 大廳與自動下注面板整合

- [x] 9.1 `app/pages/lottery-hall.vue`：`GAME_META` 新增 11選5 文案、`ROUTE_DICT` 新增 `'X5-CD': '/lottery/bg/11x5-cd'`（階段 2 再加 `X5-OF`）
- [x] 9.2 `app/composables/useBgAutoActive.ts`：`LotteryType` 加入 `'x5'`
- [x] 9.3 `app/components/lottery/bg/BgAutoPanel.vue`：新增 `X5CdAuto`／`X5Chat` 分支
- [x] 9.4 新增 SCSS 並掛進 manifest

## 10. 驗證（階段 1）

- [x] 10.1 窮舉對帳：112 個注項的 `x5ChanceOf()` 與 `x5OddsOf()` 全部與腳本算出的機率一致
- [x] 10.2 `x5IsHit()` 情境：號碼命中／單球大小界線 7（開 07 判大、06 判小）／總和界線 31（開 30 判小、31 判大）／總和尾（尾 5 判尾大、尾 4 判尾小）／龍虎（不可能開和）／全5中1
- [x] 10.3 `x5JackpotWeightOf()` 三種情境：注項有 weight → 取注項；只有 group → 取 group；明確 `weight: 0` → 回 0（**不可**退 fallback）
- [x] 10.4 `buildJackpotShares()`：多筆 share 加總 = `pool * payoutRatio`（尾差由最後一筆吃）；未觸發期 `payout === 0`、`remain === pool`、`carryJackpot` 正確累加、`issueJackpotMap[issue]` 歸零；`minPool` 未達 → `reason: 'pool-too-low'` 全額滾存
- [x] 10.5 端到端（curl + session cookie）：登入 → 下注多筆（含 weight 1 與 weight 2）→ 開獎 → 結算 → `jackpotAmount` 寫進 betHistory → 領獎後餘額正確、該期從可領清單移除
- [x] 10.6 爆池觸發：以臨時探測路由強制用 `1,3,5,7,9`（全單）跑真實 `settleIssuePrize()`，確認派彩／滾存／`lastHit`，測完刪除路由
- [x] 10.7 `/api/lottery/x5-cd/jackpot` 在服務未初始化時回 `EMPTY` 而非 500
- [x] 10.8 `npm run dev` 頁面可開、`npm run build` exit code 0

## 10b. 階段 1 實測紀錄（2026-08-19）

- [x] 窮舉對帳（esbuild bundle + node）：`x5AllCombos()` = 462、`x5SumCounts()` 合計 462 且對稱於 30、範圍 15~45；
      爆池條件「全單或全雙」= 7/462 = 1.5152%
- [x] 112 個注項逐項對帳全通過：`x5TabOddsOf()`（用 name 與 playId 兩種查法）＝ `plays.js` 的 odds 快照、
      `x5HasBetCode()`、`x5JackpotWeightOf()` ＝ 宣告的 weight、`x5ChanceOf()` 可解析
- [x] weight 分布：55 項為 2（1-5球 號碼）、57 項為 1，無 weight 3
- [x] 拒單路徑（curl）：龍虎12和（不存在的和局注項）／總和大送去 1-5球 分頁／第一球12（號碼超界）
      ／單注 1 < min 2／單注 10001 > max 10000 —— 全部 400 且**餘額未被扣**（拒單在扣款前）
- [x] 端到端第一輪：下注 3 筆（第一球07 / 總和尾大 / 龍虎12龍）各 100 →
      開獎 04 11 06 03 02（總和 26、尾 6）→ 總和尾大中 193（100 × 1.93）、
      第一球07 未中、龍虎12龍 未中（04 < 11 為虎）→ 領獎後餘額 100,000 − 300 + 193 = 99,893 ✓
- [x] 抽水兩條線分開：下注 300 → 爆池抽水 3（1%）、共用彩池 issuePool 6（2%），互不相吃
- [x] 爆池 minPool 閘門（真實結算路徑）：池 998 < 1,000 → `payout 0`、全額滾存、`lastHit` 維持 null
- [x] 爆池觸發與分配（臨時探測路由強制以 `01 03 05 07 09` 呼叫真實 `settleIssuePrize()`，測完已刪除路由）：
      池 1,198 → 發放 599（× 0.5）；8 筆有份注單（2 帳號 × 4 筆中獎，未中的第二球07 被排除）；
      weight 2 的第一球01 拿 119.8、weight 1 的三筆各 59.9 → **2:1 比例正確**，
      share 合計 599 = payout（尾差由最後一筆吃）；滾存 599；
      `lastHit` = `全單 01 03 05 07 09` / pool 1198 / payout 599 / 8 注 / 2 人
- [x] 爆池加碼寫進 betHistory 的 `jackpotAmount` 並併入可領金額：領獎到帳 33,559.5 = 賠率派彩 33,260 + 爆池 299.5
- [x] `npm run build` exit code 0（Σ 6.53 MB；`11x5-cd` 頁面 chunk 與 `api/lottery/x5-cd` 五支路由都有進 build）
- [x] Playwright 實測 `/lottery/bg/11x5-cd`（無 console pageerror）：
      4 分頁注項數 55 / 26 / 20 / 11 ＝ 112；1-5球 與 全5中1 畫號碼球（兩位數 01~11、界線 7 分色）、
      兩面與龍虎鬥畫文字膠囊；開獎區 09 03 07 04 06 → 總和 29 標「小 單 尾大」；
      路珠 5 個角度；點注項後當前注項顯示「第一球01 / 10.67 / 10」、總注額 10；
      爆池說明動態渲染為「五球全開單或全開雙（1.52%）時發放 50%，未達 1,000.00 不發放」
- [x] `/lottery-hall` 與 `/lottery/bg/11x5-cd` 皆回 200；大廳只出一張 11選5 卡（`GAME_MODES.X5` 覆寫）

## 11. 階段 2（官方盤，本次不做）

- [ ] 11.1 `shared/config/x5-of.ts`：直選／組選／定位膽／不定位／任選 N 中 M／猜中位／定單雙的機率與判定
- [ ] 11.2 `shared/config/x5of/{plays.js,helpers.ts}`：8 分頁、含 `selectarea` 佈局（複式／單式／膽拖三種選號型態）
- [ ] 11.3 膽拖注數展開：`C(拖碼數, 目標碼數 − 膽碼數)`（來源 `algorithm.js:251-267`），膽碼上限 `目標碼數 − 1`，膽拖不同號（來源 `select_num_tool.js:69-90`）
- [ ] 11.4 `server/services/game/lottery/bg/x5Of.ts` + `server/api/lottery/x5-of/**`（含共用彩池 `pool` 欄位）
- [ ] 11.5 `of/base/Board.vue`（含膽拖選號 UI）／`of/block/footer/Auto.vue`／`app/pages/lottery/bg/11x5-of.vue`
- [ ] 11.6 `x5Shared.ts` 接上官方盤結算編排（等兩盤口都交件才結算共用彩池）
- [ ] 11.7 `app/config/constants.js` 登記 `LOTTERY['X5-OF']`（id 600101 / sort 601）、`useX5.ts` 的 `lotteryMeta` 改回依 `isCd` 分流、大廳移除 `GAME_MODES.X5` 覆寫、`ROUTE_DICT` 補 `X5-OF`、`BgAutoPanel` 補 `X5OfAuto`
