# 時時彩（SSC）實作進度交接

> 用途：開新對話時貼「接續時時彩，先讀 openspec/reference/ssc-progress.md」即可從這裡往下做。

## 需求

- `server/services/game/lottery/bg/` 新增 `sscCd.ts`（信用）、`sscOf.ts`（官方）
- `app/pages/lottery/bg/` 新增 `ssc-cd.vue`、`ssc-of.vue`，佈局參照 k3
- 玩法設定來源：**pcv2_0223**（`app/config/bg/conf_sc_cd.js` / `conf_sc_og.js`）
  - bglottery（`/Users/tony.wu/SelfCode/Svn/bglottery`）只有選號區 layout，**沒有注項名稱與賠率**
    （名稱是 API 給的），所以名稱一律以 pcv2 為準
- 官方盤範圍：**只做核心幾組**，未做的已列在 `openspec/reference/ssc-of-todo.md`（94 個 playType）

## 已完成

### 一、設定與判定層（皆通過 tsc 與實測）

| 檔案 | 內容 |
|---|---|
| `shared/config/ssc.ts` | 機率核心。5 球 × 0~9 = 100,000 種全窮舉，牌型用 `_memo` 快取，總和用五重摺積 |
| `shared/config/ssc-cd.ts` | 信用盤判定與賠率。注碼收斂成單一 descriptor（9 種 kind） |
| `shared/config/ssccd/plays.js` | 由 pcv2 `conf_sc_cd.js` 轉出，7 分頁 **152 注項**，與 pcv2 逐項對帳一致 |
| `shared/config/ssccd/helpers.ts` | 設定讀取層（仿 pk10cd/helpers.ts） |
| `shared/config/sscog.ts` | 官方盤判定、賠率、複式展開（19 項測試通過） |
| `shared/config/sscog/plays.js` | 由 pcv2 `conf_sc_og.js` 轉出核心 **11 個 playType**（5 玩法 / 11 分頁 / 220 個選項） |
| `shared/config/sscog/helpers.ts` | 官方盤設定讀取層 + 複式展開 `sscOgComboCodes()`（仿 pk10og/helpers.ts） |
| `openspec/reference/ssc-of-todo.md` | 官方盤未實作玩法清單 |

### 二、伺服層（dev server 實測通過）

| 檔案 | 內容 |
|---|---|
| `server/services/game/lottery/bg/sscShared.ts` | 共用期表與彩池（仿 pk10Shared.ts）；CD/OF 讀到同一份開獎號 |
| `server/services/game/lottery/bg/sscCd.ts` | 信用盤 class（仿 pk10Cd.ts）；`user.sscRecord` |
| `server/services/game/lottery/bg/sscOf.ts` | 官方盤 class（仿 pk10Of.ts，但**沒有彩池分層那條路**）；`user.sscOfRecord` |
| `app/config/constants.js` | 加 `SSC-CD`(400100) / `SSC-OF`(400101) |
| `server/services/storage.ts` | `gamesInit()` 註冊 `SscCdClass` / `SscOfClass` |
| `server/api/lottery/ssc-cd/**`、`ssc-of/**` | 各 4 支路由（current／claim／user-record／opencode-history） |

### 三、前端 API 層與狀態

| 檔案 | 內容 |
|---|---|
| `app/services/api.ts` | `SscPool` / `SscCurrent` / `SscUserRecordResponse` / `SscUserBetHistory` 型別 + 8 支 API，`currentInfo()` 也補上兩個 case |
| `app/composables/useSsc.ts` | CD/OF 共用一支（仿 `usePk10.ts`）。官方盤複式的三種選號形狀都收在 `og.picks`，展開走 `sscOgComboCodes()` |

`useSsc` 與 `usePk10` 的差別：沒有 `ogIsPool` / `ofPrizeTiers`（時時彩官方盤沒有彩池玩法），
多了 `ogRawComboCount` / `ogComboOverflow` —— 因為 `sscOgComboCodes()` 超過上限也是回空陣列，
畫面得靠這兩個才分得出「還沒選滿」與「選太多」。

`og.picks` 依 `combo.mode` 有三種形狀：
`direct` 每個位置選號碼／`sides` 每個位置選面／`group` 只用 `picks[0]` 那一組取 k 個。

### 修過的坑

- **`ssccd/plays.js` 的 1-5球 分頁 playId 不唯一** —— pcv2 是「每個球位一個 id」（10 個號碼共用），
  照抄過來會讓前端的 `toggleItem` / `randomSelect`（以 playId 為 key）把同球位的 10 個號碼當成同一項。
  已改成後面再接號碼（`10110-101101010-0-7`），152 個注項的 playId 與 name 現在都逐項唯一。
  伺端不受影響（`sscHasBetCode` 本來就 playId 或 name 都收）。

