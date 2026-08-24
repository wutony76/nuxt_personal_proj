## 1. 玩法設定來源盤點（唯讀）

- [x] 1.1 讀取 `bglottery` `fc3d/` 全部檔案（`index.vue`／`index_script.js`／`header.vue`／
      `config_ssc.js`／`official/{tabs,play}.vue`／`official/play_script.js`／
      `official/js/{algorithm,select_num_tool}.js`）
- [x] 1.2 查證開獎位數：`header.vue` 開獎動畫 `for(i=0;i<3;i++){random(0,9)}`、`'?,?,?'` 佔位 → 3 位數 0~9
- [x] 1.3 查證只有官方盤：`index_script.js` 只呼叫 `playTabMode: 1`，無 `playTabMode: 2` 分支
- [x] 1.4 查證 `config_ssc.js` 全部 playId → `selectarea`/`alias`/`hcltPosition` 對照表
- [x] 1.5 確認 `181121113`／`181121114` 為空物件 `{}`，無 selectarea/alias
- [x] 1.6 確認 `isrx`／`alias==='TSH3'` 為 5 位數彩種殘留死代碼，`config_ssc.js` 零命中對應條件
- [x] 1.7 比對 `pl3`：結構與 fc3d 完全相同（僅 playId 前綴/lotteryId 不同），`play_script.js`
      已清掉死代碼，可作乾淨版對照，本次不處理 pl3 本身
- [x] 1.8 使用者拍板兩項：跳過空玩法 181121113/114（只做合併版三星組選和值）／
      不定位判定採公開官方規則（一碼27.1%／二碼5.4%）

## 2. Config 核心層（`shared/config/fc3d.ts`）

- [x] 2.1 常數：`FC3D_DIGIT_COUNT`(3)、`FC3D_DIGIT_MIN/MAX`(0/9)、`FC3D_TOTAL_OUTCOMES`(1000)、
      `FC3D_SUM_MIN/MAX`(0/27)、`FC3D_PLACE_NAMES`(['百位','十位','個位'])
- [x] 2.2 純函式：`fc3dDigitsOf(openCode)`（解析百/十/個）、`fc3dSumOf`、`fc3dIsTriple`（豹子判定，
      用於組選和值排除）
- [x] 2.3 機率表（純窮舉 1000 種結果，memoized，純 `Number` 即可）：`fc3dSumCounts()`（0~27，`ZXHZ`）、
      `fc3dGroupSumCounts()`（1~26，排除豹子，`ZUSHZ`，表本身加總 990，機率母數仍為 1000）
- [x] 2.4 對帳腳本：`fc3dSumCounts()` 加總 = 1000；`fc3dGroupSumCounts()` 加總 = 990；
      兩表與 `design.md` 窮舉表逐值一致，且與來源 `algorithm.js` 殘留 `cc` 常數
      （13/14→75、`ZUSHZ` 組合數表 1~26）交叉核對吻合

## 3. Config 判定層（`shared/config/fc3d-of.ts`）

- [x] 3.1 `Fc3dBet` descriptor（discriminated union）：`ballPos`(定位膽)／`direct`(前二/後二/三星直選)／
      `group2`(前二/後二組選)／`group3`(三星組三)／`group6`(三星組六)／`sumValue`(三星直選和值)／
      `groupSumValue`(三星組選和值)／`unpositioned1`(一碼不定位)／`unpositioned2`(二碼不定位)／
      `sides`(大小單雙前二/後二)
- [x] 3.2 `_parseBet`：依 alias/前綴解析注碼字串（比照 `sscof.ts` 的 `_parseBet`）
- [x] 3.3 `fc3dChanceOf(bet)`（回傳 `{hit,total}`）：直選類 `hit=1`；group2 `hit=2`；group3 `hit=3`；
      group6 `hit=6`；定位膽/大小單雙單項 `hit=100/500`；和值類查表；不定位類用集合包含公式
      （一碼 `1000-9^3`；二碼 `1000-2*9^3+8^3`，與所選碼無關）
- [x] 3.4 `fc3dIsHit(bet, openCode)`：直選/組選/定位膽/大小單雙用「排列比對」；不定位用
      「集合包含」（`Set.has`／`every`），兩套邏輯分開實作避免誤用
