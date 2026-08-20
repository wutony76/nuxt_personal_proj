## Context

參考機制：`shared/config/k3-of.ts`（`K3OfPrizeTier`／`K3_OF_PRIZE_TIERS`／`k3OfMatchCount`）、
`server/services/game/lottery/bg/k3Of.ts`（`settleIssuePrize` 的分層派彩迴圈，473-541 行）、
`server/services/game/lottery/bg/k3Shared.ts`（`K3_POOL_BASE_MIN/MAX`／`k3EnsurePoolBase`／
`K3_POOL_FLOOR`）、`app/components/lottery/bg/k3/of/block/Picker.vue`（選號 UI 與靜態分層獎金表）。

已查證 K3-OF 的分層派彩機制本身不是從 `bglottery` 來源抄的（`bglottery/src` 全專案搜尋
`彩池|奖池|jackpot|selectPool|prizePool` 零命中，K3 自己的來源「三軍」只是固定賠率選號看板，
沒有 `ratio`/`minAmount`/依命中數分層的欄位）。本次是比照 K3-OF 的**設計模式**新增機制，
不受「不可自行猜測玩法規則」限制（該限制是針對從 `bglottery` 移植既有玩法時的來源查證要求）。

## Goals / Non-Goals

**Goals:**
- EGGS／KL10 各新增一種「彩池玩法」分頁：依命中顆數分層、依下注比例分錢、頭獎有保底金額。
- 新彩金池與現有爆池（`shared/config/jackpot.ts`）各自獨立，兩者共用同一批注單資料，
  互不影響對方的抽水／滾存/觸發邏輯。
- 修正下注後前端不即時刷新彩池金額的 bug（EGGS／KL10 都要修）。

**Non-Goals:**
- 不改動 EGGS／KL10 既有玩法（固定賠率）的判定與結算邏輯。
- 不比照 K3-OF 把彩池玩法塞進 `plays.js` 看板網格（K3-OF 本身也沒有）。
- 不新增官方盤或跨盤口共用池（EGGS／KL10 都只有信用盤）。

## Decisions

### 1. 池底常數獨立宣告，數值比照 K3 但不共用

```ts
// eggs-cd.ts
export const EGGS_POOL_BASE_MIN = 110_000
export const EGGS_POOL_BASE_MAX = 450_000
// kl10-cd.ts
export const KL10_POOL_BASE_MIN = 110_000
export const KL10_POOL_BASE_MAX = 450_000
```
使用者拍板：範圍比照 K3（`K3_POOL_BASE_MIN/MAX`），但兩款遊戲各自宣告獨立常數，
不 import／複用 K3 的常數，避免未來調整其中一款遊戲的池底範圍時互相牽動。

重骰門檻比照 `K3_POOL_FLOOR`（`ceil(頭獎 minAmount ÷ 頭獎 ratio)`），用各自的頭獎設定算，
不寫死複製 K3 的數字。

### 2. 抽水：新彩金池由「全部注項」抽水，比照 K3-CD 的兩條水並行

K3-CD 對每筆下注同時抽兩條水：`K3_RAKE_RATIO`(2%) 進彩金池（`K3_SHARED.pool`）、
`K3_JACKPOT_SETTINGS.rakeRatio`(1%) 進爆池（`K3_JACKPOT`）——兩條水獨立存在，互不影響。
EGGS／KL10 比照此結構：

```ts
export const EGGS_POOL_RAKE_RATIO = 0.02   // 沿用 K3_RAKE_RATIO（信用盤）的比例，非 K3_OF_RAKE_RATIO(60%) 那種官方盤抽成
export const KL10_POOL_RAKE_RATIO = 0.02
```
既有的 `EGGS_JACKPOT_SETTINGS.rakeRatio`/`KL10_JACKPOT_SETTINGS.rakeRatio`（1%）維持不變，
兩條水同時從同一筆下注金額扣，互不影響彼此的池與滾存。

`distributablePool()` 複用既有的泛用工具（`server/services/game/lottery/bg/base.ts` 的
`LOTTERY_BASE.jackpotBase()`/`jackpotCalc()`，本來就不是 K3 專屬，K3 只是第一個用它的彩種）：
```
distributablePool(issue) = LOTTERY_BASE.jackpotCalc(poolBase, issuePoolMap[issue] ?? 0, carryPool)
                          = (poolBase + issuePool × 0.8 + carryPool) × 0.55
```
0.8／0.55 為 `jackpotCalc` 的既有預設參數，直接沿用，不另外調整。

