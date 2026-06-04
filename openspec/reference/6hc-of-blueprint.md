# 6hc-of 玩法實作藍圖

> 本文件整理六合彩官方版（`6hc-of`）的完整架構、流程與元件，作為後續玩法製作的標準參考依據。

---

## 1. 整體架構圖

```
pages/lottery/bg/6hc-of.vue          ← 頁面入口
  └─ use6hcOfficial.ts               ← 狀態中心（composable）
       ├─ lottery6hcOfficialService   ← 前端服務層（HTTP 封裝）
       │    └─ services/api.ts        ← 型別 + fetch 封裝
       └─ useLhcDb.ts                ← Dexie 本地快取
            └─ IndexedDB: lhc_official_orders

server/api/lottery/6hc-of/           ← API 路由層
  ├─ current.get.ts
  ├─ jackpot.get.ts
  ├─ road.get.ts
  ├─ opencode-history.get.ts
  ├─ user-record.get.ts
  └─ claim.post.ts

server/services/lottery6hcOf.ts      ← 後端服務（遊戲邏輯）
  └─ Storage.games['LHC-OF']        ← 記憶體狀態（singleton）
       └─ OrdersClass               ← 訂單系統
```

---

## 2. 路由與頁面

| 路由 | 檔案 | 說明 |
|------|------|------|
| `/lottery/bg/6hc-of` | `app/pages/lottery/bg/6hc-of.vue` | 唯一主頁面，需登入 |

### 2.1 頁面進入流程

```
onMounted
  → useAuth().init()
  → 未登入 → router.replace('/login')
  → use6hc.init.startServerTimeSync()      // 每秒 tick + 每3秒對時
  → mxFetch.initPageData(userId)
      ├─ fetch.orderDetailFromCache(userId) // 先從 Dexie 讀取（秒開）
      ├─ fetch.refreshCurrentInfo()         // 取得當期狀態 + 排程下次拉取
      ├─ fetch.roadPlays()                  // 路珠統計
      └─ fetch.walletState()                // 餘額 + 投注摘要
  → state.entered = true
```

### 2.2 頁面離開流程

```
onBeforeRouteLeave
  → state.leaving = true → 380ms 動畫後 next()

onBeforeUnmount
  → use6hc.init.stopServerTimeSync()
  → mxFetch.stopCurrentInfoPolling()
  → mxFetch.stopOrderDetailSync()
```

---

## 3. 版塊結構（Template）

```
.lottery-6hc-of
  ├─ .bg-fx                    ← 8 個浮動光球背景動畫（orb-rise）
  ├─ LotteryBgBaseTop          ← 頂部導覽列（共用元件）
  │    emit: open-user-dialog / open-opencode-dialog / open-rule-dialog
  ├─ .main
  │   ├─ Header                ← 期號、狀態、倒數、開獎球
  │   ├─ .info-warp
  │   │   ├─ .info-side        ← 使用者摘要（點擊開 user dialog）
  │   │   └─ .info-main
  │   │       └─ Road          ← 1-49 路珠統計
  │   ├─ .play-warp
  │   │   ├─ BarTabs           ← 玩法切換 Tab
  │   │   └─ <currentPlay>     ← 動態元件（Single/Duplex/Dantuo/Number）
  │   ├─ .record-warp
  │   │   ├─ IssueBlock        ← 當期注單紀錄
  │   │   └─ AnalyzeBlock      ← 下注分析
  │   └─ .footer-warp
  │       ├─ Auto              ← 自動投注
  │       └─ Chat              ← 聊天
  ├─ Transition(float-btn)     ← 開獎浮動按鈕（OPENING/OPENED 時顯示）
  ├─ DialogUser                ← 使用者明細 dialog
  ├─ DialogOpenCode            ← 開獎歷史 dialog
  └─ DialogRule                ← 遊戲規則 dialog
```

---

## 4. 玩法（Play）系統

### 4.1 玩法清單（GAME_6HC_OF）

| Key | 名稱 | 限制 |
|-----|------|------|
| `SINGLE` | 單式 | 恰好選 6 顆 |
| `DUPLEX` | 複式 | 選 6–49 顆（自由組合） |
| `DANTUO` | 膽拖 | 膽碼 1–5 顆 + 拖碼 |
| `NUMBER` | 號碼 | 展示用 |

