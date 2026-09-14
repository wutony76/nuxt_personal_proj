## 1. 規格與設計確認

- [x] 完成 `proposal.md` 定稿（範圍/風險/驗證方式）
- [x] 完成 `design.md` 定稿（官方資料來源、8 獎項對中條件、鏡射官方派彩、歷史累積、輪詢結算、
      tw 分類、layout 對照表）
- [x] `design.md` Open Questions：單期最多送單注數（頭獎金額基準）、結算輪詢頻率/逾時
      （5分鐘/3小時降頻）、近10期不足時的 UI 呈現方式（顯示既有資料）已由使用者拍板；
      複式是否列入下一變更仍待確認（不阻塞本次實作）

## 2. 重構既有台彩資料端點（供 dlt.ts 內部呼叫，不改變既有對外行為）

- [x] `server/services/game/lottery/tw/taiwanLotteryApi.ts`：抽出
      `fetchTaiwanLotteryLastNumber()`／`fetchTaiwanLotteryLastNumberOf(gameCode)`／
      `fetchTaiwanLotteryPrize(gameCode, period)`／`fetchTaiwanLotteryPrizeTier(gameCode, period, tierKey)`
- [x] `server/api/lottery-tw/{last-number,prize}.get.ts` 改為呼叫上述 function，回應格式不變
- [x] 回歸驗證：curl 打 `/api/lottery-tw/last-number`（401 需登入，行為與重構前一致）；
      `lottery-hall-taiwan.vue` 頁面 200

## 3. Config 核心層（`shared/config/dlt.ts`，單一檔案不拆 `-cd`，不含賠率公式）

- [x] 常數：`DLT_NUMBER_MIN/MAX`(1/49)、`DLT_PICK_COUNT`(6)、`DLT_TOTAL_COMBOS`(13,983,816)、
      `DLT_TIERS`（8 個獎項的 `{ key, label, k, hasSpecial, ways }`，`key`/`label` 沿用
      `prize.get.ts` 的 `GAME_DEFS[5118].tiers`，不重複定義）
- [x] `_parseBet`：逗號分隔恰好 6 個號碼、範圍 1~49、無重複
- [x] `dltTierOf(bet, winningNumbers, special)`：唯一判定入口，回傳 8 個官方獎項 key 之一或 `null`
- [x] 對帳腳本：node 組合數公式驗證 8 個獎項對中組數
      （1/6/252/630/12,915/17,220/229,600/172,200，加總 432,824）與 `dltTierOf` 8 種情境模擬皆通過

## 4. Config 看板設定層（`shared/config/dlt/`）

- [x] `plays.js`：單一虛擬分頁（大樂透），8 個獎項作為 `groupList`（僅名稱/對中條件，**不含**
      `odds` 快照——賠率要等結算後才知道），未使用任何 import（Nitro 限制）
- [x] `helpers.ts`：`findDltPlay/Tab`、`dltQuotaOf`、`findDltTierMeta`

## 5. Server 服務層：鏡射官方開獎與派彩

- [x] `server/services/game/lottery/tw/base.ts`／`tw/orders.ts`：複製自 `bg/base.ts`／`bg/orders.ts`
      （bg／tw 兩邊基底刻意不共用同一份檔案），`tw/orders.ts` 的 `tiers` 欄位型別改為通用的
      `Array<Record<string, unknown>>`，不依賴 6hc 專屬的 `CreditLianmaTier`
- [x] `app/config/constants.js` 新增 `LOTTERY.DLT`（單一鍵值、無 `sub`）；`STATUS_TIME` 新增
      `PENDING_SETTLEMENT`
