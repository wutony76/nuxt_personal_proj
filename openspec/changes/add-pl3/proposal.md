## Why

大廳目前缺少「排列3」（PL3）玩法。玩法來源專案 `bglottery` 的
`src/components/room/lotteryAll/pl3/`（`lotteryId: 1901`）**只有官方盤、沒有信用盤**
（`index_script.js` 的 `initLayout()` 只呼叫過 `setPlayData(1, 'pc_191')`／`playTabMode: 1`，
`.then()` 也只處理 `playTabMode == 1` 分支，來源目錄本身沒有 `creditTraditional/` 資料夾）——
跟本專案已完成的 **FC3D（福彩3D）** 是同一種「官方盤單盤口」形狀。

逐檔 diff 已於本次提案階段完成查證：`config_ssc.js` 在把 playId 前綴 `181`→`191`、
`lotteryId` `1801`→`1901` 正規化後，**與 fc3d 逐位元組完全相同**（含 `191121113`／
`191121114`「三星組選和值細分」在來源同樣是空物件 `{}`）；`algorithm.js`／
`select_num_tool.js` 逐位元組完全相同；`official/play_script.js` 的差異**只有** fc3d
多出的 `isrx`／`selectedPosition`（5 位數萬/千/百/十/個位映射）與 `alias === 'TSH3'`
（豹子/顺子/对子）兩段死代碼——pl3 的來源本身就沒有這兩段殘留，是「乾淨版」，
`design.md` 的 fc3d 決策紀錄亦已載明「pl3 可作乾淨版對照，本次不處理 pl3」。

換言之，排列3與福彩3D是**同一套玩法結構的兩個獨立彩種**：位數、範圍（3 位 0~9，
1000 種等機率結果）、五大分類（定位膽／直選組選／三星／不定位／大小單雙）、複式展開規則
完全相同，賠率一律採「公平賠率（母數÷命中數）× RTP」窮舉推導而非沿用來源執行期
`LotteryPlayOdds` 快照——這套推導方法本身是純數學（母數皆為 1000 種等機率開獎結果），
與品牌無關，故 fc3d 已完成並驗證過的機率窮舉表（`design.md` 決策 2）可直接沿用；
但兩者**仍是完全獨立彩種**，不可共用同一份 conf 物件或執行期實例，故本次仍新增一套完全獨立的
`pl3` 檔案（非在 fc3d 檔案內加 if-branch）。

`191121113`／`191121114`（跳過，只做合併版）與「不定位」判定規則（一碼27.1%／二碼5.4%，
公開官方規則）兩項決策，比照 fc3d 提案階段已與使用者確認的結論繼續沿用
（兩款彩種的玩法結構、公開規則相同，非重新拍板）。

彩池機制：pl3 沒有信用盤可用 rake 建池，來源本身也完全沒有彩池相關欄位或 UI 痕跡，
依既有規範（`prompt/pl3.txt` 第 6 節）**預設不建彩池**，本次變更全數維持固定賠率結構。

## What Changes

- 新增 `shared/config/pl3.ts`（共用純函式：開獎號解析、位數/號碼範圍、和值/組別輔助函式，
  比照 `fc3d.ts`，數學定義逐值沿用，3 位數版）。
- 新增 `shared/config/pl3-of.ts`（玩法判定與賠率核心，比照 `fc3d-of.ts`：`_parseBet`、
  `pl3ChanceOf`／`pl3IsHit`、`pl3OddsOf`（公平賠率 × RTP=0.96）、`judgePl3Bet`（鎖定賠率結算）、
  複式展開函式 `pl3DirectCombos`／`pl3GroupCombos`／`pl3SideCombos`，`PL3_MAX_COMBO` 上限
  比照 `FC3D_MAX_COMBO`）。
- 新增 `shared/config/pl3of/plays.js`（.js、零 import，比照 `fc3dof/plays.js` 的
  `{tabId,tabName,settings:{quota,payout},combo?,tabGroup}` 結構，playId 全數改為 191 前綴）
  與 `shared/config/pl3of/helpers.ts`（比照 `fc3dof/helpers.ts`：`findPl3Tab`、`pl3QuotaOf`、
  `pl3RtpOf`、`pl3TabOddsOf`、`pl3HasBetCode`、`pl3ComboCodes`、`pl3ComboGroups`；
  **不含** pool/jackpot 相關函式）。
