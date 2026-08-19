# PC蛋蛋（EGGS）彩池機制 —— 實作藍圖

> 狀態：**已實作完成（2026-08-18）。** 本檔保留為設計依據與決策紀錄。
> 分析日期：2026-08-18　範圍：`shared/config/eggs*`、`server/**/eggs.ts`、`app/**/eggs/**`
>
> 需求原文：「PC 蛋蛋增加支援彩池機制，彩池相關設定需要與玩法保持正確關聯」

---

## 實作結果與本計畫的差異（動工時骨架已變動）

本計畫寫於「跨盤口爆池」重構**之前**，以下三點依現況調整，其餘照計畫執行：

| 計畫寫的 | 實際做的 | 原因 |
|---|---|---|
| `EGGS_CD_JACKPOT` / `eggsCdJackpotHit` / `eggsCdJackpotLabel` | `EGGS_JACKPOT_SETTINGS` / `eggsJackpotHit` / `eggsJackpotLabel` | 爆池已改為兩盤共吃，其他三個彩種的 `*_CD_JACKPOT` 都改名為 `*_JACKPOT_SETTINGS`，eggs 直接跟上 |
| `JackpotSettings` 只有 6 個欄位 | 多帶 `boardWeight: { cd: 1 }` | 重構後新增的必填欄位（盤口係數）。eggs 沒有官方盤，這個係數等於不作用 |
| `JackpotRow` 不含 `source` | 每列帶 `source: 'cd'` | 重構後新增的必填欄位，供多盤口分流寫回；eggs 只有一個來源 |

另外兩點確認：

- **§6① 的踩雷點已失效** —— 該節說「k3 / ssc / pk10 的爆池前端沒串接、不要照抄」。
  重構時已把六個看板都串好了，eggs 的 Header 因此**可以**照那套寫法，
  只是 eggs 沒有共用彩池，少了「總獎金／預估頭獎／中獎機率」那一塊。
- **§6② 仍然成立** —— eggs 只有一個池，也因為只有一個盤口，
  不需要其他彩種那套「等所有盤口交件才結算」的編排（見 `k3Shared.ts`），直接在 class 內結算。

**§4 決策 1 的副作用**（豹子既是爆池條件、又是 weight 最高的注項 → 雙重加成）
維持既有慣例（k3 圍骰、ssc 後三豹子皆同），豹子 `weight: 3` 照常給。
要取消雙重加成的話，把 `shared/config/eggscd/plays.js` 裡豹子那項改成 `weight: 0` 即可，**不必改程式**。

---

## 0. 一句話結論

**不是新發明一套彩池，而是把 eggs 接上專案既有的泛用爆池骨架。**
`shared/config/jackpot.ts` 已經是為此設計的通用核心；6hc-cd / ssc-cd / k3-cd / pk10-cd 都已接上，
**eggs 是唯一沒接的彩種** —— 因為當初提案 `openspec/changes/add-pceggs/design.md:21`
明確排除（「不建立官方盤與彩池玩法（來源本身沒有）」）。本檔就是補這一塊。

---

## 1. 既有彩池機制的三層結構

| 層 | 檔案 | 職責 |
|---|---|---|
| 泛用核心 | `shared/config/jackpot.ts` | `JackpotSettings` / `JackpotRow` / `JackpotHitRecord` 型別 + `buildJackpotShares()` 純函式 |
| 彩種判定 | `shared/config/{k3,ssc,pk10}-cd.ts` | 該彩種的 `*_CD_JACKPOT` 設定、`*JackpotHit()` 爆池期判定、`*JackpotLabel()` 開獎文字 |
| 看板設定 | `shared/config/{k3cd,ssccd,pk10cd}/` | `plays.js` 宣告注項 `weight`；`helpers.ts` 的 `*JackpotWeightOf()` 解析 |

`buildJackpotShares(rows, triggered, pool, settings)` 只吃三樣東西，彩種要做的就是把這三樣湊出來：

- `rows` —— 該期注單，含 `eligible`（是否有份）與 `weight`（分配權重）
- `triggered` —— 這期是不是爆池期（布林，由彩種自己判）
- `pool` —— 可發放累積池 = 當期抽水 + 累積滾存

金流是兩條獨立的線：

```
下注  playBets()          → issueJackpotMap[issue] += amount * rakeRatio
開獎  settleIssuePrize()  → pool = issueJackpotMap[issue] + carryJackpot
                          → triggered ? 發 pool * payoutRatio : 全部滾存
                          → carryJackpot = jackpot.remain；issueJackpotMap[issue] = 0
```

