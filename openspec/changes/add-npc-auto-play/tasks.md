# Tasks

> 規劃階段產出。5 項待確認事項已由使用者拍板（見 proposal.md「已決定事項」），仍全部
> 尚未開始實作。

## 0. 待確認事項（已拍板，僅剩「建議預設值」需使用者最終確認）

- [x] NPC 資金來源：雙軌（會員 `dailyMaxSpend`/`topUpAmount` + 經典遊戲賺分數換 F幣）
- [x] NPC 下注混進真人資料，但報表要分流顯示
- [x] 第一階段遊戲範圍：BG 彩票 + 經典遊戲全部，TW/toys 先列清單標記即將支援
- [x] 「建議預設值」表格（見 proposal.md）使用者最終確認或調整（`dailyMaxSpend` 50,000、
      BG 單注隨機範圍 10～150）
- [x] 總開關關閉：進行中的動作做完才停，不強制中斷

## 1. 規格與設計確認

- [x] 完成 proposal 定稿（範圍/風險/已決定事項/建議預設值）
- [x] 完成 design 定稿（state/flow/API/排程與經濟迴圈設計/報表分流設計）
- [x] 使用者確認「建議預設值」
- [x] 使用者明確下指令進入 Implementation

## 2. 後端 Service 與資料模型（Implementation 階段）

- [x] 新增 `server/services/admin/modules/npcAutoPlay.ts`：
      總開關、排程參數（`tickIntervalSec`/`bgWeight`/`retroWeight`/`retroScoreMinPct`/
      `retroScoreMaxPct`/`bgBetAmountMin`/`bgBetAmountMax`）、四分類遊戲清單（bg/retro 可勾選，tw/toys 標記
      `supported:false`）、per-NPC 會員設定（`dailyMaxSpend`/`topUpAmount`）、今日已花費
      追蹤（跨日重置）、`tick()`
- [x] `server/services/admin/hfyyManage.ts` 掛上 `npcAutoPlay`，`circle()` 呼叫 `tick()`
- [x] BG 彩票 15 款盤口的最小合法下注 payload：逐一對照各盤口既有驗證邏輯，全數 15 款
      一次到位完成（`npcBgPayload.ts`），非原規劃的分批補齊：
  - [x] LHC-CD／LHC-OF
  - [x] K3-CD／K3-OF
  - [x] PK10-CD／PK10-OF
  - [x] SSC-CD／SSC-OF
  - [x] X5-CD／X5-OF
  - [x] EGGS
  - [x] KL10／KL8
  - [x] FC3D／PL3
- [x] 經典遊戲 29 款：沿用既有 `maxReasonableScore()`／`actions.record()`，未新增函式

## 3. 後端 API

- [x] `server/api/admin/npc/settings.get.ts`
- [x] `server/api/admin/npc/settings.patch.ts`
- [x] `server/api/admin/npc/games/[category]/[key].put.ts`
- [x] `server/api/admin/npc/members/[userId]/settings.patch.ts`
- [x] `server/api/admin/reports/fcoin-summary.get.ts` 加上 NPC／真人分流
- [x] `server/api/admin/reports/bg-summary.get.ts` 加上 NPC／真人分流
- [x] `server/api/admin/reports/tw-lottery-payout.get.ts` 加上 NPC／真人分流
- [x] 會員報表（`members.get.ts`）加上 NPC／真人分流

## 4. 前端 API 與型別

- [x] `app/services/api.ts` 新增對應型別與 `api.admin.npc.*`

## 5. 前端頁面

- [x] 新增 `app/components/admin/NpcPanel.vue`（NPC 子頁面本體）
- [x] 新增 `app/pages/admin/npc.vue`（獨立路由頁面，掛載 `NpcPanel`；`Shell.vue` 補上
      `active` 型別與頂部導覽項目，見下方「與原規劃的差異」的第二筆修訂）
