# Proposal

## 變更名稱

`add-dlt`（新增大樂透玩法）

## 背景

大廳目前的自製彩票玩法（6HC、K3、PK10、SSC、11X5、EGGS、KL10、KL8、FC3D、PL3）都是自建開獎與賠率
（內部 RNG 開獎、賠率靠機率公式推導），沒有一款是「直接鏡射台灣彩券真實開獎與真實派彩金額」的玩法。
使用者要求新增「大樂透」：49 選 6 ＋ 1 個特別號，且經過反覆確認後，最終定案為**完全鏡射官方大樂透**——
不是自建一套模擬機制，而是：

1. **開獎號碼直接用官方實際開出的號碼**（不是本站自建 RNG）
2. **各獎項派彩金額直接用官方當期實際分配金額**（不套用公平賠率 × RTP 公式）
3. 官方獎金「有人中獎會重新累積、沒人中也會滾存」的動態，本站不需要自己實作滾存邏輯——
   因為本站每期都是**直接讀取官方當期實際結果**，官方那邊怎麼變動，本站就跟著同步顯示/派彩，
   不需要自己維護一份滾存狀態

本專案已有可用的官方資料來源（`server/api/lottery-tw/{last-number,prize}.get.ts`，
`gameCode=5118` 對應大樂透），詳見 `design.md` Decision 1。

依 `openspec/project.md` 的分層標準與使用者已拍板「單一模式、不做信用盤／官方盤雙盤口」，
本次架構比照 `kl10`／`kl8`（單盤口、無 `xxxShared.ts` 共用開獎層），UI 骨架沿用 `K3-CD` 的
block 清單（Header/Board/CurrItems/Controls/Report/History/Road/Dialog*/footer）。

使用者另拍板數項調整（詳見 `design.md` 各 Decision）：
1. 路由改為 `/lottery/tw/dlt`，**全面跳脫成新分類 `tw`**（不歸入 `BG_GAMES`）。
2. Config 命名**不帶 `cd` 後綴**，一律用 `dlt` 這個代號本身。
3. 自動下注面板**直接複製一份獨立的**（`useTwAutoActive.ts`／`TwAutoPanel.vue`），不與既有
   `useBgAutoActive.ts`／`BgAutoPanel.vue` 共用。
4. 下注額度與期別週期比照官方：每注固定 `50 coin`、每週二五開獎（20:00 鎖單、20:30 開獎）。
5. **獎項與開獎號完全鏡射官方**（本次最終定案，取代先前「不做彩池、固定倍率」的版本）：
   - 開獎號＝官方當期實際開出的 6 個號碼＋特別號（讀 `last-number.get.ts`）
   - 8 個獎項（頭獎～普獎，官方實際是 **8 個**，不是 7 個——見 Decision 1 的修正）的派彩金額
     ＝官方當期實際分配金額 `perPrize`（讀 `prize.get.ts`），本站不做任何倍率換算，1 coin＝1（官方單位）
   - 因為每一分錢都是「讀官方當下的值」，本站不需要自己的彩池、摃龜滾存、RTP 概念

## 目標

- 新增「大樂透」單一盤口玩法：49 選 6（不重複）＋ 1 個特別號，選號盤面與判定邏輯自建
  （見 `design.md` Decision 2），但**開獎結果與獎金完全來自官方即時資料**，不自建 RNG、不自建賠率。
- 下注額度（每注固定 50 coin）與期別週期（每週二、五）比照官方公開規則。
- 前端頁面骨架比照 `K3-CD` 的元件拆分方式與版面配置。

## 範圍

- 包含：
  - `shared/config/dlt.ts`（8 獎項對中條件的判定邏輯，供分類注單用；**不含**賠率/RTP 公式）
  - `shared/config/dlt/{plays.js,helpers.ts}`（看板設定，單一虛擬分頁）
  - `server/services/game/lottery/tw/dlt.ts`（下注、鎖單、**呼叫官方 API 取得開獎號與獎金並結算**）
  - 對既有 `server/api/lottery-tw/{last-number,prize}.get.ts` 的**內部呼叫**（不改動這兩支既有
    路由本身的行為，僅新增 `dlt.ts` 對它們的 server-to-server 呼叫；若目前邏輯寫死在
    `defineEventHandler` 內、無法被其他 service import，需要抽成可重用的 service function）
  - `app/composables/useDlt.ts`、`app/components/lottery/tw/dlt/**`、`app/pages/lottery/tw/dlt.vue`
  - 全站接線：`app/config/constants.js`、`shared/config/gameSlugs.js`（新增 `TW_GAMES` 陣列與
    `findTwByPageSlug`）、`app/pages/lottery-hall.vue`、`app/middleware/game-access.global.ts`
    （新增 `/lottery/tw/` 分支）
  - **獨立複製一份**自動下注面板：`app/composables/useTwAutoActive.ts`、
    `app/components/lottery/tw/TwAutoPanel.vue`
- 不包含：
  - 不做信用盤／官方盤雙盤口（使用者已拍板：單一模式）
  - 不做複式／包牌（單式選 6 碼即為一注；複式留待後續變更，見 Open Questions）
  - 不涉入真實新台幣或真實兌獎流程，獎金一律以本站虛擬 coin 計價（僅數字上與官方 1:1 對應，
    coin 與新臺幣無實際兌換關係）
  - **不自建賠率公式、不自建彩池、不自建摃龜滾存**——這些官方動態一律「即時讀取」而非「自己模擬」
  - 不更動既有彩種（6HC/K3/PK10/SSC/11X5/EGGS/KL10/KL8/FC3D/PL3）的判定與結算邏輯
  - 不更動既有 `bg` 系列共用的 `useBgAutoActive.ts`／`BgAutoPanel.vue`
  - 不修改 `server/api/lottery-tw/{last-number,prize}.get.ts` 既有對外行為（僅視需要重構成
    可被 `dlt.ts` import 的 service function，回應內容與既有前台頁面 `lottery-hall-taiwan.vue` 的
    使用方式不變）