- [x] 3.5 `fc3dOddsOf(betCode, rtp=FC3D_RTP_FALLBACK=0.96)`＝`(total/hit)*rtp`，`toFixed(2)`
- [x] 3.6 `judgeFc3dBet(betCode, openCode, coin, lockedOdds)`：唯一結算入口，鎖定賠率
- [x] 3.7 複式展開：`fc3dDirectCombos(sets)`（Cartesian，不去重）、
      `fc3dGroupCombos(digits, mode:'group2'|'group3'|'group6')`（group3/group6 合法性比照
      `algorithm.js` 的 `_ZUSDScheck`/`_ZULDScheck`）、`fc3dSideCombos(sets)`；
      `FC3D_MAX_COMBO` 上限比照 `SSC_OF_MAX_COMBO`
- [x] 3.8 `FC3D_PLAY_DEFINITIONS`（5 個 tab，順序＝定位膽/直選組選/三星/不定位/大小單雙）

## 4. Config 看板設定層（`shared/config/fc3dof/`）

- [x] 4.1 `plays.js`：5 個 tab、對應 type/group 結構（見 `design.md` 決策1表格）；
      quota 比照 `sscof/plays.js` 現有級距（`item.min:2`，`item.max` 依賠率分層，
      `issue.max:500000`）、`payout.rtp: 0.96`；**不含 `combo.pool`**；
      181121113/114 註解記錄「來源空物件，已確認跳過」；**不得出現任何 import**
- [x] 4.2 `helpers.ts`：`findFc3dTab`、`fc3dQuotaOf`、`fc3dRtpOf`、`fc3dMaxOddsOf`、
      `fc3dTabOddsOf`、`fc3dHasBetCode`（含 `fc3dChanceOf() !== null` 驗證）、
      `fc3dComboCodes`、`fc3dComboGroups`；**不含** pool/jackpot 相關函式

## 5. Server 服務層

- [x] 5.1 `app/config/constants.js` 新增 `LOTTERY.FC3D`（單一鍵值、無 `sub`）
- [x] 5.2 `server/services/game/lottery/bg/fc3d.ts`：繼承 `LOTTERY_BASE`（比照 `eggs.ts`）——
      `randomOpenCode`（3 位 0~9 各自獨立）、`openCodePlay`、`validateBetQuota`
      （逐注 `fc3dHasBetCode` + quota、複式上限）、`buildOrderRows`（伺端重解析 tabId、
      鎖定 `fc3dTabOddsOf()`）、`settleIssuePrize`（`judgeFc3dBet`，未知注碼視為和局退本金）、
      `playBets`（狀態閘門/扣款/建注/推播餘額變化，**不含**任何 rake-into-pool）、
      `get.userInfo`（必須實作，`/api/lottery/userInfo` 依賴）、`get.userDialogRecord`、
      `get.sumOf`、`actions.claimOneIssue`
- [x] 5.3 `server/services/storage.ts` 註冊 `new Fc3dClass()`
- [x] 5.4 4 支 API：`server/api/lottery/fc3d/{current,claim,opencode-history,user-record}`
      （比照 `server/api/lottery/eggs/` 對應檔案；**不建** `jackpot.get.ts`／`pool.get.ts`）

## 6. 前端 API 層與 Composable

- [x] 6.1 `app/services/api.ts`：`Fc3dCurrent`／`Fc3dUserRecordResponse`／`Fc3dUserBetHistory` 型別、
      4 支 `$fetch`、`currentInfo()` 補 `FC3D` case
- [x] 6.2 `app/composables/useFc3d.ts`：比照 `useEggs.ts`（單一盤口骨架）＋ `useSsc.ts` 的
      複式選號機制（`picks`／`toggleOfPick`／`fc3dComboCodes`／comboHint），統一 `reactive` state，
      三段式 loading/success/error；定位膽走「單項表格」狀態，其餘 4 分頁走「複式選號」狀態
- [x] 6.3 三星直選單式：輸入框狀態、全形轉半形、正規驗證、去重複/無效碼提示
- [x] 6.4 下注成功後立即刷新 `fetch.current()`／`fetch.userRecordAll()`

## 7. 前端元件（`app/components/lottery/bg/fc3d/**`）

- [x] 7.1 `base/Ball.vue`：0~9 號碼球
- [x] 7.2 `block/Header.vue`：期別／倒數／開獎三球／和值標示
- [x] 7.3 `block/History.vue`：近五期開獎
- [x] 7.4 `block/Road.vue`：路珠（和值大小單雙）
- [x] 7.5 `base/Board.vue`：定位膽表格式單選 + 前二/後二/三星/不定位/大小單雙複式選號列
      （`.pick-row`／`combo-sum` 展開預覽，比照 `ssc/of/base/Board.vue` 精簡至 3 位）；
      三星直選單式另切輸入框分支
