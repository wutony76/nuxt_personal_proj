# Proposal

## 變更名稱

add-npc-auto-play — 後台新增「NPC」子頁面：總開關、NPC 會員清單、可勾選遊戲自動遊玩

## 背景

後台已經有 NPC 相關的地基，但完全沒接線：

- `server/services/admin/modules/roleDefs.ts:26` 內建角色清單裡已經有一個 `'npc'` 角色
  （`{ id: 'npc', name: 'NPC', builtin: true, testMode: true, npcMode: true }`），且
  `npcMode`／`testMode` 對這個角色是鎖 ON、不可關閉的（見同檔案 `updateSettings`）。
- `adminAccessService.setRole()`（`server/services/admin/modules/adminAccess.ts:148`）已經
  可以把任何會員指派成 `'npc'` 角色，`/admin/roles` 頁面的角色下拉選單今天就選得到
  「NPC」。
- `RoleDef.dailyCoinReward`（`roleDefs.ts:7-10`）這個「每日自動發 F幣」設定也已經存在、
  後台可以開關與設定金額（`app/components/admin/RoleList.vue`），但目前**沒有任何程式碼
  真的去發這筆錢**——純粹是個沒接線的開關。
- `npcMode` 這個欄位本身，全專案 grep 不到除了 `roleDefs.ts` 以外的任何用途——也是個
  預留、沒接線的旗標。

換句話說，「哪些會員是 NPC」這件事已經做好了，缺的是「NPC 會員要自動做什麼」。使用者要
的：一顆總開關控制整個 NPC 自動遊玩功能、一個列表列出目前有 NPC 角色的會員、以及一組
「勾選哪些遊戲允許 NPC 自動玩」的清單，之後 NPC 會員就會對勾選的遊戲自動下注/遊玩。

第一輪規劃提出 5 個待確認事項，使用者已逐項給方向（見下方「已決定事項」）。

**本次仍僅產出 Proposal + Design + Tasks 三份文件（規劃階段），不寫程式碼**，等文件內容
定案、使用者明確要求進入 Implementation 才開始寫程式碼。

## 目標

- 後台新增一個「NPC」子頁面，放在「角色 / 權限」底下。
- 頁面內有一顆總開關：控制「NPC 自動遊玩」整體功能開/關；關閉時，進行中的動作要跑完
  才真正停止，不強制中斷。
- 頁面列出目前角色為 `'npc'` 的會員，並可針對每個 NPC 會員個別設定：
  - 每日最多花多少 F幣（`dailyMaxSpend`）
  - F幣不足時自動儲值多少（`topUpAmount`，每次儲值需留下記錄，比照既有
    `walletBalanceService` 的 `admin-topup` 異動類型）
- 提供「勾選遊戲」清單，橫跨全站所有可玩遊戲分類（BG 彩票 15 款、台彩鏡射玩法 8 款、
  經典遊戲 29 款、柑仔店櫥仔 8 款，共 60 款）：
  - **第一階段實作：BG 彩票（15 款）+ 經典遊戲／遊戲中心（29 款）**，可勾選、可真的
    自動遊玩
  - 台彩鏡射玩法（8 款）、柑仔店櫥仔（8 款）：清單上列出但標記「即將支援」，暫不可勾選
- NPC 自動遊玩涵蓋兩種性質不同的玩法，形成一個小型經濟迴圈：
  - **經典遊戲／遊戲中心**：玩一輪拿分數換 F幣（`RETRO_GAME_BASE.actions.record()`，見
    Design 8），對 NPC 來說是**收入來源**，不用先有錢才能玩
  - **BG 彩票**：真的下注、真的花 F幣（`Storage.games[key].playBets()`），是**支出**，
    餘額不足時觸發自動儲值
- 「資料統計」下所有跟 F幣／下注相關的既有報表（`fcoin-summary`／`bg-summary`／
  `tw-lottery-payout`／會員報表）都要能把 NPC 的活動跟真人玩家分開顯示（NPC 下注真的會
  混進共池與開獎歷史，但統計數字要能拆開看，見「已決定事項 2」）。

## 已決定事項（使用者已拍板，取代原本 5 項待確認）

1. **NPC 資金來源**——不是單純的「每日固定發幣」，而是雙軌：
   - 會員設定新增一組「F幣設定」：`dailyMaxSpend`（每日最多花多少 F幣）、
     `topUpAmount`（F幣不足時自動儲值多少）。儲值要留下記錄（沿用
     `walletBalanceService.appendChange(userId, { type: 'admin-topup', amount, note })`
     的既有異動類型即可，不用新增類型）。
   - 額外收入管道：NPC 也會自動玩經典遊戲／遊戲中心賺分數換 F幣（既有
     `game-reward` 機制，見背景段落），跟原本規劃的「每日固定發幣」（`dailyCoinReward`）
     相比更真實——NPC 花的錢有一部分是自己「賺」回來的，不是後台無限印錢。
   - `dailyCoinReward` 這個既有 stub 設定本次先不接線（跟「F幣設定」的每日花費上限＋
     自動儲值是兩套機制，避免疊加後互相干擾），留著給之後需要「角色整體每日發幣」時再用。
