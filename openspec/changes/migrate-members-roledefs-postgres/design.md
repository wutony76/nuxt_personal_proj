# Design

> 本變更是資料持久化/後端架構調整，不是前端頁面功能，模板裡的 Layout/Component/Token Mapping 等
> 前端專屬段落不適用，以下僅保留與本次變更相關的段落並改寫內容。

## 1. 現況（調查結果，修正 Phase 1 文件先前的錯誤描述）

```
server/services/storage.ts
  Storage.account: Record<string, AuthRecord>        // members 本體：id/name/email/passwordHash

server/services/admin/modules/adminAccess.ts
  adminIds: Set<string>                                // 後台權限白名單（字面值 'admin'，不查 role-defs）
  memberRoleId: Map<userId, roleId>                    // 一般角色指派，查無則預設 'user'

server/services/admin/modules/roleDefs.ts
  roles: Map<string, RoleDef>                          // 4 筆 builtin 種子：admin/user/npc/demo

server/services/admin/modules/roleGamePerms.ts
  disabledByRole: Map<roleId, Set<compositeKey>>       // 角色可玩遊戲開關（本次不搬遷本體，見範圍）
  disabledGlobally: Set<compositeKey>
```

全部是純記憶體，**沒有** JSON 檔案（先前 `add-postgres-docker` 文件誤寫，已訂正）。`hfyyManage.ts` 的
`setStartData()` 只在 `Storage.init()` 跑一次：建立 2 筆 admin + 5 筆測試帳號 + 20 筆 NPC 帳號、
4 筆 builtin 角色。重啟 ⇒ 全部歸零，靠這份種子邏輯重建（代表每次重啟都會失去後台手動新增的會員/角色/
角色指派異動）。

關聯模型：1 個 member 對應 1 個 `roleId`（弱連結，純字串，無 FK），1 個 role-def 可被 0～N 個 member
指向。刪除角色時靠應用層手動呼叫三個函式做級聯清理（`clearRoleAssignments()` + `roleGamePerms.clearRole()`
+ `roles.delete(id)`），沒有資料庫層的保證。

## 2. 決策記錄：為什麼 members/role-defs 採 write-through，不沿用 Phase 1 的批次 SyncSource

`add-postgres-docker` 規劃的「5 分鐘批次同步」設計目標是：**不碰既有同步業務邏輯**、用最小改動讓高頻、
可接受最終一致的資料（例如遊戲紀錄、配額計數器）定期落地。但 members/role-defs 有不同的特性：

| 面向 | 遊戲紀錄/配額（Phase 1 原設計對象） | members/role-defs（本次） |
| --- | --- | --- |
| 寫入頻率 | 高頻（每次下注/開獎） | 低頻（只有 admin 手動操作時才寫） |
| 遺失 5 分鐘資料的後果 | 可接受（本來就是統計/配額快照，下一輪會更新） | 不可接受（admin 新增會員、刪除角色是一次性操作，遺失就是真的沒了） |
| 正確性要求 | 最終一致即可 | 需要立即生效 + 唯一性/級聯刪除要有交易保證 |
| 對「主流程」的影響 | 同步失敗不該卡住遊戲 tick | admin 操作本身就是這次請求的主流程，DB 寫入失敗應該讓這次操作失敗並回報 |

因此本次**不**幫 members/role-defs 實作 Phase 1 定義的 `SyncSource` 介面去掛進批次排程，改採
**write-through**：每次 mutation（`createMember`/`setRole`/`setEmail`/`adjustCoin` 之於 members；
`create`/`updateSettings`/`remove` 之於 role-defs）在同一次 request 內，記憶體更新與 DB 寫入一起完成，
DB 寫入失敗就讓這次 API 呼叫回傳錯誤（記憶體也不套用這次變更，維持前後一致）。

Phase 1 的批次 `SyncSource` 機制保留給未來真正符合其設計前提的資料（遊戲紀錄、配額）使用，兩者並存、
各自適用不同場景，不互相取代。

## 3. Schema 設計

```sql
CREATE TABLE role_defs (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  builtin                   BOOLEAN NOT NULL DEFAULT false,
  test_mode                 BOOLEAN NOT NULL DEFAULT false,
  npc_mode                  BOOLEAN NOT NULL DEFAULT false,
  demo_mode                 BOOLEAN NOT NULL DEFAULT false,
  daily_coin_reward_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_coin_reward_amount  INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role_id        TEXT NOT NULL DEFAULT 'user' REFERENCES role_defs(id) ON DELETE SET DEFAULT,
  is_admin       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `role_id` 與 `is_admin` **正交**：`is_admin` 對應現有 `adminIds` 白名單語意（決定後台權限），
  `role_id` 對應現有 `memberRoleId`/預設 `user` 的一般角色標籤（決定遊戲端行為、demo 唯讀模式等）。
  兩者目前在記憶體裡是完全獨立判斷（`roleOf()` 先查 `adminIds`，不查 role-defs），schema 延續這個
  獨立性，不把 `is_admin` 塞進 `role_id = 'admin'` 這種隱含語意裡
- `email` 用 `UNIQUE` constraint 取代目前 `_assertEmailAvailable()` 的全表線性掃描；write-through
  寫入時若違反 unique，DB 直接回傳 constraint violation，應用層轉成現有的「email 已被使用」錯誤訊息
- `role_defs.id` 用 `ON DELETE SET DEFAULT` 搭配 `role_id` 的 `DEFAULT 'user'`：刪除角色時，原本指向
  它的 members 自動退回 `'user'`，取代現有 `clearRoleAssignments()` 的應用層手動掃描
- 不建 `role_game_perms` 表（見 proposal.md 範圍）；若未來要搬遷，可在刪除角色的同一個 transaction 裡
  一併加上 `DELETE FROM role_game_perms WHERE role_id = $1`

## 4. Write-through 架構

```
API handler（server/api/admin/role-defs/[id].delete.ts 等，既有 async function，簽名不變）
  → adminAccessService / roleDefsService 的方法改為 async
      1. 先做現有的記憶體前置檢查（唯一 admin 防呆、自我降級防呆、email 格式等，純邏輯不變）
      2. 開一個 DB transaction，執行對應的 SQL（INSERT/UPDATE/DELETE）
      3. transaction 成功 → 更新記憶體 Map/Set/Record（跟現有程式碼相同的 mutation，只是往後移到
         DB 寫入成功之後才做）
      4. transaction 失敗 → 不更新記憶體，直接把錯誤往上拋，API 回傳失敗