參考實作（最完整、可直接對照抄）：`server/services/game/lottery/bg/k3Cd.ts`
- 抽水：約 L597-601
- 分配：約 L386-460（`jackpotRows` 累積 → `buildJackpotShares` → 回寫 `jackpotAmount` → 更新 `carryJackpot` / `lastJackpotHit`）
- 對外狀態：`get.creditJackpot()` 約 L537-551

---

## 2. 「彩池設定與玩法正確關聯」現有做法（需求核心）

關聯靠**三段鏈**串成。eggs 已經有第 2 段，缺 1 與 3。

### 第 1 段：設定檔宣告 weight（group 層預設 + item 層覆寫）

範例 `shared/config/k3cd/c_weitou.js`：

```js
{
  groupName: '圍骰',
  weight: 3,                                                        // 群組層預設
  columns: 4,
  groupList: [
    { playId: '40001-001', name: '圍111', odds: 209.52, weight: 3 }, // 注項層可覆寫
  ],
}
```

### 第 2 段：注單記得住自己屬於哪個玩法 ✅ eggs 已具備

`server/services/game/lottery/bg/eggs.ts` 的 `orders.add.record()` 已存
`playKey` + `tabId`（`select_tab_id`）+ `betCode` + `odds`，
且 `server/services/game/lottery/bg/orders.ts:45-54` 確實持久化這些欄位。

**這是關聯能成立的關鍵前提，不需改動。**

### 第 3 段：結算時用 (playKey, tabId, betCode) 反查權重

`shared/config/k3cd/helpers.ts:146-154` 的解析順序：

```
item.weight → group.weight → 0（不參與分配）
```

⚠️ **最容易寫錯的一點**：「明確給 0」與「沒設定」是兩件不同的事。
- 明確 `weight: 0` = 這個注項**排除**在彩池之外
- 完全沒帶（舊注單、已下架玩法）= 退回 `settings.weightFallback`

因此判斷必須用 `weight == null` 而**不是** falsy 判斷。
此語意在 `shared/config/jackpot.ts:118-124` 也再守一次，兩邊都不能寫鬆。

---

## 3. eggs 目前的「半成品」狀態（減少要動的面積）

| 位置 | 現況 |
|---|---|
| `shared/config/eggscd/helpers.ts` → `ConfigOption` | ✅ **已有** `weight?: number` |
| `shared/config/eggscd/helpers.ts` → `ConfigGroup` | ❌ 缺 `weight`（k3 那份有） |
| `shared/config/eggscd/helpers.ts` | ❌ 缺 `eggsJackpotWeightOf()`；但 `_findTabItem()` 已現成可用 |
| `server/services/game/lottery/bg/eggs.ts` → `UserBetHistory` | ✅ **已有** `jackpotAmount: number`（寫死 0、從未更新） |
| `app/services/api.ts` → `EggsUserBetHistory` | ✅ **已有** `jackpotAmount: number` |
| `app/services/api.ts` → `CreditJackpotState` | ✅ **已是共用形狀**（SSC/K3/PK10 三家共用），eggs 原樣重用，**不必新增型別** |
| `shared/config/eggscd/plays.js` | ❌ 5 玩法 33 注項，完全沒有 `weight` |
| `server/api/lottery/eggs/` | ❌ 只有 current / claim / user-record / opencode-history，缺 `jackpot.get.ts` |

---

## 4. 兩個要拍板的設計決策

其餘皆為照搬，只有這兩項需要人決定。

### 決策 1：爆池條件 → **建議「豹子」**

既有彩種訂條件的標準寫在 `shared/config/k3-cd.ts:336-345`，兩條：
1. 必須是看板上真的押得到的注項（玩家看得到也押得到）
2. 機率要與 6hc-cd 的「特別號開 49」（1/49 ≈ 2.04%）同量級

eggs 候選窮舉（樣本空間 10³ = 1000，全部為精確值）：

| 候選 | 命中數 | 機率 | 看板注項 | 評估 |
|---|---|---|---|---|
| **豹子** | 10 | **1.00%** | ✅ `152121010`（特殊玩法） | **建議** |
| 順子 | 48 | 4.80% | ✅ `152121012` | 偏頻繁，池養不起來 |
| 極大（22–27） | 56 | 5.60% | ✅ `152111014` | 偏頻繁 |
| 極小（0–5） | 56 | 5.60% | ✅ `152111015` | 同上 |
| 極大或極小 | 112 | 11.20% | ✅（兩注項） | 太頻繁 |
| 特碼 0 或 27 | 各 1 | 0.10% | ✅ | 太罕見，池會爆到失控 |