- [x] `fcoin.vue`／`settlement.vue`／`plays.vue`／`members.vue` 補上 NPC／真人分流顯示
      （`taiwan-lottery.vue` 例外，見下方說明）

## 6. 錯誤處理與體驗

- [x] 總開關／排程參數／會員設定／遊戲勾選各自獨立的 loading/success/error 狀態
- [x] 排程 `tick()` 每個 NPC、每次行動都 try/catch 包住，單一失敗不中斷其他人

## 7. 視覺與互動驗證

- [x] 新頁面與既有後台頁面風格一致
- [x] 手動驗證：見 design.md「10. 測試與驗證策略」六項案例，結果見 `validation.md`

## 8. 交付檢查（Implementation 完成後）

- [x] 確認 `npm run dev` 可正常啟動
- [x] 補齊 `validation.md` 與 `engineering-evidence.md`

## 與原規劃的差異（實作階段發現，非缺陷）

- **前端頁面結構（第一版，已於下一筆修訂調整）**：design.md 原規劃是新增獨立頁面
  `app/pages/admin/npc.vue` + 橫向 tabs 元件 `AdminRolesNav.vue`。實作當下發現
  `/admin/roles` 頁面既有的 `RolesPageNav.vue` 其實是「單頁內錨點捲動」模式（不是路由
  分頁），跟角色/權限相關的其他功能（角色清單、遊戲總閘等）都是同一頁面內的不同
  section，因此第一版改為在 `roles.vue` 內新增 `<section id="ar-npc">`、
  `RolesPageNav.vue` 補一個錨點項目，沒有新建路由或 tabs 元件。
- **前端頁面結構（第二版，目前狀態）**：使用者後續自行建立 `app/pages/admin/npc.vue`
  空頁面，要求把 NPC 功能搬過去，回到最貼近 design.md 原規劃的「獨立路由頁面」形式。
  已完成：`npc.vue` 改為 `<AdminShell active="npc"><AdminNpcPanel /></AdminShell>`；
  `Shell.vue` 的 `active` prop 型別加上 `'npc'`（頂部導覽 `NAV` 陣列的 `/admin/npc`
  項目是使用者自己先加的）；`roles.vue` 移除 `<section id="ar-npc">`；
  `RolesPageNav.vue` 移除對應錨點項目。跟 design.md 的差異只剩下沒有另外新增
  `AdminRolesNav.vue` 橫向 tabs 元件——NPC 現在是頂層導覽 `NAV` 裡的一個項目，
  不是「角色/權限」底下的分頁，比原規劃更扁平。
- **可勾選遊戲清單從「全域共用」改成「每個 NPC 各自獨立」**：原規劃（proposal.md／
  design.md）的「勾選遊戲」是全站一份共用清單，所有 NPC 一起吃同一份勾選結果。使用者
  後續要求改成每個 NPC 會員各自獨立勾選，並要能保存、且要有快捷選擇。已完成：
  - `npcAutoPlay.ts`：`_allowedGames: Set<string>`（全域）改成
    `_allowedGamesByUser: Map<userId, Set<string>>`（每個 NPC 一份），`tick()` 內
    `_playRandomBg`／`_playRandomRetro` 依 userId 各自查自己的允許清單
  - 新增 `setMemberGamesBulk(userId, category, allowed)`：快捷「全選／清空」某分類
  - API 從全域 `PUT /api/admin/npc/games/[category]/[key]` 改成
    `PUT /api/admin/npc/members/[userId]/games/[category]/[key]`（單一切換）與
    `PUT /api/admin/npc/members/[userId]/games/bulk`（快捷全選/清空）
  - `NpcMemberRow` 新增 `allowedGames: string[]`（該 NPC 自己的勾選清單），
    `NpcGameItem` 移除全域 `allowed` 欄位（不再有意義）
  - 前端第一版：會員表格新增「可玩遊戲」欄位＋「設定遊戲」按鈕，點開後在該列下方
    展開遊戲勾選格
  - 前端第二版（目前狀態）：使用者要求改成 `CreateMember.vue` 的 `acm-grid` 兩欄式
    操作設計——改成左側 NPC 會員清單（`np-list-wrap`/`np-list`，點擊切換）、右側
    `np-detail` 直接顯示該會員的資訊卡（每日上限/自動儲值可編輯）與遊戲勾選格
    （含分類全選/清空），預設選取清單第一位；點另一位會員右側內容立即切換，不用
    再多點一次「設定遊戲」。移除了原本的表格逐列 inline 展開
  - 設定即時透過 API 保存（in-memory，重啟後回復預設空清單，跟其他 NPC 設定一致）
  - 已用 curl 端對端驗證：兩個不同 NPC 分別勾選/快捷全選，彼此清單互不影響
  - 前端第三版：右側 `np-detail` 改成兩個可切換 tab——「設定」（每日上限/自動儲值/
    權重/單注金額，直接是可編輯欄位，不用先點「編輯」）、「遊戲」（原本的遊戲勾選
    格）。上方資訊卡固定顯示唯讀摘要（含每日上限/自動儲值），下方 tab 切換編輯內容
