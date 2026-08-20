## 1. 玩法設定來源盤點（唯讀）

- [x] 1.1 讀取 `bglottery` `kl10/` 全部 16 個檔案（4 個 config、4 組 play.vue/play_script.js、index、header、dict）
- [x] 1.2 查證球號範圍：`zhenghe`／`renxuan` 皆 `for (i = 1; i <= 20; i++)`、開獎號 8 碼 → 1~20 取 8
- [x] 1.3 查證 `dict.js`：kl10 底下零 import、4 個 config 無色波 playId → 殘留檔，不實作色波
- [x] 1.4 查證任選判定：號碼池 20／開獎 8，與六合彩連碼母數不同，需自行窮舉；複式以 C(k,N) 展開
- [x] 1.5 使用者拍板三項規則：總和 ≥84 大／上下盤與奇偶盤比個數（4:4 和盤）／爆池＝奇或偶 ≥7 個

## 2. Config 核心層（`shared/config/kl10.ts`）

- [x] 2.1 常數：`KL10_BALL_COUNT`(8)、`KL10_NUMBER_MIN/MAX`(1/20)、`KL10_NUMBERS`、`KL10_BALL_NAMES`、
      `KL10_TOTAL_COMBOS`(125970)、`KL10_SUM_MIN/MAX`(36/132)
- [x] 2.2 拍板常數（附「使用者拍板」註解）：`KL10_BIG_LINE`(11)、`KL10_TAIL_BIG_LINE`(5)、
      `KL10_SUM_BIG_LINE`(84)、`KL10_SUM_TAIL_BIG_LINE`(5)、`KL10_HALF_LINE`(10)、`KL10_JACKPOT_LOPSIDED_MIN`(7)
- [x] 2.3 純函式：`kl10NumberLabel`、`kl10NumbersOf`（8 碼、1~20、不重複）、`kl10SumOf`、`kl10SumTailOf`、
      `kl10DigitSumOf`（合數）、`kl10DragonOf`、`kl10LowCountOf`／`kl10OddCountOf`、
      `kl10ZoneOf`（上/和/下）、`kl10ParityZoneOf`（奇/和/偶）
- [x] 2.4 機率表：`kl10SumCounts()`（遞迴累加、不保留組合，memoized）、
      `kl10HalfSplitCounts()`（`C(10,k)×C(10,8-k)`）、`kl10ChooseCount()`（組合數）
- [x] 2.5 對帳腳本：sumCounts 合計 = 125,970；halfSplit 合計 = 125,970；上下盤／奇偶盤／爆池數字符合窮舉

## 3. Config 判定層（`shared/config/kl10-cd.ts`）

- [x] 3.1 `Kl10Bet` descriptor：`ballNumber` / `ballSide` / `dragon` / `renxuan` / `sumSide` / `zone` / `parityZone`
- [x] 3.2 `_parseBet`：正和（第X球 + 號碼／8 面）、龍虎鬥（`龍虎ab龍`，a<b）、
      任選（`任N中N` + 逗號號碼，個數＝N、不重複、1~20）、兩面（`總和X`／`上盤`/`上下和`/`下盤`／`奇盤`/`奇偶和`/`偶盤`）
- [x] 3.3 `kl10ChanceOf`（hit/total）與 `kl10IsHit`（唯一判定入口）
- [x] 3.4 `kl10OddsOf`（公平賠率 × rtp、無條件捨去 2 位）、`judgeKl10Bet`（鎖定賠率、payout）、`kl10KindOf`
- [x] 3.5 爆池：`KL10_JACKPOT_SETTINGS`（`hitLabel`／`hitRate = 2490/125970`）、`kl10JackpotHit`、`kl10JackpotLabel`
- [x] 3.6 `KL10_PLAY_DEFINITIONS`（zhenghe／longhu／renxuan／liangmian，順序＝前端玩法列）

## 4. Config 看板設定層（`shared/config/kl10cd/`）

- [x] 4.1 產生器腳本（scratchpad `gen-kl10cd.mjs`）：由機率推 weight 與 odds 快照，輸出 `plays.js`
- [x] 4.2 `plays.js`：4 玩法（正和 8 分頁 × 28 項、龍虎鬥 28 組 × 2 項、任選 5 分頁、兩面 1 分頁 3 組），
      group 層 weight 預設 + 注項層覆寫；**不得出現任何 import**（Nitro 限制）
- [x] 4.3 `helpers.ts`：`findKl10Play/Tab`、`kl10QuotaOf`、`kl10RtpOf`、`kl10MaxOddsOf`、`kl10TabOddsOf`、
      `kl10HasBetCode`、`kl10FindPlayLocation`、`kl10JackpotWeightOf`（item → group → 0，用 `== null` 判斷）
- [x] 4.4 `_resolveItem` 支援任選動態注碼（前綴比對）；`kl10HasBetCode` 併驗 `kl10ChanceOf !== null`

## 5. Server 服務層