- [x] 7.6 `block/CurrItems.vue`、`block/Controls.vue`、`block/Report.vue`
- [x] 7.7 `block/DialogShell.vue`／`DialogOpenCode.vue`／`DialogUser.vue`／`DialogRule.vue`
- [x] 7.8 `block/footer/Auto.vue`、`block/footer/Chat.vue`

## 8. 頁面與大廳整合

- [x] 8.1 `app/pages/lottery/bg/fc3d.vue`（單頁，骨架比照 `egg.vue`）
- [x] 8.2 `lottery-hall.vue`：`GAME_META.FC3D`、`GAME_MODES.FC3D`（單卡）、`ROUTE_DICT.FC3D`
- [x] 8.3 `useBgAutoActive.ts` 加 `'fc3d'`；`BgAutoPanel.vue` 加 `Fc3dAuto`／`Fc3dChat` 分支
- [x] 8.4 SCSS：新增對應 style 檔並掛進 manifest

## 9. 驗證

- [x] 9.1 對帳腳本：`fc3dChanceOf` 各注項與獨立窮舉一致（定位膽/直選/組選/和值/不定位/大小單雙）；
      `fc3dIsHit` 逐情境（和值0/13/27 邊界、豹子是否正確排除於組選和值、二碼不定位含/不含
      兩碼各一種情境）—— config 層實作時已用窮舉腳本跑過 168 項斷言（1000 種開獎逐一比對），
      全數通過
- [x] 9.2 三星組選和值排列數表（990）與組合數表（210）逐值對帳，確認判定用的是排列數表 ——
      同上一項腳本涵蓋，並修正 design.md 原先「母數 990」的錯誤敘述（母數仍為 1000）
- [x] 9.3 端到端（curl + session cookie）：
      - 拒單：三星直選複式非法碼（少一位）、單注低於下限、送到已跳過的空分頁（181121113）
        → 皆整筆拒絕且不扣款（實測 400 + 明確錯誤訊息）
      - 涵蓋定位膽／三星直選複式／二碼不定位／大小單雙前二 4 個分頁下注，鎖定賠率與
        design.md 窮舉表完全一致（9.6／960／17.78／3.84）
      - 開獎後逐注判定：已實際等過一次完整開獎週期驗證（見 9.6），非僅邏輯推導
- [x] 9.4 `npm run build` exit 0；`/lottery-hall`、`/lottery/bg/fc3d` 皆 200（已實測）
- [x] 9.5 瀏覽器實測（Playwright + chromium，登入 admin 帳號）：
      - 5 個玩法分頁與其子分頁文案、順序皆正確（直選組選 4 個子分頁／三星 6 個子分頁／
        不定位 2 個／大小單雙 2 個）
      - 定位膽單選表格（30 顆球、逐項金額輸入）、複式選號列（三星直選複式 3 排球）、
        大小單雙面別膠囊（8 個）、三星直選單式輸入框（貼碼→即時驗證→展開預覽）皆渲染正確
      - 實際點選並送出一筆定位膽下注：彈窗顯示「下注成功」、下注紀錄即時新增一列（賠率 9.6、
        狀態待開獎）、餘額與當期/累計已投注即時更新
      - `console --errors`／`pageerror` 全程乾淨；唯一出現的 `401 /api/me` 經比對
        既有 EGGS 頁面（`/lottery/bg/egg`）同流程也會出現，確認是既有全站行為、非本次新增問題
- [x] 9.6 真實開獎週期端到端觀察（curl，等待實際期別開盤→封盤→開獎→結算）：
      - 於一碼不定位分頁對 0~9 全部 10 個數字各下注 10 元（刻意涵蓋所有可能結果，確保
        開獎後同時出現 win 與 lose 兩種情境可驗證），等待該期真實跑完開盤中→已封盤→
        正在開獎中→已開獎的完整狀態機
      - 實際開出 `[9, 9, 7]`：注碼「一碼不定位9」與「一碼不定位7」正確判定為 `win`
        （派彩 35.4 = 10 × 3.54，與鎖定賠率一致），其餘 8 個數字正確判定為 `lose`
        （派彩 0），與 `fc3dIsHit` 的集合包含判定手算完全吻合
      - `claimableIssues` 正確加總兩筆中獎金額為 70.8；呼叫 `claim.post.ts` 領取後
        `coin` 從 99,900 增加為 99,970.8、`claimableIssues` 清空、`balanceChanges`
        正確新增一筆 `type:'claim'` 紀錄——下注→開獎→結算→領獎全鏈路完整驗證通過