2. **NPC 下注會混進真人玩家看到的資料**（共池、開獎歷史、路珠都算真的一份），但後台
   「資料統計」底下的報表需要能把 NPC 的部分拆開看，不要讓 NPC 灌水到真人數據裡誤導判斷。
   影響範圍：`fcoin-summary.get.ts`（柑仔店/遊戲中心報表）、`bg-summary.get.ts`（BG 彩票
   月報，`settlement.vue`/`plays.vue` 共用）、`tw-lottery-payout.get.ts`（彩運來中獎派彩
   月報）、會員報表（`members.get.ts`）——這幾份報表的聚合迴圈本來就是逐 userId 累加，
   本次要多做一次「依 `roleOf(userId)` 分流」，把 NPC 與真人分開累加、前端多顯示一組
   NPC 數字（不是本次新增報表頁面，是既有頁面多一欄/多一區塊）。
   **例外**：`bg-lottery.vue` 的彩池稽核報表（`poolAudit`，池底重骰／保底超付事件）
   使用者確認**不需要**分流，NPC 造成的事件維持跟真人混在一起看。
3. **第一階段遊戲覆蓋範圍**：BG 彩票（15 款）全部 + 經典遊戲／遊戲中心（29 款）全部。
   台彩鏡射玩法（8 款）、柑仔店櫥仔（8 款）暫緩，清單上列出、標記「即將支援」、不可勾選。
4. **預設值**：使用者要我先規劃一組合理預設，之後在後台可調（不是寫死常數）。見下方
   「建議預設值」。
5. **總開關關閉時的行為**：進行中的動作要「做完才停」，不強制中斷——`tick()` 本身每次
   呼叫都是同步、瞬間內完成的單次下注/結算（沒有跨多個 tick 的「進行中」狀態），所以實務
   上只要「關閉後不再排下一次」就自然達成這個效果，不需要額外的中斷保護機制。

## 建議預設值（草案，實作階段建成後台可調欄位，不寫死）

| 設定項 | 建議預設值 | 說明 |
|---|---|---|
| NPC 自動遊玩總開關 | 關閉 | 安全預設，需要後台主動開啟 |
| 排程檢查間隔 | 30 秒 | 每 30 秒檢查一次是否有 NPC 該行動 |
| 每次行動涵蓋的 NPC 數 | 全部 NPC，各自獨立判斷 | 不是每 tick 只選一個 NPC |
| 經典遊戲／遊戲中心 vs BG 彩票的選擇權重 | 各 50% | 用權重決定這次行動玩哪一大類，避免其中一類被冷落 |
| 經典遊戲模擬分數 | 該遊戲 `maxReasonableScore` 的 10%～40% 隨機 | 避免刷到每日 coin 上限太快，也避免分數低到沒意義 |
| BG 彩票單注金額 | 隨機範圍 10～150 coin | 每次行動在範圍內隨機抽一個金額，不固定同一個數字 |
| 每個 NPC 每日最多花多少 F幣（`dailyMaxSpend`） | 50,000 | 使用者指定 |
| F幣不足時自動儲值多少（`topUpAmount`） | 2,000 | 夠撐幾輪 BG 下注，不會一次補太多 |

## 範圍

- 包含：
  - 新增 `app/pages/admin/npc.vue`，掛在「角色 / 權限」底下（新增橫向 tabs，見 Design）
  - 新增後台 service `npcAutoPlay.ts`：總開關、四分類遊戲清單（BG/retro 可勾選，
    tw/toys 標記即將支援）、每個 NPC 會員的 `dailyMaxSpend`/`topUpAmount` 設定、`tick()`
    排程本體
  - 新增背景排程：接進既有 `HFYYManage.circle()` 的 tick 迴圈
  - BG 彩票 15 款、經典遊戲 29 款的自動遊玩整合（呼叫既有 `playBets()`／
    `actions.record()`）
  - 既有 4 份報表（`fcoin-summary`／`bg-summary`／`tw-lottery-payout`／會員報表）加上
    NPC／真人分流聚合與顯示
  - 重用既有 `GET /api/admin/roles`（會員清單，含角色與 F幣），不新增會員查詢端點
