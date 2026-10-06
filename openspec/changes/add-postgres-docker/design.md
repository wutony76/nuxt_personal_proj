# Design

> 本變更是資料持久化基礎建設，不是前端頁面功能，模板裡的 Layout/Component/Token Mapping 等前端專屬段落
> 不適用，以下僅保留與本次變更相關的段落並改寫內容。

## 1. 現況與目標架構

現況（示意）：

```
Nuxt/Nitro server process
  └─ Storage（static，記憶體）
       ├─ account / sessions
       ├─ config（各玩法賠率/期別設定）
       ├─ lottery.orders / poolAudit
       ├─ retroGames.instances / history
       └─ manager.admin / gameRetro / gameCalc / lotteryBg / lotteryTw
後台 members / role-defs → 同樣是純記憶體（`adminAccess.ts` 的 `accounts`/`adminIds`/`memberRoleId`、
`roleDefs.ts` 的 `roles` Map），**並非** JSON 檔案（本節先前誤寫為 JSON 檔案，已訂正；
見 `migrate-members-roledefs-postgres` change 的調查記錄）
```

重啟 server ⇒ 以上全部歸零（無任何例外）。

目標架構（本次僅搭地基，虛線箭頭代表「之後」才會發生的搬遷，非本次任務）：

```
Nuxt/Nitro server process
  ├─ Storage（本次不動，維持記憶體）┄之後┄▶ PostgreSQL（Docker container）
  └─ db client（新增，本次只建立連線層，尚未被任何既有邏輯呼叫）
         │
         ▼
   docker-compose: postgres service + named volume
```

## 2. 為什麼選 PostgreSQL（決策記錄）

- 配額（分頁層級限額、跨分頁單期總上限）、遊戲紀錄每日上限皆屬於「同一期別/同一天內多次寫入需要唯一性與
  交易保證」的場景，關聯式資料庫的 transaction + unique constraint 可以把這類邏輯下推到資料庫層，不必在
  應用層手刻鎖
- 官方 Docker image（如 `postgres:16-alpine`）成熟、單一 named volume 掛載即可持久化，符合「最終用 Docker
  架設」的前提
- 與現有 TypeScript 技術棧（Nuxt/Nitro）生態的 ORM 選擇豐富（Drizzle / Prisma / Kysely 皆可）

## 3. Docker Compose 服務設計（規劃）

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

- 本機開發與正式環境共用同一份 compose 定義，差異只靠 `.env` 控制（密碼/port）
- 本次不把 Nuxt app 本身容器化，只先把 DB 容器化（符合「打地基」範圍；Nuxt app 是否容器化留待後續 change 決定）

## 4. ORM / Migration 工具選型（待使用者確認後定案）

| 選項 | 優點 | 缺點 |
| --- | --- | --- |
| **Drizzle ORM** | TypeScript-first、無 codegen 黑盒、SQL-like API 貼近專案現有「直接寫邏輯」風格、`drizzle-kit` migration 工具輕量 | 生態較新，進階關聯查詢語法不若 Prisma 直覺 |
| **Prisma** | DX 成熟、schema 即文件、migration 工具完整 | 需要額外 codegen 步驟（`prisma generate`），與專案目前 `shared/config` 禁止額外建置步驟的慣例風格略有落差 |
| 原生 `pg` + 手寫 SQL | 零抽象、完全掌控 | 每個 domain 搬遷都要手刻 query/migration，長期維護成本高 |

初步傾向：**Drizzle**（貼近現有 TypeScript-first、少黑盒的開發慣例），但實際定案留到使用者確認後再寫入
`tasks.md`。

## 5. 連線層設計（規劃，尚未接上既有邏輯）

- 新增 `server/services/db.ts`：單一連線 pool（singleton），讀取 `process.env.DATABASE_URL`
- 僅暴露最小 `ping()` / health-check 用途，本次不建立任何 table 或 repository 方法
- 若 `DATABASE_URL` 未設定，現有 `Storage` 流程完全不受影響（維持純記憶體模式），確保本機不裝 Docker
  也能照常 `npm run dev`

## 6. 環境變數與設定（規劃）

- `.env.example` 新增：`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` / `DATABASE_URL`
- `DATABASE_URL` 格式：`postgresql://<user>:<password>@localhost:<port>/<db>`

## 7. 未來搬遷路徑（規劃用，非本次任務，每個 Phase 各自開一個 OpenSpec change）

1. Phase 1（本次）：Docker + 連線層 + 選型定案
2. Phase 2：搬遷 admin members / role-defs（JSON → Postgres），風險最低、資料量最小
3. Phase 3：搬遷遊戲紀錄 / 配額相關資料
4. Phase 4（視需求）：評估是否疊加 Redis 做高頻計數器快取
每個 Phase 各自走完整六階段流程（Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence）

## 8. 定時同步機制設計（Memory → SQL，通用機制，不綁定具體資料）

### 8.1 為什麼不是即時寫入

`Storage` 現有的業務邏輯（40+ 玩法 class、admin 模組）全部是同步操作記憶體，若改成「每次寫入都同步打 DB」，
等於要把這些既有程式碼全部插入 async DB I/O，牽涉範圍跟直接搬遷資料一樣大。改採**定時批次同步**
（memory 持續當 runtime 的 source of truth，SQL 只是每 5 分鐘刷新一次的持久化鏡像），可以在完全不碰
既有業務邏輯的前提下，先把「重啟全歸零」這個現況大幅改善成「最多遺失 5 分鐘」。

### 8.2 排程方式：沿用既有 `BaseClass` 自重啟 timer 慣例

