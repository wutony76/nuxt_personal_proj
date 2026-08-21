## Why

大廳目前缺少「快樂8」（KL8）玩法。玩法來源專案 `bglottery` 的
`src/components/room/lotteryAll/kl8/`（`playTabId` 21210～21211）**只有信用模式、沒有官方盤**
（該資料夾下沒有 `official/` 子目錄，與 11x5／ssc／pk10／k3 的雙盤口不同），
架構條件與 PC蛋蛋（EGGS）、快樂十分（KL10）完全相同 —— 單一盤口、單一頁面、單一結算入口，
可直接複用 EGGS／KL10 那一套分層（config → server service → composable → components → page）。

KL8 只有 2 個玩法分頁（任選、兩面），比 KL10 少了「正和」「龍虎鬥」，但兩面多了「五行」一組；
且來源前端完全查不到兩面（和值／上下盤／奇偶盤／五行）的判定門檻與五行對應規則
（判定式在伺端，`liangmian/play_script.js` 全篇只組裝 `playId`/`buyCode` 送出），
這些門檻已於提案階段由使用者拍板（詳見 `design.md`），並全數以 `C(80,20)` 窮舉或 DP 建表
驗證機率、收斂成具名常數，不寫死猜測數字。

## What Changes

- 新增 `shared/config/kl8.ts`（機率核心：20 球取自 1~80 不重複；母數 `C(80,20)=3,535,316,142,212,174,320`
  —— **超過 `Number.MAX_SAFE_INTEGER`，全程須用 BigInt 窮舉／建表**，不可用一般 `number`）與
  `shared/config/kl8cd/`（看板設定 `plays.js` + 讀取層 `helpers.ts`）、
  `shared/config/kl8-cd.ts`（注碼判定、賠率推導、爆池設定、選號彩池玩法設定）。
- 新增 `server/services/game/lottery/bg/kl8.ts`：單一信用盤 service（比照 `eggs.ts`／`kl10.ts`，
  **不建立** `kl8Shared.ts`／官方盤，因來源本身只有信用模式）。
- 新增 5 支 API：`server/api/lottery/kl8/{current,claim,user-record,opencode-history,jackpot}`，
  外加 1 支彩池玩法查詢 `server/api/lottery/kl8/pool.get.ts`（比照 `add-pool-play` 的
  `eggs/pool.get.ts`／`kl10/pool.get.ts`）；投注沿用共用路由 `/api/lottery/bet`。
- 新增 `app/composables/useKl8.ts`（比照 `useEggs.ts`／`useKl10.ts`，額外處理「任選」的複式組合展開
  與「選號」彩池玩法的送單流程）。
- 新增 `app/components/lottery/bg/kl8/**`（版面骨架比照 `eggs/**`；多一支 `base/BoardRenxuan.vue`
  處理任選的號碼池選號，一支 `block/PoolPicker.vue` 處理選號彩池玩法，皆比照 KL10 的做法）。
- 新增 `app/pages/lottery/bg/kl8.vue`（單頁，無盤口切換）。
- `app/config/constants.js` 新增 `LOTTERY.KL8`；`server/services/storage.ts` 註冊實例；
  `lottery-hall.vue`／`BgAutoPanel.vue`／`useBgAutoActive.ts` 掛上入口與自動下注面板；新增對應 SCSS。
- 玩法規則（2 個分頁，來源逐項對照，判定依據詳見 `design.md`）：
  - 任選（21210）：任一中一 ~ 任七中七，號碼池 01~80，判定為選中號碼全落在 20 個開獎號內，
    複式以組合 `C(k,N)` 展開成多注
  - 兩面（21211）：
    - 和值：大（總和 ≥810）/小（<810，**無和局**，總和恰為 810 併入大）/單/雙/大單/大雙/小單/小雙
    - 上下盤：上盤（1~40 落點個數 >10）/上下和（10:10）/下盤（<10）
    - 奇偶盤：奇盤（奇數個數 >10）/奇偶和（10:10）/偶盤（<10）
    - 五行：金/木/水/火/土（20 顆總和依 DP 窮舉出的等機率五等分邊界分組：
      金≤734／木735~787／水788~833／火834~886／土≥887，各組機率 19.87%~20.23%）
- 爆池：接上既有泛用骨架 `shared/config/jackpot.ts`（不新發明），觸發條件為
  **「奇偶個數失衡 ≤5 或 ≥15 個」**（66,366,308,138,029,536 / 3,535,316,142,212,174,320 ≈ 1.8772%，
  使用者拍板，與 kl10 奇偶≥7/8（1.9767%）、6hc 特別號開49（2.04%）同量級）。
- 選號彩池玩法（比照 `add-pool-play` 已為 EGGS／KL10 建立的機制，這次同步擴充到 KL8）：
  新增獨立「選號」分頁，選 3 個號碼（1~80，不重複），依命中顆數（3/2/1/0）分層派彩
  （頭獎＝命中3全中，機率 1140/82160 ≈ 1.3874%，與 KL10 選4碼頭獎 1.445% 同量級），
  比照 `KL10_POOL_PRIZE_TIERS` 的 `pool`/`pool`/`fixed` 三層結構，池底、抽水、滾存
  皆獨立宣告成 KL8 自己的常數，且**不進** `kl8cd/plays.js` 看板網格。

## Capabilities

### New Capabilities
- `kl8-credit`: 快樂8信用盤玩法頁需提供任選／兩面兩大類玩法、單一頁面下注與結算、
  以及與玩法正確關聯的爆池分配能力。

### Modified Capabilities
- `pool-play`: 選號彩池玩法由「EGGS／KL10 各一種」擴充為「EGGS／KL10／KL8 各一種」，
  KL8 版本為選 3 個號碼（1~80，不重複），依命中顆數（3/2/1）分層派彩。

## Impact

- 前端：新增 `app/pages/lottery/bg/kl8.vue`、`app/components/lottery/bg/kl8/**`、`app/composables/useKl8.ts`
- Config：新增 `shared/config/kl8.ts`、`shared/config/kl8-cd.ts`、`shared/config/kl8cd/{plays.js,helpers.ts}`
- 後端：新增 `server/services/game/lottery/bg/kl8.ts`、`server/api/lottery/kl8/**`；修改 `server/services/storage.ts`
- 共用設定：修改 `app/config/constants.js`、`app/services/api.ts`、`app/pages/lottery-hall.vue`、
  `app/components/lottery/bg/BgAutoPanel.vue`、`app/composables/useBgAutoActive.ts`、SCSS manifest
- 影響範圍：僅新增獨立玩法路由與服務、擴充既有 `pool-play` 能力到第三款遊戲，
  不改動既有 6hc／k3／pk10／ssc／11x5／eggs／kl10 的判定與結算邏輯