- [x] `server/services/game/lottery/tw/dlt.ts`：繼承 `tw/base.ts` 的 `LOTTERY_BASE`（不 import
      `bg/base.ts`）——
      - 期別：內部佔位 `DLT-YYYYMMDD`（下注用）＋官方真實 `period`（結算/歷史用）分開，
        避免預先猜測官方期別編碼規則失準導致輪詢永遠對不上（見 dlt.ts 檔頭註解，是對
        Decision 3 字面規劃的必要修正，已記錄理由）
      - `_nextDrawWindow()` 依日曆判斷下一個開獎日（每週二、五）、20:00 鎖單／20:30 開獎，
        不 mutate 傳入的 Date（避免污染全站共用的 `MEMORY.now`）
      - `lastJackpotPrize: number` 欄位：服務啟動時初始化為 `DLT_QUOTA_FALLBACK_COIN`(80,000,000)，
        每次結算若 `jackpotAssign.perPrize > 0` 就覆寫此值（見 Decision 3）
      - `validateBetQuota`：下注金額固定 50、一次送單 1~5 筆獨立注單（A~E，非複式展開）；
        單期總注數上限＝`Math.floor(lastJackpotPrize / 50)`，超過整筆拒絕
      - `circle()`：每 300ms 同步期別/狀態，過開獎時間後以 5 分鐘／逾 3 小時降頻 30 分鐘的節奏
        非同步嘗試 `_attemptSettlement()`（`isSettling` 防重疊、`pending-settlement` 不誤判無人中獎）
      - `_settleIssue()`：逐注 `dltTierOf()` 分類、派彩＝該獎項當期 `perPrize`；結算完成後把官方
        真實開獎號 push 進 `this.recordOpenCode`（Decision 4）並更新 `lastJackpotPrize`
      - `get.userInfo`、`get.userDialogRecord`、`get.currentInfo`、`get.tiers`、
        `actions.claimOneIssue`、`user.dltRecord`
- [x] 已結算期別標記（`issueSettledMap`），避免輪詢重試重複結算
- [x] `server/services/storage.ts` 註冊 `new DltClass()`
- [x] 4 支 API：`server/api/lottery-tw/dlt/{current,claim,user-record,opencode-history}`（無 `jackpot`）
      —— dev server 實測 `/api/lottery-tw/dlt/current` 401（需登入，符合預期，無 500）

## 6. 前端 API 層與 Composable

- [x] `app/services/api.ts`：`DltCurrent`／`DltUserRecordResponse`／`DltUserBetHistory`
      型別、4 支 `$fetch`、`currentInfo()` 補 `DLT` case、`LotteryBetPayload` 新增 `slots` 欄位
- [x] `app/composables/useDlt.ts`：module-level `reactive` state；`actions`（選號/機選/清空/送單/
      新增刪除組別）；三段式 loading/success/error；`isPendingSettlement` 狀態顯示

## 7. 自動下注面板（獨立複製一份，不共用 bg 系列）

- [x] `app/composables/useTwAutoActive.ts`：複製 `useBgAutoActive.ts` 的結構，`LotteryType` union
      換成 tw 系列（目前僅 `'dlt'`），**不修改 `useBgAutoActive.ts` 原檔**
- [x] `app/components/lottery/tw/TwAutoPanel.vue`：複製 `BgAutoPanel.vue` 的結構，`v-if` 分支換成
      tw 系列元件（`DltAuto`／`DltChat`），**不修改 `BgAutoPanel.vue` 原檔**

## 8. 前端元件（`app/components/lottery/tw/dlt/**`，依 `design.md` Decision 9/10 對照表）

- [x] `base/Board.vue`：**還原官方紙本投注單**——1~49 排成 7×7 方格供圈選（不是號碼池風格）、
      對應一組（A~E 其中一組）注格，含已選 6 碼即時預覽與「電腦選號」按鈕（點下後系統
      隨機選 6 碼，玩家仍可手動改選），固定金額 50（無輸入框、無倍數欄位）
- [x] `base/Ball.vue`：號碼球（01~49），特別號另有金色樣式
- [x] `useDlt.ts` 的 `slots`：`Array<{ id, numbers, isQuickPick }>`，1~5 組（比照 A~E），
      新增/刪除組別的 UI 操作；總金額＝已選滿組數 × 50
- [x] `block/Header.vue`：期別（內部佔位）／倒數（天/時/分）／上期官方開獎（6 號＋特別號）；
      不顯示預告獎金
