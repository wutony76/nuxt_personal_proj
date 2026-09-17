## 1. 規格與設計確認（全數 Open Question 已解決，可進入實作）

- [ ] `proposal.md`／`design.md` 定稿
- [x] Open Question 1：賓果賓果 → **已拍板：開獎號鏡射官方 API、賠率表寫死使用者提供的
      官方公開固定金額**，納入本次範圍，共 7 款玩法
- [x] Open Question 2：3星彩「對彩」→ **已提供**：前二／後二對彩各自獨立判定、可同時
      中獎，各 750 元（25 元×30 倍），見 `design.md` Decision 5
- [x] Open Question 3：**已拍板採納**——`Auto.vue` 各玩法各自獨立實作、`Chat.vue` 共用
      同一份 `ChatPanel.vue` wrapper
- [x] Open Question 4：賓果賓果「每注」基準金額 → **已提供**：`BET_UNIT = 25`，超級獎號
      額外加購 +25 元／注
- [x] Open Question 5：賓果賓果超級獎號開獎順序 → **已提供資料結構規範**：
      `{ issue, numbers: [{ number, order }] }`；實際呼叫官方 API 驗證陣列順序仍是
      Tasks 階段第一個要做的項目（見第 9 節）

## 2. 共用基礎設施（一次性調整，供 7 款玩法共用，需先完成才能開始個別玩法）

- [ ] `shared/config/gameSlugs.js` 的 `TW_GAMES` 新增 7 個條目（key/pageSlug，見 `design.md`
      Decision 0）
- [ ] `app/config/constants.js` 的 `LOTTERY` 新增對應條目（皆帶 `category:'tw'`），確認 `id`
      不與既有玩法衝突
- [ ] 抽出「開獎星期清單」參數化的期別 helper（`_nextOfficialPeriod`/`_prevOfficialPeriods`
      等，見 `design.md` Decision 2），DLT 改呼叫新 helper（行為不變，純重構）並跑
      `npm run test:dlt` 確認 40/40 仍通過
- [ ] `useTwAutoActive.ts` 的 `LotteryType` union 擴充
- [ ] `TwAutoPanel.vue` 的 `v-if` 分支擴充：`Auto.vue` 各玩法一支獨立分支；`Chat.vue`
      統一共用同一份 `ChatPanel.vue` wrapper（不逐一玩法各自 v-if）
- [ ] 回歸驗證：`npm run test:dlt` 40/40 通過、`lottery-hall-taiwan.vue`／既有 `bg` 玩法不受影響

## 3. 今彩539（`D539`，建議優先，最接近 DLT 架構）

- [ ] `shared/config/d539.ts`：`D539_NUMBER_MIN/MAX`(1/39)、`D539_PICK_COUNT`(5)、
      4 個獎項對中條件（比照 `Daily539Result` 的 `d539{Jackpot,Second,Third,Fourth}Assign`）
- [ ] `server/services/game/lottery/tw/d539.ts`：繼承 `tw/base.ts`，期別 bootstrap 改用
      「每天（週一至週六）」參數
- [ ] `app/composables/useD539.ts`、`app/components/lottery/tw/d539/**`（比照 DLT block 清單）
- [ ] `app/pages/lottery/tw/d539.vue`
- [ ] `server/services/storage.ts` 註冊
- [ ] 功能驗證：選 5 個號碼下注、官方開獎後正確判定 4 個獎項

## 4. 49樂合彩（`M649`，依賴 DLT 已驗證的期別週期，判定邏輯簡單）

- [ ] `shared/config/m649.ts`：`isHit(selected, drawn)` 全中判定（見 `design.md` Decision 3）
- [ ] `server/services/game/lottery/tw/m649.ts`：獨立呼叫 `fetchTaiwanLotteryLastNumberOf(1121)`／
      `fetchTaiwanLotteryPrize(1121, period)`，**不 import DLT service**
- [ ] `app/composables/useM649.ts`、`app/components/lottery/tw/m649/**`（選 2/3/4 個號碼的
      「玩幾合」切換 UI，不是 DLT 式固定選 6 個）
- [ ] `app/pages/lottery/tw/m649.vue`
- [ ] `server/services/storage.ts` 註冊
- [ ] 功能驗證：選定合數＋號碼下注、與 DLT 同期開獎後正確判定全中／不中

## 5. 39樂合彩（`M539`，同 49樂合彩模式，依賴今彩539的開獎週期參數）

