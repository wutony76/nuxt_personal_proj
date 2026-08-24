## 1. 玩法設定來源盤點（唯讀）

- [x] 1.1 讀取 `bglottery` `pl3/` 全部檔案，並與 `fc3d/` 對應檔案逐檔 `diff`
- [x] 1.2 `config_ssc.js`：playId 前綴 `181`→`191`、`lotteryId` `1801`→`1901` 正規化後
      與 fc3d 逐位元組完全相同，含 `191121113`／`191121114` 同為空物件 `{}`
- [x] 1.3 `official/js/{algorithm,select_num_tool}.js`：與 fc3d 對應檔案逐位元組完全相同
- [x] 1.4 `official/play_script.js`：確認差異只有 fc3d 多出的 `isrx`／`TSH3` 死代碼兩段，
      pl3 本身無此殘留，其餘（含 `DXDS` 大小單雙分支）逐行相同
- [x] 1.5 沿用 fc3d 提案階段已拍板兩項：跳過空玩法 191121113/114（只做合併版三星組選和值）／
      不定位判定採公開官方規則（一碼27.1%／二碼5.4%，兩彩種規則相同）

## 2. Config 核心層（`shared/config/pl3.ts`）

- [x] 2.1 常數：`PL3_DIGIT_COUNT`(3)、`PL3_DIGIT_MIN/MAX`(0/9)、`PL3_TOTAL_OUTCOMES`(1000)、
      `PL3_SUM_MIN/MAX`(0/27)、`PL3_PLACE_NAMES`(['百位','十位','個位'])
- [x] 2.2 純函式：`pl3DigitsOf(openCode)`、`pl3SumOf`、`pl3IsTriple`
- [x] 2.3 機率表（純窮舉 1000 種結果，memoized）：`pl3SumCounts()`（0~27）、
      `pl3GroupSumCounts()`（1~26，排除豹子，表加總 990）
- [x] 2.4 對帳腳本：`pl3SumCounts()` 加總 = 1000；`pl3GroupSumCounts()` 加總 = 990；
      兩表與 fc3d `design.md` 對應窮舉表逐值一致（同一數學問題，獨立重算後核對）

## 3. Config 判定層（`shared/config/pl3-of.ts`）

- [x] 3.1 `Pl3Bet` descriptor（discriminated union）：`ballPos`／`direct`／`group2`／`group3`／
      `group6`／`sumValue`／`groupSumValue`／`unpositioned1`／`unpositioned2`／`sides`
- [x] 3.2 `_parseBet`：依 alias/前綴解析注碼字串，逐一對照 `fc3d-of.ts` 搬移
- [x] 3.3 `pl3ChanceOf(bet)`（回傳 `{hit,total}`）：邏輯與 `fc3dChanceOf` 相同
- [x] 3.4 `pl3IsHit(bet, openCode)`：直選/組選/定位膽/大小單雙用「排列比對」；不定位用
      「集合包含」，兩套邏輯分開實作
- [x] 3.5 `pl3OddsOf(betCode, rtp=PL3_RTP_FALLBACK=0.96)`＝`(total/hit)*rtp`，`toFixed(2)`
- [x] 3.6 `judgePl3Bet(betCode, openCode, coin, lockedOdds)`：唯一結算入口，鎖定賠率
- [x] 3.7 複式展開：`pl3DirectCombos`／`pl3GroupCombos`／`pl3SideCombos`；`PL3_MAX_COMBO`
      上限比照 `FC3D_MAX_COMBO`
- [x] 3.8 `PL3_PLAY_DEFINITIONS`（5 個 tab，順序＝定位膽/直選組選/三星/不定位/大小單雙）

## 4. Config 看板設定層（`shared/config/pl3of/`）

- [x] 4.1 `plays.js`：5 個 tab、對應 type/group 結構（見 `design.md` 決策1表格，playId 全數
      191 前綴）；quota 比照 `fc3dof/plays.js`、`payout.rtp: 0.96`；**不含 `combo.pool`**；
      191121113/114 註解記錄「來源空物件，沿用 fc3d 已確認跳過」；**不得出現任何 import**
- [x] 4.2 `helpers.ts`：`findPl3Tab`、`pl3QuotaOf`、`pl3RtpOf`、`pl3MaxOddsOf`、
      `pl3TabOddsOf`、`pl3HasBetCode`、`pl3ComboCodes`、`pl3ComboGroups`；**不含**
      pool/jackpot 相關函式

## 5. Server 服務層

