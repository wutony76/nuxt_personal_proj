## Context

PL3 上線時依規範「預設不建彩池」，`shared/config/pl3-of.ts`／`pl3.ts` 頭部註解明確寫著
「pl3 沒有彩池，故不含任何 pool/jackpot 分支」；`server/services/game/lottery/bg/pl3.ts`
也明確列出「刻意不做」清單（爆池／彩池／rake-into-pool）。使用者現在明確要求加回彩池機制。

PL3 與 FC3D 同形狀（官方盤單盤口、無信用盤），但專案裡目前唯一的「官方盤吃彩池」先例是
`SSC-OF`／`PK10-OF`，兩者都需要與各自的信用盤共用彩池（`SSC_JACKPOT_SETTINGS` 定義在
`ssc-cd.ts`，狀態放在跨 class 的 `sscShared.ts` 單例，靠「兩個盤口都交件才結算」的編排）。
PL3 沒有信用盤兄弟盤，硬套這套跨 class 編排沒有意義。

**PC蛋蛋（EGGS）才是更直接的先例**：EGGS 同樣「單一盤口、無信用盤」，且它自己就同時具備
使用者要的兩種機制：
1. 全站型爆池（`EGGS_JACKPOT_SETTINGS`，開豹子觸發，`buildJackpotShares` 依權重分潤）——
   狀態全部收在 `class EGGS` 自己身上，不需要跨 class 單例，因為只有一個盤口，不必等誰交件。
2. 特定玩法「彩池玩法（選號）」——比照 `SSC-OF`／`PK10-OF` 的分層＋阻尼公式＋池底重骰
   （`EGGS_POOL_PRIZE_TIERS`／`ensurePoolBase()`／`distributablePool()`），但狀態一樣收在
   `class EGGS` 自己身上（`poolBase`／`issuePoolMap`／`carryPool` 是 instance 欄位，不是
   跨 class 單例）。

因此本次設計＝**「EGGS 的單 class 記帳骨架」承載「SSC-OF 後三直選的分層數值與判定方式」**：
三星直選在結構上是 3 位、0~9、可重複、逐位比對，與 SSC 後三完全同構（機率分布相同），
所以判定與分層比例直接沿用 SSC_OF 的既有數字；但因為 PL3 只有一個盤口，記帳方式改抄 EGGS
的單 class 骨架，不需要 `sscShared.ts` 那套跨盤口交件編排。

## Goals / Non-Goals

**Goals:**
- 三星直選複式／單式改吃分層彩池，賠率不再固定（依命中位數 0~3 分層）。
- 全站爆池：所有分頁下注一律抽水參與，開出豹子觸發，依權重分潤（`buildJackpotShares`）。
- 兩個池各自獨立記帳（池底／抽水／滾存互不影響），比照 EGGS 註解一貫強調的「兩池互不吃」。
- 資金來源比照既有 SSC-OF／EGGS 慣例：對整筆送單金額抽水，不篩選分頁。

**Non-Goals:**
- 不引入跨 class 單例（PL3 只有一個盤口，不需要 `pl3Shared.ts`）。
- 不改動三星直選以外的其他 9 個分頁的固定賠率判定邏輯。
- 不影響 FC3D／SSC／PK10／EGGS 既有彩池。
- 不重新設計機率或分層比例——三星直選與 SSC 後三機率結構相同，直接沿用其比例；
  一般爆池機率沿用 EGGS 的豹子機率（PL3 與 EGGS 開獎結構相同：3 位 0~9 可重複）。

## Decisions

### 1. 三星直選改吃分層彩池（沿用 SSC_OF_PRIZE_TIERS 數值與判定方式）

| 命中位數 | 機率(每1000) | 分層 | 派彩 |
|---|---|---|---|
| 3 | 1 | 頭獎 | 彩池 × 70%，按下注額比例分（每單位保底 20,000） |
| 2 | 27 | 二獎 | 彩池 × 20%，按下注額比例分（無保底） |
| 1 | 243 | 三獎 | 固定 2 倍下注額 |
| 0 | 729 | 未中 | 0 |

判定＝逐位比對（`pl3SanxingMatchCount`，比照 `sscOfMatchCount`，**不是**集合交集）：
猜 `[1,2,3]`、開 `[1,3,2]` → 只有百位對 → 命中 1。三星直選複式與單式共用同一組
`combo.pool = true`／同一個判定函式（單式只是輸入方式不同，判定完全相同）。

⚠️ 未中獎的分層（該層 0 位中獎者）整塊滾存至下期，比照 SSC-OF `carryNext` 的作法，
不當作已發放。

### 2. 全站爆池（沿用 EGGS_JACKPOT_SETTINGS 數值）

- 觸發：開出豹子（三位數字全同），機率 1%（10/1000）——用既有 `pl3IsTriple()` 判斷。
- 抽水 1%（`PL3_JACKPOT_SETTINGS.rakeRatio`），可派發 = 50%（`payoutRatio`），
  `minPool: 1000`，權重讀 `pl3JackpotWeightOf()`（複式注碼查不到單一注項時退回該分頁
  第一組的 weight，比照 `sscOfJackpotWeightOf`）。
- 所有分頁（含三星直選）都參與：三星直選的注單同時進兩個池——分層彩池決定它自己的中獎，
  全站爆池則是「有份就參與分潤」（`eligible = payout > 0`，比照 EGGS 彩池玩法注單
  同時參與 EGGS 自己爆池的作法）。