## 影響面

- 前端路由/頁面：新增 `app/pages/lottery/tw/dlt.vue`（路由 `/lottery/tw/dlt`）
- 前端元件/Composables：新增 `app/components/lottery/tw/dlt/**`、`app/composables/useDlt.ts`；
  新增 `app/composables/useTwAutoActive.ts`、`app/components/lottery/tw/TwAutoPanel.vue`
- 後端 API/Services：新增 `server/services/game/lottery/tw/dlt.ts`、
  `server/api/lottery-tw/dlt/{current,opencode-history,claim,user-record}`；
  修改 `server/services/storage.ts` 註冊新 service；視需要重構
  `server/api/lottery-tw/{last-number,prize}.get.ts` 抽出可重用的 service function
- 設定或常數（`app/config/`）：`app/config/constants.js` 新增 `LOTTERY.DLT`；
  `shared/config/gameSlugs.js` 新增獨立的 `TW_GAMES` 陣列與 `findTwByPageSlug()`；
  `app/middleware/game-access.global.ts` 新增 `/lottery/tw/` 前綴分支

## 風險與對策

- 技術風險：
  - 風險：本玩法的開獎與結算**依賴外部官方 API**（`api.taiwanlottery.com`），現有兩支呼叫
    (`last-number.get.ts`／`prize.get.ts`) 目前無快取、無重試、無降級策略，且官方端點本身
    **沒有正式文件保證**（設定檔註解已明講）。若官方 API 改版、延遲公布、或暫時不可用，
    本站的結算會卡住。
  - 對策：`dlt.ts` 的結算流程需設計成「輪詢＋重試」而非一次性呼叫失敗就放棄；期別需有明確的
    `pending-settlement` 狀態（已到開獎時間但官方資料尚未到位），避免誤判為「本期無人中獎」；
    詳見 `design.md` Decision 4。
  - 風險：官方獎金明細（`perPrize`）目前程式碼寫死在 `prize.get.ts` 的 `defineEventHandler` 內，
    無法直接被 `dlt.ts` import 呼叫。
  - 對策：抽出成獨立、可重用的 service function（例如 `fetchTaiwanLotteryPrize(gameCode, period)`），
    兩處（既有前台頁面與新的 `dlt.ts`）共用同一份邏輯，不重複實作。
  - 風險：本站的下注期別（下一個開獎日）需要靠日曆推算，若官方實際開獎日因故調整（例如國定假日
    調整開獎日，現實中極少見但曾發生），本站的期別判斷會與官方對不上。
  - 對策：這是可接受的已知限制（機率極低），本次不特別處理節慶調整；若日後真的發生，屬於
    獨立的 bug fix，不在本次設計範圍內預先處理。
- UI/UX 風險：
  - 風險：官方「開獎前的預告累積獎金」（例如新聞常見的「本期上看 2 億」）目前的官方 API
    抓不到，只能抓到「開獎後實際分配金額」。這代表玩家下注當下**看不到**這期的獎金金額，
    要等開獎、結算後才知道自己中了多少。
  - 對策：`Report.vue`／`DialogRule.vue` 需明確告知玩家「本玩法獎金於開獎後依官方實際分配金額
    公布，下注當下不顯示預告金額」，管理玩家預期，非本站技術缺陷。
  - 風險：49 選 6 的選號盤面與 K3-CD 的「表格式注項看板」互動模型不同。
  - 對策：比照 `kl10`／`kl8` 已有的「號碼池選號」元件模式另建 `base/Board.vue`。
  - 風險：獨立複製一份自動下注面板（`TwAutoPanel.vue`）後，未來若 `bg` 系列的自動下注邏輯修正，
    `tw` 這份不會同步跟到。
  - 對策：這是使用者明確拍板的取捨，非本次新增的技術債。

## 驗證方式

- 功能驗證：
  - 選滿 6 個號碼才能送單；送單後鎖定注碼與金額（固定 50 coin）
  - 官方開獎後，`dlt.ts` 能正確抓到當期開獎號與 8 個獎項的 `perPrize`／`winnerCount`
  - 玩家注單依 `(k, hasSpecial)` 正確歸類到 8 個獎項之一，派彩＝官方當期該獎項 `perPrize`
  - 官方資料尚未到位時，期別維持 `pending-settlement`，不會誤判無人中獎
- 視覺驗證：
  - 元件拆分與版面順序與 `K3-CD` 對照
- 回歸驗證：
  - 大廳頁其餘既有玩法卡片與路由不受影響；`lottery-hall-taiwan.vue` 既有的台彩資訊展示功能
    不受影響（重構 `prize.get.ts` 內部邏輯時需保持既有回應格式相容）；`npm run dev` 正常啟動

## 成功標準

- [ ] 選號、送單、鎖單、開獎後同步官方號碼與獎金、8 獎項判定與派彩皆與 `design.md` 訂定的規則一致
- [ ] 官方 API 延遲或暫時失敗時，期別能正確停留在 `pending-settlement` 而非誤判
- [ ] UI 元件拆分與 `K3-CD` 一致（同一組 block 清單、對應職責）
- [ ] `TwAutoPanel.vue`／`useTwAutoActive.ts` 獨立運作且不影響既有 `bg` 系列
- [ ] `lottery-hall-taiwan.vue` 既有功能不受本次重構影響
- [ ] 無新增重大 console / runtime error
- [ ] 相關對帳腳本與手動驗證完成，並落於 `validation.md`