### 4.2 玩法切換邏輯

```ts
click.switch(status)
  → state.status = status
  → handle.newGame(status)
      → state.playList = init.playList(status)  // 重建選號清單
      → state.groupList = []                    // 清空已選組
```

### 4.3 號碼選號清單（PLAYLIST）

- 來自 `app/config/bg/6hc-of.js`
- 50 個號碼物件（id 1–50，id=50 為特別號）
- 每個號碼攜帶：`{ id, num, label, selected, countIssue, countShow, odds, colorY }`
- 顏色分波（`LHC_COLORS`）：紅波 / 藍波 / 綠波

---

## 5. 狀態中心（`use6hcOfficial.ts`）

### 5.1 頂層 reactive 狀態物件

| 物件 | 用途 |
|------|------|
| `state` | 玩法模式、選號清單、注單群組、單注金額 |
| `current` | 當期 runtime 資訊 + 當期注單明細 + orderCache 狀態 |
| `road` | 路珠統計（1–49 球號） |
| `wallet` | coin / currentBets / totalBets / analysis |
| `userRecord` | 使用者對話框資料（balanceChanges / betHistory / claimableIssues） |
| `openCodeHistory` | 歷史開獎清單 |
| `system` | 系統玩法清單（路珠分析用） |
| `analyze` | 排序狀態 |
| `time` | 伺服器對時、statusEndAt、倒數字串 |

### 5.2 重要 computed

| 名稱 | 說明 |
|------|------|
| `isOpen` | 當期狀態 === OPEN |
| `isOpening` | 當期狀態 === OPENING |
| `livePool` | 即時彩池（jackpotBase + currentIssueJackpot + carryJackpot） |
| `totalBetCount` | groupList 所有注數加總 |
| `openingRevealedIndices` | 開獎動畫已揭示的球位索引（Set<0-6>） |
| `openingRevealedNumbers` | 開獎動畫已揭示的實際號碼（Set<number>） |
| `danSelector` | 膽碼選號清單 |
| `tuoSelector` | 拖碼選號清單 |

### 5.3 開獎揭示動畫時間軸

開獎期間（`isOpening=true`）以 RAF 精準計時，依 elapsed ms 逐一揭示 7 顆球：

| elapsed ms | 揭示球位 |
|-----------|---------|
| 9,571 | index 0（正碼1） |
| 13,493 | index 1（正碼2） |
| 17,414 | index 2（正碼3） |
| 21,786 | index 3（正碼4） |
| 27,357 | index 4（正碼5） |
| 33,429 | index 6（特別號） |
| 37,000 | index 5（正碼6） |

> 特別號（index 6）在正碼6（index 5）之前揭示

### 5.4 核心 fetch 方法

| 方法 | 說明 |
|------|------|
| `fetch.initPageData(userId)` | 頁面初始化（並行載入 current/road/wallet + 本地快取） |
| `fetch.refreshCurrentInfo()` | 取得當期狀態，依 statusEndAt 排程下次拉取 |
| `fetch.startCurrentInfoPolling()` | 啟動輪詢（refreshCurrentInfo + jackpotPolling） |
| `fetch.stopCurrentInfoPolling()` | 停止所有輪詢 |
| `fetch.roadPlays()` | 路珠統計 |
| `fetch.walletState()` | 錢包狀態 |
| `fetch.bets(coin, userId)` | 送出下注 → 快取訂單 → 更新 wallet + 當期注單 |
| `fetch.cacheBetOrders(payload)` | 接收拆單結果寫入 Dexie |
| `fetch.orderDetailFromCache(userId, issue)` | 從 Dexie 讀取注單渲染 current.detail |
| `fetch.userDialogRecord()` | 使用者明細（balance / betHistory / claimableIssues） |
| `fetch.openCodeHistory()` | 歷史開獎清單 |
| `fetch.claimOneIssue()` | 領獎（一次一期）→ 更新 wallet + userRecord |
| `fetch.startJackpotPolling()` | 每 5 秒拉一次彩池（與 currentInfo 分離） |

