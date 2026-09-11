## 1. 規格與設計確認

- [ ] 完成 `proposal.md` 定稿（範圍/風險/驗證方式）
- [ ] 完成 `design.md` 定稿（官方資料來源、8 獎項對中條件、鏡射官方派彩、歷史累積、輪詢結算、
      tw 分類、layout 對照表）
- [ ] `design.md` Open Questions 的 4 項（單期最多送單注數、結算輪詢頻率/逾時、複式是否列入下一變更、
      近10期不足時的 UI 呈現方式）已由使用者拍板

## 2. 重構既有台彩資料端點（供 dlt.ts 內部呼叫，不改變既有對外行為）

- [ ] `server/api/lottery-tw/last-number.get.ts`：抽出 `fetchTaiwanLotteryLastNumber()` service
      function，路由本身改為呼叫該 function，回應格式不變
- [ ] `server/api/lottery-tw/prize.get.ts`：抽出 `fetchTaiwanLotteryPrize(gameCode, period)`
      service function（含既有 `GAME_DEFS` 對照表），路由本身改為呼叫該 function，回應格式不變
- [ ] 回歸驗證：`app/pages/lottery-hall-taiwan.vue`、`TaiwanLotteryPrizeDialog.vue` 既有行為不受影響

## 3. Config 核心層（`shared/config/dlt.ts`，單一檔案不拆 `-cd`，不含賠率公式）

- [ ] 常數：`DLT_NUMBER_MIN/MAX`(1/49)、`DLT_PICK_COUNT`(6)、`DLT_TOTAL_COMBOS`(13,983,816)、
      `DLT_TIERS`（8 個獎項的 `{ key, label, k, hasSpecial, ways }`，`key`/`label` 沿用
      `prize.get.ts` 的 `GAME_DEFS[5118].tiers`，不重複定義）
- [ ] `_parseBet`：逗號分隔恰好 6 個號碼、範圍 1~49、無重複
- [ ] `dltTierOf(bet, winningNumbers, special)`：唯一判定入口，回傳 8 個官方獎項 key 之一或 `null`
- [ ] 對帳腳本：node 窮舉或組合數公式二次驗證 8 個獎項對中組數
      （1/6/252/630/12,915/17,220/229,600/172,200）與加總 432,824 是否與 `design.md` Decision 1 一致

## 4. Config 看板設定層（`shared/config/dlt/`）

- [ ] `plays.js`：單一虛擬分頁（大樂透），8 個獎項作為 `groupList`（僅名稱/對中條件，**不含**
      `odds` 快照——賠率要等結算後才知道），**不得出現任何 import**（Nitro 限制）
- [ ] `helpers.ts`：`findDltPlay/Tab`、`dltQuotaOf`、`dltHasBetCode`

## 5. Server 服務層：鏡射官方開獎與派彩

- [x] `server/services/game/lottery/tw/base.ts`／`tw/orders.ts`：複製自 `bg/base.ts`／`bg/orders.ts`
      （bg／tw 兩邊基底刻意不共用同一份檔案），`tw/orders.ts` 的 `tiers` 欄位型別改為通用的
      `Array<Record<string, unknown>>`，不依賴 6hc 專屬的 `CreditLianmaTier`
- [ ] `app/config/constants.js` 新增 `LOTTERY.DLT`（單一鍵值、無 `sub`）
- [ ] `server/services/game/lottery/tw/dlt.ts`：繼承 `tw/base.ts` 的 `LOTTERY_BASE`（不 import
      `bg/base.ts`）——
      - 期別 = 官方 `period`（直接沿用，不自行編碼映射）
      - 依日曆判斷下一個開獎日（每週二、五）、20:00 鎖單
      - `validateBetQuota`：下注金額必須固定為 50，其餘金額整筆拒絕；一次送單最多 5 筆獨立注單
        （比照官方投注單 A~E，非複式展開），每筆各自驗證
      - `settleIssuePrize`：20:30 後開始輪詢 `fetchTaiwanLotteryLastNumber()` +
        `fetchTaiwanLotteryPrize('5118', period)`；任一未到位則維持 `pending-settlement`
        （不得誤判為無人中獎）；兩者到位後，逐注以 `dltTierOf()` 分類、派彩＝該獎項當期 `perPrize`；
        結算完成後把該期官方開獎號 push 進 `this.recordOpenCode`（Decision 4）
      - `get.userInfo`、`get.userDialogRecord`、`actions.claimOneIssue`、`user.dltRecord`
- [ ] 已結算期別標記，避免輪詢重試重複結算
- [ ] `server/services/storage.ts` 註冊 `new DltClass()`
- [ ] 4 支 API：`server/api/lottery-tw/dlt/{current,claim,user-record,opencode-history}`（無 `jackpot`）

## 6. 前端 API 層與 Composable

- [ ] `app/services/api.ts`：`DltCurrent`／`DltUserRecordResponse`／`DltUserBetHistory`
      型別、4 支 `$fetch`、`currentInfo()` 補 `DLT` case
- [ ] `app/composables/useDlt.ts`：module-level `reactive` state；`actions`（選號/機選/清空/送單）
      含 loading guard、early return；三段式 loading/success/error；`pending-settlement` 狀態顯示

## 7. 自動下注面板（獨立複製一份，不共用 bg 系列）

