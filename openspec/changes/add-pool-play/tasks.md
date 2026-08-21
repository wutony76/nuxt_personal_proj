## 1. 規格確認（唯讀）

- [x] 1.1 查證 K3-OF 彩池玩法（`shared/config/k3-of.ts`／`server/services/game/lottery/bg/k3Of.ts`／
      `k3Shared.ts`／`k3/of/block/Picker.vue`）的完整機制
- [x] 1.2 查證 `bglottery` 全專案無「彩池玩法」來源（K3-OF 本身也是本專案自創機制）
- [x] 1.3 窮舉驗證 EGGS／KL10 候選選號結構的機率分布，拍板 EGGS 選 3 碼(0~9可重複)／
      KL10 選 4 碼(1~20不重複)
- [x] 1.4 使用者拍板：新增彩池玩法分頁（非純顯示數字）；池底範圍比照 K3 但獨立宣告常數

## 2. 修正既有 bug：下注後彩池不即時刷新

- [x] 2.1 `useEggs.ts`／`useKl10.ts` 的 `fetch.submit()` 成功分支補呼叫 `fetch.creditJackpot()`

## 3. Config 層（`shared/config/eggs-cd.ts`／`kl10-cd.ts`）

- [x] 3.1 池底常數：`EGGS_POOL_BASE_MIN/MAX`、`KL10_POOL_BASE_MIN/MAX`（110,000/450,000）
- [x] 3.2 抽水常數：`EGGS_POOL_RAKE_RATIO`、`KL10_POOL_RAKE_RATIO`（0.02，比照 K3-CD）
- [x] 3.3 額度常數：`EGGS_POOL_QUOTA`、`KL10_POOL_QUOTA`（比照 `K3_OF_QUOTA`）
- [x] 3.4 爆池 weight fallback：`EGGS_POOL_PLAY_WEIGHT`、`KL10_POOL_PLAY_WEIGHT`（比照
      `K3_OF_POOL_PLAY_WEIGHT`）
- [x] 3.5 Sentinel playKey：`EGGS_POOL_PLAY_KEY`、`KL10_POOL_PLAY_KEY`（皆為 `'xuanhao'`）
- [x] 3.6 選號常數：`EGGS_POOL_PICK_COUNT`(3)、`KL10_POOL_PICK_COUNT`(4)
- [x] 3.7 分層派彩型別與表：`PoolPrizeTier`、`EGGS_POOL_PRIZE_TIERS`、`KL10_POOL_PRIZE_TIERS`
- [x] 3.8 部分命中比對函式：`eggsPoolMatchCount`（multiset 交集，仿 `k3OfMatchCount`）、
      `kl10PoolMatchCount`（Set 交集，開獎不重複不需 multiset）
- [x] 3.9 池底重骰門檻：`EGGS_POOL_FLOOR`／`KL10_POOL_FLOOR`（`ceil(頭獎minAmount÷頭獎ratio)`）

## 4. Server 服務層

- [x] 4.1 `eggs.ts`／`kl10.ts` 新增 instance 欄位：`poolBase`／`poolBaseSetAt`／`issuePoolMap`／
      `carryPool`
- [x] 4.2 新增 `ensurePoolBase()`／`distributablePool()`（複用 `LOTTERY_BASE.jackpotBase()`/
      `jackpotCalc()`）
- [x] 4.3 `settleIssuePrize()` 新增彩池玩法分層結算分支（與既有固定賠率迴圈平行，兩段注單
      皆 push 進同一個 `jackpotRows`）
- [x] 4.4 `playBets()` 新增彩池玩法的下注驗證（額度用 `XXX_POOL_QUOTA`，注碼驗證
      `XXX_POOL_PICK_COUNT` 個合法號碼）與抽水（`XXX_POOL_RAKE_RATIO`，與既有爆池抽水並行）
- [x] 4.5 新增 `get.poolState()`：回傳 `{ issue, base, carry, issuePool, distributable, prizeTiers }`

## 5. API 層

- [x] 5.1 `server/api/lottery/eggs/pool.get.ts`、`server/api/lottery/kl10/pool.get.ts`
- [x] 5.2 `app/services/api.ts` 新增 `poolEggs()`/`poolKl10()` `$fetch`

