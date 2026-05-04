# 功能規格書：六合彩官方版（6hc-of）

## 1. 文件目的與範圍

本規格定義 `/lottery/bg/6hc-of` 目前已存在的功能與邏輯，並新增以下需求：

1. 點擊 `user` 區塊以 dialog 顯示使用者資料視窗。
2. 點擊 `opencode` 區塊以 dialog 顯示歷史開獎資料。
3. 在 `user` dialog 中，提供餘額變動表與完整下注紀錄，並判斷紀錄是否中獎。
4. 每位使用者的餘額變動表必須落地保存於 `Storage.users.record`。

本文件同時保留既有 Dexie 快取、下注拆單、路珠資料來源等既定規範，避免新需求破壞既有流程。

---

## 2. 現況功能與邏輯盤點（As-Is）

### 2.1 前端頁面與組件（`app/pages/lottery/bg/6hc-of.vue`）

- 頁面載入後執行：
  - `useAuth().init()` 驗證登入。
  - 未登入導向 `/login`。
  - 啟動 server time sync。
  - 呼叫 `mxFetch.initPageData(userId)` 載入當前期數、路珠、錢包與本地注單快取。
- 頁面卸載時會停止：
  - server time sync
  - current info polling
  - order detail sync
- 主要版塊：
  - Header（彩種資訊、期數狀態、倒數、開獎球）
  - info-side（使用者餘額與投注摘要）
  - Road（1~49 路珠統計）
  - Play（玩法切換 + 下注控制）
  - Record（當期注單 + 分析區）

### 2.2 前端狀態中心（`use6hcOfficial.ts`）

- 統一 reactive 狀態：
  - `state`: 玩法模式、選號清單、注單群組、單注金額
  - `current`: 當前期 runtime 與當期注單明細
  - `road`: 1~49 路珠統計
  - `wallet`: coin/currentBets/totalBets/analysis
  - `time`: server 對時、狀態截止時間、倒數字串
- 既有核心流程：
  - `fetch.refreshCurrentInfo()`：輪詢取得當前期資訊，並依 `statusEndAt` 排程下次拉取。
  - `fetch.bets()`：送出下注後，寫入 Dexie、本地重刷 wallet 與當期注單。
  - `fetch.cacheBetOrders()`：接收後端拆單結果，保存為 `order_id(k/n)` 格式。
  - `fetch.orderDetailFromCache()`：從 Dexie 讀最近紀錄渲染 `current.detail`。
  - `init.startServerTimeSync()`：每秒 tick、每 3 秒重新對時。

### 2.3 後端服務（`server/services/lottery6hcOf.ts`）

- 每日自動建立 205 期期號與隨機開獎號：
  - 期號格式：`YYYYMMDD + 3碼流水`
  - 每期 7 分鐘一輪（依 `STATUS_TIME` 切換 PREPARE/OPEN/CLOSED/OPENING/OPENED）
- 下注流程：
  - `playBets(payload, user)` 先扣款，再拆單寫入訂單系統。
  - 訂單主號：`LHC-OF + issue + serial(6碼)`。
  - 拆單附碼：`(k/n)`。
- 路珠統計：
  - `countShow`: 球號在已完成期數出現次數。
  - `countIssue`: 球號距離上次出現的間隔期數。

### 2.4 既有限制與缺口

- 尚未提供「user / opencode 點擊打開 dialog」行為。
- `Storage.users[userId]` 目前僅有 `coin`，無 `record` 歷史欄位。
- 下注紀錄雖有保存（Orders + Dexie），但尚未提供「是否中獎」判定欄位與展示。
- `opencode` 目前僅顯示最新一期（Header），尚無歷史清單視窗。

---

## 3. 既有規範（持續生效）

### 3.1 Dexie 前端快取（保留）

- DB: `Lottery_DB`
- Store: `lhc_official_orders`
- 主要欄位：`order_id`, `user_id`, `issue`, `bet_time`, `coin`, `bet_code`, `status`
- 保留策略：每 user 超過 5000 筆時刪除最舊紀錄（至少刪 1000 筆）
- 目標：頁面重整後可秒開注單，不依賴即時 API 成功與否

### 3.2 訂單規則（保留）

- 主單號：`LHC-OF{issue}{serial6}`
- 拆單後綴：`(k/n)`，例如 `(1/3)`、`(2/3)`、`(3/3)`
- 前後端顯示、快取、查詢必須使用同一 `order_id`

### 3.3 路珠數據來源（保留）

- `countShow` 與 `countIssue` 僅可由 `api.lottery.road6hcOf()` 回傳資料驅動
- 不可改回前端 mock / 靜態資料