### 5.5 本地快取（Dexie）

- DB: `Lottery_DB`
- Store: `lhc_official_orders`
- 欄位：`order_id`, `user_id`, `issue`, `bet_time`, `coin`, `bet_code`, `status`, `dan_code?`, `tuo_code?`, `bet_count?`
- 每 user 超過 5000 筆刪除最舊（至少刪 1000 筆）
- 目標：重整後秒開注單，不依賴 API

---

## 6. 元件目錄

```
app/components/lottery/bg/6hc/of/
  ├─ Single.vue           ← 單式玩法
  ├─ Duplex.vue           ← 複式玩法
  ├─ Dantuo.vue           ← 膽拖玩法
  ├─ Number.vue           ← 號碼展示
  ├─ base/
  │   ├─ Ball.vue         ← 球號元件（紅/藍/綠波顏色）
  │   └─ BarTabs.vue      ← 玩法切換 Tab
  └─ block/
      ├─ Header.vue           ← 期號狀態、開獎球展示、倒數
      ├─ Road.vue             ← 路珠看板（1-49）
      ├─ Selector.vue         ← 號碼選擇控制
      ├─ DialogUser.vue       ← 使用者明細 dialog
      ├─ DialogOpenCode.vue   ← 歷史開獎 dialog
      ├─ DialogRule.vue       ← 規則 dialog
      ├─ controls/
      │   ├─ index.vue        ← 下注控制主容器
      │   ├─ Group.vue        ← 注單群組管理
      │   ├─ Coin.vue         ← 單注金額選擇
      │   └─ Recommend.vue    ← 推薦方案
      ├─ footer/
      │   ├─ Auto.vue         ← 自動投注
      │   └─ Chat.vue         ← 聊天面板
      ├─ record/
      │   ├─ Issue.vue            ← 當期注單
      │   ├─ Analyze.vue          ← 分析展示
      │   ├─ Pagination.vue       ← 分頁控制
      │   ├─ ReportIssueBets.vue  ← 期號統計報告
      │   └─ IssueBets.vue        ← 期號下注列表
      └─ analyze/
          ├─ Balls.vue        ← 球號統計
          ├─ BarControls.vue  ← 分析面板控制
          └─ IssueBets.vue    ← 期號下注分析
```

---

## 7. 後端 API 路由

| Method | 路由 | 說明 |
|--------|------|------|
| GET | `/api/lottery/6hc-of/current` | 當期資訊（期號、狀態、倒數、開獎球、jackpot） |
| GET | `/api/lottery/6hc-of/jackpot` | 彩池狀態（單獨輪詢用） |
| GET | `/api/lottery/6hc-of/road` | 路珠統計（1-49 countShow/countIssue） |
| GET | `/api/lottery/6hc-of/opencode-history` | 歷史開獎清單（升冪，當日） |
| GET | `/api/lottery/6hc-of/user-record` | 使用者下注紀錄 + 餘額變動 + 可領獎期 |
| POST | `/api/lottery/6hc-of/claim` | 領獎（一次一期） |
| POST | `/api/lottery/bet` | 共用下注接口（所有玩法共用） |

---

## 8. 後端服務（`server/services/lottery6hcOf.ts`）

### 8.1 期號系統

- 每日自動生成 **205 期** 期號
- 格式：`YYYYMMDD` + 3 碼流水（001–205）
- 每期 **7 分鐘** 一輪（`CYCLE_SECONDS = 420`）
- 狀態序列：`PREPARE → OPEN → CLOSED → OPENING → OPENED → (下一期 PREPARE)`

### 8.2 訂單規則

- 主單號：`LHC-OF{issue}{serial6碼}`
- 拆單後綴：`(k/n)`，例如 `(1/3)`、`(2/3)`、`(3/3)`
- 前後端顯示、快取、查詢必須使用同一 `order_id`

### 8.3 下注流程（`playBets`）

```
playBets(payload, user)
  → 扣款（user.coin -= amount）
  → 建立訂單行（buildOrderRows）
  → addIssueJackpot（累積本期彩池）
  → pushBalanceChange（寫入 balanceChange type=bet）
  → 更新 configPlay countShow（路珠統計）
  → 拆單寫入 OrdersClass
```

