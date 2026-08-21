## 1. 玩法設定來源盤點（唯讀）

- [x] 1.1 讀取 `bglottery` `kl8/` 全部檔案（2 個 config、2 組 play.vue/play_script.js、index、header、dict）
- [x] 1.2 查證球號範圍：`header.vue` 開獎動畫 `for (i=0;i<20;i++){random(0,80)}`、20 個 `?` 佔位 → 1~80 取 20
- [x] 1.3 查證 `dict.js`：kl8 底下零 import、2 個 config 無色波 playId → 殘留檔，不實作色波
- [x] 1.4 查證任選 minChosen/maxChosen：一中一 1~80、二中二~七中七皆 2~8/3~8/…/7~8，複式 `C(k,N)` 展開
- [x] 1.5 查證兩面分組結構：和值8/上下盤3/奇偶盤3/五行5，前端無判定式（判定在伺端）
- [x] 1.6 查證 6hc 五行先例：`n%5` 個別號碼歸類已被本專案判定為誤用，kl8 不可套用該模型
- [x] 1.7 使用者拍板四項規則：和值≥810大無和局／上下盤1~40:41~80比個數10:10和／奇偶盤同構／
      五行等機率五等分（DP窮舉邊界）／爆池＝奇偶失衡≤5或≥15／選號彩池玩法選3碼分層

## 2. Config 核心層（`shared/config/kl8.ts`）

- [ ] 2.1 常數：`KL8_BALL_COUNT`(20)、`KL8_NUMBER_MIN/MAX`(1/80)、`KL8_NUMBERS`、
      `KL8_TOTAL_COMBOS`(3535316142212174320n，**BigInt**)、`KL8_SUM_MIN/MAX`(210/1410)
- [ ] 2.2 拍板常數（附「使用者拍板」註解）：`KL8_SUM_BIG_LINE`(810)、`KL8_HALF_LINE`(40)、
      `KL8_WUXING_BOUNDS`([734,787,833,886])、`KL8_JACKPOT_LOPSIDED_MIN`(15)／`_MAX`(5)
- [ ] 2.3 純函式：`kl8NumberLabel`、`kl8NumbersOf`（20 碼、1~80、不重複）、`kl8SumOf`、
      `kl8LowCountOf`／`kl8OddCountOf`、`kl8ZoneOf`（上/和/下）、`kl8ParityZoneOf`（奇/和/偶）、
      `kl8WuxingOf`（依總和查 `KL8_WUXING_BOUNDS`）
- [ ] 2.4 機率表（**全程 BigInt**）：`kl8SumCounts()`（DP 卷積 `dp[j][s]`，j 上限 20、s 範圍 210~1410，
      memoized，不保留組合本身）、`kl8HalfSplitCounts()`（`C(40,k)×C(40,20-k)` 閉式解）、
      `kl8ChooseCount()`（組合數）
- [ ] 2.5 對帳腳本：`dp[20]` 加總 = `C(80,20)`；halfSplit 加總 = `C(80,20)`；
      和值/上下盤/奇偶盤/五行/爆池數字符合 `design.md` 的窮舉表

## 3. Config 判定層（`shared/config/kl8-cd.ts`）

- [ ] 3.1 `Kl8Bet` descriptor：`renxuan` / `sumSide` / `zone` / `parityZone` / `wuxing`
- [ ] 3.2 `_parseBet`：任選（`任N中N` + 逗號號碼，個數＝N、不重複、1~80）、
      兩面（`大`/`小`/`單`/`雙`/`大單`/`大雙`/`小單`/`小雙`／`上盤`/`上下和`/`下盤`／
      `奇盤`/`奇偶和`/`偶盤`／`金`/`木`/`水`/`火`/`土`）
- [ ] 3.3 `kl8ChanceOf`（hit/total，**BigInt** 分子分母，只在回傳機率時轉 `Number`）與
      `kl8IsHit`（唯一判定入口）