### 伺服層實測涵蓋（2026-08-18）

18 個分頁（信用盤 7 + 官方盤 11）**各下過一注**，走完「下注 → 開獎 → 結算 → 派彩」，
伺端結算結果與 `sscIsHit` / `sscOgIsHit` 逐注對照一致；其中 5 注實際中獎，驗到派彩 = 注額 × 鎖定賠率。
拒單案例也擋到：非遞增組六注碼、跨分頁注碼、超過五星單注上限(100)、不存在的注項。

### 驗證數據（可重跑對帳用）

信用盤 7 分頁：`10110 1-5球(50) / 10123 兩面(24) / 10124 前中後三(15) / 10125 全5中1(10) / 10126 龍虎鬥(30) / 10127 鬥牛(15) / 10128 梭哈(8)` = 152

官方盤 5 玩法 / 11 分頁（tabId 沿用 pcv2 的 playTypeId）：
`dingwei 101101010 定位膽` ／ `erxing 101111110 後二直選、101111310 後二組選` ／
`housan 101141010 後三直選、101141110 後三組三、101141111 後三組六` ／
`wuxing 101161010 五星直選` ／ `daxiao 101181010 後二、101181011 後三、101181012 前二、101181013 前三`

官方盤賠率快照（rtp 0.96）：定位膽 9.6／後二直選 96／後二組選 48／後三直選 960／
組三・組六 160／五星直選 96000／大小單雙 後二・前二 3.84、後三・前三 7.68

機率窮舉結果（改動判定後要能對回這些數字）：
- 三球牌型：豹子 10、順子 48、對子 270、半順 336、雜六 336（合計 1000）
- 總和 0~45 合計 100,000，大(≥23)/小 恰好 50000/50000
- 梭哈：五條 10、四條 450、葫蘆 900、順子 720、三條 7200、兩對 10800、一對 50400、散號 29520
- 鬥牛：沒牛 35649、牛牛 6456、牛1~9 各 6375/6505（合計 100,000）

## 三個已記錄的規則選擇（改動前先確認）

1. **順子不含環狀** —— 890、901 不算順子（歸半順／雜六）
2. **牛牛視為 10 點**；牛大 = 牛點 ≥ 6（含牛牛）、牛小 = 1~5；**沒牛不屬於任何一面**
3. **龍虎的「和」是獨立注項**（不是退本金），判定只有 win／lose

另外：時時彩號碼**可重複**，位置型複式**不濾**重複組合（與 pk10 的名次排列不同）。
五星直選全選會展開成 100,000 注，`SSC_OG_MAX_COMBO = 2000` 會直接回空拒絕（伺端也擋一次）。

## 彩池機制（2026-08-18 新增：SSC 官方盤分層 + 三個彩種的跨盤口爆池）

專案裡有**兩套彼此獨立的池**，改動前先確認在動哪一套：

| | 共用彩池 | 爆池 |
|---|---|---|
| 狀態放哪 | `*Shared.ts` 的 `SHARED.pool` | `*Shared.ts` 的 `*_JACKPOT` |
| 誰在吃 | **官方盤**的彩池分頁（依命中數分層） | **兩個盤口一起**，開出爆池條件那期一次發放 |
| 抽水 | CD 2%、OF 60% | 兩盤各另外再抽 1%（`*_JACKPOT_SETTINGS.rakeRatio`） |
| 滾存 | `SHARED.pool.carry` | `*_JACKPOT.carry` |
| API | `/{game}/current` 的 `pool` | `/{game}-cd/jackpot`＝`/{game}-of/jackpot` |

⚠️ 兩套帳一定要分開 —— 共用同一個 `carry` 的話，兩條結算路會互相吃掉對方的滾存。

### 一、SSC 官方盤：後三直選吃彩池分層

- `shared/config/ssc-of.ts`：`SSC_OF_PRIZE_TIERS`（3 中頭獎池 70%＋保底 20000／2 中二獎池 20%／1 中三獎固定 2 倍）、
  `sscOfPicksOf()`、`sscOfMatchCount()`、`sscOfMatchCounts()` 窮舉
- `sscog/plays.js`：後三直選的 `combo.pool = true`，其餘 10 個分頁明確標 `pool: false`
- `sscog/helpers.ts`：`sscOgIsPoolTab()`；`sscOgTabOddsOf()` 對彩池分頁一律回 0
- `sscOf.ts`：兩條結算路（賠率／分層），抽水比例 0.02 → **0.6**（比照 pk10-of）
- 命中分布（窮舉 1000 種後三）：3 中 1／2 中 27／1 中 243／0 中 729