- [x] `block/CurrItems.vue`：顯示目前已填寫的 A~E 各組號碼與狀態
- [x] `block/Controls.vue`：送出／清空／新增一組（最多 5 組）／刪除某一組
- [x] `block/Report.vue`：8 獎項對獎表（僅名稱/對中條件，不顯示金額）
- [x] `block/History.vue`：近期開獎（讀 `recordOpenCode`，筆數依累積期數而定，資料不足直接顯示現有筆數）
- [x] `block/Road.vue`：冷熱號（統計 `recordOpenCode` 內 1~49 各號碼出現次數）
- [x] `block/DialogShell.vue`／`DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue`
      （`DialogRule.vue` 說明「開獎號與獎金鏡射官方大樂透實際結果」「下注當下不顯示獎金」）
- [x] `block/footer/Chat.vue`、`block/footer/Auto.vue`（掛在 `TwAutoPanel.vue` 底下）
- [ ] 視覺細節仍偏簡化（功能優先、非逐像素比照 K3-CD），後續可再打磨樣式

## 9. 頁面與大廳整合

- [x] `app/pages/lottery/tw/dlt.vue`（單頁，路由 `/lottery/tw/dlt`，骨架比照 `k3-cd.vue`／`kl10.vue`；
      dev server 實測 200）
- [x] `shared/config/gameSlugs.js` 新增獨立 `TW_GAMES` 陣列 `[{ key: 'DLT', pageSlug: 'dlt' }]` 與
      `findTwByPageSlug()`（**不**塞進 `BG_GAMES`）
- [x] `app/middleware/game-access.global.ts` 新增 `/lottery/tw/` 前綴分支，呼叫 `findTwByPageSlug`
- [x] `lottery-hall.vue`：`GAME_META.DLT`、`GAME_MODES.DLT`（單卡）、`ROUTE_DICT.DLT`；
      不加進 `POOL_FETCHERS`（無彩池，比照 FC3D 的既有先例）
- [ ] SCSS：目前皆為元件內 `<style scoped>`，未額外新增全域 SCSS manifest 項目（暫不需要）

## 9a. 角色遊戲權限補上 `tw` 分類（否則 DLT 永遠無法被後台停用，見 `design.md` Decision 0）

- [x] `server/services/admin/modules/roleGamePerms.ts`：`GameCategory` 型別加 `'tw'`；`_catalog()`
      新增 `tw` 分支（import `TW_GAMES`）
- [x] `server/api/admin/games.patch.ts`、`server/api/admin/role-defs/[id]/games.patch.ts`：
      兩處**各自獨立**的 `VALID_CATEGORIES` 常數都加 `'tw'`
- [x] `app/services/api.ts`：前端 `GameCategory` 型別加 `'tw'`
- [x] `app/components/admin/GameCatalogPanel.vue`、`RoleGamesPanel.vue`：比照 `bgGames`/`retroGames`
      新增 `twGames` filter 與對應 `<section>` 區塊
- [x] `server/api/lottery/bet.post.ts`：`roleGamePerms.isEnabled(roleId, 'bg', ...)` 改成
      伺端依 `getLottery.key` 反查 `TW_GAMES`（`TW_GAMES.some(g => g.key === getLottery.key) ? 'tw' : 'bg'`）
      動態決定 category，**不可信任前端送來的分類欄位**

## 10. 驗證

- [x] 對帳腳本：node 組合數公式驗證 8 個獎項對中組數（1/6/252/630/12,915/17,220/229,600/172,200，
      加總 432,824）；純 JS 模擬 `dltTierOf` 8 種情境（k=6 頭獎～k=2+特別號普獎）與不中獎情境皆正確