**選豹子的理由（很硬）**：ssc-cd 的爆池條件就是「後三豹子」，
`shared/config/ssc-cd.ts:378-379` 寫的是 `hitRate: 10 / 1000`。
而 PC蛋蛋開獎結構（3 球、每球 0–9、可重複）與 SSC 後三**完全相同**，
樣本空間與機率一模一樣 —— 這不是類比，是同一件事。連 hitRate 常數都對得上。

判定可直接用 `shared/config/eggs.ts` 既有的 `eggsPatternOf(digits) === '豹子'`，不需新邏輯。

### 決策 2：weight 分級 → 沿用 6hc 的理論賠率分級法

分級規則見 `shared/config/6hc-cd.ts:1836-1846`：依理論賠率 `1 / 命中機率` 分三級
`≥20 → 3`、`2.5~20 → 2`、`<2.5 → 1`。套用到 eggs：

| 玩法（tabId） | 注項 | 理論賠率 | weight |
|---|---|---|---|
| 特碼 50004 | 0 / 27 | 1000 | 3 |
| 特碼 50004 | 1,2,25,26 等極端值 | 高 | 3 |
| 特碼 50004 | 13 / 14（各 75/1000） | ≈13.3 | 2 |
| 特殊玩法 50002 | 豹子（10/1000）/ 順子（48/1000） | 100 / 20.8 | 3 |
| 特殊玩法 50002 | 對子（270/1000） | ≈3.7 | 2 |
| 色波 50003 | 紅波（332）/ 藍波・綠波（各 258） | 3.01 / 3.88 | 2 |
| 單雙 50001 | 大單・小雙（各 231）/ 大雙・小單（各 269） | 4.33 / 3.72 | 2 |
| 大小 50000 | 極大 / 極小（各 56/1000） | 17.86 | 2 |
| 大小 50000 | 大 / 小（各 500/1000） | 2.00 | 1 |
| 單雙 50001 | 單 / 雙（各 500/1000） | 2.00 | 1 |

⚠️ **特碼分頁不能只給 group weight，必須逐項標。**
特碼 28 個注項機率差距極大（0 是 1/1000，13 是 75/1000），
這是 eggs 與 k3 最大的差異 —— k3 靠 group 一次帶過就夠，eggs 的特碼不行。

實作時建議寫個小腳本由 `EGGS_SUM_COUNTS` 推 weight 再貼進 `plays.js`，不要手算 28 個。

### ⚠️ 決策 1 的副作用（要一併決定）

豹子同時是「爆池條件」又是「weight 最高的注項」→ 押中豹子者拿賠率派彩 **+** 爆池最大份，雙重加成。
k3（圍骰）與 ssc（後三豹子）也有同樣重疊，屬既定慣例；
但 eggs 豹子理論賠率 100 倍，高於 k3 圍骰全的 36 倍，加成更明顯。

若不希望雙重加成：在 `plays.js` 把豹子的 `weight` **明確設為 0**
（正是第 2 節「明確給 0 = 排除」語意的用途）。**這是設定值，不需改程式。**

---

## 5. 檔案改動清單（依相依序，共 9 個）

### Config 層

**① `shared/config/eggs-cd.ts`** —— 新增（檔尾，`EGGS_PLAY_DEFINITIONS` 附近）

```ts
import { type JackpotSettings } from '#shared/config/jackpot'

export const EGGS_CD_JACKPOT: JackpotSettings = {
  rakeRatio: 0.01,
  payoutRatio: 0.5,
  minPool: 1000,          // 以 rakeRatio 1% 換算 ≈ 需累積 10 萬投注額
  weightFallback: 1,
  hitLabel: '開出豹子（三球同號）',
  hitRate: 10 / 1000
}

export function eggsCdJackpotHit(openCode: Array<string | number>): boolean
export function eggsCdJackpotLabel(openCode: Array<string | number>): string
```

- `eggsCdJackpotHit`：`eggsDigitsOf(openCode)` → null 回 false；否則 `eggsPatternOf(digits) === '豹子'`
- `eggsCdJackpotLabel`：例如 `豹${digits[0]}`（k3 是 `圍${dice.join('')}`）
- ⚠️ 本檔**不可** import `eggscd/helpers`（會循環）。需要設定值一律由呼叫端傳入。