### 8.4 獎金結算（`settleClosedIssueIfNeeded`）

每 circle 檢查是否有 CLOSED 且未結算的期數：

```
ISSUE_PRIZE_TIERS（7 個階層）:
  頭獎: 6 正碼全中    → pool 70%，最低 200,000
  二獎: 5 正 + 特別號 → pool 20%，最低 50,000
  三獎: 5 正碼       → pool 10%，最低 3,500
  四獎: 4 正 + 特別號 → fixed 3,000
  五獎: 4 正碼       → fixed 200
  六獎: 3 正 + 特別號 → fixed 10
  七獎: 3 正碼       → fixed 5

未中獎或無人中獎 → 比例金額滾存（carryJackpot）
中獎 → 寫入 claimableIssues，等使用者主動領取
```

### 8.5 彩池設定

```ts
const BASE_FIRST_PRIZE = 200_000    // 頭獎最低金額
const JACKPOT_PERCENT = 0.8         // 發放獎金比例
const BASE_PERCENT = 0.55           // 池底比例

jackpotBase 初始範圍：
  JACKPOT_BASE_MIN ≈ BASE_FIRST_PRIZE / 0.55 + BASE_FIRST_PRIZE / 3
  JACKPOT_BASE_MAX = BASE_FIRST_PRIZE * 7
```

---

## 9. 服務層（前端）

### `lottery6hcOfficialService.ts`

| 方法 | HTTP | 說明 |
|------|------|------|
| `fetchCurrentInfo()` | GET current | 返回 `Lottery6hcOfCurrent` |
| `fetchRoadPlays()` | GET road | 返回 `Lottery6hcRoadPlay[]` |
| `fetchWalletState()` | GET wallet（共用） | 返回 coin/currentBets/totalBets |
| `fetchOpenCodeHistory()` | GET opencode-history | 返回歷史開獎清單 |
| `fetchUserRecord()` | GET user-record | 返回 balanceChanges/betHistory/claimableIssues |
| `submitClaimOneIssue()` | POST claim | 返回 ok/message/issue/amount |
| `submitBet(payload)` | POST bet | 返回 orders（拆單結果） |
| `fetchJackpot()` | GET jackpot | 返回 jackpotBase/currentIssueJackpot/carryJackpot |
| `fetchServerTime()` | GET server-time | 返回 serverTime（ms） |

---

## 10. 伺服器時間同步

```
init.startServerTimeSync()
  → syncServerTime()  // 立即同步一次
  → tickTimer: setInterval(handle.tickServerNow, 1000)   // 每秒 tick
  → syncTimer: setInterval(init.syncServerTime, 3000)    // 每 3 秒重新對時

handle.tickServerNow()
  time.nowMs = syncedAtServerMs + (Date.now() - syncedAtClientMs)
  → 更新 statusRemainSec / statusRemainLabel
```

---

## 11. 當期輪詢策略

```
fetch.refreshCurrentInfo()
  → fetch.currentInfo()
  → handle.scheduleNextCurrentInfoFetch(statusEndAt)
      delay = max(250ms, statusEndAt - time.nowMs + 50)
      → setTimeout(fetch.refreshCurrentInfo, delay)

優點：精準在期號切換瞬間更新，不做無謂的固定頻率輪詢
```

---

## 12. 使用者紀錄資料結構

### Storage.users[userId].record

```ts
{
  balanceChanges: UserBalanceChange[]  // 餘額變動（下注/領獎）
  betHistory: UserBetHistory[]         // 下注紀錄（含中獎判定）
  claimableIssues: UserClaimableIssue[]// 可領獎期號
  updatedAt: number
}

UserBetHistory {
  orderId, issue, betTime, coin, betCount
  betCode, danCode?, tuoCode?
  openCode, matchCount, specialMatch
  winStatus: 'pending' | 'win' | 'lose'
  winAmount
}

UserBalanceChange {
  id, issue, type: 'bet' | 'claim'
  amount (負=支出), before, after
  createdAt, note
}
```

### 中獎判定邏輯