- [x] 結算流程：
      - **真實官方開獎已自然發生並驗證過一次**——2026-09-11（週五）期別到 2026-09-15（週二）期別
        的自動輪詢＋結算全程跑通：抓到真實官方 period（115000086）與開獎號、`lastJackpotPrize`
        從回退預設 80,000,000 正確更新為真實頭獎金額 253,563,028、期別正確推進到下一個開獎日、
        測試注單正確判定為「未中」（bet 07-12 對不到真實開獎號）
      - 另建立**保留下來的**管理員限定測試工具 `server/api/admin/dlt-test-settle.post.ts`
        （使用者要求「隨時測試」，跟一般實作期間「用完即刪」的臨時探測路由不同，這支刻意保留），
        搭配 `scripts/test-dlt.mjs`（`npm run test:dlt`）自動跑 8 個獎項判定、A~E 多組互不影響、
        已結算期別不重複結算共 33 項斷言，**全數通過**（見下方「持續可跑的測試腳本」）
- [x] 端到端（curl + admin 測試帳號 session cookie，dev server 實測）：
      - 登入 → `GET /api/lottery-tw/dlt/current` 正確回傳 `issue`（純 YYYYMMDD）／狀態／倒數／
        `quotaIssueMaxBets`（80,000,000÷50=1,600,000）／8 獎項清單
      - `POST /api/lottery/bet`（共用端點，`slots` payload）：1 組與 2 組皆下注成功，
        `orderId` 格式正確（無 `DLTDLT` 前綴重複，已修正並重測）、`coin` 正確扣款
      - 拒單驗證：號碼只選 5 個 → 400 拒絕；號碼重複 → 400 拒絕；一次送 6 組（超過上限 5）→ 400 拒絕；
        三種拒單情境事後查 `userInfo` 確認**皆未扣款**
      - `GET /api/lottery-tw/dlt/user-record`：`balanceChanges`／`betHistory`（`winStatus: 'pending'`）
        正確回傳
      - A~E 多組互不影響、`recordOpenCode` 累積：已於結算流程項用臨時測試路由驗證（見上）
      - 20:00 鎖單後送單拒絕、`TwAutoPanel` 前端互動（點擊/新增組別/機選按鈕實際點擊）
        —— **尚未實測**（前者需操控伺服器時鐘或等實際時間、後者需瀏覽器操作，本次未做）
- [x] 回歸驗證：`server/api/lottery-tw/last-number.get.ts` 重構後 curl 測試回應行為一致（401 需登入，
      與重構前相同）；`/lottery-hall-taiwan` 頁面 200
- [x] dev server 持續運行期間（`circle()` 每 300ms 執行）無任何錯誤累積；
      `/lottery-hall`、`/lottery/tw/dlt`、`/lottery-hall-taiwan` 皆 200
- [x] **持續可跑的測試腳本**：`npm run test:dlt`（`scripts/test-dlt.mjs`）——登入、當期資訊格式、
      下注／拒單／扣款、8 獎項判定、A~E 互不影響、已結算不重複結算、**開獎＋結算整條流程**
      （對真正的 `currentIssue` 下注 → 呼叫 `debugForceSettleNow()` 模擬開獎 → 驗證注單正確結算、
      `currentIssue` 正確推進到下一個開獎日、`recordOpenCode` 帶「（測試）」後綴），共 40 項斷言，
      全數通過、exit code 0。依賴兩支保留下來的管理員限定測試工具：
      `dlt-test-settle.post.ts`（只測派彩判定）／`dlt-test-draw.post.ts`（測整條開獎+結算流程，
      內部呼叫 `DltClass.debugForceSettleNow()`，會讓真正的 `currentIssue` 往前推進）。
      使用者要求「測試紀錄不用移除」——所有測試產生的 `recordOpenCode`／期別紀錄一律帶
      「（測試）」後綴，與真實開獎紀錄可一眼分辨，不需要事後清除
- [ ] `npm run build`（正式建置）—— **尚未執行**，目前僅驗證 dev server

## 11. 交付檢查

- [ ] 確認 `npm run dev` 可正常啟動
- [ ] 必要時執行 build / preview 驗證
- [ ] 完成 `validation.md`（功能／視覺／回歸驗證結果）
- [ ] 完成 `engineering-evidence.md`（變更摘要、驗證佐證、風險與後續追蹤）並確認可執行 `openspec archive`