**選後三直選而不是五星直選的理由**：後三 1/1000 的命中分布（0.10 / 2.70 / 24.30%）
幾乎等同 pk10 前三直選（0.14 / 2.92 / 23.75%），可直接沿用現成三層比例；
五星直選 1/100,000 要分到「命中 2 位」才有中獎感，得重新設計四層。

**與 pk10-of 的關鍵差異**：彩池分頁的注碼**仍然是字串**（`後三直選123`）而不是 `codes` 陣列 ——
時時彩號碼可重複、沒有「同一台車佔兩個名次」要擋，所以前端複式展開（`sscOgComboCodes`）
與伺端驗證（`sscOgHasBetCode`）完全不必為彩池分頁開特例，只有派彩那一段分流。

### 二、爆池（信用盤與官方盤**共吃一池**，三個彩種都有）

- `shared/config/jackpot.ts`：泛用分配核心 `buildJackpotShares(rows, triggered, pool, settings)`
  - `JackpotRow.source`（'cd' / 'of'）原樣帶回 `JackpotShare`，讓各 class 只挑自己那半寫回自己的 record
  - `JackpotSettings.boardWeight`：盤口係數，預設 `{ cd: 1, of: 1 }`
  - ⚠️ 6hc-cd 沿用它自己那一份（`CREDIT_JACKPOT` / `buildCreditJackpotShares`），
    因為它多了 kind/tier 的權重解析，硬合併只會兩邊都變複雜
- 狀態與編排在各彩種的 `*Shared.ts`（`SSC_JACKPOT` / `K3_JACKPOT` / `PK10_JACKPOT`）：

| API | 用途 |
|---|---|
| `*RegisterJackpotBoard(board)` | class 在 constructor 註冊，決定「要等幾份交件」 |
| `*AddIssueJackpot(issue, amount)` | 兩個盤口下注時各抽 1% 進同一池 |
| `*SubmitJackpotRows(issue, board, rows)` | 該盤口在自己的結算流程裡交件（自己判定自己的注單） |
| `*SettleJackpotIfReady(issue, triggered, label)` | **所有註冊盤口都交件後**才計算；重複呼叫回同一份結果 |
| `*JackpotResultOf(issue)` / `*JackpotState(issue)` | 取結果 / 取看板狀態 |

**為什麼是這個編排**：兩個 class 的 `circle()` 是同一個 tick 依序跑的（`server/plugins/init.ts`），
各自都會對同一期呼叫 `settleIssuePrize`。用「等所有盤口交件」而不是「誰先跑誰算」，
就不必依賴 `Storage.gamesInit` 的註冊順序；`settledMap` 保證一期只分配一次。
分配結果的寫回則靠 `share.source` 分流 —— 共用層不必知道 `k3Record` / `k3OfRecord` 兩種形狀。

- 觸發條件都**綁在看板上真的存在的注項**，機率對齊 6hc-cd 的 1/49（≒2.04%）：

| 彩種 | 爆池條件 | 機率 | 對應注項 |
|---|---|---|---|
| SSC | 後三開出豹子 | 10/1000 = 1.00% | 前中後三分頁的「後三豹子」 |
| K3 | 開出圍骰 | 6/216 ≒ 2.78% | 圍骰／全骰分頁 |
| PK10 | 冠亞和開出 19 | 2/90 ≒ 2.22% | 冠亞和分頁的「和19」 |

- 分配：`payoutRatio` 50%、`minPool` 1000（未達不發）、依「注金 × 權重 × 盤口係數」比例分配，尾差由最後一筆吸收
- **權重來源就是看板設定**：CD 走 `*JackpotWeightOf`、OF 走 `*OgJackpotWeightOf`
  （注項 `weight` → 群組 `weight` → 0 不參與）。這六支在改動前全是**寫好但沒人用**的死碼
  - ⚠️ 例外：K3-OF 的選號（`xuanhao`）不在 `k3og/plays.ts` 裡（前端自己一條送單路），
    權重改讀 `K3_OF_POOL_PLAY_WEIGHT`（= 3，見 `shared/config/k3-of.ts`）
- 有份條件：該期「非未中」的注單。賠率玩法 `status !== 'lose'`（和局也有份）、
  彩池玩法 `payout > 0`（沒有和局）
- API：`/{game}-cd/jackpot` 與 `/{game}-of/jackpot` 回**同一份**
- 前端：三個 composable 的 `creditJackpot` + 六個看板的 Header 爆池區塊

### 三、PC蛋蛋（EGGS）的爆池

同一套骨架，但**只有一個盤口、也只有一個池**（沒有官方盤、沒有共用彩池），
所以不需要「等所有盤口交件」的編排，直接在 `eggs.ts` class 內結算。