- [ ] `app/composables/useTwAutoActive.ts`：複製 `useBgAutoActive.ts` 的結構，`LotteryType` union
      換成 tw 系列（目前僅 `'dlt'`），**不修改 `useBgAutoActive.ts` 原檔**
- [ ] `app/components/lottery/tw/TwAutoPanel.vue`：複製 `BgAutoPanel.vue` 的結構，`v-if` 分支換成
      tw 系列元件（`DltAuto`／`DltChat`），**不修改 `BgAutoPanel.vue` 原檔**

## 8. 前端元件（`app/components/lottery/tw/dlt/**`，依 `design.md` Decision 9/10 對照表）

- [ ] `base/Board.vue`：**還原官方紙本投注單**——1~49 排成 7×7 方格供圈選（不是號碼池風格）、
      對應一組（A~E 其中一組）注格，含已選 6 碼即時預覽與「電腦選號」勾選/按鈕（勾選後系統
      隨機選 6 碼，玩家仍可手動改選），固定金額 50（無輸入框、無倍數欄位）
- [ ] `useDlt.ts` 的 `state.slots`：`Array<{ id, numbers, isQuickPick }>`，1~5 組（比照 A~E），
      新增/刪除組別的 UI 操作；總金額＝已選滿組數 × 50
- [ ] `block/Header.vue`：期別（官方 period）／倒數（天/時/分）／上期開獎（官方 6 號＋特別號）；
      不顯示預告獎金
- [ ] `block/CurrItems.vue`：顯示目前已填寫的 A~E 各組號碼與狀態
- [ ] `block/Controls.vue`：送出／清空／新增一組（最多 5 組）／刪除某一組
- [ ] `block/Report.vue`：8 獎項對獎表；下注前只顯示名稱/對中條件，結算後補上該期 `perPrize`
- [ ] `block/History.vue`：近期開獎（讀 `recordOpenCode`，筆數依累積期數而定）
- [ ] `block/Road.vue`：冷熱號（統計 `recordOpenCode` 內 1~49 各號碼出現次數）
- [ ] `block/DialogShell.vue`／`DialogUser.vue`／`DialogOpenCode.vue`／`DialogRule.vue`
      （`DialogRule.vue` 說明「開獎號與獎金鏡射官方大樂透實際結果」「下注當下不顯示獎金」）
- [ ] `block/footer/Chat.vue`、`block/footer/Auto.vue`（掛在 `TwAutoPanel.vue` 底下）

## 9. 頁面與大廳整合

- [ ] `app/pages/lottery/tw/dlt.vue`（單頁，路由 `/lottery/tw/dlt`，骨架比照 `k3-cd.vue`／`kl10.vue`）
- [ ] `shared/config/gameSlugs.js` 新增獨立 `TW_GAMES` 陣列 `[{ key: 'DLT', pageSlug: 'dlt' }]` 與
      `findTwByPageSlug()`（**不**塞進 `BG_GAMES`）
- [ ] `app/middleware/game-access.global.ts` 新增 `/lottery/tw/` 前綴分支，呼叫 `findTwByPageSlug`
- [ ] `lottery-hall.vue`：`GAME_META.DLT`、新增 `'DLT': '/lottery/tw/dlt'` 路由對照
- [ ] SCSS：新增樣式並掛進 manifest（如需要）

## 10. 驗證

- [ ] 對帳腳本：8 獎項對中組數與獨立窮舉/組合數公式一致；`dltTierOf` 逐情境
      （k=6；k=5+特別號；k=5 不含；k=4+特別號；k=4 不含；k=3+特別號；k=3 不含；k=2+特別號；k≤1 不中獎）
- [ ] 結算流程：模擬官方資料尚未到位（`pending-settlement` 不誤判無人中獎）、模擬官方資料到位後
      正確結算並派彩、已結算期別不重複結算
- [ ] 端到端（curl + session cookie）：
      - 拒單：號碼個數不符/重複/超出範圍、下注金額不是 50、單次送單超過 5 組 → 整筆拒絕且不扣款
      - A~E 多組各自獨立判定與派彩（例如 A 中頭獎、B 不中，互不影響、互不稀釋）
      - 8 個獎項派彩＝該期官方 `perPrize`
      - 20:00 鎖單後送單一律拒絕；期別於下一個開獎日（週二或週五）正確產生
      - 自動下注面板（`TwAutoPanel.vue`）獨立運作，不影響既有 `bg` 系列 `BgAutoPanel.vue`
      - `recordOpenCode` 正確累積、`History.vue`／`Road.vue` 資料不足時正常顯示（非錯誤）
- [ ] 回歸驗證：`server/api/lottery-tw/{last-number,prize}.get.ts` 重構後，
      `lottery-hall-taiwan.vue` 既有功能（開獎號顯示、中獎明細 Dialog）行為不變
- [ ] `npm run build` exit 0；`/lottery-hall`、`/lottery/tw/dlt`、`/lottery-hall-taiwan` 皆 200

## 11. 交付檢查

- [ ] 確認 `npm run dev` 可正常啟動
- [ ] 必要時執行 build / preview 驗證
- [ ] 完成 `validation.md`（功能／視覺／回歸驗證結果）
- [ ] 完成 `engineering-evidence.md`（變更摘要、驗證佐證、風險與後續追蹤）並確認可執行 `openspec archive`