## 6. 前端 Composable

- [x] 6.1 `useEggs.ts`／`useKl10.ts` 新增 `poolPlay`（選號狀態）、`isPoolPlay` 計算屬性、
      `poolPlayState` reactive
- [x] 6.2 `betsPool()`／`autoBets()` 的 `isPoolPlay` 分支送單方法（送 `codes` 陣列，不經
      `select.pool`/`toggleItem`）
- [x] 6.3 `playList` 注入合成分頁 `{ key: 'xuanhao', name: '選號（彩池）', list: [] }`
- [x] 6.4 `fetch.initPageData()`／輪詢流程／送單成功流程補上 `fetch.poolState()`

## 7. 前端元件

- [x] 7.1 `app/components/lottery/bg/eggs/block/PoolPicker.vue`（3 個獨立槽位、各自 0~9 按鈕，
      複用 `base/Ball.vue`，因 PC蛋蛋開獎可重複，改用 k3-of Picker.vue 的槽位模式而非 toggle 池）
- [x] 7.2 `app/components/lottery/bg/kl10/block/PoolPicker.vue`（1~20 號碼池固定選 4 個，複用
      `base/Ball.vue`）
- [x] 7.3 兩支 Picker 皆含機選/清空按鈕與靜態分層獎金表＋彩金池金額（讀 `XXX_POOL_PRIZE_TIERS`／
      `poolState` API）

## 8. 頁面整合

- [x] 8.1 `egg.vue`／`kl10.vue` 依 `isPoolPlay` 條件切換渲染新 Picker（比照既有
      `isRenxuan ? BoardRenxuan : Board` 分流）
- [x] 8.2 機選/清空、下注數量顯示、Controls.vue、CurrItems.vue 等既有分流邏輯補上 `isPoolPlay` 分支

## 9. 驗證

- [x] 9.1 `npm run build` exit 0
- [x] 9.2 前端手動測試（Playwright 實際登入操作）：兩個頁面都能看到「選號（彩池）」分頁、
      機選／下注、下注後彩池（既有爆池）與彩金池（新池）數字立刻變動（確認 bug 已修）
- [x] 9.3 端到端（curl + session cookie 讀 user-record／pool API）：實際等待兩期開獎，確認
      KL10 選號 `4,6,15,16` 對中開獎 `16,12,11,15,04,01,18,09` → matchCount=3 →
      落在二獎層（20% 池 419,596.8 × 20% ÷ 20 元單注 × 20 元 = 83,919.36），與程式派彩金額
      逐分錢核對一致；EGGS 選號 `0,1,3` 對中開獎 `3,2,3` → matchCount=1 → 三獎固定 2 倍
      （20 元 × 2 = 40），與程式一致。同時確認彩池玩法注單有計入既有爆池抽水／顯示。
- [x] 9.4 池底：兩局皆自然生成池底（無需重骰），`distributablePool` 公式與畫面顯示金額一致
- [ ] 9.5 未實際觸發：頭獎 `minAmount` 保底層（無人命中全部碼）、無人中時整層滾存的下一期
      重算、池底低於門檻重骰——這幾種情境邏輯與 k3-of 完全同源（結算迴圈直接比照複製），
      但這次驗證的實際下注沒有踩中這些分支，建議日後有需要時再針對性測試

## 10. Addendum：既有爆池（Header「總彩池」）補上起始池底

- [x] 10.1 使用者回饋：Header 顯示的「總彩池」（既有爆池）一進遊戲仍是 0
- [x] 10.2 常數：`EGGS_JACKPOT_BASE_MIN/MAX`、`KL10_JACKPOT_BASE_MIN/MAX`（110,000/450,000，
      獨立宣告不共用彩池玩法的常數）
- [x] 10.3 `eggs.ts`／`kl10.ts` 建構子改為一次性 `this.carryJackpot = LOTTERY_BASE.jackpotBase(...)`
      seed（不可比照彩池玩法每期重新加回去——爆池公式沒有 0.55 阻尼係數，會無界成長）
- [x] 10.4 `npm run build` exit 0；Playwright 實測重啟服務後兩頁「總彩池」立即非 0
      （KL10 115,221.00、EGGS 341,646.00），「預估發放」＝總彩池 × 50% 正確
