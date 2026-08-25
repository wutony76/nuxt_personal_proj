## Why

PL3（排列3）上線時依規範第 6 節「預設不建彩池」，全數維持固定賠率。使用者現在要求補上彩池機制。
PL3 沒有信用盤兄弟盤可借（不像 kl8／kl10／pceggs 靠信用盤 rake 建池），須自己從官方盤下注抽水建池。

已與使用者確認兩層機制並存（提案階段逐項拍板，見下）：

1. **三星直選（複式＋單式）改吃分層彩池，賠率不再固定**——比照 `SSC-OF`「後三直選」／
   `PK10-OF`「前三直選」的既有先例：3 位數精準比對，依「命中位數」分 3 層派彩。
   三星直選在結構上與 SSC 後三（3 位、0~9、可重複、逐位比對）**完全相同**，機率分布
   （命中3／2／1／0 → 1／27／243／729 每 1000 種）可直接沿用 `SSC_OF_PRIZE_TIERS` 的
   既有比例（70%／20%／固定2倍），不必重新設計比例。
2. **全站型爆池**：其餘所有玩法的下注一律用權重分潤——比照 `PC蛋蛋（EGGS）` 的爆池（PL3 與
   EGGS 一樣是「單一盤口、無信用盤」，是比 SSC／PK10 更直接的先例，不需要 SSC 那套「等兩個
   盤口交件才結算」的跨 class 編排）。觸發條件用「開出豹子」（3 位數字全同），機率 1%
   （10/1000），與 EGGS 的豹子條件同一個機率（PL3 開獎結構與 PC蛋蛋完全同構：3 位 0~9 可重複）。

資金來源：依使用者「機制需要與目前其他玩法一致」的裁示，比照 SSC-OF／EGGS 的既有慣例——
**每次下注都對送單的完整金額抽水**（不論該次送單押的是哪個分頁），而不是只對三星直選自身的
注額抽水。這與 SSC-OF 的 60% 抽水、EGGS 彩池玩法的 2% 抽水是同一種設計（兩者的既有原始碼
都是對 `playBets` 的整體 `amount` 抽水，不篩選分頁），非本次新引入的例外。

## What Changes

- `shared/config/pl3-of.ts` 新增：
  - `PL3_OF_PRIZE_TIERS`（沿用 `SSC_OF_PRIZE_TIERS` 數值：命中3→70%彩池、保底20000、
    命中2→20%彩池、命中1→固定2倍）
  - `PL3_OF_RAKE_RATIO = 0.6`（沿用 `SSC_OF_RAKE_RATIO`）
  - `PL3_POOL_PLAY_KEY = 'sanxing'`、`pl3SanxingPicksOf`／`pl3SanxingMatchCount`（比照
    `sscOfPicksOf`／`sscOfMatchCount`，逐位比對，非集合交集）
  - `PL3_JACKPOT_SETTINGS`（`rakeRatio:0.01`／`payoutRatio:0.5`／`minPool:1000`／
    `weightFallback:1`／`boardWeight:{of:1}`／`hitLabel:'開出豹子（三位數字全同）'`／
    `hitRate:10/1000`，沿用 `EGGS_JACKPOT_SETTINGS` 數值）、`PL3_JACKPOT_BASE_MIN/MAX`
    （沿用 `EGGS_JACKPOT_BASE_MIN/MAX` = 110,000～450,000）、`pl3JackpotHit`／`pl3JackpotLabel`
    （用既有 `pl3IsTriple` 判斷豹子）
  - `PL3_POOL_BASE_MIN/MAX`（沿用 SSC 的 120,000～480,000，因三星直選池比照 SSC-OF 完全吃池）
- `shared/config/pl3of/plays.js`：191121010（三星直選複式）／191121011（三星直選單式）的
  `combo` 加上 `pool: true`
- `shared/config/pl3of/helpers.ts` 新增 `pl3OfIsPoolTab`（比照 `sscOfIsPoolTab`，讀
  `combo.pool`）、`pl3JackpotWeightOf`（比照 `sscOfJackpotWeightOf`／`eggsJackpotWeightOf`，
  複式分頁查不到單一注項時退回該分頁第一組的 weight）；`pl3TabOddsOf` 對吃池分頁一律回 0
- `server/services/game/lottery/bg/pl3.ts`：
  - 新增彩池狀態欄位（比照 `eggs.ts`，單一 class 內自己記帳，不需要跨 class 共用單例）：
    `issueJackpotMap`／`carryJackpot`／`lastJackpotHit`（全站爆池）、
    `poolBase`／`poolBaseSetAt`／`issuePoolMap`／`carryPool`（三星直選池）
  - `playBets()` 新增兩條抽水：`amount × PL3_JACKPOT_SETTINGS.rakeRatio` 進爆池、
    `amount × PL3_OF_RAKE_RATIO` 進三星直選池（比照 SSC-OF／EGGS，對整筆送單金額抽水）
  - `settleIssuePrize()` 拆分三段：一般固定賠率分頁（原邏輯不變）／三星直選依
    `PL3_OF_PRIZE_TIERS` 分層派彩／全站爆池 `buildJackpotShares` 分潤（比照 EGGS 完整流程）
  - 新增 `get.creditJackpot()`（全站爆池狀態）、`get.poolState()`（三星直選池狀態）、
    `ensurePoolBase()`／`distributablePool()`（比照 EGGS 的池底重骰＋阻尼公式）
- 新增 `server/api/lottery/pl3/jackpot.get.ts`、`server/api/lottery/pl3/pool.get.ts`
  （比照 `server/api/lottery/eggs/{jackpot,pool}.get.ts`）
- `app/services/api.ts` 新增 `jackpotPl3`／`poolPl3`（型別沿用既有 `CreditJackpotState`／
  `PoolPlayState`，不新增型別）；`Pl3UserBetHistory` 補 `jackpotAmount`／`tierName` 欄位
- `app/composables/usePl3.ts` 新增彩池／爆池狀態抓取與刷新（比照 `useEggs.ts`）
- 前端顯示：三星直選複式／單式分頁改標示「浮動賠率（依彩池分潤）」，不再顯示固定 960.00；
  新增彩池／爆池資訊區塊（比照 EGGS 的 Header／Report 呈現方式）；`DialogRule.vue` 補充
  三星直選分層規則與爆池條件說明

## Impact

- Config：修改 `shared/config/pl3-of.ts`、`shared/config/pl3of/plays.js`、
  `shared/config/pl3of/helpers.ts`
- 後端：修改 `server/services/game/lottery/bg/pl3.ts`；新增
  `server/api/lottery/pl3/{jackpot,pool}.get.ts`
- 前端：修改 `app/services/api.ts`、`app/composables/usePl3.ts`、
  `app/components/lottery/bg/pl3/block/{Header,Board 或 base/Board,Report,DialogRule}.vue`
- 影響範圍：僅 PL3 自身；三星直選複式／單式的賠率行為改變（固定→浮動），為使用者明確要求
  的行為變更，非既有玩法的向下相容破壞（PL3 才剛上線，尚無既有下注歷史需相容）
- 不影響 FC3D／SSC／PK10／EGGS 等其他彩種的既有彩池與判定邏輯
