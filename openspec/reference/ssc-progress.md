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

## 官方盤與 PK10 官方盤的差異（照做即可）

- **沒有彩池分層玩法**：11 個分頁全是固定賠率，所以 `sscOf.ts` 沒有 `PK10_OF_PRIZE_TIERS` 那一段，
  也不動 `SSC_SHARED.pool.carry`（永遠 0）。彩池只是看板「總獎金」的門面數字。
- 抽水比例兩盤都是 **0.02**（不是 pk10-of 的 0.6 —— 那個高比例是因為彩池要出獎金）。
- 注碼全部是字串（沒有 pk10 前三直選那種 `codes` 陣列），複式由前端
  `sscOgComboCodes()` 展開成一注一碼送單，伺端逐注用 `sscOgHasBetCode()` 驗
  （複式分頁改驗「前綴符合 + 賠率 > 0」）。

## 待辦（依序，剩前端）

1. `app/components/lottery/bg/ssc/**`（仿 pk10 的 14 個元件，Car.vue → 號碼球）
   - 官方盤的選號區要吃 `sscOgComboGroups()`：`digits` 與 `sides` 只會有一邊有值，看 `combo.mode`
   - 送單前用 `sscOgComboCodes()` 展開成一注一碼，注數就是 `.length`（回空陣列＝規則不合或超過 2000 注）
2. `app/pages/lottery/bg/ssc-cd.vue`、`ssc-of.vue`（版面 sed 自 k3/pk10 頁面）
3. `BgAutoPanel.vue` / `useBgAutoActive.ts` 掛上 ssc；`app/assets/style/lhc_ssc.scss`
4. `lottery-hall.vue` 的 `ROUTE_DICT` 與 `GAME_META` 補 SSC

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