**② `shared/config/eggscd/plays.js`** —— 5 個 group 加 `weight`，特碼 28 項逐項加
- ⚠️ 本檔是 `.js` 且**不得出現任何 import**（Nitro 對 shared 走 Node 原生 ESM，不認 `#shared` 別名，一 import 伺端啟動即炸）。weight 只能是字面值。

**③ `shared/config/eggscd/helpers.ts`**
- `ConfigGroup` 型別加 `weight?: number`
- 新增 `eggsJackpotWeightOf(playKey?, tabId?, betCode?): number`，照抄 `k3cd/helpers.ts:146-154`
  （`_findTabItem()` 已現成，解析順序 item → group → 0，用 `== null` 判斷不可用 falsy）

### Server 層

**④ `server/services/game/lottery/bg/eggs.ts`** —— 四處改動

1. import：`buildJackpotShares` / `JackpotRow` / `JackpotHitRecord`（from `#shared/config/jackpot`）、
   `EGGS_CD_JACKPOT` / `eggsCdJackpotHit` / `eggsCdJackpotLabel`、`eggsJackpotWeightOf`
2. 類別狀態（constructor 內，比照 k3Cd L193-195）：
   ```ts
   issueJackpotMap: Record<string, number>   // issue → 該期抽水累積
   carryJackpot: number                      // 未發放滾存
   lastJackpotHit: JackpotHitRecord | null
   ```
3. `playBets()` 扣款後、`pushBalanceChange` 前加抽水一行（比照 k3Cd L599-601）
4. `settleIssuePrize()`：迴圈內累積 `jackpotRows`，迴圈後跑分配
   ```ts
   jackpotRows.push({
     orderId: String(row.orderId),
     userId: String(row.userId),
     coin,
     eligible: result !== 'lose',                              // 和局也算有份（與 6hc-cd / k3-cd 同語意）
     weight: eggsJackpotWeightOf(playKey, tabId, betCode)
   })
   // 迴圈後
   const jackpotPool = Number((Number(this.issueJackpotMap[safeIssue] ?? 0) + Number(this.carryJackpot ?? 0)).toFixed(2))
   const jackpot = buildJackpotShares(jackpotRows, eggsCdJackpotHit(codes), jackpotPool, EGGS_CD_JACKPOT)
   // share 併進 payoutByUser + 回寫 betHistory[idx].jackpotAmount
   // this.carryJackpot = jackpot.remain；this.issueJackpotMap[safeIssue] = 0
   // jackpot.triggered → 寫 this.lastJackpotHit
   ```
   ⚠️ 爆池 share 必須併進 `payoutByUser`，**在** `payoutByUser.forEach` 寫 `claimableIssues` **之前**，否則玩家領不到。
5. `get.creditJackpot()` 新增，回傳形狀對齊 `CreditJackpotState`（照抄 k3Cd L537-551）

**⑤ `server/api/lottery/eggs/jackpot.get.ts`** —— 新檔
- 照抄 `server/api/lottery/k3-cd/jackpot.get.ts`，把 `LOTTERY['K3-CD'].key` 換成 `LOTTERY.EGGS.key`
- 保留 `EMPTY` 兜底（服務未初始化時不要丟 500）
- eggs 沒有共用池，**不需要**在 `current.get.ts` 加 `pool` 欄位

### 前端層

**⑥ `app/services/api.ts`**
```ts
jackpotEggs: () => $fetch<CreditJackpotState>('/api/lottery/eggs/jackpot'),
```
型別重用 `CreditJackpotState`，**不新增型別**。

**⑦ `app/composables/useEggs.ts`**
- 加 module 級 `jackpot` reactive state + `fetch.jackpot()`
- 掛進既有的 `fetch.startPolling()`（已有 3 秒輪詢與 `issueLatest` 換期偵測，直接搭上去；
  換期時與 `userRecordAll()` / `openCodeHistoryAll()` 一起刷新）
- 從 `useEggs()` return 出去

**⑧ `app/components/lottery/bg/eggs/block/Header.vue`** —— 顯示池額
- ⚠️ **參考 `6hc/cd/block/Header.vue`，不要抄 `k3/block/Header.vue`**（理由見第 6 節第 1 點）
- 滾動數字動畫可參考 k3 Header 的 `_poolAnim`（該部分與池種類無關，可重用）

**⑨ `app/components/lottery/bg/eggs/block/Report.vue` + `block/DialogRule.vue`**
- Report 顯示 `jackpotAmount`（欄位早就在 `EggsUserBetHistory`，只是一直是 0）
- DialogRule 補爆池說明：用 `hitLabel` / `hitRate` / `payoutRatio` / `minPool` 動態渲染，不要寫死文案

