# Proposal

## 變更名稱

`migrate-members-roledefs-postgres` — 把後台 members 與 role-defs 從記憶體搬遷到 PostgreSQL
（`add-postgres-docker` 規劃的 Phase 2）

## 背景

調查確認：後台 members 與 role-defs **目前完全是純記憶體資料**，沒有任何 JSON 檔案或其他持久化
（`add-postgres-docker` 的 proposal/design 先前誤寫為「JSON 檔案」，已於該 change 文件訂正）。
具體來說：

- **members**：`server/services/storage.ts` 的 `Storage.account: Record<string, AuthRecord>` 是帳號本體
  （id/name/email/passwordHash），角色指派另外拆成兩個獨立記憶體結構放在
  `server/services/admin/modules/adminAccess.ts`：`adminIds: Set<string>`（後台管理員白名單，字面值
  `'admin'`，**不透過 role-defs 查表**）與 `memberRoleId: Map<userId, roleId>`（一般角色指派，查無則預設
  `'user'`）
- **role-defs**：`server/services/admin/modules/roleDefs.ts` 的 `roles: Map<string, RoleDef>`，種子為 4 筆
  builtin 角色（admin/user/npc/demo）
- 兩者透過字串 id 弱連結（1 個 member : 1 個 roleId，role-def : member 是 1 : N），完整性靠應用層手動
  級聯清理（刪除角色時手動呼叫 `clearRoleAssignments()` + `roleGamePerms.clearRole()`），沒有 DB 層的
  FK constraint
- `Storage.init()` / `hfyyManage.ts` 的 `setStartData()` 只在 server 啟動時跑一次種子資料（2 筆 admin +
  5 筆測試帳號 + 20 筆 NPC 帳號、4 筆 builtin 角色），**重啟 = 全部歸零**，這正是
  `add-postgres-docker` 想解決的核心問題
- `add-postgres-docker`（Phase 1）已規劃好 Docker Compose + 連線層 + 一套「5 分鐘批次同步」的通用
  `SyncSource` 機制，並在 `tasks.md` 把「搬遷 admin members / role-defs」列為下一個獨立 change——也就是
  本次

## 目標

讓 members 與 role-defs 的資料**跨重啟持久化**：記憶體繼續作為 runtime 讀取的來源（避免每個 request
都打 DB），但所有寫入操作**即時**落地到 Postgres；server 啟動時改為**優先從 DB 回填記憶體**，只有在
DB 對應 table 是空的（全新環境）才執行現有的種子邏輯並寫回 DB。

## 範圍

- 包含：
  - `role_defs` / `members` 兩張表的 schema 設計（見 design.md）
  - `adminAccess.ts`（members CRUD）與 `roleDefs.ts`（role-defs CRUD）的寫入路徑改為 **write-through**：
    同一次操作內，記憶體與 DB 同時更新（而非沿用 Phase 1 規劃的 5 分鐘批次 `SyncSource`，理由見
    design.md「決策記錄」）
  - 開機回填邏輯：`hfyyManage.ts` 的 `setStartData()` 改為先查 DB，有資料就回填記憶體、沒資料才跑種子
    並寫回 DB
  - email 唯一性檢查改用 DB `UNIQUE` constraint 取代目前的全表線性掃描
  - 刪除角色的級聯清理（退回 `user` 角色 + 清 `roleGamePerms`）改在單一 DB transaction 內完成，取代
    目前應用層手動串接三個函式呼叫
- 不包含：
  - NPC 專屬欄位（`dailyMaxSpend`/`topUpAmount`/`bgWeight`，目前獨立存在 `npcAutoPlay.ts` 的 Map）——
    本次不動，留待之後視需要另開 change
  - `login_history`（登入紀錄）與 `member_balance_change`（F幣異動彙總）的持久化——這兩份是會持續累積的
    明細資料，屬於不同的持久化/歸檔考量，不在本次「members 本體 + role-defs」範圍內
  - `role_game_perms`（角色遊戲權限開關）本身的持久化——本次只確保「刪除角色時清理它」這個級聯動作
    搬進 transaction，但 `disabledByRole`/`disabledGlobally` 這兩個 Map 本身暫不搬遷到 DB（維持記憶體，
    重啟後退回全部角色預設全開），留待後續視需要另開 change
  - Phase 1 規劃的 5 分鐘批次 `SyncSource` 機制——本次**不套用**在 members/role-defs 上（見下方風險/
    對策），該機制保留給未來真正「高頻寫入、可接受最終一致」的資料（例如遊戲紀錄/配額）使用
  - 多 instance 水平擴展（記憶體在多個 process 之間不會同步）——本次只處理單一 process 的持久化
  - **實際執行任何指令或寫入程式碼**（建表、改 `adminAccess.ts`/`roleDefs.ts`、跑 migration 等）——
    本次僅規劃，待使用者明確要求才進入 Implementation