### 3. 彩池玩法的選號結構：各自依開獎形狀設計，不是硬套 K3 的「3 選 6」

**EGGS**：選 3 個數字（0~9，可重複）——跟 PC蛋蛋開獎位數同構（開獎就是 3 顆 0~9 可重複的球），
是 K3-OF 選骰子玩法最直接的類比。用 node 窮舉全部 1,000 種開獎結果驗證：

| 選號形狀 | P(中3) | P(中2) | P(中1) | P(中0) |
|---|---|---|---|---|
| 全異數字（如 1,2,3） | 0.6% | 14.4% | 50.7% | 34.3% |
| 一對（如 1,1,2） | 0.3% | 7.6% | 40.9% | 51.2% |
| 豹子形狀（如 1,1,1） | 0.1% | 2.7% | 24.3% | 72.9% |
| 全體 220 種選法平均 | 0.45% | 11.09% | 45.49% | 42.97% |

⚠️ 命中率依選型不同（全異／一對／豹子）——這跟 K3-OF 選骰子本來就有的「選型影響機率」現象
一樣（K3 全異拾骰 P(中3)=2.78%、豹子拾骰僅 0.46%），是既有設計已知的簡化，不是新問題，
沿用同一套單一分層表（不依選型調整賠率）。

**KL10**：選 4 個號碼（1~20，不重複）。用超幾何分布 `C(N,k)×C(20-N,8-k)/C(20,8)` 驗證候選
選號數 N=4~10 後選定 N=4：

| N | P(全中) | P(中N-1) | P(中N-2) |
|---|---|---|---|
| 4 | 1.445% | 13.87% | 38.14% |
| 5 | 0.361% | 5.42% | 23.84% |
| 6 | 0.072% | 1.73% | 11.92% |

選 N=4：全中機率（1.445%）與 K3-OF 全體平均全中機率（1.79%）同一量級，且因為開獎本身
8 個號碼互不重複，**任何 4 碼組合的命中分布完全相同**（不像 EGGS／K3 有選型機率落差）—
結構上比 K3-OF／EGGS 的等價設計更乾淨。

### 4. 分層派彩表：比照 K3-OF 的 70/20/固定倍數比例結構

```ts
type PoolPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

export const EGGS_POOL_PRIZE_TIERS: PoolPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

export const KL10_POOL_PRIZE_TIERS: PoolPrizeTier[] = [
  { match: 4, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 3, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 2, type: 'fixed', amount: 2, name: '三獎' }
]
```
⚠️ 這組數字直接比照 K3-OF 既有設計比例（非機率反推），是使用者拍板「比照 K3」下的
合理預設值；日後若要調整獎金結構，改常數即可，不影響其他層。

### 5. 彩池玩法不進 `plays.js` 看板網格，比照 K3-OF 的 `xuanhao`

- Sentinel `playKey`：兩款遊戲都用 `'xuanhao'`（語意「選號」，各自設定檔獨立，不會互相干擾）。
- 硬編碼額度常數（比照 `K3_OF_QUOTA`）：
  ```ts
  export const EGGS_POOL_QUOTA = { item: { min: 2, max: 10000 }, issue: { max: 500000 } }
  export const KL10_POOL_QUOTA = { item: { min: 2, max: 10000 }, issue: { max: 500000 } }
  ```
- 因查不到看板 weight，給 fallback 常數（比照 `K3_OF_POOL_PLAY_WEIGHT`）：
  ```ts
  export const EGGS_POOL_PLAY_WEIGHT = 3
  export const KL10_POOL_PLAY_WEIGHT = 3
  ```
  讓彩池玩法注單也能參與現有爆池分配（豹子／奇偶一邊倒），跟一般固定賠率注單一視同仁。

### 6. 伺服端結算：與既有固定賠率迴圈平行，兩段都各自 push 進同一個 `jackpotRows`