---

## 6. 三個踩雷點

**① UI 層在 K3 / SSC / PK10 其實沒做完 —— 不要照抄。**
`jackpotK3Cd`、`jackpotPk10Cd`、`jackpotSscCd` 三支在 `app/services/api.ts` 都有定義，
但**前端沒有任何地方呼叫**（已 grep 確認）。唯一有完整前端串接的是
`jackpot6hcCd`（經 `app/services/lottery6hcCreditService.ts:49`）。
k3 Header 上顯示的是**官方盤共用彩池**（`poolState()`），與信用盤爆池是兩回事，抄了會做錯。

**② eggs 沒有共用池，反而更簡單。**
k3 / ssc / pk10 的註解反覆警告「信用盤爆池與 `*Shared.ts` 共用彩池是兩個池、搶同一個 carry 會互吃」。
eggs 沒有官方盤、沒有 Shared 層，只會有一個池 →
那整組風險不存在，也**不需要** `poolState()`，`current.get.ts` 不用改。

**③ 舊注單的 weight。**
改動前既存注單在 orders 裡有 `playKey` / `tabId`，`eggsJackpotWeightOf()` 反查得到，基本無虞；
只有「已下架注項」才會落到 `weightFallback`。設 `weightFallback: 1` 與其他三彩種一致。

---

## 7. 驗證清單

- [x] `eggsPatternCounts()` 對帳：豹子 10 / 對子 270 / 順子 48（合計 328，非 1000 —— 其餘為半順雜六）
- [x] `eggsJackpotWeightOf()` 三種情境：注項有 weight → 取注項；只有 group → 取 group；明確 `weight: 0` → 回 0（**不可**退 fallback）
      （因為 config 44 項現在都有明確 weight，後兩種情境是暫時改動 plays.js 跑完再還原驗的）
- [x] `buildJackpotShares()` 尾差：多筆 share 加總須等於 `pool * payoutRatio`（最後一筆吃尾差）
- [x] 未觸發期：`payout === 0`、`remain === pool`、`carryJackpot` 正確累加、`issueJackpotMap[issue]` 歸零
- [x] `minPool` 門檻：池低於 1000 且開豹子 → `reason: 'pool-too-low'`、不發放、全額滾存
- [x] 端到端（curl + session cookie）：下注多筆 → 結算 → `jackpotAmount` 寫進 betHistory、
      `claimableIssues` 含爆池金額、**領獎後餘額正確**（78,100 = 派彩 77,600 + 加碼 500）、
      該期從可領清單移除、餘額變動有領獎紀錄、`lastHit` 有值
      ⚠️ 豹子觸發率 1%／期、一期 7 分鐘，等不到自然開出 —— 觸發是用臨時探測路由
      強制以 `7 7 7` 呼叫真實的 `settleIssuePrize()` 產生的，測完路由已刪除
- [x] `/api/lottery/eggs/jackpot` 在服務未初始化時回 `EMPTY` 而非 500
- [x] 觸發後派彩：以臨時探測路由強制用 `7 7 7` 跑真實結算 —— 池 1000 → 發放 500、
      weight 1:3 的兩注加碼 125:375、滾存 500、可領 = 派彩 + 加碼，測完已刪除路由
- [x] `npm run build` exit code 0（Σ 6.26 MB；`eggs/jackpot.get.mjs` 有進 build）
      ⚠️ build 有數則 sourcemap WARN，來自 `nuxt:module-preload-polyfill` 與
      `@tailwindcss/vite`，是既有的、與爆池無關

---

## 8. 落成 openspec change 時的建議切法（未採用）

> 實際做法：直接依第 5 節的檔案清單實作，沒有另開 `openspec/changes/add-eggs-jackpot/`。
> 若之後要補正式提案，以下切法仍可參考。


本檔是 reference（調查結論）。要正式動工建議開 `openspec/changes/add-eggs-jackpot/`：

- `proposal.md` —— Why（eggs 是唯一無彩池的彩種）／What Changes（第 5 節 9 個檔案）／
  Capabilities（Modified: `pceggs-credit`）／Impact
- `design.md` —— 第 4 節兩個決策與其依據（含窮舉數據與 ssc-cd 先例）、第 6 節踩雷點
- `tasks.md` —— 第 5 節照層級拆成可勾選項（Config 3 / Server 2 / 前端 4 / 驗證 1 組）