- **BG／經典遊戲權重、BG 單注金額區間從「全域排程參數」改成「每個 NPC 各自設定」**：
  原本 `NpcSchedule.bgWeight`/`retroWeight`/`bgBetAmountMin`/`bgBetAmountMax` 是全站
  一份共用值，使用者要求併入「會員設定」，讓不同 NPC 可以有不同的玩法傾向與下注習慣。
  已完成：
  - `npcAutoPlay.ts`：這 4 個欄位從 `NpcSchedule` 移到 `NpcMemberSetting`／
    `NpcMemberRow`，預設值不變（bgWeight/retroWeight 各 50，bgBetAmountMin/Max
    10~150）；`_actOnce()`／`_playRandomBg()` 改讀 `_memberSettingOf(userId)` 而非
    全域 `_schedule`
  - `setMemberSetting()` 擴充驗證：新增 4 個欄位的數字檢查，並補上
    `bgBetAmountMin` 不可高於 `bgBetAmountMax` 的檢查（原本掛在 `updateSchedule()`
    上的同一條檢查隨之移除）
  - `NpcSchedule` 現在只剩 `tickIntervalSec`／`retroScoreMinPct`／`retroScoreMaxPct`
    （排程間隔、經典遊戲模擬分數區間——這兩類是「整體排程」概念，不隨 NPC 而異，維持
    全域）
  - 前端「排程參數」區塊只剩 3 個全域欄位；「NPC 會員」右側「設定」tab 用
    `MEMBER_NUMBER_FIELDS` 統一 v-for 渲染 6 個欄位（每日上限/自動儲值/BG 權重/
    經典遊戲權重/BG 單注金額上下限），上方資訊卡同步顯示唯讀摘要
  - 已用 curl 驗證：PATCH 新欄位成功寫入、min>max 正確擋下 400、驗證後已還原測試帳號
