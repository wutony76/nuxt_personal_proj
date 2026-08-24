## Why

大廳目前缺少「福彩3D」（FC3D）玩法。玩法來源專案 `bglottery` 的
`src/components/room/lotteryAll/fc3d/`（`lotteryId: 1801`）**只有官方盤、沒有信用盤**
（`index_script.js` 的 `initLayout()` 只呼叫過 `setPlayData(1, 'pc_181')`／`playTabMode: 1`，
`.then()` 也只處理 `playTabMode == 1` 分支，從未出現 `playTabMode: 2`，且來源目錄本身沒有
`creditTraditional/` 資料夾）——這跟 11x5／ssc／pk10／k3／x5 的雙盤口不同，也跟
kl8／kl10／pceggs 的信用盤單盤口不同，是本專案目前唯一「官方盤單盤口」的形狀，
需要組合兩套既有架構：盤口內部的玩法判定／賠率／複式展開比照 **SSC-OF**（尤其是無 pool 的
10 個一般分頁那一套 `sscof.ts`／`sscof/plays.js`／`sscof/helpers.ts`），位數由 5 縮減為 3；
單一盤口不需要 cd/of 三檔切分，檔案佈局比照 **EGGS**（`eggs.ts`／`useEggs.ts`／`egg.vue`）。

來源前端（`config_ssc.js`／`play_script.js`）只提供「選號畫面佈局」，賠率一律由後端
`LotteryPlayOdds` API 於執行期回傳、前端用使用者的返水滑桿即時運算顯示值——本專案沿用
既有 `*-of.ts` 的做法（`sscOfOddsOf`／`x5OfOddsOf`／`pk10OfOddsOf` 皆是「公平賠率
（母數 ÷ 命中數）× RTP」），公平賠率的母數由 3 位數 0~9（共 1000 種結果）窮舉推導，
不沿用來源的執行期 API 快照，也不寫死猜測數字（詳見 `design.md` 的窮舉驗證表）。

另外查證到 `config_ssc.js` 的 `181121113`／`181121114`（三星組選和值細分「組三和值」／
「組六和值」）在來源裡是完全空物件 `{}`，沒有任何 `selectarea`／`alias`，UI 也打不到；
`official/play_script.js` 也含有 `isrx`／`selectedPosition`（5 位數萬/千/百/十/個位映射）與
`alias === 'TSH3'`（豹子/顺子/对子）兩段死代碼，是從 5 位數彩種複製後沒清乾淨的殘留（`config_ssc.js`
沒有任何玩法設 `isrx:1` 或 `alias:'TSH3'`，兩段分支永遠打不到）。以上兩點皆已於提案階段
與使用者確認：**跳過 181121113/114、不實作**（只做合併版 181121112「三星組選和值」，
與來源實際運作方式一致）；**死代碼不照抄**。

「不定位」玩法（一碼/二碼）的中獎判定，bglottery 前端同樣沒有揭露（判定式在伺端），
已依公開福彩3D官方規則於提案階段與使用者確認採用（詳見 `design.md` 決策 4）。

彩池機制：fc3d 沒有信用盤可用 rake 建池，來源本身也完全沒有彩池相關欄位或 UI 痕跡，
依既有規範**預設不建彩池**，本次變更全數維持固定賠率結構。

## What Changes

- 新增 `shared/config/fc3d.ts`（共用純函式：開獎號解析、位數/號碼範圍、和值/組別輔助函式，
  比照 `ssc.ts`／`eggs.ts`，3 位數版）。
- 新增 `shared/config/fc3d-of.ts`（玩法判定與賠率核心，比照 `sscof.ts` 無 pool 分頁那一套：
  `_parseBet`、`fc3dChanceOf`／`fc3dIsHit`、`fc3dOddsOf`（公平賠率 × RTP=0.96，比照全部
  `*-of.ts` 一致慣例）、`judgeFc3dBet`（鎖定賠率結算）、複式展開函式 `fc3dDirectCombos`／
  `fc3dGroupCombos`／`fc3dSideCombos`，`FC3D_MAX_COMBO` 上限比照 `SSC_OF_MAX_COMBO`）。
- 新增 `shared/config/fc3dof/plays.js`（.js、零 import，比照 `sscof/plays.js` 的
  `{tabId,tabName,settings:{quota,payout},combo?,tabGroup}` 結構）與
  `shared/config/fc3dof/helpers.ts`（比照 `sscof/helpers.ts`：`findFc3dTab`、`fc3dQuotaOf`、
  `fc3dRtpOf`、`fc3dTabOddsOf`、`fc3dHasBetCode`、`fc3dComboCodes`、`fc3dComboGroups`；
  **不含** `sscOfIsPoolTab`／`sscOfJackpotWeightOf` 等 pool/jackpot 相關函式）。