`settleIssuePrize()` 內新增一段（不動原本迴圈）：
```ts
const poolOrders = issueOrders.filter((row) => row.playKey === POOL_PLAY_KEY)
const totalPool = this.distributablePool(safeIssue)
const rows = poolOrders.map((row) => ({ ...row, matchCount: xxxPoolMatchCount(row.betCode, codes) }))
let carryNext = 0
XXX_POOL_PRIZE_TIERS.forEach((tier) => {
  const winners = rows.filter((row) => row.matchCount === tier.match)
  if (tier.type === 'pool') {
    if (winners.length === 0) { carryNext += totalPool * tier.ratio; return }
    const prizePerUnit = Math.max(totalPool * tier.ratio / totalWinnerBets, tier.minAmount ?? 0)
    winners.forEach((row) => { row.payout = prizePerUnit * row.coin })
  } else {
    winners.forEach((row) => { row.payout = tier.amount * row.coin })
  }
})
this.carryPool = carryNext
this.issuePoolMap[safeIssue] = 0
```
兩段（固定賠率／彩池玩法）的注單都各自 push 一筆 `JackpotRow` 進同一個 `jackpotRows` 陣列，
讓彩池玩法的注單也能吃到現有的爆池分配（`weight` 用上方的 fallback 常數）。

### 7. 前端：獨立送單路徑，不經過 `select.pool`／`toggleItem`

比照 `useK3.ts` 的 `ofPicks`/`isOfPool`/`betsOf`：`poolPicks`（選號陣列）、`isPoolPlay` 計算屬性、
`betsPool()` 送單方法（送出 `codes` 陣列而非 `label`，比照 K3-OF 的 `{codes, amount}`）；
`playList` 注入合成分頁項目（`{ key: 'xuanhao', name: '選號（彩池）', isPool: true }`），
新元件 `PoolPicker.vue`（比照 `k3/of/block/Picker.vue`：N 個選號格子 + 機選/清空 +
靜態分層獎金表），複用 `base/Ball.vue` 渲染數字/號碼格。

同時修正下注後彩池不即時刷新的 bug：`fetch.submit()` 成功分支補呼叫
`fetch.creditJackpot()` 與新增的 `fetch.poolState()`。

## Risks / Trade-offs

- **[Risk]** 分層派彩比例（70/20/固定 2 倍）與頭獎保底金額（20,000）為比照 K3-OF 沿用，
  非依 EGGS/KL10 自身機率重新反推的精算值。
  → **Mitigation**：全部收斂成具名常數（`XXX_POOL_PRIZE_TIERS`），改一處即全站生效；
    對帳腳本會驗證各層 payout 計算正確，但賠率結構本身的「公平性」比照 K3-OF 既有慣例，
    非本次重新設計範圍。
- **[Risk]** EGGS 彩池玩法命中率依選型不同（全異/一對/豹子），與 K3-OF 同樣的已知簡化，
  可能被熟悉機率的玩家利用（優先選全異數字）。
  → **Mitigation**：與 K3-OF 現況一致，非本次新增風險；如需修正需同時調整 K3-OF，超出本次範圍。
- **[Risk]** 彩池玩法注單同時參與現有爆池分配，可能改變爆池的實際分配比例（多了一批新注單）。
  → **Mitigation**：`weight` 用明確的 fallback 常數（非 0），行為與新增一般注項相同，
    現有爆池機制（`buildJackpotShares`）本就設計成可容納任意來源的注單，不需改動。
- **[Risk]** 新彩金池與爆池同時從同一筆下注抽水（2% + 1% = 3%），玩家總抽水比例提高。
  → **Mitigation**：與 K3-CD 現況一致（K3-CD 也是 2%+1%=3%），非本次新增風險。

## Migration Plan

全新玩法分頁，無既有資料需要遷移。步驟：
1. 依 `tasks.md` 由 config → server → API → 前端依序實作，每層各自驗證
   （esbuild + node 對帳、curl、`npm run dev`）
2. 全部完成後跑一次端到端：登入 → 兩款遊戲的彩池玩法各下注 → 等開獎 → 對帳分層派彩、
   滾存、既有爆池分配是否正確納入新注單
3. 中止時可直接刪除新增檔案，並回退 `eggs-cd.ts`／`kl10-cd.ts`／`eggs.ts`／`kl10.ts`／
   `useEggs.ts`／`useKl10.ts`／`egg.vue`／`kl10.vue`／`api.ts` 的追加段落（皆為追加式修改）

## Open Questions

（無 —— 彩池玩法的選號結構、分層派彩比例、池底範圍已於提案階段由使用者拍板，見上表）