- **BG／經典遊戲權重、BG 單注金額區間再加一層「會員沒設定抓全域，會員有設定抓會員的」
  fallback**：上一筆改動把這 4 個欄位完全搬到每個 NPC 各自設定後，使用者要求恢復一個
  全域預設值，讓「還沒手動調過」的 NPC 自動套用全域值、「已經手動存過設定」的 NPC
  固定用自己的值，不受全域變動影響。已完成：
  - `NpcSchedule` 加回 `bgWeight`／`retroWeight`／`bgBetAmountMin`／`bgBetAmountMax`
    當全域預設值（`updateSchedule()` 也加回 `bgBetAmountMin>bgBetAmountMax` 檢查）
  - `_memberSettingOf(userId)`：這個 NPC 有存過設定（`_memberSettings.get(userId)`
    有值）就回傳存過的整份設定；沒存過的話，`dailyMaxSpend`／`topUpAmount` 套用固定
    預設值（50,000／2,000，跟全域排程參數無關），`bgWeight`／`retroWeight`／
    `bgBetAmountMin`／`bgBetAmountMax` 即時讀當下的 `_schedule` 全域值
  - 判定粒度是「整個 NPC 存過設定與否」，不是逐欄位——`setMemberSetting()` 每次都是
    存整份合併後的物件，所以只要按過一次「儲存」，這個 NPC 的 6 個欄位就全部凍結成
    自己的值，之後全域預設再怎麼改都不會影響到它；沒按過儲存的 NPC 則所有欄位都還是
    即時跟隨全域值
  - 前端「排程參數」區塊恢復顯示這 4 個全域預設欄位（標籤加註「全域預設」）；
    「NPC 會員」右側「設定」tab 的 hint 補充說明這個 fallback 規則
  - 已用 curl 端對端驗證：全新 NPC（從沒存過設定）即時跟著全域值變動；手動存過一次
    設定後，再改全域值，該 NPC 的值維持不變（凍結），驗證後已還原全域預設值
- **右側「NPC 會員」詳情新增「資訊」tab，放更詳細的紀錄**：使用者要求把 User ID／
  Email／F幣餘額／今日已花費／每日上限／自動儲值這組固定摘要保留在上方（不要收進
  tab 裡），另外新增一個「資訊」tab 放更詳細的內容。比照 `CreateMember.vue`
  既有的 ledger 模式（`api.admin.memberBalanceChanges`／`memberLoginHistory`，這兩支
  API 本來就存在、NPC 帳號本身也是走同一套會員機制，直接重用即可），tab 內含
  F幣變動紀錄／登入紀錄兩個子分頁，切到「資訊」tab 或切換會員時才 lazy fetch。
  三個 tab 最終順序：資訊／設定／遊戲，預設開啟「資訊」。
  - 後續追加：「資訊」tab 內加了「總覽」小節顯示 BG 彩票權重／經典遊戲權重／BG 單注
    金額下限／上限（單欄直列顯示，不與上方固定摘要重複）；`np-detail-k`／
    `np-detail-edit-label` 補上 `white-space: nowrap` 並加寬，避免長標籤（如「BG
    單注金額下限」）斷行
- **經典遊戲模擬分數下限／上限也改成「會員沒設定抓全域，會員有設定抓會員的」**：
  這兩個欄位原本只有全域一份（`NpcSchedule`），跟 bgWeight 等 4 個欄位當初的處理方式
  不同。使用者要求比照同一套 fallback 機制，讓每個 NPC 也能個別覆蓋。已完成：
  - `NpcMemberSetting`／`NpcMemberRow` 加上 `retroScoreMinPct`／`retroScoreMaxPct`；
    `_memberSettingOf()` 的 fallback 分支也補上這兩個欄位（讀當下的 `_schedule`）
  - `setMemberSetting()` 新增這兩個欄位的驗證，並補上「下限不可高於上限」檢查
  - `_playRandomRetro()` 改讀 `_memberSettingOf(userId).retroScoreMinPct/MaxPct`，
    不再讀全域 `_schedule`
  - 前端 `MEMBER_NUMBER_FIELDS`／`_draftOf()` 加入這兩個欄位，「設定」tab 自動一併
    可編輯；「資訊」tab 的「總覽」也把這兩列的資料來源從 `state.schedule` 改回
    `selectedMember`（比照 bgWeight 等欄位，因為現在也是每個 NPC 各自的值）
  - 已用 curl 端對端驗證：全新 NPC 即時跟隨全域值；手動存過一次後，再改全域值，
    該 NPC 維持原值不受影響，驗證後已還原全域預設值