- [ ] 3.4 `kl8OddsOf`（公平賠率 × rtp、無條件捨去 2 位）、`judgeKl8Bet`（鎖定賠率、payout）、`kl8KindOf`
- [ ] 3.5 爆池：`KL8_JACKPOT_SETTINGS`（`hitLabel`／`hitRate = 66366308138029536n / KL8_TOTAL_COMBOS`）、
      `kl8JackpotHit`、`kl8JackpotLabel`
- [ ] 3.6 `KL8_PLAY_DEFINITIONS`（renxuan／liangmian，順序＝前端玩法列）
- [ ] 3.7 選號彩池玩法：`KL8_POOL_PLAY_KEY`（sentinel，不進 `plays.js`）、`KL8_POOL_PICK_COUNT`(3)、
      `KL8_POOL_PLAY_WEIGHT`（fallback）、`KL8_POOL_BASE_MIN/MAX`、`KL8_POOL_RAKE_RATIO`(0.02)、
      `KL8_POOL_QUOTA`（硬編碼額度）、`KL8_POOL_PRIZE_TIERS`（頭獎 pool+minAmount／二獎 pool／三獎 fixed）、
      `KL8_POOL_FLOOR`、`kl8PoolMatchCount()`（仿 `kl10PoolMatchCount`）、選號合法性驗證函式

## 4. Config 看板設定層（`shared/config/kl8cd/`）

- [ ] 4.1 產生器腳本（scratchpad）：由機率推 weight 與 odds 快照，輸出 `plays.js`
- [ ] 4.2 `plays.js`：2 玩法（任選 7 分頁、兩面 4 組 19 項），group 層 weight 預設 + 注項層覆寫；
      **不得出現任何 import**（Nitro 限制）；選號彩池玩法不進此檔
- [ ] 4.3 `helpers.ts`：`findKl8Play/Tab`、`kl8QuotaOf`、`kl8RtpOf`、`kl8MaxOddsOf`、`kl8TabOddsOf`、
      `kl8HasBetCode`、`kl8FindPlayLocation`、`kl8JackpotWeightOf`（item → group → 0，用 `== null` 判斷）
- [ ] 4.4 `_resolveItem` 支援任選動態注碼（前綴比對）；`kl8HasBetCode` 併驗 `kl8ChanceOf !== null`

## 5. Server 服務層

- [ ] 5.1 `app/config/constants.js` 新增 `LOTTERY.KL8`（單一鍵值、無 `sub`）
- [ ] 5.2 `server/services/game/lottery/bg/kl8.ts`：繼承 `LOTTERY_BASE`（比照 `eggs.ts`／`kl10.ts`）
      —— `randomOpenCode`（80 取 20 不重複）、`openCodePlay`、`validateBetQuota`、`buildOrderRows`、
      `settleIssuePrize`（含爆池分配＋選號彩池分層派彩）、`playBets`（雙線抽水：爆池 1%／選號彩池 2%）、
      `get.userInfo`、`get.creditJackpot`、`get.poolState`、`get.userDialogRecord`、`get.sumOf`、
      `actions.claimOneIssue`、`user.kl8Record`
- [ ] 5.3 `server/services/storage.ts` 註冊 `new Kl8Class()`
- [ ] 5.4 6 支 API：`server/api/lottery/kl8/{current,claim,user-record,opencode-history,jackpot,pool}`

## 6. 前端 API 層與 Composable

- [ ] 6.1 `app/services/api.ts`：`Kl8Current`／`Kl8UserRecordResponse`／`Kl8UserBetHistory`／`Kl8PoolState`
      型別、6 支 `$fetch`、`currentInfo()` 補 `KL8` case（`CreditJackpotState` 重用不新增）
- [ ] 6.2 `app/composables/useKl8.ts`：比照 `useEggs.ts`／`useKl10.ts`（單一盤口）＋任選狀態
      （`renxuan.picked`／`combos`／`betsRenxuan()`）＋選號彩池玩法狀態（`poolPicks`／`isPoolPlay`），
      三段式 loading/success/error