## 影響面

- 後端 Services（規劃）：`server/services/admin/modules/adminAccess.ts`、
  `server/services/admin/modules/roleDefs.ts`、`server/services/admin/hfyyManage.ts`
- 新增 schema/migration 檔案（規劃，沿用 Phase 1 選定的 ORM 工具）
- 後端 API（無簽名變動）：`server/api/admin/members*`、`server/api/admin/role-defs*`、
  `server/api/admin/roles*` 這些 handler 本身已是 async function，內部呼叫改 `await` 不影響外部介面

## 風險與對策

- 技術風險：
  - 風險：write-through 把原本同步、零延遲的記憶體操作變成含 DB I/O 的 async 操作，若 DB 當下不可用，
    admin 操作會直接失敗（跟 Phase 1「批次同步失敗不影響主流程」的容錯設計方向相反）
  - 對策：這是刻意取捨——members/role-defs 屬於「正確性優先於可用性」的管理操作（新增會員、調整角色
    這類動作一旦發生就該確實落地，而非悄悄只寫記憶體、之後永遠沒機會補寫 DB），跟遊戲高頻計數器那種
    「可接受最終一致、優先不卡主流程」的取捨不同，所以本次不沿用 Phase 1 的批次機制
  - 風險：開機回填邏輯寫錯，可能導致「DB 已有資料卻沒正確讀出，又跑了種子邏輯」造成 id 衝突或資料被覆蓋
  - 對策：種子邏輯改成「僅在 DB 對應 table 為空時才執行一次 INSERT」，用明確的 `COUNT(*)` 查詢判斷，
    不是檢查某個旗標檔案
  - 風險：`adminIds` 白名單（後台權限）與 `role_id = 'admin'`（一般角色目錄項）語意不同，若 schema
    設計時不小心用同一個欄位代表兩件事，會混淆「誰有後台權限」跟「誰的角色標籤是 admin」
  - 對策：`members` table 明確拆成 `role_id`（FK → `role_defs.id`，一般角色，預設 `'user'`）與
    `is_admin`（boolean，獨立欄位，對應現有 `adminIds` Set）兩個正交欄位，不互相覆蓋
  - 風險：刪除角色的級聯清理如果不包在單一 transaction，中途失敗會留下不一致狀態（例如 member 的
    `role_id` 已經退回 `user`，但 `role_defs` 那筆還沒刪成功）
  - 對策：整個刪除流程（退回角色 + 清 `role_game_perms` + 刪 `role_defs`）包在單一 DB transaction，
    要嘛全部成功要嘛全部不生效
- UI/UX 風險：不適用（本次不涉及前端變更；API 回應格式不變）
- 開發體驗風險：
  - 風險：write-through 需要 Phase 1 的 DB 連線層已經可用，本次依賴 `add-postgres-docker` 先決定
    ORM/migration 選型
  - 對策：本次 design.md 沿用 Phase 1 的選型結論，若 Phase 1 尚未定案，本 change 的 Implementation
    階段會被阻擋，但不影響本次規劃內容

## 驗證方式

本次僅規劃、不執行，暫無程式變更可供驗證；待使用者明確要求進入 Implementation 階段後，才會依
Tasks 清單實際建表、改程式碼，並補齊 Validation / Engineering Evidence 文件。

## 成功標準

- [ ] 完成 `role_defs` / `members` schema 設計與 write-through 架構定案（design.md 定稿）
- [ ] 完成可追蹤的 Tasks 清單
- [ ] 使用者明確要求後才進入 Implementation（本次不涉及）
