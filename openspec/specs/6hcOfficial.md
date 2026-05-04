# 功能規格書：六合彩官方版下注紀錄前端緩存 (Dexie.js)

## 1. 目的

在前端 `/lottery/bg/6hc-of` 頁面下注流程中引入 Dexie.js，將下注成功的紀錄即時儲存於用戶瀏覽器。

- **提升體驗**：頁面重新整理或切換分頁時，紀錄秒開，無需等待 API 轉圈。
- **異常防護**：若 API 請求成功但後續畫面崩潰，用戶重新進入後仍能看到該筆投注。
- **減輕壓力**：減少對 `bet-history` 接口的輪詢頻率。

## 2. 技術棧

- **儲存庫**：Dexie.js (v4+)
- **前端框架**：Nuxt 4 (Vue 3.5+)
- **運行環境**：Browser Client Side Only

## 3. 資料庫設計 (Schema)

### 3.1 資料庫定義

- **Database Name**: `Lottery_DB`
- **Store Name**: `lhc_official_orders`

### 3.2 索引設計

| 欄位名 (Key)        | 類型   | 索引         | 說明                               |
| :------------------ | :----- | :----------- | :--------------------------------- |
| **order_id**        | String | ++ (Primary) | 訂單編號 (後端返回)                |
| **user_id**         | String | Index        | 用戶 ID (隔離不同帳號數據)         |
| **issue**           | String | Index        | 下注彩期                           |
| **bet_time**        | Number | Index        | 下注時間戳 (用於倒序排列)          |
| **[user_id+issue]** | Array  | Composite    | 複合索引：加速特定用戶在該期的查詢 |
| **coin**            | Number | -            | 投注金額                           |
| **bet_code**        | Array  | -            | 下注號碼 (初始為空)                |
| **status**          | String | -            | 狀態 (pending/success/settled)     |

## 4. 核心流程

### 4.1 寫入流程 (Write)

1. **API 調用**：前端 POST `/api/lottery/bet`。
2. **結果處理**：
   - 請求成功 (`code: 200`) 後，提取 Res 中的訂單細節。
   - 執行 `await db.lhc_official_orders.put({ ... })`。
3. **無感化**：寫入過程使用 `try/catch` 封裝，不應影響用戶關閉投注視窗或後續操作。

### 4.2 讀取流程 (Read)

- **優先級**：頁面初始化時先從 Dexie 讀取。
- **排序與分頁**：使用 `.orderBy('bet_time').reverse().limit(20)` 確保顯示最新數據。
- **資料聯動**：讀取後的資料會實時反映在 `use6hcOfficial.ts` 的 `current.detail` 中，供 UI 渲染。

### 4.3 數據清理 (Cleanup)

- **容量維護**：每次寫入成功後，檢查當前 `user_id` 的紀錄筆數。
- **清理規則**：若超過 5000 筆，刪除該 `user_id` 下最舊的紀錄。 最舊的 1000 筆

## 5. Nuxt 4 實作規範

- **5.1 客戶端限制**：資料庫實例化放在 `composables/useLhcDb.ts`，並透過 `import.meta.client` 確保 SSR 階段不被執行。
- **5.2 反應式更新**：利用 `liveQuery` 監聽資料庫，實現狀態變更（如結算後填入 opencode）時 UI 自動感應。

## 6. 異常處理

- **版本控制**：若未來增加索引，需提升 `db.version(N)`。
- **一致性校驗**：若後端返回數據與本地快取衝突，以後端數據為準 (Overwrite)。
- **無痕模式**：處理不支援 IndexedDB 的極端環境報錯。

## 7. 本次增補需求（2026-04-30）

### 7.1 訂單流水號規則（Server）

- 在 `server/services/lottery6hcOf.ts` 新增訂單流水號產生函式。
- 格式：`LHC-OF + issue + serial`（例如：`LHC-OF20260430001xxxxx1`）。
- `serial` 需為該期內單調遞增，避免同一期重複。

### 7.2 下注拆單與 order_id 後綴

- 一次下注若包含多個 `groups`，後端需拆成多筆訂單資料。
- 同一次下注共 `n` 筆時，拆單後 `order_id` 需附加分段後綴：`(k/n)`。
  - 例如原單號 `LHC-OF20260430001xxxxx1`，拆 3 筆後為：
    - `LHC-OF20260430001xxxxx1(1/3)`
    - `LHC-OF20260430001xxxxx1(2/3)`
    - `LHC-OF20260430001xxxxx1(3/3)`
- 前端 Dexie 寫入時需使用上述拆單後的 `order_id`，確保顯示與查詢一致。

### 7.3 注號分析數據來源統一

- 「注號分析」中 1-49 的：
  - 攪出次數（`countShow`）
  - 相隔期數（`countIssue`）
- 必須由 `api.lottery.road6hcOf()` 回傳資料計算，不可再使用本地 mock 或靜態假資料。
- 分析相關 UI（含排序/高亮）需以 API 回傳的統計值為唯一來源。
