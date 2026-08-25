## 1. 決策盤點（唯讀）

- [x] 1.1 研究現有彩池先例：SSC-OF/PK10-OF（分層＋跨盤口共用彩池）、KL8/KL10/EGGS（單盤口
      自建爆池），確認 PL3（無信用盤兄弟盤）最貼近 EGGS 的單 class 記帳骨架
- [x] 1.2 使用者拍板三項：機制＝三星直選分層＋其他玩法權重爆池／分層方式＝比照SSC-OF完全
      吃池／爆池觸發＝開出豹子
- [x] 1.3 確認資金來源比照既有慣例：對整筆送單金額抽水，不篩選分頁（與 SSC-OF/EGGS 現有
      程式碼行為一致，非新設計）

## 2. Config 層（`shared/config/pl3-of.ts`）

- [x] 2.1 `PL3_OF_PRIZE_TIERS`（沿用 `SSC_OF_PRIZE_TIERS` 數值：命中3→pool 0.70 保底20000／
      命中2→pool 0.20／命中1→fixed 2）
- [x] 2.2 `PL3_OF_RAKE_RATIO = 0.6`（沿用 `SSC_OF_RAKE_RATIO`）
- [x] 2.3 `PL3_POOL_PLAY_KEY = 'sanxing'`、`pl3SanxingPicksOf`／`pl3SanxingMatchCount`
      （逐位比對，比照 `sscOfPicksOf`／`sscOfMatchCount`）
- [x] 2.4 `PL3_POOL_BASE_MIN/MAX = 120_000/480_000`、`PL3_POOL_FLOOR`
- [x] 2.5 `PL3_JACKPOT_SETTINGS`（沿用 `EGGS_JACKPOT_SETTINGS` 數值）、
      `PL3_JACKPOT_BASE_MIN/MAX = 110_000/450_000`、`pl3JackpotHit`／`pl3JackpotLabel`
      （用 `pl3.ts` 既有 `pl3IsTriple`）
- [x] 2.6 獨立腳本窮舉驗證 `pl3SanxingMatchCount` 命中分布 = 1/27/243/729（每1000），
      與 SSC 後三一致

## 3. Config 看板層（`shared/config/pl3of/`）

- [x] 3.1 `plays.js`：191121010／191121011 的 `combo` 加 `pool: true`，並補註解說明
      三星直選複式／單式已改吃分層彩池、賠率不再固定
- [x] 3.2 `helpers.ts` 新增 `pl3OfIsPoolTab`（比照 `sscOfIsPoolTab`）、`pl3JackpotWeightOf`
      （比照 `sscOfJackpotWeightOf`）；`pl3TabOddsOf` 對吃池分頁一律回 0

## 4. Server 服務層（`server/services/game/lottery/bg/pl3.ts`）

- [x] 4.1 新增欄位：`issueJackpotMap`／`carryJackpot`／`lastJackpotHit`（全站爆池）、
      `poolBase`／`poolBaseSetAt`／`issuePoolMap`／`carryPool`（三星直選池）
- [x] 4.2 constructor：`carryJackpot` 一次性 seed；`init()` 呼叫 `ensurePoolBase()`
- [x] 4.3 新增 `ensurePoolBase()`／`distributablePool(issue)`（比照 `eggs.ts`）
- [x] 4.4 `playBets()`：新增兩條抽水（爆池 1%／三星直選池 60%，對整筆 `amount`）
- [x] 4.5 `settleIssuePrize()` 拆三段：一般固定賠率分頁（不變）／三星直選依
      `PL3_OF_PRIZE_TIERS` 分層派彩（未中層滾存）／全站爆池 `buildJackpotShares` 分潤
      （比照 EGGS 完整流程，三星直選注單同時參與兩池）
- [x] 4.6 新增 `get.creditJackpot()`（全站爆池狀態）、`get.poolState()`（三星直選池狀態）

## 5. API 層

- [x] 5.1 新增 `server/api/lottery/pl3/jackpot.get.ts`（比照 `eggs/jackpot.get.ts`）
- [x] 5.2 新增 `server/api/lottery/pl3/pool.get.ts`（比照 `eggs/pool.get.ts`）

## 6. 前端

- [x] 6.1 `app/services/api.ts`：新增 `jackpotPl3`／`poolPl3`（沿用既有
      `CreditJackpotState`／`PoolPlayState` 型別）；`Pl3UserBetHistory` 補
      `jackpotAmount`／`tierName` 欄位
- [x] 6.2 `app/composables/usePl3.ts`：新增彩池／爆池狀態抓取、下注成功後刷新
- [x] 6.3 三星直選複式／單式分頁：Board.vue 新增 `.pool-banner` 顯示「浮動賠率」與
      分層摘要；Report.vue／DialogUser.vue 的賠率欄改顯示分層名稱或「浮動」
- [x] 6.4 新增彩池／爆池資訊顯示：Header.vue 補回 `.info-bonus`（全站爆池），
      Board.vue 三星直選分頁顯示可派發彩池與分層比例
- [x] 6.5 `DialogRule.vue` 補充三星直選分層規則（含分層表格）與爆池條件說明

## 7. 驗證

- [x] 7.1 獨立腳本窮舉 `pl3SanxingMatchCount` 分布，確認與 SSC 後三一致（1/27/243/729）
- [x] 7.2 `nuxi typecheck`／`npm run build` exit 0
- [x] 7.3 curl 端到端：下注三星直選複式（50元）+ 一碼不定位（20元）→ 確認
      `issuePool` = 42（=70×0.6）、`currentIssueJackpot` = 0.7（=70×0.01），
      三星直選注單鎖定 `odds: 0`（浮動）、一碼不定位仍鎖定固定賠率 3.54
- [x] 7.4 curl 驗證 `pool.get.ts`／`jackpot.get.ts` 回傳結構正確（`base`/`carry`/
      `issuePool`/`distributable`/`prizeTiers` 與 `currentIssueJackpot`/`carryJackpot`/
      `distributable`/`hitLabel`/`hitRate`/`lastHit` 皆在合理範圍）
- [x] 7.5 等待真實開獎週期驗證（curl，實際等過一次完整開獎）：
      - 開出 `[8,9,8]`（非豹子，爆池未觸發）：三星直選123 判定 `matchCount:0`／`lose`／
        `tierName:''`／`odds:0`；一碼不定位7 判定 `matchCount:0`／`lose`（固定賠率
        `3.54` 保留不變），兩者 `jackpotAmount:0` 皆正確
      - 爆池滾存正確：`carryJackpot` 204991 → 204991.7（未觸發，整池含當期抽水 0.7
        全數滾存，與 `buildJackpotShares` 未觸發時 `remain = pool` 的邏輯一致）
      - 三星直選池滾存正確：`carry` 333953.46 → 333970.1，與手算
        `(340700 + 42×0.8 + 333953.46) × 0.55 × 0.9`（頭獎70%＋二獎20%皆無人中、
        整塊滾存）逐分位吻合，確認分層派彩公式與滾存邏輯正確
      - 兩期的 `issuePool`／`currentIssueJackpot` 皆於結算後正確歸零