專案 `server/services/base.ts` 的 `BaseClass` 已經有一套「自我重新排程」的 `setTimeout` loop，
`server/plugins/init.ts` 用它跑 300ms 一次的遊戲 tick（`new BaseClass().runCircle(...)`）。同步機制沿用
同一種慣例，另開一個獨立的 timer（**不與 300ms 遊戲 tick 共用**，避免同步耗時卡住遊戲邏輯）：

```
server/services/sync.ts（規劃新增）
  class SyncScheduler extends BaseClass-like 自重啟 timer，intervalMs 可注入（預設 300_000 = 5 分鐘）
  runSyncCircle(task: () => Promise<void>)
    - 與 BaseClass.circle 的差異：task 是 async（DB I/O），必須 await 完成才能排下一輪 setTimeout，
      確保同一時間只有一次同步在跑，DB 較慢時自然跳過重疊、不會疊加執行
```

`server/plugins/init.ts` 於 `Storage.init()` 之後、與既有遊戲 circle 平行註冊：

```
new SyncScheduler().runSyncCircle(async () => {
  await runSyncTick()   // 見 8.3
})
```

### 8.3 可插拔的 SyncSource 介面（本次只設計介面，不實作任何具體來源）

```ts
interface SyncSource {
  table: string                              // 對應的 SQL table 名稱
  primaryKey: string[]                       // upsert 用的唯一鍵欄位
  snapshot(): Record<string, unknown>[]      // 同步瞬間，從 Storage 取出要寫入的列（同步函式，見 8.4）
}
```

- `runSyncTick()` 內部維護一份 `SyncSource[]` 註冊表，逐一呼叫 `snapshot()` → 組成 upsert SQL → 在單一
  DB transaction 內寫入
- 之後每個 Phase（members/role-defs、game history/quota…）各自實作一個 `SyncSource`，在自己的 change 裡
  註冊進這份清單；本次不實作任何一個具體 `SyncSource`，註冊表起始為空陣列

### 8.4 Snapshot 一致性：為什麼 `snapshot()` 必須是同步函式

Node.js 單執行緒，若 `snapshot()` 本身不 `await` 任何東西，從「讀取 `Storage` 當前值」到「複製出一份
快照物件」之間不會被其他 request 的 callback 插隊（no read-tearing）。真正的非同步 DB 寫入動作要發生在
`snapshot()` 回傳**之後**，確保每次同步拿到的是某個時間點的一致快照，而不是邊讀邊被其他邏輯改掉一半。

### 8.5 Upsert 策略（冪等、可重覆執行）

每輪同步都是「用 `primaryKey` 對現有資料做 upsert」，而不是先清空再整批插入：

- 冪等：同一輪資料重複同步兩次，結果相同（不會因為 timer 重疊或手動重跑而產生重複列）
- 不處理刪除：記憶體裡若有資料被移除（例如 session 過期），本次機制**不會**把 SQL 對應列刪掉
  （刪除同步留給各 `SyncSource` 自行決定要不要實作，標記為已知限制，非本次要解決的問題）

### 8.6 失敗處理與可觀測性

- 整輪 `runSyncTick()` 包在 try/catch：任何一個 `SyncSource` 失敗（含 DB 連線中斷）只記錄 log、
  不拋出，不影響主要業務流程與遊戲 tick
- 失敗的這一輪直接跳過，記憶體資料仍完整保留，下一輪（5 分鐘後）會帶著最新狀態重試，不需要額外的
  重試/補償邏輯
- 比照現有 `console.log('SUCCESS ---BASE>...')` 的 log 慣例，每輪同步印出耗時與各 `SyncSource` 的
  寫入列數，方便從 server log 直接看出同步是否健康

### 8.7 本次明確排除、留待後續決定的項目

- **重啟回填（SQL → memory）**：本次同步方向單純是 memory → SQL，`Storage.init()` 本次不會去讀 SQL
  做任何回填；是否需要在啟動時從 SQL 恢復上一次同步的狀態，牽涉到「回填的資料跟啟動當下已經產生的新
  期別/新彩池如何合併」等業務邏輯，複雜度不亞於搬遷本身，留待實際有 `SyncSource` 落地時再評估
- **刪除同步 / 軟刪除標記**：見 8.5
- **同步間隔是否需要依資料類型分級**（例如 session 類資料變動快、適合更短間隔）：本次先用單一全域
  5 分鐘間隔，之後有需要再讓 `intervalMs` 依 `SyncSource` 分組

## 9. 測試與驗證策略（規劃用，待 Implementation 階段才執行）

- 單元/整合測試範圍：本次不涉及業務邏輯，無需新增測試；進入 Implementation 後，連線層本身可補一支
  `test/test-db-connection.mjs`
- 手動測試案例：`docker compose up -d postgres` → 連線層 `ping()` 成功 → `docker compose down` 後
  資料透過 volume 仍保留
- 手動測試案例（同步機制）：註冊一個假的 `SyncSource`（回傳固定測試資料）→ 等待一輪 5 分鐘（或暫時把
  `intervalMs` 調低測試）→ 確認 SQL 對應 table 有 upsert 成功；重複跑兩輪確認不會產生重複列（冪等）；
  刻意讓 DB 斷線一輪，確認 server 與遊戲 tick 不受影響、log 有印出失敗、下一輪恢復後自動補上
- 回歸風險與檢查點：確認未設定 `DATABASE_URL` 時，現有全部 `npm test` 套件行為不變；確認新增的同步
  timer 不影響既有 300ms 遊戲 tick 的執行頻率與時機