- **「設定」tab 新增「遊戲時段」複選，NPC 只在勾選的時段自動遊玩**：新功能，24 小時
  分成 5 段（凌晨 00:00–06:00／上午 06:00–10:00／中午 10:00–14:00／下午 14:00–18:00／
  晚上 18:00–24:00），每個 NPC 可複選允許遊玩的時段。已完成：
  - `npcAutoPlay.ts`：新增 `NPC_TIME_SLOTS`（固定 5 段清單）與
    `npcAutoPlayService.listTimeSlots()`；`NpcMemberSetting`／`NpcMemberRow` 加上
    `activeTimeSlots: string[]`（NpcTimeSlot.id 陣列），預設全選（跟這個功能加入前的
    行為一致，等同不限時段）
  - 新增 `_isWithinActiveSlots(userId, now)`：依 `now.getHours()` 判斷目前時間是否落在
    該 NPC 勾選的任一時段內；`tick()` 迴圈內每個 NPC 行動前先檢查這個，不在範圍內就
    直接 `continue`（略過，不算失敗，不影響其他 NPC）
  - `setMemberSetting()` 驗證 `activeTimeSlots` 陣列內每個值都必須是合法的
    `NPC_TIME_SLOTS` id，否則 400；允許存空陣列（等同讓這個 NPC 暫停行動，是合法狀態
    不是錯誤）
  - `GET /api/admin/npc/settings` 回應加上 `timeSlots`（固定 5 段目錄，給前端渲染勾選
    清單用）；member 的 `PATCH .../settings` 加上 `activeTimeSlots` 欄位
  - 前端「設定」tab 新增「遊戲時段」複選 checkbox 群組（獨立於數字欄位，用
    `state.memberTimeSlotsDraft` 追蹤，跟其他欄位一起在按「儲存」時送出）；「資訊」
    tab 的「總覽」也加一列顯示目前選了哪些時段（全選時顯示「不限時段（全選）」、
    空陣列顯示「未勾選任何時段（暫停行動）」）
  - 已用 curl 端對端驗證：全新 NPC 預設全選（5 段都選）；只選 dawn/morning 時，在
    非允許時段（當下是 noon）內即使總開關開啟、有勾選遊戲，也不會有任何行動（coin/
    spentToday 完全不變）；把 noon 加進允許清單後立刻恢復自動遊玩（coin 增加）；
    也驗證了送不存在的時段 id 會正確回 400。驗證後已還原測試帳號狀態
- **「設定」tab 新增「遊戲頻率」，避免 NPC 行為太規律**：新功能。每個 NPC 各自可設
  `actionIntervalSec`（兩次行動至少間隔幾秒，預設 20）、`actionJitterChancePct`（間隔
  到了之後，幾 % 機率再加一段隨機延遲，預設 60%）、`actionJitterMaxSec`（該隨機延遲
  的秒數上限，預設 30）。已完成：
  - `npcAutoPlay.ts`：`NpcMemberSetting`／`NpcMemberRow` 加上這 3 個欄位；新增
    `_nextActionAt: Map<userId, timestamp>`、`_isActionDue(userId, now)`（距上次行動
    是否已過間隔＋隨機延遲）、`_scheduleNextAction(userId, now)`（行動後才重新擲骰排下
    一次最早可行動時間）；`tick()` 迴圈內每個 NPC 依序檢查時段限制→頻率限制，兩者都
    通過才 `_actOnce()`，之後才呼叫 `_scheduleNextAction()`（時段不符時不消耗冷卻，
    頻率未到時單純跳過）
  - `setMemberSetting()` 新增這 3 個欄位驗證，`actionJitterChancePct` 額外檢查
    0～100 範圍
  - 前端 `MEMBER_NUMBER_FIELDS` 加入這 3 個欄位（沿用既有數字欄位 v-for 渲染／驗證
    機制，不需要另外寫 UI），「資訊」tab 的「總覽」也加三列顯示目前值
  - **驗證過程中再次踩到同一台 dev server 長時間熱重載的殘留排程問題**（跟本次變更
    最早期驗證每日花費上限時遇到的是同一類）：第一次用固定 8 秒間隔測試時，短短 3～6
    秒內就出現 3 次行動，跟預期的「至少間隔 8 秒」矛盾。這次經使用者明確授權
    （「你直接把我的清掉 給你執行」）直接 kill 掉舊的 dev server process 並重新啟動
    （同樣監聽 6100），確認新 PID 後在乾淨環境重新建帳號測試：讀真實的
    `GET /api/admin/games/history` 時間戳，兩次行動間隔實測 8.46 秒（設定值 8 秒，
    jitter 機率設 0 排除隨機延遲干擾），誤差在心跳取樣（300ms）範圍內，判定邏輯正確。
    驗證後已把測試帳號與全域排程參數還原成預設值