- [x] 5.1 `app/config/constants.js` 新增 `LOTTERY.PL3`（`id: 10001`，單一鍵值、無 `sub`）
- [x] 5.2 `server/services/game/lottery/bg/pl3.ts`：繼承 `LOTTERY_BASE`（比照 `fc3d.ts`）——
      `randomOpenCode`、`openCodePlay`、`validateBetQuota`、`buildOrderRows`、
      `settleIssuePrize`、`playBets`（**不含**任何 rake-into-pool）、`get.userInfo`、
      `get.userDialogRecord`、`get.sumOf`、`actions.claimOneIssue`
- [x] 5.3 `server/services/storage.ts` 註冊 `new Pl3Class()`
- [x] 5.4 4 支 API：`server/api/lottery/pl3/{current,claim,opencode-history,user-record}`
      （比照 `server/api/lottery/fc3d/` 對應檔案；**不建** `jackpot.get.ts`／`pool.get.ts`）

## 6. 前端 API 層與 Composable

- [x] 6.1 `app/services/api.ts`：`Pl3Current`／`Pl3UserRecordResponse`／`Pl3UserBetHistory` 型別、
      4 支 `$fetch`、`currentInfo()` 補 `PL3` case
- [x] 6.2 `app/composables/usePl3.ts`：比照 `useFc3d.ts`（單一盤口骨架＋複式選號機制），
      統一 `reactive` state，三段式 loading/success/error
- [x] 6.3 三星直選單式：輸入框狀態、全形轉半形、正規驗證、去重複/無效碼提示
- [x] 6.4 下注成功後立即刷新 `fetch.current()`／`fetch.userRecordAll()`

## 7. 前端元件（`app/components/lottery/bg/pl3/**`）

- [x] 7.1 `base/Ball.vue`：0~9 號碼球
- [x] 7.2 `block/Header.vue`：期別／倒數／開獎三球／和值標示
- [x] 7.3 `block/History.vue`：近五期開獎
- [x] 7.4 `block/Road.vue`：路珠（和值大小單雙）
- [x] 7.5 `base/Board.vue`：定位膽表格式單選 + 前二/後二/三星/不定位/大小單雙複式選號列；
      三星直選單式另切輸入框分支
- [x] 7.6 `block/CurrItems.vue`、`block/Controls.vue`、`block/Report.vue`
- [x] 7.7 `block/DialogShell.vue`／`DialogOpenCode.vue`／`DialogUser.vue`／`DialogRule.vue`
- [x] 7.8 `block/footer/Auto.vue`、`block/footer/Chat.vue`

## 8. 頁面與大廳整合

- [x] 8.1 `app/pages/lottery/bg/pl3.vue`（單頁，骨架比照 `fc3d.vue`）
- [x] 8.2 `lottery-hall.vue`：`GAME_META.PL3`、`GAME_MODES.PL3`（單卡）、`ROUTE_DICT.PL3`
- [x] 8.3 `useBgAutoActive.ts` 加 `'pl3'`；`BgAutoPanel.vue` 加 `Pl3Auto`／`Pl3Chat` 分支
- [x] 8.4 SCSS：新增 `lhc_pl3.scss` 並掛進 `base.scss` manifest

## 9. 驗證

- [x] 9.1 掃描新增檔案零殘留 `fc3d`／`Fc3d`／`FC3D`／`福彩3D`／`1801`（避免誤植 fc3d 的
      playId／類別名稱進 pl3 wiring）
- [x] 9.2 `nuxi typecheck` 與 `npm run build` 皆 exit 0（typecheck 僅剩既有 kl8/kl10 的
      pre-existing 錯誤，與本次新增檔案無關，已用 `git status` 確認未觸碰該兩檔）
- [x] 9.3 `npm run dev` 啟動後 `/lottery-hall`、`/lottery/bg/pl3` 皆回應 200；
      啟動 log 出現 `TTT---RUN.PL3.官方`，`Storage.games` 初始化成功
- [x] 9.4 curl 端到端測試（登入 admin 帳號）：
      - `current`：期別／倒數／3 位 0~9 開獎號格式正確
      - 定位膽「百位5」下注 10 元 → 成功、鎖定賠率 9.60（與窮舉表一致）、餘額正確扣款
      - 一碼不定位「5」下注 10 元 → 成功、鎖定賠率 3.54（與窮舉表一致）
      - 拒單情境：不存在的注碼「百位99」→ 400 明確錯誤訊息、不扣款；
        單注低於下限（1 元 < min 2）→ 400 明確錯誤訊息、不扣款
      - `user-record`：`balanceChanges`／`betHistory` 正確反映已成立注單
      - 獨立 Node 腳本重新窮舉機率（1000/990 總和、13/14 和值 75、豹子排除、
        一碼 271／二碼 54 不定位命中數）逐值與 `design.md` 表格一致