- 一次性 seed：開站時把 `jackpotBase(110000, 450000)` 灌進 `carryJackpot`（比照
  `EGGS_JACKPOT_BASE_MIN/MAX`），之後不再重複 seed（避免無界成長，比照 EGGS 註解）。

### 3. 資金來源：對整筆送單金額抽水，不篩選分頁（比照既有慣例，非新例外）

`playBets()` 內：
```
issueJackpotMap[issue] += amount × 0.01   // 全站爆池
issuePoolMap[issue]    += amount × 0.6    // 三星直選池
```
`amount` 是該次 `/api/lottery/bet` 呼叫的完整金額，不篩選這次送的是哪個分頁——與
`sscOf.ts`／`eggs.ts` 的既有寫法完全一致（兩者都是對 `playBets` 的整體 `amount` 抽水）。
現況前端 `usePl3.ts` 的 `submit()` 每次呼叫只送一個 `playKey`／`tabId`（見
`app/composables/usePl3.ts:596`），故實務上等同「該分頁自己的下注額」，但程式邏輯本身
不對此假設；未來若前端改成一次送多分頁，行為會與 SSC-OF／EGGS 同步改變（既有慣例本來
就是如此，非本次引入的風險）。

### 4. 三星直選池記帳：EGGS 彩池玩法的骨架 + SSC-OF 的阻尼公式與池底門檻

```
poolBase / poolBaseSetAt / issuePoolMap / carryPool   // instance 欄位，比照 eggs.ts
PL3_POOL_BASE_MIN/MAX = 120_000 / 480_000             // 沿用 SSC 池底範圍（比照 SSC-OF）
PL3_POOL_FLOOR = ceil(20000 / 0.70)                   // 頭獎保底 ÷ 頭獎比例
ensurePoolBase()     // 比照 eggs.ts ensurePoolBase()，池底不足門檻就重骰
distributablePool(issue) = jackpotCalc(poolBase, issuePoolMap[issue], carryPool)
                          = (poolBase + issuePool×0.8 + carryPool) × 0.55
```
與全站爆池（無阻尼、`distributable = issueJackpotMap[issue] + carryJackpot`）刻意用
不同公式——三星直選池比照 SSC-OF「完全吃池」需要阻尼＋池底重骰維持可持續派彩；
全站爆池比照 EGGS 的簡單一次性 seed + 自然累積，兩者機制不同、互不影響、互不共用常數。

### 5. `pl3TabOddsOf` 對吃池分頁一律回 0（比照 `sscOfTabOddsOf`）

前端原本顯示的固定賠率（960.00）不再適用；`pl3OfIsPoolTab()` 為 true 時 `pl3TabOddsOf`
回 0，前端改顯示「浮動賠率（依彩池分潤）」文案，不顯示賠率數字。

## Risks / Trade-offs

- **[Risk]** 對整筆送單金額抽水（非僅三星直選自身）意味著玩家下注其他分頁時，資金也會被
  高比例（60%）撥入三星直選池，而該分頁仍按原固定賠率由「house」支付，經濟上看似房間
  同時承擔兩筆成本。
  → **Mitigation**：這是 SSC-OF／PK10-OF／EGGS 彩池玩法的既有真實行為（非本次新增瑕疵），
  且專案本身已在多處註解明示「這是 demo 的設定，不是真實彩券的資金流」；使用者已明確要求
  「機制需要與目前其他玩法一致」，故此次比照既有慣例而非另立新規則。
- **[Risk]** 三星直選改浮動賠率後，玩家原本看到的固定 960.00 賠率消失，可能造成使用體驗
  認知落差。
  → **Mitigation**：前端明確標示「浮動賠率（依彩池分潤）」並顯示即時可派發彩池／保底金額，
  比照 SSC-OF 官方盤後三直選頁面的既有呈現方式（無需另創 UI 語彙）。
- **[Risk]** 兩個池互相污染（例如誤用同一個 `carry` 欄位或誤把三星直選注單漏算進全站爆池）。
  → **Mitigation**：兩組欄位／函式全部獨立命名（`issueJackpotMap` vs `issuePoolMap`、
  `carryJackpot` vs `carryPool`），比照 EGGS 檔頭反覆強調「兩池互不吃」的註解慣例；
  結算時 `jackpotRows` 統一收集全部注單（含三星直選），分層彩池的中獎判定則只對三星直選
  的注單跑一次，兩段邏輯不共用同一個陣列 mutate。

## Migration Plan

PL3 剛上線、無既有下注歷史需相容。實作順序：
1. `shared/config/pl3-of.ts`／`pl3of/plays.js`／`pl3of/helpers.ts`（純函式，先窮舉驗證
   `pl3SanxingMatchCount` 分布與 SSC 後三一致：1/27/243/729）
2. `server/services/game/lottery/bg/pl3.ts`（記帳與結算）
3. 2 支新 API（`jackpot.get.ts`／`pool.get.ts`）
4. 前端（`api.ts`／`usePl3.ts`／元件顯示）
5. 端到端驗證：下注三星直選 + 其他分頁各一筆 → 確認兩個池都正確累積 → 等開獎 →
   確認分層派彩與爆池分潤皆正確、未中獎分層正確滾存

## Open Questions

（無 —— 機制、資金來源、觸發條件三項關鍵決策皆已於提案階段由使用者逐項確認採用
「比照 SSC-OF」／「比照 EGGS」既有先例，不自行拍板新數字）