---

## 4. 新增需求（To-Be）

## 4.1 UI 互動：`user` 與 `opencode` 以 Dialog 展示

### 4.1.1 觸發點

- `user` 觸發：
  - `6hc-of` 頁左側使用者資訊區（`user-warp`）可點擊。
- `opencode` 觸發：
  - Header 右側開獎號碼區（`open-code`）可點擊。

### 4.1.2 Dialog 要求

- 使用既有全域 Dialog 機制（`useDialog` / `$dialog`）統一管理顯示與關閉。
- 內容區允許自訂 HTML/組件渲染（既有 dialog 支援 `useHtml`；新增需求可擴充為組件型內容）。
- 每次開啟需有明確狀態：
  - loading
  - success
  - error（不可吞錯，需可見）

---

## 4.2 `user` Dialog：餘額變動 + 全下注紀錄 + 中獎判定

### 4.2.1 資料範圍

開啟 `user` dialog 時，至少顯示以下兩塊資料：

1. 餘額變動表（Balance Ledger）
2. 全部下注紀錄表（Bet History）

兩表皆限定目前登入使用者（userId 隔離），不得混入他人資料。

### 4.2.2 餘額變動表欄位定義

| 欄位 | 型別 | 說明 |
| :-- | :-- | :-- |
| `record_id` | string | 唯一識別碼 |
| `user_id` | string | 使用者 ID |
| `change_type` | `bet` \| `settle_win` \| `settle_refund` \| `manual_adjust` | 餘額變動類型 |
| `change_amount` | number | 本次變動值（扣款為負、入帳為正） |
| `balance_before` | number | 變動前餘額 |
| `balance_after` | number | 變動後餘額 |
| `related_order_ids` | string[] | 關聯注單，可為空 |
| `issue` | string | 關聯期號，可為空 |
| `created_at` | number | 建立時間（ms timestamp） |
| `remark` | string | 備註（可選） |

### 4.2.3 下注紀錄表欄位定義

| 欄位 | 型別 | 說明 |
| :-- | :-- | :-- |
| `order_id` | string | 拆單後完整單號（含 `(k/n)`） |
| `issue` | string | 下注期號 |
| `bet_time` | number | 下注時間 |
| `bet_code` | string[] | 該筆下注號碼 |
| `coin` | number | 該筆投注金額 |
| `status` | `pending` \| `success` \| `settled` | 注單流程狀態 |
| `win_status` | `pending` \| `win` \| `lose` | 中獎判定結果（本次新增） |
| `win_amount` | number | 中獎金額（未結算可為 0） |
| `open_issue` | string | 用於判定的開獎期號 |
| `open_code` | string[] | 用於判定的開獎號 |

### 4.2.4 中獎判定規則

- 判定時機：
  - 開啟 `user` dialog 時必須可得到每筆紀錄對應的 `win_status`。
  - 若該期尚未可判定，狀態為 `pending`。
- 最低判定規則（現行玩法相容）：
  1. 以注單 `issue` 對應該期 `openCode`。
  2. `bet_code` 與 `openCode` 有交集則 `win_status = win`，否則 `lose`。
  3. 無法取得開獎資料（例如當期未開）為 `pending`。
- 後續若加入更精準賠率/玩法算法，需在此規格追加對應 rule set，不得覆蓋既有欄位。

### 4.2.5 排序與分頁

- 預設按 `created_at` / `bet_time` 由新到舊。
- 支援分頁（預設 pageSize 10，與既有表格一致）。
- 需提供「總變動金額」與「總投注金額」摘要。

### 4.2.6 領獎按鈕與逐期領取

- `user` dialog 需顯示「可領獎期數」與「領取下一期獎金」按鈕。
- 點擊一次只能領取一個期數（最早可領的期數優先）。
- 領獎成功後必須：
  - 更新使用者餘額；
  - 寫入一筆 `balanceChanges`（`type = claim`）；
  - 從 `claimableIssues` 移除該期，避免重複領取。

---

## 4.3 `opencode` Dialog：歷史開獎號碼（過去到最近期）

### 4.3.1 顯示要求

- 顯示範圍：當日可用的 `recordOpenCode` 全部期數，從過去到最近期（升冪）。
- 每列至少包含：
  - `issue`
  - `open_code`（7 顆）
  - `time.start`
  - `time.end`
- 可選擇顯示期數狀態（OPEN/CLOSED/OPENED）作為輔助欄位。

### 4.3.2 來源要求

- 資料來源需來自 server 端 `LHC_OF.recordOpenCode` 衍生結果。
- 前端不可自行生成歷史列表，避免與 server 狀態不一致。

