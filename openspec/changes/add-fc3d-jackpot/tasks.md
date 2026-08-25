## 1. 決策盤點（唯讀）

- [x] 1.1 確認 FC3D 與 PL3 結構完全相同（官方盤單盤口、無信用盤、3 位 0~9 可重複），
      PL3 已完成同一套彩池機制，可直接以 PL3 為底稿轉換，不重新設計
- [x] 1.2 使用者拍板：完全比照 PL3 現有機制與數值（AskUserQuestion 確認）

## 2. Config 層（`shared/config/fc3d-of.ts`）

- [x] 2.1 以 `pl3-of.ts` 為底做識別字轉換（`PL3→FC3D`／`Pl3→Fc3d`／`pl3→fc3d`），
      比對轉換後與既有 `fc3d-of.ts`（加彩池前）逐行一致，確認轉換安全
- [x] 2.2 補回 `FC3D_OF_PRIZE_TIERS`（頭獎70%保底20000／二獎20%／三獎固定2倍）、
      `FC3D_OF_RAKE_RATIO = 0.6`、`FC3D_POOL_PLAY_KEY = 'sanxing'`、
      `fc3dSanxingPicksOf`／`fc3dSanxingMatchCount`／`fc3dSanxingTierOf`／`fc3dSanxingMatchCounts`
- [x] 2.3 `FC3D_POOL_BASE_MIN/MAX = 120_000/480_000`、`FC3D_POOL_FLOOR`
- [x] 2.4 `FC3D_JACKPOT_SETTINGS`（rakeRatio 0.01／payoutRatio 0.5／minPool 1000／
      hitLabel 開出豹子／hitRate 10/1000）、`FC3D_JACKPOT_BASE_MIN/MAX = 110_000/450_000`、
      `fc3dJackpotHit`／`fc3dJackpotLabel`（用既有 `fc3dIsTriple`）
- [x] 2.5 更新檔頭註解：移除「fc3d 沒有彩池」的舊敘述，補上彩池機制段落

## 3. Config 看板層（`shared/config/fc3dof/`）

- [x] 3.1 `plays.js`：181121010（三星直選複式）／181121011（三星直選單式）的 `combo`
      加 `pool: true`，並補註解說明已改吃分層彩池（tabId 沿用 FC3D 既有編號，不是 PL3 的）
- [x] 3.2 `helpers.ts`：`Fc3dOfCombo` 型別補 `pool?: boolean`；新增 `fc3dOfIsPoolTab`
      （比照 `pl3OfIsPoolTab`）、`fc3dJackpotWeightOf`（比照 `pl3JackpotWeightOf`）；
      `fc3dTabOddsOf` 對吃池分頁一律回 0

## 4. Server 服務層（`server/services/game/lottery/bg/fc3d.ts`）

- [x] 4.1 以 `pl3.ts` 為底做識別字轉換，比對轉換後與既有 `fc3d.ts`（加彩池前）逐行一致
- [x] 4.2 補回欄位：`issueJackpotMap`／`carryJackpot`／`lastJackpotHit`（全站爆池）、
      `poolBase`／`poolBaseSetAt`／`issuePoolMap`／`carryPool`（三星直選池）
- [x] 4.3 constructor：`carryJackpot` 一次性 seed；`init()` 呼叫 `ensurePoolBase()`
- [x] 4.4 新增 `ensurePoolBase()`／`distributablePool(issue)`
- [x] 4.5 `playBets()`：新增兩條抽水（爆池 1%／三星直選池 60%，對整筆 `amount`）
- [x] 4.6 `settleIssuePrize()` 拆三段：一般固定賠率分頁（不變）／三星直選依
      `FC3D_OF_PRIZE_TIERS` 分層派彩（未中層滾存）／全站爆池 `buildJackpotShares` 分潤
- [x] 4.7 新增 `get.creditJackpot()`（全站爆池狀態）、`get.poolState()`（三星直選池狀態）
- [x] 4.8 `UserBetHistory` 型別補 `tierName`／`jackpotAmount` 欄位

## 5. API 層

- [x] 5.1 新增 `server/api/lottery/fc3d/jackpot.get.ts`（比照 `pl3/jackpot.get.ts`）
- [x] 5.2 新增 `server/api/lottery/fc3d/pool.get.ts`（比照 `pl3/pool.get.ts`）

## 6. 前端

- [x] 6.1 `app/services/api.ts`：新增 `jackpotFc3d`／`poolFc3d`（沿用既有
      `CreditJackpotState`／`PoolPlayState` 型別）；`Fc3dUserBetHistory` 補
      `jackpotAmount`／`tierName` 欄位
- [x] 6.2 `app/composables/useFc3d.ts`：新增 `creditJackpot`／`poolPlayState` 狀態、
      `isPoolTab` computed、彩池／爆池狀態抓取、下注成功後刷新
- [x] 6.3 `base/Board.vue`：新增 `.pool-banner` 顯示「浮動賠率」與分層摘要
- [x] 6.4 `block/Header.vue`：補回 `.info-bonus`（全站爆池總額／預估發放／觸發機率／
      當期抽水／上期滾存／上次爆池紀錄）
- [x] 6.5 `block/Report.vue`／`block/DialogUser.vue`：賠率欄改顯示 `tierName || odds || '浮動'`，
      派彩欄補 `jackpotAmount` 顯示
- [x] 6.6 `block/DialogRule.vue`：投注玩法段落三星直選分頁改顯示分層表格；補充全站爆池條件說明

## 7. 驗證

- [x] 7.1 `pl3-of.ts`／`fc3d-of.ts` 轉換後逐行比對（sed 識別字替換 + diff），確認非彩池段落
      100% 一致，彩池段落數值與 PL3 相同
- [ ] 7.2 `npm run dev` 啟動確認無型別／執行期錯誤
- [ ] 7.3 curl 端到端：下注三星直選複式 + 一碼不定位各一筆 → 確認 `issuePool`／
      `currentIssueJackpot` 正確累積、三星直選注單鎖定 `odds: 0`（浮動）、其他分頁固定賠率不受影響
- [ ] 7.4 curl 驗證 `pool.get.ts`／`jackpot.get.ts` 回傳結構正確
- [ ] 7.5 等待真實開獎週期驗證：分層派彩／未中獎滾存／全站爆池觸發與分潤是否正確
