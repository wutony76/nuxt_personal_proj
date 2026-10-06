# Validation

## 驗證範圍

- 對應變更：`migrate-members-roledefs-postgres`（Phase 2：members/role-defs write-through + 開機回填）
- 驗證環境：本機 dev（macOS，Docker Desktop 29.1.3，Postgres 16-alpine，Node 22.22.2），沿用
  `add-postgres-docker`（Phase 1）已建立的 docker-compose/連線層

## 功能驗證

依 proposal 的「成功標準」逐項驗證：

- [x] 完成 `role_defs` / `members` schema 設計與 write-through 架構定案 — 實際結果：`drizzle-kit
      generate` 產出的 migration SQL 與 design.md 第 3 節規劃完全一致（FK、UNIQUE、`ON DELETE SET
      DEFAULT` 皆正確），已實際 `drizzle-kit migrate` 套用到本機 Postgres
- [x] 完成可追蹤的 Tasks 清單 — 實際結果：`tasks.md` 全數勾選，含一處 Implementation 階段的設計調整
      （保留 `_assertEmailAvailable()` 而非移除）與一項新發現的後續追蹤項目（見下方問題紀錄）
- [x] 使用者明確要求後才進入 Implementation — 實際結果：使用者在 Phase 1 驗證完成後明確回覆「好的」
      確認繼續 Phase 2

## 回歸驗證

- 流程：DB 未啟用（`.env` 移除）時，write-through 的 7 個方法（`createMember`/`setPassword`/
  `setEmail`/`setRole`/`roleDefs.create`/`remove`/`updateSettings`）是否與遷移前行為一致
  - 結果：通過。暫時移除 `.env` 重啟，server log 顯示
    `SKIP ---BASE>sync.scheduler（DATABASE_URL 未設定，維持純記憶體模式）`，`npm test`（38 支）
    跑兩輪，一輪 37/38（既有 flaky，詳見下方）、重跑後 38/38
- 流程：DB 啟用時，既有功能是否受影響
  - 結果：通過。`test:roles`（RBAC 端到端，34 項斷言）與 `test:chat`（24 項斷言）各自連續執行 3 輪，
    每輪皆 100% 通過，沒有一次受本次變更影響

## Write-through / 開機回填驗證

- **全新 DB 種子**：`TRUNCATE members, role_defs` 後乾淨重啟，確認：
  - `role_defs` 寫入 4 筆 builtin 角色、`members` 寫入 27 筆（2 admin + 5 test + 20 npc），皆與現有
    記憶體種子內容一致
  - 過程中發現並修正一個 bug：`seedBootAdminsToDb()` 原本讀取「目前記憶體裡的全部帳號」重新 INSERT，
    與已經透過 `createMember()` write-through 寫入的 25 筆 test/npc 帳號重複，觸發
    `duplicate key value violates unique constraint "members_pkey"`；修正為接受明確的 id 清單
    （只補寫 `Storage.init()` 直接建立、未經過 `createMember()` 的 2 筆種子 admin）
- **既有資料回填**：透過 API 建立一個自訂角色（`qa-持久化測試角色`）後重啟，確認：
  - 角色清單（`GET /api/admin/role-defs`）重啟後仍包含該自訂角色（`['admin','user','npc','demo',
    'qa-持久化測試角色']`）
  - members 數量維持 27（不是 54），證明種子迴圈被正確跳過、不是又跑了一次
- **刪除角色的交易邊界**：刪除上述自訂角色，確認 DB `role_defs` 筆數從 5 降回 4，API 回傳
  `{ ok: true }`
- **DB 斷線時的 write-through 失敗行為**：`docker compose stop postgres` 後呼叫
  `POST /api/admin/members`，確認：
  - API 回傳 500（DB 查詢失敗的原始錯誤訊息，非靜默成功）
  - 事後查詢會員清單，確認該筆資料**沒有**洩漏進記憶體（`leaked = false`）
  - `docker compose start postgres` 恢復後，後續操作與既有 `npm test` 皆恢復正常

## 問題與修正紀錄

- 問題：`seedBootAdminsToDb()` 在全新 DB 情境下觸發 primary key 衝突
  - 發現方式：乾淨重啟後 server log 出現 `[unhandledRejection] Failed query: insert into "members"...
    duplicate key value violates unique constraint "members_pkey"`
  - 修正方式：函式簽名改為 `seedBootAdminsToDb(ids: string[])`，呼叫端明確傳入
    `[SEED_ADMIN_ID, 'U0xA666666']` 這兩個已知的 bootstrap admin id，而非讀取當下整個
    `Storage.account`
  - 是否已重新驗證：是，修正後乾淨重啟（`TRUNCATE` 後）無錯誤，27 筆 members 正確寫入且無重複
- 問題（新發現，非本次程式邏輯錯誤，是持久化帶來的既有測試腳本副作用）：`test-roles.mjs` 每次執行都
  會透過 `POST /api/admin/members` 建立一個帶時間戳記的臨時 QA 會員（`qa-role-test-<timestamp>
  @test.cc`），過去純記憶體時代重啟即消失、無害；現在會**永久寫入 Postgres**，多次測試後會在
  `members` 表累積殘留資料
  - 發現方式：驗證過程中多次執行 `npm test`／`test:roles` 後，手動查詢 DB 發現
    `email like 'qa-%'` 的筆數隨執行次數增加
  - 修正方式：本次僅手動用 SQL 清除殘留資料（`DELETE FROM members WHERE email LIKE 'qa-%'`），
    **未修改測試腳本本身**——後台目前完全沒有「刪除會員」的 API/UI（遷移前這個能力就不存在，不是
    本次移除的），不屬於本次 write-through/開機回填的範圍，已記錄進 tasks.md 第 7 節留待後續決定
  - 是否已重新驗證：是，清理後 `npm test` 確認 members 數量回到預期的 27 筆基準
- 問題：既有測試套件在本次驗證過程中同樣出現與 `add-postgres-docker`（Phase 1）驗證時一致的低機率
  時序性 flaky（單次跑 38 支中 1～4 支暫時性失敗，重跑即恢復 100% 通過），且失敗的測試每次不盡相同、
  與 members/role-defs 無關
  - 發現方式：`npm test` 多次執行，偶發非 0 失敗數
  - 修正方式：重跑確認皆能恢復 38/38；特別針對 `test:roles`/`test:chat`（與本次變更直接相關的兩支）
    各自連續執行 3 輪，皆 100% 穩定通過，判定本次變更本身沒有引入新的不穩定性
  - 是否已重新驗證：是

## 結論

- 是否通過：是
- 已知限制或風險：
  - `test-roles.mjs` 的臨時 QA 會員沒有清理機制，持久化後會在 `members` 表累積殘留（見上方問題紀錄，
    已列入 tasks.md 第 7 節追蹤）
  - DB 寫入失敗時，API 直接把原始 SQL 錯誤訊息（含參數）回傳給前端（dev 模式下 Nitro 預設行為），
    正式環境下 Nitro 預設會抑制詳細錯誤堆疊，但建議之後針對 DB 層錯誤額外包一層更友善的錯誤訊息轉換
  - 既有測試套件的低機率時序性 flaky（與 Phase 1 驗證時發現的是同一個既有問題）仍未解決根因
- 後續追蹤事項：
  - Phase 3（`migrate-game-history-postgres`）待使用者明確要求後進入 Implementation
  - member 刪除能力的後續決定（見上方問題紀錄）