- 新增 `server/services/game/lottery/bg/pl3.ts`：單一官方盤 service（比照 `fc3d.ts` 的
  單一 class、無 `*Shared.ts` 共用期表層，**不含** pool-tab 分支、**不含**爆池/彩池註冊）。
- 新增 4 支 API：`server/api/lottery/pl3/{current,claim,opencode-history,user-record}.get.ts`
  （`claim` 為 `.post.ts`），比照 `server/api/lottery/fc3d/` 的 4 支基本檔；**不建**
  `jackpot.get.ts`／`pool.get.ts`；投注沿用共用路由 `/api/lottery/bet`。
- 新增 `app/composables/usePl3.ts`（比照 `useFc3d.ts` 的單一盤口狀態骨架 + 複式選號機制，
  統一 `reactive` state，三段式 loading/success/error）。
- 新增 `app/components/lottery/bg/pl3/**`：`base/{Ball,Board}.vue`、
  `block/{Header,History,Road,Report,CurrItems,Controls,DialogShell,DialogOpenCode,DialogUser,
  DialogRule,footer/Auto,footer/Chat}.vue`（比照 `fc3d/**` 對應檔案，扁平佈局、不分 `cd/`／`of/`）。
- 新增 `app/pages/lottery/bg/pl3.vue`（單頁，骨架比照 `fc3d.vue`，無盤口切換、無彩池選號分頁）。
- `app/config/constants.js` 新增 `LOTTERY.PL3`（`id: 10001`）；`server/services/storage.ts`
  註冊 `Pl3Class` 實例；`app/services/api.ts` 補 `Pl3Current`／`Pl3UserRecordResponse`／
  `Pl3UserBetHistory` 型別與 4 支 `$fetch`；`lottery-hall.vue` 新增 `GAME_META.PL3`／
  `GAME_MODES.PL3`／`ROUTE_DICT.PL3`；`BgAutoPanel.vue`／`useBgAutoActive.ts` 掛上入口與
  自動下注面板；新增 `lhc_pl3.scss` 並掛進 `base.scss` manifest。
- 玩法規則（5 個分頁，機率窮舉與判定依據與 fc3d 完全相同結構，詳見 `design.md`）：
  - 定位膽（191101010）：百/十/個位各自 0~9 單選複式
  - 直選組選（19111）：前二／後二 各自的 直選（位置對應）／組選（2 碼不分順序）
  - 三星（19112）：直選複式／直選單式／直選和值（0~27，窮舉表）；
    組三／組六／組選和值（合併版，1~26，窮舉表，**跳過空玩法 191121113/114**）
  - 不定位（19113）：一碼不定位（任一位命中即中，機率 27.1%）／
    二碼不定位（兩碼各自命中不同位，機率 5.4%）
  - 大小單雙（19114）：前二／後二 各自兩個位置的 大/小/單/雙（各機率 50%）

## Capabilities

### New Capabilities
- `pl3-official`：排列3官方盤玩法頁需提供定位膽／直選組選／三星／不定位／大小單雙
  五大玩法、單一頁面下注與結算，賠率一律「公平賠率 × RTP」窮舉推導，不建彩池。

## Impact

- 前端：新增 `app/pages/lottery/bg/pl3.vue`、`app/components/lottery/bg/pl3/**`、
  `app/composables/usePl3.ts`
- Config：新增 `shared/config/pl3.ts`、`shared/config/pl3-of.ts`、
  `shared/config/pl3of/{plays.js,helpers.ts}`
- 後端：新增 `server/services/game/lottery/bg/pl3.ts`、`server/api/lottery/pl3/**`；
  修改 `server/services/storage.ts`
- 共用設定：修改 `app/config/constants.js`、`app/services/api.ts`、`app/pages/lottery-hall.vue`、
  `app/components/lottery/bg/BgAutoPanel.vue`、`app/composables/useBgAutoActive.ts`、SCSS manifest
- 影響範圍：僅新增獨立玩法路由與服務，不改動既有 6hc／k3／pk10／ssc／11x5／x5／eggs／kl10／kl8／
  fc3d 的判定與結算邏輯；不建立跨遊戲共用的彩池/爆池機制