1. 以注單 `issue` 對應該期 `openCode`
2. `betCode` 與 `openCode` 有交集 → `win`，否則 `lose`
3. 無法取得開獎資料（當期未開）→ `pending`

---

## 13. Dialog 觸發邏輯

| Dialog | 觸發位置 | 開啟時同步執行 |
|--------|---------|--------------|
| `DialogUser` | info-side 使用者區 / 頂部導覽 | `fetch.userDialogRecord()` |
| `DialogOpenCode` | Header 開獎球 / 頂部導覽 | `fetch.openCodeHistory()` + `fetch.userDialogRecord()` |
| `DialogRule` | 頂部導覽 | 無（靜態內容） |

所有 dialog 都有三段狀態：`loading → success / error`

---

## 14. 動畫系統

| 動畫 | 觸發 | keyframes |
|------|------|-----------|
| 頁面入場 | `onMounted` → `state.entered=true` | `sec-in`（各版塊依序 delay 0.08s–0.48s） |
| 頁面離場 | `onBeforeRouteLeave` | `page-out`（scale 0.97 + translateY -8px） |
| 卡片光暈 | 持續 | `card-glow`（3.5s 循環） |
| 背景光球 | 持續 | `orb-rise`（8 顆，各自 delay 和 duration） |
| 浮動獎按鈕 | OPENING/OPENED | `float-btn-slide-in/out` + `float-btn-sway` |

---

## 15. 製作新玩法的標準步驟

參考 6hc-of 的模式，新玩法需完成以下各層：

### 前端

1. **`app/config/bg/{玩法}.js`** — 號碼清單與顏色/賠率設定
2. **`app/composables/use{玩法}.ts`** — 狀態中心（參考 use6hcOfficial.ts 結構）
   - 必有：`state / current / road / wallet / userRecord / time`
   - 必有：`fetch / handle / click / init` 四大命名空間
   - 必有：非同步三段狀態（loading/success/error）
3. **`app/services/{玩法}Service.ts`** — HTTP 服務封裝
4. **`app/components/lottery/bg/{玩法}/`** — 元件目錄
   - `base/Ball.vue` — 球號元件
   - `base/BarTabs.vue` — 玩法 Tab
   - `block/Header.vue` — 期號狀態
   - `block/Road.vue` — 路珠統計
   - `block/Dialog*.vue` — user/opencode/rule 三個 dialog
   - `block/controls/` — 下注控制
   - `block/record/` — 注單紀錄
   - 玩法元件（Single/Duplex/Dantuo 等）
5. **`app/pages/lottery/bg/{玩法}.vue`** — 頁面入口
   - 登入守衛
   - 入場/離場動畫
   - 浮動開獎按鈕

### 後端

6. **`server/services/{玩法}.ts`** — 遊戲服務（`extends` 或獨立 class）
   - `init()` → 生成期號 + 初始化 jackpotBase
   - `circle()` → 刷新當期狀態 + 結算
   - `playBets()` → 扣款、訂單、balanceChange
   - `get.currentInfo()` / `get.roadPlays()` / `get.jackpotState()` / `get.userInfo()` / `get.userDialogRecord()`
7. **`server/api/lottery/{玩法}/`** — API 路由（6 支，同 6hc-of）

### 規格文件

8. **`openspec/specs/{玩法}.md`** — 功能規格書

---

## 16. 關鍵設計原則（務必遵守）

1. **reactive 統一 state** — 所有共享狀態集中於 composable，不散落在元件
2. **私有邏輯封裝** — `_handlers` / `_actions` 前綴私有，`click` 為 UI 觸發點
3. **非同步三段狀態** — 所有 async 操作都有 loading/success/error 三態
4. **路珠資料唯一來源** — `countShow` / `countIssue` 只來自 API，不 mock
5. **Dexie 快取先行** — 頁面載入先讀本地快取再呼叫 API
6. **訂單 ID 不變** — `LHC-OF{issue}{serial}(k/n)` 格式，前後端一致
7. **伺服器對時** — 倒數計時必須以 serverTime 為基準，不用 Date.now()
8. **智慧排程輪詢** — 依 `statusEndAt` 計算 delay，不固定頻率
