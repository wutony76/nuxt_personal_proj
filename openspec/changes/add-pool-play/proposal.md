## Why

使用者發現 PC蛋蛋（EGGS）與快樂十分（KL10）的彩池機制跟快3（K3）不一致：兩者目前都只有
「爆池」（`shared/config/jackpot.ts` 骨架，開出豹子／奇偶一邊倒才觸發的紅利池），
沒有 K3-OF 那種「有池底、持續累積、依命中顆數分層派彩」的彩金池玩法。同時發現一個既有 bug：
下注成功後，前端沒有重新拉取爆池金額（`fetch.submit()` 只刷新 `userInfo`/`userRecordAll`），
導致玩家下注後彩池數字不會立即變動，只有等到換期才更新。

使用者拍板：兩款遊戲都要新增一種全新的「彩池玩法」分頁，機制比照 K3-OF 的「選號」
（`shared/config/k3-of.ts` 的 `xuanhao`：依命中顆數分層、依下注比例分錢、頭獎有 minAmount 保底），
池底常數比照 K3 的數值範圍但獨立宣告成 EGGS／KL10 各自的常數，不可直接沿用
`K3_POOL_BASE_MIN`/`K3_POOL_BASE_MAX`。

已查證：K3-OF 的 `K3_OF_PRIZE_TIERS` 本身也不是從 `bglottery` 來源抄的（全專案搜尋
`彩池|奖池|jackpot|selectPool|prizePool` 零命中），是本專案自己設計的機制。因此這次是比照
K3-OF 的**設計模式**新增彩池玩法，不是從來源找規則——K3-OF 本身就是先例，不違反其他玩法
「不可自行猜測規則」的限制。

## What Changes

- 修正既有 bug：`useEggs.ts`／`useKl10.ts` 的 `fetch.submit()` 下注成功後，補呼叫
  `fetch.creditJackpot()` 與新增的 `fetch.poolState()`，讓爆池與新彩金池金額下注後立即反映。
- 新增 `EGGS_POOL_*`／`KL10_POOL_*` 常數與型別（`shared/config/eggs-cd.ts`／`kl10-cd.ts`）：
  池底範圍、分層派彩表 `XXX_POOL_PRIZE_TIERS`、部分命中比對函式
  （`eggsPoolMatchCount`／`kl10PoolMatchCount`，仿 `k3OfMatchCount` 的 multiset／集合交集算法）。
- 新增彩池玩法的伺服端結算：`server/services/game/lottery/bg/eggs.ts`／`kl10.ts` 各自新增
  彩金池欄位（`poolBase`／`issuePoolMap`／`carryPool`，不需要 `k3Shared.ts` 那種跨 class 單例，
  因為 EGGS／KL10 都只有一個 class）與依命中顆數分層派彩的結算分支，複用既有的
  `LOTTERY_BASE.jackpotBase()`/`jackpotCalc()` 泛用工具（本來就不是 K3 專屬）。
- 彩池玩法**不**進 `eggscd/plays.js`／`kl10cd/plays.js` 的看板網格（比照 K3-OF 的 `xuanhao`：
  沒有對應的看板分頁，前端是獨立的一條送單路徑），伺服端驗證用硬編碼的
  `XXX_POOL_QUOTA` 常數；因查不到看板 weight，給一個 fallback 常數讓這個玩法的注單
  也能參與**現有**的爆池分配。
- 新增 2 支 API：`server/api/lottery/eggs/pool.get.ts`、`server/api/lottery/kl10/pool.get.ts`，
  回傳 `{ issue, base, carry, issuePool, distributable, prizeTiers }`。
- 新增前端狀態與元件：`useEggs.ts`／`useKl10.ts` 新增彩池玩法的選號狀態與送單流程
  （比照 `useK3.ts` 的 `ofPicks`/`isOfPool`），新增
  `app/components/lottery/bg/eggs/block/PoolPicker.vue`、
  `app/components/lottery/bg/kl10/block/PoolPicker.vue`（比照 `k3/of/block/Picker.vue`），
  `egg.vue`／`kl10.vue` 依新的 `isPoolPlay` 分流渲染。
- 玩法規則（依機率驗證，詳見 `design.md`）：
  - EGGS 彩池玩法：選 3 個數字（0~9，可重複，跟 PC蛋蛋開獎位數同構），依命中顆數
    （3/2/1）分層派彩。
  - KL10 彩池玩法：選 4 個號碼（1~20，不重複），依命中顆數（4/3/2）分層派彩；
    任一 4 碼組合機率相同（開獎本身不重複），比 EGGS／K3 的「選型影響機率」更乾淨。

## Capabilities

### New Capabilities
- `pool-play`：EGGS 與 KL10 各新增一種彩池玩法分頁，提供依命中顆數分層、依下注比例分錢、
  頭獎有保底金額的彩金池玩法，與獨立的池底／抽水／滾存機制。

### Modified Capabilities
- `eggs-jackpot`／`kl10-credit`：修正下注後爆池金額前端不即時刷新的 bug。

## Impact

- 前端：修改 `app/composables/useEggs.ts`／`useKl10.ts`、`app/pages/lottery/bg/egg.vue`／`kl10.vue`；
  新增 `app/components/lottery/bg/eggs/block/PoolPicker.vue`、
  `app/components/lottery/bg/kl10/block/PoolPicker.vue`
- Config：修改 `shared/config/eggs-cd.ts`／`kl10-cd.ts`
- 後端：修改 `server/services/game/lottery/bg/eggs.ts`／`kl10.ts`；新增
  `server/api/lottery/eggs/pool.get.ts`、`server/api/lottery/kl10/pool.get.ts`
- 共用設定：修改 `app/services/api.ts`
- 影響範圍：僅新增獨立玩法分頁與獨立彩金池，不改動 EGGS／KL10 既有玩法的判定與結算邏輯，
  也不改動其他彩種（6hc／k3／pk10／ssc／11x5）