---

## 4.4 `Storage.users.record` 資料落地（本次必做）

### 4.4.1 Storage 結構擴充

每位使用者資料由：

- 現況：`{ userId, coin }`
- 擴充為：`{ userId, coin, record }`

其中 `record` 結構如下：

```js
{
  balanceChanges: [],
  betHistory: [],
  updatedAt: 0
}
```

### 4.4.2 寫入規範

- 每次成功下注後，必須新增一筆 `balanceChanges`（`change_type = bet`）。
- `betHistory` 需同步保存本次拆單紀錄（一筆 groups 對應多筆 order）。
- 寫入應在同一業務流程中完成，避免只扣款未記錄或只記錄未扣款。

### 4.4.3 讀取規範

- `user` dialog 的餘額變動表，資料唯一來源為 `Storage.users[userId].record.balanceChanges`。
- 若 record 尚不存在，需初始化空結構，不得拋出未定義錯誤。

### 4.4.4 容量與清理

- `balanceChanges` 與 `betHistory` 預設最多保留 5000 筆。
- 超量時刪除最舊資料（可批次刪 500~1000 筆）。
- 清理策略不得影響當期可見資料。

---

## 5. API / Service 需求補強

為符合「當前架構（page -> composable -> service -> api -> storage/game service）」：

1. 新增使用者紀錄查詢接口（建議）
   - `GET /api/lottery/6hc-of/user-record`
   - 回傳：`balanceChanges`, `betHistory`（含 `win_status`）
2. 新增歷史開獎查詢接口（建議）
   - `GET /api/lottery/6hc-of/opencode-history`
   - 回傳：由舊到新的期數與開獎球
3. 現有 `POST /api/lottery/bet`
   - 需在成功路徑中保證寫入 `Storage.users.record`
4. 新增單期領獎接口（建議）
   - `POST /api/lottery/6hc-of/claim`
   - 每次僅領取一個期數

## 5.1 當期總獎金累積與分配（Server）

- `lottery6hcOf` 需維護：
  - 當期累積總獎金（當期下注金額累積）；
  - 滾存獎金（上一期未分配金額）。
- 當期結束後，依官方六合彩通用分層思路進行獎金分配：
  - 依中獎匹配階層分配固定比例；
  - 該階層無人中獎時，比例金額滾存到下一期；
  - 該期每位用戶中獎總額寫入 `claimableIssues`，等待使用者主動領取。

若不新增 endpoint，而改由既有 endpoint 擴充欄位，亦可接受，但需保持：

- 單一責任（user record 與 current info 不混雜過重）
- 前端載入時延可控
- 錯誤可區分（哪個資料源失敗）

---

## 6. 錯誤處理與狀態管理

所有新增 async 流程必須有：

- loading：dialog 開啟即顯示載入狀態
- success：資料完整後切換內容
- error：顯示可理解訊息（例如「讀取使用者紀錄失敗」）

其他要求：

- 不得吞錯；需回傳或落入可觀測 state。
- 若 `win_status` 判定失敗，不可阻塞整體畫面，該筆以 `pending` 降級。

---

## 7. 相容性與不破壞承諾

- 不破壞既有下注成功流程與 `$dialog.alert` 行為。
- 不改動既有 order id 規格（含 `(k/n)`）。
- 不改動既有 Dexie 寫入與當期注單渲染流程。
- 不改變 `api.lottery.road6hcOf()` 作為路珠統計唯一來源。

---

## 8. 驗收標準（Acceptance Criteria）

### AC-1：Dialog 觸發

- 點擊 user 區塊可開啟 `user` dialog。
- 點擊 opencode 區塊可開啟 `opencode` dialog。

### AC-2：User Dialog 資料完整

- 可看到餘額變動表。
- 可看到完整下注紀錄。
- 每筆下注都有 `win_status`（`pending/win/lose` 其一）。

### AC-3：Storage 落地

- 成功下注後，`Storage.users[userId].record.balanceChanges` 新增紀錄。
- 對應 `betHistory` 同步新增拆單紀錄。

### AC-4：歷史開獎顯示

- `opencode` dialog 可顯示歷史到最近期資料（升冪）。
- 至少含期號與 7 顆開獎號。

### AC-5：錯誤可觀測

- 任一資料源失敗時，dialog 可顯示 error 狀態，不可無聲失敗。

---

## 9. 非目標（Out of Scope）

- 不在本次規格中定義最終賠率結算公式。
- 不在本次規格中處理跨天歷史資料歸檔（僅定義當日/現行資料）。
- 不在本次規格中重構整體 dialog 基礎元件為全新框架。
