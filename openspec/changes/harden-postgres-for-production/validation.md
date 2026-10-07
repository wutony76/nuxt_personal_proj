# Validation

## 驗證範圍

- 對應變更：`harden-postgres-for-production`（正式環境上線前的種子資料/密碼/部署安全強化）
- 驗證環境：本機 dev（macOS，Docker Desktop，Postgres 16-alpine，Node 22.22.2），沿用 Phase 1-3
  已建立的連線層與 schema 基礎

## 功能驗證

依 proposal 的「成功標準」逐項驗證：

- [x] 完成環境變數設計與「admin 種子 vs 測試/NPC 種子」的職責切分，含獨立的 `hasExistingAdmin()`
      判斷 — 實際結果：`SEED_DEMO_DATA`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 三個環境變數皆已
      實作並實測生效；`hasExistingAdmin()` 的獨立判斷邏輯已驗證能修正「有會員但沒有 admin」的邊界
      情況
- [x] 完成部署檢查清單文件 — `docs/deployment/postgres-production-checklist.md`，五大項（密碼/
      網路防火牆/備份/監控/開機行為自我檢查）
- [x] 完成可追蹤的 Tasks 清單 — 全數勾選，含一項 Implementation 階段發現並記錄的設計調整
- [x] 使用者明確要求後才進入 Implementation — 使用者於規劃文件更新後明確回覆「這邊幫我直接實作」

## 回歸驗證

- 流程：未設定任何新環境變數時，行為是否與 Phase 2/3 完成時的現狀一致
  - 結果：通過。既有 DB（27 members、4 role_defs，含 2 筆既有 admin）清乾淨重啟，`members`/
    `role_defs` 筆數不變、`hasExistingAdmin()` 判斷為 true、`seedMissingAdmin()` 未被呼叫；
    `npm test`（38 支）執行兩輪，一輪 38/38、一輪遇到既有時序性 flaky（跟本次變更無關）重跑後
    恢復 38/38

## 核心情境驗證

- **全新 DB + `SEED_DEMO_DATA=false` + 自訂 `SEED_ADMIN_EMAIL`/`PASSWORD`**：
  - `TRUNCATE` 後設定 `SEED_DEMO_DATA=false`、`SEED_ADMIN_EMAIL=owner@my-production.example`、
    `SEED_ADMIN_PASSWORD=S3cureProdPass!` 並重啟
  - 結果：`members` 表只有 2 筆（`U0xA000001` 用自訂帳密、`U0xA666666` 維持固定值），**沒有**
    test01~05/NPC 帳號；用自訂帳密成功登入（`POST /api/login` 回傳 200）
  - 附帶觀察：此設定下執行既有 `npm test` 會大量失敗（29/38），因為測試腳本預設用
    `admin@example.com`/`123456` 登入——這是**正確且預期**的行為，證明環境變數覆蓋確實生效，不是
    回歸（測試腳本本來就不是為了「自訂管理帳號」的情境設計，不在本次修改範圍）
- **「有會員但沒有 admin」邊界情況（本次主要修正目標）**：
  - 手動把現有 DB 裡 2 筆既有 admin 的 `is_admin` 都改成 `false`（模擬 admin 被誤改/誤刪的情境），
    保留其餘 27 筆一般會員
  - 重啟後：server log 無錯誤；查詢 DB 確認 `U0xA000001` 的 `is_admin` 被自動補回 `true`；用預設
    帳密（`admin@example.com`/`123456`）成功登入
  - 證明 `hasExistingAdmin()` 的獨立判斷確實修正了原本設計的缺口（原設計下這個情境會導致後台永遠
    進不去）

## 問題與修正紀錄

- 問題：design.md 原本規劃 `seedMissingAdmin(ids: string[])` 直接重用 `Storage.account[id]` 現有
  的記憶體資料，但 `hasExistingDbMembers()` 為 true 的分支會先呼叫 `rehydrateFromDb()`**整個清空
  重建** `Storage.account`，不保證 `U0xA000001` 這個 id 還在記憶體裡
  - 發現方式：Implementation 階段對照程式碼邏輯時發現這個假設不成立（尚未實際跑出錯誤就先發現，
    屬於設計走讀階段抓到的問題）
  - 修正方式：`seedMissingAdmin()` 改為不吃參數、不依賴記憶體現況，直接用
    `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 現場組一筆，對 DB 做 `ON CONFLICT (id) DO UPDATE
    SET is_admin = true` upsert，寫入成功後才回頭補記憶體
  - 是否已重新驗證：是，「有會員但沒有 admin」情境已實測修正生效（見上方核心情境驗證）
- 問題：IDE（tsserver）對 `storage.ts`、`adminAccess.ts` 新增的 `process.env.XXX` 存取回報
  「找不到名稱『process』」的診斷錯誤
  - 發現方式：Edit 工具的 PostToolUse hook 回報診斷訊息
  - 判斷：`server/services/db.ts` 既有的 `process.env.DATABASE_URL` 寫法完全相同、且已經在
    Phase 1-3 大量實測跑過無數次、從未因此出錯，判斷這是 tsserver 對剛編輯檔案的暫時性型別快取
    落後（stale diagnostic），不是真正的編譯/執行錯誤——Nitro 開發伺服器用 esbuild/Vite 轉譯，
    不依賴這份 IDE 診斷做 type-check
  - 是否已重新驗證：是，多輪清乾淨重啟 + 完整測試套件皆正常執行，沒有任何與 `process` 存取相關的
    真實 runtime 錯誤

## 結論

- 是否通過：是
- 已知限制或風險：
  - `seedMissingAdmin()` 固定使用 id `U0xA000001`，若正式環境 DB 裡原本的「正牌」admin 用的是
    別的 id（例如手動建立的自訂 id），而 `U0xA000001` 這個 id 剛好被別的（非 admin）會員佔用，
    upsert 會把那個會員的 `is_admin` 改成 true，而非另外新建一筆——這是刻意的簡化（避免引入
    「找得到就用、找不到就建」的額外分支複雜度），正式環境若真的遇到這個 edge case，建議的處理
    方式是手動透過 DB 或後台介面指定真正要給誰 admin 權限，而不是依賴這個開機自動修復機制
  - `U0xA666666`（HappyFatYoYo 固定展示帳號）不受本次任何環境變數影響，正式環境若不想要這個帳號
    存在，需要手動從 DB 刪除或後續另開 change 處理（已記錄進 tasks.md 第 6 節）
  - 部署檢查清單是文件形式，沒有強制機制防止忘記調整（proposal.md 已记录為接受的風險）
- 後續追蹤事項：
  - 實際在 GCP 部署（VM/docker-compose/環境變數套用）留待使用者明確要求時再進行
  - `U0xA666666` 環境變數化、備份自動化腳本、TLS 設定皆視需求另行規劃