- [ ] `shared/config/m539.ts`：`isHit(selected, drawn)`（邏輯同 `m649.ts`，號碼池換成 1–39）
- [ ] `server/services/game/lottery/tw/m539.ts`：獨立呼叫 `fetchTaiwanLotteryLastNumberOf(5120)`／
      `fetchTaiwanLotteryPrize(5120, period)`，**不 import D539 service**
- [ ] `app/composables/useM539.ts`、`app/components/lottery/tw/m539/**`
- [ ] `app/pages/lottery/tw/m539.vue`
- [ ] `server/services/storage.ts` 註冊
- [ ] 功能驗證：同第 4 節，號碼池換成 1–39

## 6. 威力彩（`SUPERLOTTO`，兩區選號，複雜度較高）

- [ ] `shared/config/superlotto.ts`：`SUPERLOTTO_ZONE_A_{MIN,MAX,PICK}`(1/38/6)、
      `SUPERLOTTO_ZONE_B_{MIN,MAX,PICK}`(1/8/1)、10 個獎項對中條件（比照
      `SuperLotto638Result` 的 `super638{...}Assign`）
- [ ] `server/services/game/lottery/tw/superlotto.ts`：繼承 `tw/base.ts`，期別 bootstrap
      沿用 DLT 每週 2 期參數（但改星期一、四），需實際呼叫官方 API 確認期別編碼格式
      是否與大樂透一致（`design.md` Decision 2 已標記此為待驗證項目，不可假設）
- [ ] `app/composables/useSuperlotto.ts`：slot 結構 `{ zoneA: number[], zoneB: number|null }`
- [ ] `app/components/lottery/tw/superlotto/base/Board.vue`：兩區選號網格（見 `design.md`
      Decision 4）；其餘 block 比照 DLT
- [ ] `app/pages/lottery/tw/superlotto.vue`
- [ ] `server/services/storage.ts` 註冊
- [ ] 功能驗證：兩區各自選號、官方開獎後正確判定 10 個獎項

## 7. 3星彩（`P3`，重用 `pl3` 判定邏輯）

- [x] 對照 `pl3` 既有 `shared/config/` 判定函式，確認正彩／組彩演算法可直接複製
- [x] `shared/config/p3.ts`：複製 `pl3` 對應邏輯，開獎號碼改為讀
      `fetchTaiwanLotteryLastNumberOf(2108)`；新增對彩判定函式
      `isFrontPairMatch(bet, drawn)`／`isBackPairMatch(bet, drawn)`（`pl3` 無等價規則，
      需新增），兩者各自獨立判定、可同時中獎（各 750 元、25 元基本注，見 `design.md`
      Decision 5），結算時需分別累加派彩，不可只擇一計算
- [x] `server/services/game/lottery/tw/p3.ts`：繼承 `tw/base.ts`，期別 bootstrap 同今彩539
      （每天週一至週六）
- [x] `app/composables/useP3.ts`、`app/components/lottery/tw/p3/**`（參考 `pl3` 既有數字選號
      元件，改用柑仔店主題配色）
- [x] `app/pages/lottery/tw/p3.vue`
- [x] `server/services/storage.ts` 註冊
- [x] 功能驗證：正彩／組彩／前二對彩／後二對彩皆正確判定；前二＋後二同時中獎時
      合計派彩 1,500 元（750+750），不因三碼全同只算一次

## 8. 4星彩（`P4`，重用 `fc3d` 判定邏輯）

- [x] 對照 `fc3d` 既有 `shared/config/` 判定函式，確認正彩／組彩演算法可直接複製
      （4星彩無對彩，範圍比 3星彩單純）——實作時改以剛完成的 P3 為 1:1 對照範本（架構完全一致），
      組彩排列分級延伸 P3「投注數字是否有重複」的二元判定原則（4 碼互異→二獎；有任何重複→
      三獎），此為延伸假設、非官方逐模式對應金額，見 shared/config/p4.ts 檔頭說明
- [x] `shared/config/p4.ts`：複製 P3 對應邏輯，開獎號碼改為讀
      `fetchTaiwanLotteryLastNumberOf(2109)`