- 新增 `server/services/game/lottery/bg/fc3d.ts`：單一官方盤 service（比照 `eggs.ts` 的
  單一 class、無 `*Shared.ts` 共用期表層；判定/結算邏輯取 `sscOf.ts` 的「一般分頁」半套，
  **不含** pool-tab 分支、**不含**爆池/彩池註冊）。
- 新增 4 支 API：`server/api/lottery/fc3d/{current,claim,opencode-history,user-record}.get.ts`
  （`claim` 為 `.post.ts`），比照 `server/api/lottery/eggs/` 的 4 支基本檔；**不建**
  `jackpot.get.ts`／`pool.get.ts`；投注沿用共用路由 `/api/lottery/bet`。
- 新增 `app/composables/useFc3d.ts`（比照 `useEggs.ts` 的單一盤口狀態骨架 + `useSsc.ts` 的
  `picks`／`toggleOfPick`／`ofComboCodes`／`ofComboHint` 複式選號機制，統一 `reactive` state，
  三段式 loading/success/error）。
- 新增 `app/components/lottery/bg/fc3d/**`：`base/Board.vue`（定位膽單式表格 + 前二/後二/三星/
  不定位/大小單雙的複式選號列，比照 `ssc/of/base/Board.vue` 精簡至 3 位數）、
  `block/{Header,History,Road,Report,DialogShell,DialogOpenCode,DialogUser,DialogRule,
  CurrItems,Controls,footer/Auto,footer/Chat}.vue`（比照 `eggs/block/**`，扁平佈局、
  不分 `cd/`／`of/`）。
- 新增 `app/pages/lottery/bg/fc3d.vue`（單頁，骨架比照 `egg.vue`，無盤口切換、無彩池選號分頁）。
- `app/config/constants.js` 新增 `LOTTERY.FC3D`；`server/services/storage.ts` 註冊實例；
  `app/services/api.ts` 補型別與 4 支 `$fetch`；`lottery-hall.vue`／`BgAutoPanel.vue`／
  `useBgAutoActive.ts` 掛上入口與自動下注面板；新增對應 SCSS 並掛進 manifest。
- 玩法規則（5 個分頁，來源逐項對照，機率窮舉與判定依據詳見 `design.md`）：
  - 定位膽（181101010）：百/十/個位各自 0~9 單選複式
  - 直選組選（18111）：前二／後二 各自的 直選（位置對應）／組選（2 碼不分順序）
  - 三星（18112）：直選複式／直選單式／直選和值（0~27，窮舉表）；
    組三／組六／組選和值（合併版，1~26，窮舉表，**跳過空玩法 181121113/114**）
  - 不定位（18113）：一碼不定位（任一位命中即中，機率 27.1%）／
    二碼不定位（兩碼各自命中不同位，機率 5.4%）——依公開官方規則，使用者已確認採用
  - 大小單雙（18114）：前二／後二 各自兩個位置的 大/小/單/雙（各機率 50%）

## Capabilities

### New Capabilities
- `fc3d-official`：福彩3D官方盤玩法頁需提供定位膽／直選組選／三星／不定位／大小單雙
  五大玩法、單一頁面下注與結算，賠率一律「公平賠率 × RTP」窮舉推導，不建彩池。

## Impact

- 前端：新增 `app/pages/lottery/bg/fc3d.vue`、`app/components/lottery/bg/fc3d/**`、
  `app/composables/useFc3d.ts`
- Config：新增 `shared/config/fc3d.ts`、`shared/config/fc3d-of.ts`、
  `shared/config/fc3dof/{plays.js,helpers.ts}`
- 後端：新增 `server/services/game/lottery/bg/fc3d.ts`、`server/api/lottery/fc3d/**`；
  修改 `server/services/storage.ts`
- 共用設定：修改 `app/config/constants.js`、`app/services/api.ts`、`app/pages/lottery-hall.vue`、
  `app/components/lottery/bg/BgAutoPanel.vue`、`app/composables/useBgAutoActive.ts`、SCSS manifest
- 影響範圍：僅新增獨立玩法路由與服務，不改動既有 6hc／k3／pk10／ssc／11x5／x5／eggs／kl10／kl8
  的判定與結算邏輯；不建立跨遊戲共用的彩池/爆池機制