- 不包含（本次規劃階段先排除，需求成熟再開新變更）：
  - 不做台彩鏡射玩法／柑仔店櫥仔的自動遊玩（僅列清單標記「即將支援」）
  - 不做「每個 NPC 會員各自勾不同遊戲」——遊戲勾選清單是全域共用，個別 NPC 只能調
    `dailyMaxSpend`/`topUpAmount`，玩哪些遊戲不能各自不同
  - 不接線 `RoleDef.dailyCoinReward`（見「已決定事項 1」）
  - 不做 NPC 專屬的下注策略／AI，下注邏輯先求「能真的呼叫到跟真人玩家一樣的服務」

## 影響面（初步，實作階段可能微調）

- 前端路由/頁面：
  - 新增 `app/pages/admin/npc.vue`
  - 修改 `app/pages/admin/reports/fcoin.vue`、`settlement.vue`、`plays.vue`、
    `taiwan-lottery.vue`（中獎派彩月報那段）、`members.vue`：加上 NPC／真人分流顯示
- 前端元件/Composables：
  - 新增 `app/components/admin/AdminRolesNav.vue`（角色/權限橫向 tabs）
  - 可能重用 `GameCatalogPanel.vue` 的分類/勾選格 UI 模式
- 後端 API/Services：
  - 新增 `server/services/admin/modules/npcAutoPlay.ts`
  - 新增 `server/api/admin/npc/settings.get.ts`／`.patch.ts`（總開關 + 排程參數）
  - 新增 `server/api/admin/npc/games/[category]/[key].put.ts`（單一遊戲勾選）
  - 新增 `server/api/admin/npc/members/[userId]/settings.patch.ts`（`dailyMaxSpend`／
    `topUpAmount`）
  - 修改 `server/services/admin/hfyyManage.ts`（掛上 `npcAutoPlay`，`circle()` 呼叫
    `tick()`）
  - 修改 `server/api/admin/reports/fcoin-summary.get.ts`／`bg-summary.get.ts`／
    `tw-lottery-payout.get.ts`／會員報表：加上 NPC／真人分流
- 設定或常數（`app/config/`）：無

## 風險與對策

- 風險：BG 彩票 15 款盤口下注 payload 形狀不完全一致（號碼/位數/期別規則各異），自動
  下注要先讀懂每個盤口目前受理下注時的合法 payload 最小組合
  - 對策：實作階段逐盤口確認（可能有前後順序差異，非一次到位），先完成架構與最簡單的
    1～2 個盤口打通，其餘依序補齊，寫進 tasks.md 逐項追蹤
- 風險：NPC 大量自動下注可能影響 BG 彩池補貼機制（`poolAudit`、保底超付事件）的真實性，
  讓既有的彩池監控報表數字混入 NPC 造成的事件
  - 對策：使用者確認 `bg-lottery.vue` 的彩池稽核報表（`poolAudit`）**不需要**做
    NPC／真人分流，維持現狀、混在一起看即可（跟「已決定事項 2」的四份報表不同，那四份
    要分流，這份不用）
- 風險：經典遊戲的 `coinDailyCap`（每人每日 coin 上限）是共用機制，NPC 頻繁玩可能很快
  觸頂，之後那個 NPC 當天就領不到更多錢
  - 對策：屬預期行為（機制本來就是防灌水），NPC 觸頂後當天該遊戲收入為 0，不影響下注
    支出邏輯（`dailyMaxSpend` 用完就是用完，跟 coin 賺不賺得到是分開的兩件事）

## 驗證方式（實作階段填寫，本次規劃先列預期項目）

- 功能驗證：
  - 總開關開啟/關閉時，NPC 排程確實啟動/停止
  - 後台勾選/取消勾選遊戲後，NPC 只會在已勾選的遊戲清單裡出現下注/遊玩紀錄
  - NPC 會員清單只列出角色為 `npc` 的會員；改回 `user` 後從清單消失、排程也不再選中
  - 個別 NPC 的 `dailyMaxSpend` 用完後，當天不再自動下注；`topUpAmount` 觸發時產生一筆
    `admin-topup` 記錄
  - 報表頁面（fcoin/bg-summary/tw-lottery-payout/會員）能看到 NPC 與真人分開的數字
- 回歸驗證：
  - 既有 `/admin/roles` 頁面（角色指派、角色設定、遊戲總閘）行為不受影響
  - 真人玩家的下注/遊玩流程、既有報表原本的合計數字（真人+NPC 混合的總數）不受影響

## Open Questions（延伸到實作階段才能確認）

- BG 彩票 15 款盤口的合法最小下注 payload，實作階段逐一確認後才能定案自動下注邏輯

## 成功標準（規劃階段）

- [x] 使用者對 5 項待確認事項逐項拍板
- [x] 使用者確認「建議預設值」表格（`dailyMaxSpend` 改 50,000、BG 單注改隨機範圍
      10～150）
- [x] Design 文件的 state/flow/API 定案
- [ ] 使用者明確要求進入 Implementation 後才開始寫程式碼