- [x] 5.1 `app/config/constants.js` 新增 `LOTTERY.KL10`（單一鍵值、無 `sub`）
- [x] 5.2 `server/services/game/lottery/bg/kl10.ts`：繼承 `LOTTERY_BASE`（比照 `eggs.ts`）
      —— `randomOpenCode`（20 取 8 不重複）、`openCodePlay`、`validateBetQuota`、`buildOrderRows`、
      `settleIssuePrize`（含爆池分配）、`playBets`（抽水入池）、`get.userInfo`、`get.creditJackpot`、
      `get.userDialogRecord`、`get.sumOf`、`actions.claimOneIssue`、`user.kl10Record`
- [x] 5.3 `server/services/storage.ts` 註冊 `new Kl10Class()`
- [x] 5.4 5 支 API：`server/api/lottery/kl10/{current,claim,user-record,opencode-history,jackpot}`

## 6. 前端 API 層與 Composable

- [x] 6.1 `app/services/api.ts`：`Kl10Current`／`Kl10UserRecordResponse`／`Kl10UserBetHistory` 型別、
      5 支 `$fetch`、`currentInfo()` 補 `KL10` case（`CreditJackpotState` 重用不新增）
- [x] 6.2 `app/composables/useKl10.ts`：比照 `useEggs.ts`（單一盤口）＋任選狀態
      （`renxuan.picked`／`combos`／`betsRenxuan()`），三段式 loading/success/error
- [x] 6.3 任選送單：C(k,N) 組合展開、每注 `betCode = 任N中N + 號碼`、總額 = 單注 × 注數

## 7. 前端元件（`app/components/lottery/bg/kl10/**`）

- [x] 7.1 `base/Ball.vue`：1~20 號碼球（大小分色依 `KL10_BIG_LINE`）
- [x] 7.2 `block/Header.vue`：期別／倒數／8 顆開獎球／總和與上下盤奇偶盤標示／爆池池額
- [x] 7.3 `block/History.vue`：近五期開獎（8 球）
- [x] 7.4 `block/Road.vue`：路珠（總和大小／單雙／上下盤／奇偶盤）
- [x] 7.5 `base/Board.vue`：正和／龍虎鬥／兩面的表格看板（注碼前綴縮寫顯示）
- [x] 7.6 `base/BoardRenxuan.vue`：任選號碼池選號 + 組合注數／總額預覽
- [x] 7.7 `block/CurrItems.vue`、`block/Controls.vue`、`block/Report.vue`（含 `jackpotAmount` 欄）
- [x] 7.8 `block/DialogShell.vue`／`DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue`（爆池說明讀 settings 不寫死）
- [x] 7.9 `block/footer/Auto.vue`、`block/footer/Chat.vue`

## 8. 頁面與大廳整合

- [x] 8.1 `app/pages/lottery/bg/kl10.vue`（單頁，骨架比照 `egg.vue`）
- [x] 8.2 `lottery-hall.vue`：`GAME_META.KL10`、`GAME_MODES.KL10`（單卡）、`ROUTE_DICT.KL10`
- [x] 8.3 `useBgAutoActive.ts` 加 `'kl10'`；`BgAutoPanel.vue` 加 `Kl10Auto`／`Kl10Chat` 分支
- [x] 8.4 SCSS：新增 `app/assets/style/lhc_kl10.scss` 並掛進 manifest

## 9. 驗證

- [x] 9.1 對帳腳本：各注項 `kl10ChanceOf` 與獨立窮舉一致；`kl10IsHit` 逐情境（總和 84／83、
      上下盤 4:4、龍虎、任選中與不中、合單合雙、尾大尾小）
- [x] 9.2 爆池：`kl10JackpotHit` 對 7:1／8:0／6:2 三種情境；`buildJackpotShares` 尾差與未觸發滾存
- [x] 9.3 `kl10JackpotWeightOf` 三情境（注項 weight／只有 group／明確 0 不退 fallback）
- [x] 9.4 端到端（curl + session cookie）：
      - 拒單：任選重複號碼／注碼送錯分頁／已改名的「和盤」／單注超上限 → 皆整筆拒絕且不扣款
      - 13 筆下注（四個玩法都涵蓋，含任二中二複式 6 注）鎖定賠率與 config 一致；抽水 1%＝13 進池
      - 開獎 17,13,15,01,19,14,04,11（總和 94、小號 2 個、奇數 6 個）→ 逐注判定與手算一致，
        中獎 5 筆合計 1,532，領獎後餘額 98,700 → 100,232、可領清單清空
      - 未觸發期：payout 0、當期抽水全額滾存（carry 13）
      - 觸發期（臨時探測路由強制以「奇 7 偶 1」開獎，測完已刪除）：池 1,000 → 發放 500、
        weight 3:2 的兩注分得 300:200、滾存 500、`lastHit` 有值、可領 = 派彩 + 加碼 = 1,119,000
      - minPool 門檻：池 501（< 1,000）且觸發 → 不發放、全額滾存、`lastHit` 不變
      - 已結算的期別不會被重複結算（`issueSettledMap` 標記有效）
- [x] 9.5 `npm run build` exit 0；`/lottery-hall`、`/lottery/bg/kl10` 皆 200