- [x] `server/services/game/lottery/tw/p4.ts`：繼承 `tw/base.ts`，期別 bootstrap 同今彩539
- [x] `app/composables/useP4.ts`、`app/components/lottery/tw/p4/**`（參考剛完成的 P3 既有元件）
- [x] `app/pages/lottery/tw/p4.vue`
- [x] `server/services/storage.ts` 註冊
- [x] 功能驗證：正彩／組彩兩種模式皆正確判定（見 scripts/test-p4.mjs）

## 9. 賓果賓果（`BINGO`，輪詢頻率與判定邏輯皆與其他玩法不同，排最後、需獨立驗證）

- [ ] **第一步、優先於其他項目**：實際呼叫 `fetchTaiwanLotteryLastNumberOf(1102)`（或官方
      原始端點）確認回應內容——(a) 是否已有獨立的 `superNumber`／「超級獎號」欄位可直接
      讀取；(b) 若沒有，`lotNumber` 陣列順序是否確實等於原始開獎順序（而非排序後結果）。
      **(a) 存在則直接用官方欄位，不採用 (b) 的假設**；(a)、(b) 皆不可用則需回報無法支援
      超級獎號玩法，不可硬猜陣列索引
- [ ] `shared/config/bingo.ts`：
      - `BET_UNIT = 25`；超級獎號為獨立加購項目（額外 +25 元／注，不併入基本玩法金額）
      - `BINGO_STAR_PAYOUT` 固定賠率表（1~10 星，見 `design.md` Decision 6）、
        `BINGO_SUPER_NUMBER_PRIZE`(1200)、`BINGO_BIG_SMALL_PRIZE`(150)、
        `BINGO_ODD_EVEN_PRIZE`(150)
      - 判定函式：`bingoStarPrize(star, hitCount)`／`bingoSuperNumberHit(picked, superNumber)`／
        `bingoBigSmallResult(numbers)`／`bingoOddEvenResult(numbers)`（大小/單雙回傳含
        `'push'`（和局）的三態結果）
- [ ] `server/services/game/lottery/tw/bingo.ts`：繼承 `tw/base.ts`；開獎結果統一存成
      `{ issue, numbers: [{ number, order }] }`，**一個期號只產生一份**，4 種投注類型
      皆讀同一份、不得各自呼叫官方 API 或各自產生開獎結果；獨立設計每 5 分鐘輪詢與期別
      bootstrap（不沿用 DLT/其他玩法的參數，見 `design.md` Decision 6）；結算時對「和局」
      的大小/單雙注單需退款而非派彩 0；超級獎號與基本玩法/大小/單雙分開計費、分開判定
- [ ] `app/composables/useBingo.ts`、`app/components/lottery/tw/bingo/**`：`Board.vue` 需同時
      容納 4 種投注類型（星數選號／超級獎號／大小／單雙），參考本站既有 `kl8` 的多玩法面板
      配置模式；下注金額顯示需明確區分「基本玩法 25 元」與「超級獎號加購 25 元」，避免
      玩家誤以為選了超級獎號後基本玩法金額會變
- [ ] `app/pages/lottery/tw/bingo.vue`
- [ ] `server/services/storage.ts` 註冊
- [ ] 功能驗證：4 種投注類型皆依固定賠率表正確派彩；大小/單雙的和局情境正確退款；
      超級獎號判定使用官方開獎順序（非集合判定）；同時下基本玩法＋超級獎號時總金額為
      50 元且兩者分開判定

## 10. 全站回歸與交付檢查

- [ ] `lottery-hall-taiwan.vue` 大廳卡片可正確導向各新頁面
- [ ] 既有 DLT、`bg`/`retro` 分類玩法功能與路由不受影響
- [ ] 後台 `roleGamePerms`（`GameCatalogPanel.vue`/`RoleGamesPanel.vue`）能看到並可停用/啟用
      新增的 `tw` 玩法
- [ ] `npm run dev` 正常啟動，無新增重大 console / runtime error
- [ ] 各玩法建立對應的 `scripts/test-{key}.mjs` 對帳腳本，具體測試案例見
      [test-plan.md](test-plan.md)（比照 `test-dlt.mjs` 的 6 大類結構：常數設定、下注拒單、
      獎項判定、多組互不影響、重複結算防護、真實開獎流程，各玩法額外補上專屬風險案例——
      樂合彩的獨立性驗證、3星彩對彩雙中、賓果賓果超級獎號順序判定與和局退款等）
- [ ] 進入實作前，本檔案的每個 `[ ]` 在對應玩法完成後改為 `[x]`（比照 `add-dlt/tasks.md` 的
      既有慣例）