- `shared/config/eggs-cd.ts`：`EGGS_JACKPOT_SETTINGS` + `eggsJackpotHit()`（豹子 10/1000 = 1%）
- `shared/config/eggscd/plays.js`：5 個群組 + **44 個注項全部標 weight**
  （特碼 28 項機率從 1/1000 到 75/1000 差 75 倍，group 一次帶過會失準，必須逐項標）
- `shared/config/eggscd/helpers.ts`：`ConfigGroup.weight` + `eggsJackpotWeightOf()`
- `server/api/lottery/eggs/jackpot.get.ts`、`useEggs` 的 `creditJackpot`、Header／Report／DialogRule

⚠️ 豹子既是爆池條件、又是 weight 最高的注項（雙重加成），與 k3 圍骰／ssc 後三豹子同慣例。
   要取消的話把 plays.js 裡豹子那項改成 `weight: 0` 即可（設定值，不必改程式）。
   詳細決策依據見 `openspec/reference/eggs-jackpot-plan.md`。

## 已知待辦

1. 官方盤還有 **94 個 playType** 未實作，清單見 `openspec/reference/ssc-of-todo.md`
   （單式 `input`、和值／跨度／包胆 `noFastSelect` 那幾類）
2. （已完成）PC蛋蛋的爆池 —— 見上面「三、PC蛋蛋（EGGS）的爆池」

> 先前記的「大廳 SSC-OF 卡片標『獎池分層』與實作不符」已隨後三直選改吃彩池而解決。

## 回歸測試（改動後重跑這幾支）

| 測項 | 內容 | 期望 |
|---|---|---|
| `tsc --build --force` ＋ `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | 型別（後者才會檢查 `.vue`） | 無輸出 |
| sscog helpers 單元測試 | 判定／賠率／複式展開，含 100,000 種開獎窮舉對帳 | 73 passed |
| config 注項全掃 | 152 個信用注項 + 220 個官方選項都判定得出來、賠率 > 0、屬於自己的分頁 | 372 passed |
| `_widenPicks` 全掃 | 10 個複式分頁 × 7 種目標注數，不得超過 `SSC_OG_MAX_COMBO` | 280 passed |
| 下注 E2E | 7 個信用分頁 + 11 個官方分頁各送一單 | 18 passed |
| 結算對帳 | 用 `sscIsHit`／`sscOgIsHit` 重算，與伺端 `winStatus`／`winAmount`／可領金額比對 | 逐注一致 |
| 彩池分層 config | `sscOfMatchCount` / 分層 / 旗標，含 100,000 種開獎窮舉 | 31 passed |
| 爆池核心 | `buildJackpotShares` 分配、門檻、尾差、`source` 帶回、盤口係數 + 三個彩種觸發條件窮舉 | 38 passed |
| 爆池編排 | 兩盤交件 → 只結算一次 → 各取自己那半（臨時 dev 路由驗，測完刪除） | 逐項一致 |
| 彩池分層結算 | 後三直選下 200 注，重算每注命中層與每單位派彩、驗滾存 | 269 passed |
| 爆池帳務 | 六個盤口下注 → 等結算 → 驗兩盤抽水都進同一池、整筆滾進 carry、不動共用彩池 | 15 passed |
| EGGS 爆池 | 觸發窮舉、44 個注項權重與理論賠率分級對帳、分配／門檻／weight 0 語意 | 66 passed |
| EGGS 端對端 | 五個分頁下注 → 抽水 → 等結算 → 滾存；另強制以豹子跑一次派彩路徑 | 9 passed |

## 重要慣例（照做即可）

- 賠率一律「公平賠率 × rtp」推導，config 的 `odds` 只是快照，執行期以 helpers 為準
- 錯誤文案放 `message`，**不要放 `statusMessage`**（h3 會把中文消毒掉）
- `shared/config/**/plays.js` 一律用 `.js` 且不 import 任何東西（Nitro 不認 `#shared` 別名）
- 表格用 `table-layout: fixed` 時，欄寬要設在 `<th>` 上（設在 `td` 會被忽略）
- **`tsc` 不檢查 `.vue`**，要驗 SFC 語法請用 esbuild 掃 `<script setup>` 或 `vue-tsc`
- 測試 helpers/config：`node_modules/.bin/esbuild <test>.mjs --bundle --platform=node --format=esm
  --alias:#shared=./shared` 後用 node 跑（專案沒有 vitest）
- 伺服層實測：`npm run dev` 後打 `/api/login` → `/api/lottery/bet`；
  **只有「開盤中」（每期第 30 ~ 340 秒）受理投注**，一期 7 分鐘，等開獎約 5 分鐘