- [ ] 6.3 任選送單：`C(k,N)` 組合展開、每注 `betCode = 任N中N + 號碼`、總額 = 單注 × 注數
- [ ] 6.4 下注成功後立即刷新 `fetch.creditJackpot()`／`fetch.poolState()`（比照 `add-pool-play` 修的
      即時刷新，KL8 從一開始就要做對，不要重蹈 EGGS／KL10 一開始漏掉的覆轍）

## 7. 前端元件（`app/components/lottery/bg/kl8/**`）

- [ ] 7.1 `base/Ball.vue`：1~80 號碼球
- [ ] 7.2 `block/Header.vue`：期別／倒數／20 顆開獎球／總和與上下盤奇偶盤五行標示／爆池池額／彩池池額
- [ ] 7.3 `block/History.vue`：近五期開獎（20 球）
- [ ] 7.4 `block/Road.vue`：路珠（和值大小／單雙／上下盤／奇偶盤／五行）
- [ ] 7.5 `base/Board.vue`：兩面的表格看板（注碼前綴縮寫顯示）
- [ ] 7.6 `base/BoardRenxuan.vue`：任選號碼池選號 + 組合注數／總額預覽
- [ ] 7.7 `block/PoolPicker.vue`：選號彩池玩法選 3 碼 + 靜態分層獎金表（比照 KL10 的 `PoolPicker.vue`）
- [ ] 7.8 `block/CurrItems.vue`、`block/Controls.vue`、`block/Report.vue`（含 `jackpotAmount` 欄）
- [ ] 7.9 `block/DialogShell.vue`／`DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue`（爆池／彩池說明讀 settings 不寫死）
- [ ] 7.10 `block/footer/Auto.vue`、`block/footer/Chat.vue`

## 8. 頁面與大廳整合

- [ ] 8.1 `app/pages/lottery/bg/kl8.vue`（單頁，骨架比照 `egg.vue`／`kl10.vue`，依 `isPoolPlay` 分流渲染）
- [ ] 8.2 `lottery-hall.vue`：`GAME_META.KL8`、`GAME_MODES.KL8`（單卡）、`ROUTE_DICT.KL8`
      （文案獨立撰寫，不沿用 kl10 的「BG · 10 碼排位」）
- [ ] 8.3 `useBgAutoActive.ts` 加 `'kl8'`；`BgAutoPanel.vue` 加 `Kl8Auto`／`Kl8Chat` 分支
- [ ] 8.4 SCSS：新增對應 style 檔並掛進 manifest

## 9. 驗證

- [ ] 9.1 對帳腳本：各注項 `kl8ChanceOf` 與獨立窮舉一致；`kl8IsHit` 逐情境（總和 810／809、
      上下盤 10:10、任選中與不中、五行五段邊界值）
- [ ] 9.2 爆池：`kl8JackpotHit` 對奇7偶13／奇5偶15／奇6偶14 三種情境；`buildJackpotShares` 尾差與未觸發滾存
- [ ] 9.3 `kl8JackpotWeightOf` 三情境（注項 weight／只有 group／明確 0 不退 fallback）
- [ ] 9.4 選號彩池玩法：`kl8PoolMatchCount` 對命中3/2/1/0 四種情境；頭獎保底（`minAmount` 超出自然派彩時）；
      池底不足重骰；與既有爆池抽水並行不互相影響（各自 `carry`/`issueMap` 對帳）
- [ ] 9.5 端到端（curl + session cookie）：
      - 拒單：任選重複號碼／注碼送錯分頁／已改名的「上下和/奇偶和」／單注超上限 → 皆整筆拒絕且不扣款
      - 涵蓋任選＋兩面四組＋選號彩池玩法的下注，鎖定賠率與 config 一致；雙線抽水（爆池1%／彩池2%）皆正確入池
      - 開獎後逐注判定與手算一致；爆池觸發期／未觸發期分別驗證派發與滾存；選號彩池分層派彩與滾存
      - 已結算的期別不會被重複結算（`issueSettledMap` 標記有效）
- [ ] 9.6 `npm run build` exit 0；`/lottery-hall`、`/lottery/bg/kl8` 皆 200
