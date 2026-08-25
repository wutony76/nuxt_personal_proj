## Why

FC3D（福彩3D）上線時依規範第 6 節「預設不建彩池」，全數維持固定賠率。使用者現在要求把彩池機制
「完善」成跟 PL3（排列3）一樣——FC3D 與 PL3 是本專案裡結構完全相同的兩個彩種（皆為官方盤單盤口、
無信用盤、3 位 0~9 可重複開獎），PL3 稍早已完成同一套彩池機制（見
`openspec/changes/add-pl3-jackpot/`），故本次直接沿用 PL3 的既有設計與數值，不重新拍板。

已與使用者確認（AskUserQuestion）：完全比照 PL3 現有機制與數值，不調整。

1. **三星直選（複式＋單式）改吃分層彩池，賠率不再固定**——與 PL3 的三星直選完全同構
   （3 位、0~9、可重複、逐位比對），機率分布（命中3/2/1/0 → 1/27/243/729 每 1000）相同，
   直接沿用 `PL3_OF_PRIZE_TIERS` 的既有比例（頭獎70%彩池保底20000／二獎20%彩池／三獎固定2倍）。
2. **全站型爆池**：其餘所有玩法的下注一律用權重分潤，觸發條件用「開出豹子」（3 位數字全同），
   機率 1%（10/1000），直接沿用 `PL3_JACKPOT_SETTINGS` 數值（1% 抽水／50% 可派發／池底
   110,000~450,000）。

資金來源：比照 PL3／SSC-OF／EGGS 的既有慣例——每次下注都對送單的完整金額抽水（不論該次送單押
的是哪個分頁），而不是只對三星直選自身的注額抽水。

## What Changes

- `shared/config/fc3d-of.ts` 新增彩池機制段落（完整比照 `pl3-of.ts` 尾段）：
  `FC3D_OF_PRIZE_TIERS`／`FC3D_POOL_PLAY_KEY`／`FC3D_OF_RAKE_RATIO`／`FC3D_POOL_BASE_MIN/MAX`／
  `FC3D_POOL_FLOOR`／`fc3dSanxingPicksOf`／`fc3dSanxingMatchCount`／`fc3dSanxingTierOf`／
  `fc3dSanxingMatchCounts`／`FC3D_JACKPOT_SETTINGS`／`FC3D_JACKPOT_BASE_MIN/MAX`／
  `fc3dJackpotHit`／`fc3dJackpotLabel`
- `shared/config/fc3dof/plays.js`：181121010（三星直選複式）／181121011（三星直選單式）的
  `combo` 加上 `pool: true`
- `shared/config/fc3dof/helpers.ts` 新增 `fc3dOfIsPoolTab`（比照 `pl3OfIsPoolTab`）、
  `fc3dJackpotWeightOf`（比照 `pl3JackpotWeightOf`）；`fc3dTabOddsOf` 對吃池分頁一律回 0
- `server/services/game/lottery/bg/fc3d.ts`：完整比照 `pl3.ts` 補上彩池狀態欄位
  （`issueJackpotMap`／`carryJackpot`／`lastJackpotHit`、`poolBase`／`poolBaseSetAt`／
  `issuePoolMap`／`carryPool`）、`playBets()` 兩條抽水、`settleIssuePrize()` 三段結算、
  `get.creditJackpot()`／`get.poolState()`、`ensurePoolBase()`／`distributablePool()`
- 新增 `server/api/lottery/fc3d/{jackpot,pool}.get.ts`（比照 `pl3/{jackpot,pool}.get.ts`）
- `app/services/api.ts` 新增 `jackpotFc3d`／`poolFc3d`；`Fc3dUserBetHistory` 補
  `jackpotAmount`／`tierName` 欄位
- `app/composables/useFc3d.ts` 新增彩池／爆池狀態抓取與刷新（比照 `usePl3.ts`）
- 前端顯示：三星直選複式／單式分頁改標示「浮動賠率（依彩池分潤）」；新增彩池／爆池資訊區塊
  （`Header.vue` 的 `.info-bonus`、`Board.vue` 的 `.pool-banner`）；`Report.vue`／`DialogUser.vue`
  補 `tierName`／`jackpotAmount` 顯示；`DialogRule.vue` 補充三星直選分層規則與爆池條件說明

## Impact

- Config：修改 `shared/config/fc3d-of.ts`、`shared/config/fc3dof/plays.js`、
  `shared/config/fc3dof/helpers.ts`
- 後端：修改 `server/services/game/lottery/bg/fc3d.ts`；新增
  `server/api/lottery/fc3d/{jackpot,pool}.get.ts`
- 前端：修改 `app/services/api.ts`、`app/composables/useFc3d.ts`、
  `app/components/lottery/bg/fc3d/{base/Board,block/Header,block/Report,block/DialogUser,block/DialogRule}.vue`
- 影響範圍：僅 FC3D 自身；三星直選複式／單式的賠率行為改變（固定→浮動），為使用者明確要求
  的行為變更
- 不影響 PL3／SSC／PK10／EGGS 等其他彩種的既有彩池與判定邏輯