```

這個順序（先 DB、後記憶體）保證記憶體永遠不會領先 DB——如果 server 在「DB 寫入成功」與「記憶體更新」
之間 crash，下次啟動會從 DB 回填出正確狀態，不會有「記憶體有、DB 沒有」的不一致。

### 刪除角色的交易邊界

```sql
BEGIN;
  UPDATE members SET role_id = 'user' WHERE role_id = $1;   -- 由 FK ON DELETE SET DEFAULT 自動處理，
                                                              -- 這行其實可以省略，交給 DELETE 觸發
  DELETE FROM role_defs WHERE id = $1;
COMMIT;
```

搭配 schema 的 `ON DELETE SET DEFAULT`，`DELETE FROM role_defs WHERE id = $1` 一個敘述就能讓 DB 自動
完成「退回受影響 members 的角色」，應用層不再需要手動呼叫 `clearRoleAssignments()`。`roleGamePerms.clearRole(id)`
因為 `role_game_perms` 本次不搬遷到 DB，繼續維持現有的記憶體呼叫（在同一個 async 函式裡，DB transaction
commit 成功之後執行）。

## 5. 開機回填設計（解決「重啟全歸零」的關鍵）

這是本次新增、Phase 1 明確排除延後的部分（Phase 1 design.md 8.7 節：「留待實際有 SyncSource 落地時再
評估」——本次就是這個時機，但走的是 write-through 而非批次 `SyncSource`，回填邏輯也相應簡化）：

```
hfyyManage.ts: setStartData()（規劃調整後的流程）
  1. SELECT COUNT(*) FROM role_defs
     - 0 筆（全新環境）→ 執行現有的 4 筆 builtin 角色種子邏輯，INSERT 進 DB，同時寫入記憶體 Map
     - > 0 筆（已有資料）→ SELECT * FROM role_defs，用查詢結果重建記憶體 Map，**不**執行種子邏輯
  2. SELECT COUNT(*) FROM members
     - 0 筆 → 執行現有的 2 admin + 5 test + 20 npc 種子邏輯，INSERT 進 DB，同時寫入記憶體
     - > 0 筆 → SELECT * FROM members，用查詢結果重建 Storage.account / adminIds / memberRoleId，
       **不**執行種子邏輯
```

用 `COUNT(*)` 而非某個旗標檔案或環境變數判斷「是否為全新環境」，避免額外的狀態來源；且兩個判斷各自
獨立（role_defs 與 members 分開判斷），因為兩者在「全新環境」下的因果順序是 role_defs 要先建好，
members 的 `role_id` 外鍵才有對象可以指。

若 `DATABASE_URL` 未設定（沿用 Phase 1「DB 選用」的設計），本次開機回填整段略過，完全退回現有的
純記憶體 + 每次重啟都跑種子邏輯的行為——不強制要求本機開發一定要有 Postgres 才能跑。

## 6. 與 Phase 1 基礎設施的關係

- 沿用 Phase 1 的 `server/services/db.ts` 連線層與 ORM/migration 選型（本次不重新選型）
- 不使用 Phase 1 的 `SyncScheduler`/`SyncSource`/5 分鐘 timer（見第 2 節決策記錄）
- `docker-compose.yml`、`.env.example` 沿用 Phase 1 規劃的既有內容，本次不需新增

## 7. 測試與驗證策略（規劃用，待 Implementation 階段才執行）

- 單元/整合測試：
  - `adminAccessService.createMember()` / `setRole()` / `setEmail()` 等方法補上「DB 寫入失敗時記憶體
    不被更新」的測試案例
  - email 重複時，DB unique constraint 觸發的錯誤能正確轉換成現有的錯誤訊息格式（前端行為不變）
- 手動測試案例：
  - 全新 DB（`docker compose up` 後第一次啟動）：確認種子資料被正確寫入 `role_defs`/`members`，記憶體
    與現有行為一致
  - 重啟 server（DB 已有資料）：確認記憶體從 DB 回填、**不會**重新跑種子邏輯（用 DB 裡手動新增過的
    測試角色驗證重啟後還在，且不會變成兩份）
  - 刪除角色：確認原本指向該角色的 members 退回 `user`，且 `role_defs` 那筆確實消失，驗證 transaction
    的原子性（可用一筆刻意失敗的操作測試，確認沒有半套狀態）
  - 斷開 DB 連線後嘗試新增會員：確認 API 回傳錯誤，而不是悄悄只更新記憶體
- 回歸風險與檢查點：
  - 確認 `DATABASE_URL` 未設定時，所有既有 `npm test`（含 `test:roles`）行為與現在完全一致
  - 確認既有前端 `app/services/api.ts` 的型別與回應格式不受影響（本次不改 API 回應格式，只改底層儲存）