- **NPC 新建預設改為遊戲全選**：`_allowedGamesOf()` 第一次被存取（從沒設定過）時，
  改成預設把該 NPC 所有已支援分類（bg／retro）的遊戲全部勾選，而不是空清單，不用再
  手動點「全選」。已用 curl 驗證新建 NPC 的 `allowedGames` 剛好等於目錄裡全部
  45 款已支援遊戲（BG 15 + 經典遊戲 30）。
- **「遊戲」tab 新增「保存 / 快選」：可以把目前的遊戲勾選保存成命名範本，之後套用到
  任一 NPC**：新功能。已完成：
  - `npcAutoPlay.ts`：新增 `NpcGamePreset`（`id`/`name`/`allowedGames`/`createdAt`）、
    `_gamePresets: Map<id, NpcGamePreset>`；`listGamePresets()`（依建立時間新到舊排序）、
    `saveGamePreset(name, allowedGames)`（名稱必填、trim 後不可空字串，
    `allowedGames` 只保留目前真的存在且已支援分類的 composite key，過濾掉無效值）、
    `applyGamePreset(userId, presetId)`（找不到 preset 回 404，找到就把該 NPC 的
    `allowedGames` 整份清空重灌成 preset 的內容）、`deleteGamePreset(presetId)`
  - 新增 API：`POST /api/admin/npc/game-presets`（保存）、
    `DELETE /api/admin/npc/game-presets/[id]`（刪除）、
    `PUT /api/admin/npc/members/[userId]/games/apply-preset`（快選套用，body
    `{presetId}`）；`GET /api/admin/npc/settings` 回應加上 `gamePresets`
  - 前端「遊戲」tab 最上方新增保存區塊：輸入名稱＋「保存目前勾選」按鈕（保存的是
    `selectedMember.allowedGames`，也就是畫面上目前這個 NPC 已勾選的遊戲），下方列出
    所有保存過的範本，每筆有「快選套用」（套用到目前選取的 NPC）與「刪除」
  - 範本是全域共用（不綁定特定 NPC），任何 NPC 都可以套用同一份範本，符合「後續可以
    直接使用這個保存的設定快選」的需求
  - 已用 curl 端對端驗證：NPC A 只留 `bg/LHC-CD` 一款並保存成範本「只玩六合彩」；
    NPC B（原本 0 款）套用該範本後 `allowedGames` 剛好變成 `["bg:LHC-CD"]`；空名稱
    正確回 400；刪除範本後清單正確清空。驗證後已把測試帳號的遊戲勾選還原
- **`taiwan-lottery.vue` 未補上 NPC 分流顯示**：後端 `tw-lottery-payout.get.ts` 已經
  補上 `npc` 欄位，但這份報表的整個前端渲染區塊，在本次 NPC 功能開發之前，已被使用者
  在其他工作中移除（非本次變更所為，先前對話已確認「這樣是正確的」）。目前沒有任何
  頁面在消費這支 API，故沒有畫面可以補；後端資料已備妥，之後若該報表頁面重新出現，
  直接讀 `summary.npc` 即可。

## Open Questions（延伸到實作階段）

- （已定案：`bg-lottery.vue` 彩池稽核報表 `poolAudit` 不做 NPC／真人分流，維持現狀）
