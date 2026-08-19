## Why

大廳目前缺少「11選5」玩法。既有玩法來源專案 `bglottery` 的 `src/components/room/lotteryAll/11x5/` 同時提供**信用盤**（`mode: 2`，`config_11x5_credit.js`）與**官方盤**（`mode: 1`，`config_11x5.js`），與本專案 SSC（`ssc-cd` / `ssc-of` 雙盤口 + 共用期別 + 共用彩池）的架構完全對應，可直接複用其五層分層（config → server service → composable → components → page），不需要新設計玩法架構。

同時 11x5-CD 需接上專案既有的泛用爆池骨架（`shared/config/jackpot.ts`），做法比照 `openspec/reference/eggs-jackpot-plan.md`，只是彩種判定與觸發條件要重新分析（見 `design.md` 決策 4）。

## What Changes

> ⚠️ **命名**：`11x5` 開頭是數字，不能當 JS/TS 識別字（同 6HC 用 `LHC` 代稱的做法）。
> 本 change 一律以 `X5` 代稱：常數 `X5_xxx`／`X5CD_xxx`、composable `useX5`、檔名 `x5.ts`／`x5-cd.ts`／`x5-of.ts`。
> 路由與資料夾名維持 `11x5`（同 `6hc-cd.vue` 開頭帶數字沒問題）。

### 階段 1（已交付）：信用盤 + 爆池

- 新增 `shared/config/x5.ts`（機率核心：1~11 取 5 不重複、C(11,5)=462 種組合全窮舉）
- 新增 `shared/config/x5-cd.ts`（信用盤判定＋賠率推導＋`X5_JACKPOT_SETTINGS`／`x5JackpotHit()`／`x5JackpotLabel()`）
- 新增 `shared/config/x5cd/plays.js`（4 分頁 112 注項，含 `weight`）＋ `helpers.ts`（含 `x5JackpotWeightOf()`）
- 新增 `server/services/game/lottery/bg/x5Shared.ts`（兩盤口共用期別／開獎號／共用彩池，比照 `sscShared.ts`）與 `x5Cd.ts`
- 新增 4 支 API：`server/api/lottery/x5-cd/{current,claim,user-record,opencode-history}` + `jackpot.get.ts`
- 新增 `app/composables/useX5.ts`（module-level singleton，cd/of 共用一支，比照 `useSsc.ts`）
- 新增 `app/components/lottery/bg/11x5/{base,block,block/footer}`（共用層）與 `cd/base/Board.vue`、`cd/block/footer/Auto.vue`
- 新增 `app/pages/lottery/bg/11x5-cd.vue`
- `app/config/constants.js` 新增 `LOTTERY['X5']`／`LOTTERY['X5-CD']`（⚠️ `X5-OF` 留到階段 2 再登記 —— 鍵一存在，`/api/lottery/userInfo?lottery=X5-OF` 就會去拿不存在的服務而 500）；`server/services/storage.ts` 註冊實例；`lottery-hall.vue`／`BgAutoPanel.vue`／`useBgAutoActive.ts` 掛上入口

### 階段 2（已交付）：官方盤

- 新增 `shared/config/x5-of.ts`（8 個玩法的判定與賠率、膽拖／複式／單式展開、後三直選的彩池分層）
- 新增 `shared/config/x5of/{plays.js,helpers.ts}`（54 個分頁，tabId 沿用來源 playId）
- 新增 `server/services/game/lottery/bg/x5Of.ts`（**雙結算路徑**：52 個分頁固定賠率、後三直選 2 個分頁彩池分層）
  與 `server/api/lottery/x5-of/**`（5 支）
- 新增 `of/base/Board.vue`（四種選號 UI）、`of/block/footer/Auto.vue`、`app/pages/lottery/bg/11x5-of.vue`
- `useX5.ts` 補上官方盤分支（`of` 選號狀態、`setMode`、`betsOf` / `autoBetsOf`）；
  `Controls`／`CurrItems`／`Report`／`DialogUser`／`DialogRule` 補回盤口分流
- ⚠️ 膽拖**不是**專案首次出現 —— `app/components/lottery/bg/6hc/of/block/Selector.vue` 已有一套
  （`danSelected` / `tuoSelected` + 膽拖分頁 + 同號互斥），本次沿用同一個互動模式，
  只是把它接進 config 驅動的看板；注數展開規則照來源 `algorithm.js:251-267` 的 `C(拖, N−膽)`。
- ⚠️ 單式玩法**改成由設定列出全部注碼讓玩家點選**（使用者拍板），不做來源那種文字輸入框。

## 玩法規則（全部有來源依據，推導過程見 `design.md`）

| 規則 | 值 | 來源 |
|---|---|---|
| 開獎結構 | 1~11 取 5 個**不重複**號碼、有位置（第一~五球） | `index_script.js` 的 `openNum` 切 5 段；`algorithm.js` 的 `_CheckNum` 檢查 `a > 11 \|\| a <= 0` 與重複 |
| 單球大小 | 號碼 ≥ 7 為大（大 5 個／小 6 個） | `roadMap.vue:490` `c < 7 ? '小' : '大'`；`config_11x5.js` 的 `noBigIndex: 7` |
| 單球單雙 | 號碼奇偶 | `roadMap.vue:491` |
| 總和大小 | 總和 ≥ 31 為大（總和範圍 15~45） | `roadMap.vue:497` `c < 31 ? '小' : '大'` |
| 總和單雙 | 總和奇偶 | `roadMap.vue:498` |
| 龍虎鬥 | 前者 > 後者為龍、< 為虎；**無和局** | `roadMap.vue:509-512` 只有龍／虎兩個分支；五碼不重複故不可能相等，正對上來源每組只有 2 個 playId |
| 全5中1 | 該號碼出現在開出的 5 碼中即中 | 分頁名即規則；來源 `playTabId 11212` 11 個注項對應號碼 01~11 |

## Capabilities

### New Capabilities
- `x5-credit`（階段 1）：11選5 信用盤需提供 1-5球／兩面／龍虎鬥／全5中1 共 4 分頁 112 注項的下注、結算、領獎與爆池分配能力
- `x5-official`（階段 2）：11選5 官方盤需提供前中後二·三直選／組選／組選膽拖、定位膽、不定位、任選 N 中 M（含單式與膽拖）、趣味玩法（猜中位／定單雙）的下注與結算能力，其中「後三直選」吃共用彩池並依命中位數分層派彩

### Modified Capabilities
- （無 —— 不改動既有 6hc／k3／pk10／ssc／eggs 的判定邏輯）

## Impact

- Config：新增 `shared/config/x5.ts`、`x5-cd.ts`、`x5cd/{plays.js,helpers.ts}`、`x5-of.ts`、`x5of/{plays.js,helpers.ts}`
- 後端：新增 `server/services/game/lottery/bg/{x5Shared,x5Cd,x5Of}.ts`、`server/api/lottery/x5-{cd,of}/**`；修改 `server/services/storage.ts`
- 前端：新增 `app/composables/useX5.ts`、`app/components/lottery/bg/11x5/**`、`app/pages/lottery/bg/11x5-{cd,of}.vue`
- 共用設定：修改 `app/config/constants.js`、`app/services/api.ts`、`app/pages/lottery-hall.vue`、
  `app/components/lottery/bg/BgAutoPanel.vue`、`app/composables/useBgAutoActive.ts`、SCSS manifest
- 影響範圍：既有檔案皆為**追加式**修改，不動既有彩種邏輯
