# Design

> 本變更是部署/環境設定調整，不是前端頁面功能，模板裡的 Layout/Component/Token Mapping 等前端專屬
> 段落不適用，以下僅保留與本次變更相關的段落並改寫內容。

## 1. 現況（程式碼位置）

```
server/services/storage.ts  Storage.init()
  帳號 U0xA000001：email 'admin@example.com'、密碼 '123456'（寫死字面值）
  帳號 U0xA666666：email 'hfyy@cc.cc'、密碼 '123456'（寫死字面值）
  → encodePasswordBcjs(encodePassword(密碼, email)) 雜湊後存進 Storage.account

server/services/admin/hfyyManage.ts  setStartData()
  1. chatSchedule 種子（跟本次無關，不動）
  2. roleDefs.rehydrateOrSeed()（Phase 2，DB 為空才種子 4 筆 builtin 角色，跟本次無關，不動）
  3. hasExistingDbMembers() 為 false 時：
     a. for test01~test05：this.access.createMember(...)       ← 本次要加開關的地方
     b. for 20 次：this.npcAutoPlay.autoCreateMember()          ← 本次要加開關的地方
     c. this.access.seedBootAdminsToDb([SEED_ADMIN_ID, 'U0xA666666'])（把上面 storage.ts 建立的
        2 筆 admin 補寫進 DB）——**只在 `hasExistingDbMembers()` 為 false 這個分支裡才會執行**
```

兩個帳號种子（admin）與測試/NPC種子目前是**同一個 `else` 分支裡的連續程式碼**，沒有獨立開關。

**現況有一個缺口（本次一併修正，使用者明確要求）**：admin 帳號的建立完全綁死在
「`hasExistingDbMembers()` 為 false」這個分支下——換句話說，只要 DB 裡已經有**任何一筆** member
（哪怕只是測試帳號、或未來手動匯入的一般會員，完全沒有 admin），開機就會直接走
`rehydrateFromDb()`、永遠不會檢查「有沒有 admin」這件事、更不會補建。正式環境萬一發生這種邊界情況
（例如 admin 帳號被誤刪、或資料庫是從別處只搬了部分會員過來），會導致**完全沒有人能登入後台**。
本次改成「admin 是否存在」獨立判斷，不依附在 `hasExistingDbMembers()` 底下。

## 2. 環境變數設計

```
SEED_DEMO_DATA=true|false   預設 true（向下相容，本機開發不用額外設定）
  - true（或未設定）：維持現狀，跑 test01~05 + 20 筆 NPC 種子
  - false：完全跳過 test01~05 與 NPC 種子迴圈（正式環境建議設定）

SEED_ADMIN_EMAIL=<email>     未設定時 fallback 回 'admin@example.com'
SEED_ADMIN_PASSWORD=<明碼>   未設定時 fallback 回 '123456'
```

**刻意不加 `SEED_ADMIN2_EMAIL`/`SEED_ADMIN2_PASSWORD` 給第二筆種子帳號（`U0xA666666`
/`hfyy@cc.cc`）**：這筆帳號（顯示名稱 `HappyFatYoYo`）是作品集展示用的固定角色帳號，語意上比較像
「這個作品集的作者帳號」而非「操作用的管理帳號」，維持寫死；正式環境真正要用的管理帳號走
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 這組即可。若之後使用者覺得連這筆也要環境變數化，
屬於後續可以再追加的小調整，不影響本次架構。

## 3. `storage.ts` 調整

```ts
// Storage.init() 內
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const adminPassword = process.env.SEED_ADMIN_PASSWORD || '123456'

this.account = {
  U0xA000001: {
    id: 'U0xA000001',
    name: 'Admin',
    email: adminEmail,
    passwordHash: encodePasswordBcjs(encodePassword(adminPassword, adminEmail))
  },
  U0xA666666: { /* 不變 */ }
}
```

`encodePassword()`/`encodePasswordBcjs()` 的雙重雜湊慣例不變，只是輸入來源從字面值改成環境變數
（有設定才覆蓋，語意上是「明碼只存在於部署當下的環境變數，雜湊後才落地」，符合既有
`feedback`/`fix(auth)` 那次雜湊修正的精神）。

## 4. `hfyyManage.ts` 調整：admin 判斷獨立出來，不再依附 `hasExistingDbMembers()`

```ts
// setStartData()（調整後的整體流程）
await this.roleDefs.rehydrateOrSeed()

const hasExistingMembers = await this.access.hasExistingDbMembers()
if (hasExistingMembers) {
  await this.access.rehydrateFromDb()
} else {
  const seedDemoData = process.env.SEED_DEMO_DATA !== 'false'   // 預設 true
  if (seedDemoData) {
    for (const n of ['01', '02', '03', '04', '05']) { /* 不變 */ }
    for (let i = 0; i < 20; i++) { /* 不變 */ }
  }
}

// ↓ 本次新增：不管上面走哪個分支，都獨立再檢查一次「DB 裡有沒有 admin」
const hasAdmin = await this.access.hasExistingAdmin()
if (!hasAdmin) {
  await this.access.seedMissingAdmin([SEED_ADMIN_ID, 'U0xA666666'])
}
```

`adminAccessService` 新增兩個方法（取代原本直接呼叫的 `seedBootAdminsToDb()`，命名與語意都更貼近
「這是在補一個缺口」而不是「開機固定動作」）：

```ts
/** DB 裡是否已經存在至少一筆 is_admin = true 的 member（跟「有沒有任何 member」是兩件事）。 */
hasExistingAdmin: async (): Promise<boolean> => {
  if (!isDbEnabled()) return false
  const rows = await getDb().select({ id: membersTable.id })
    .from(membersTable).where(eq(membersTable.isAdmin, true)).limit(1)
  return rows.length > 0
}

/**
 * 只在「DB 裡完全沒有 admin」時才會被呼叫（見 setStartData()）。把 Storage.init() 已經直接建立、
 * 讀了 SEED_ADMIN_EMAIL/PASSWORD 的那幾筆種子 admin 帳號寫進 DB；若這幾個 id 在 DB 裡其實已經
 * 存在（例如先前 hasExistingMembers 分支已經 rehydrate 過、只是剛好不是 admin），改用 UPDATE
 * 把對應列的 is_admin 補成 true，而不是硬 INSERT 撞 primary key。
 */
seedMissingAdmin: async (ids: string[]): Promise<void> => { /* ... */ }
```

**行為對照（跟 Phase 2 既有邏輯合併後的完整矩陣）：**

| DB 現況 | `hasExistingMembers` | `hasExistingAdmin` | 實際行為 |
| --- | --- | --- | --- |
| 全新空 DB | false | false | 跑 test/npc 種子（視 `SEED_DEMO_DATA`）→ 補建 admin |
| 已有會員、其中有 admin | true | true | `rehydrateFromDb()` 讀回全部，admin 判斷為 true，不動 |
| 已有會員、但沒有 admin（本次要修的缺口） | true | false | `rehydrateFromDb()` 讀回全部 → 另外補建 admin |
| 只曾經種過 admin、沒有其他會員 | true | true | 同第二列，正常 |

這個表格裡第三列就是使用者這次明確要求補上的情境：「先看看有沒有 admin 的資料，有的話預設不新增，
沒有才直接跑種子流程」——`hasExistingAdmin()` 的判斷永遠獨立執行一次，不管前面 `hasExistingMembers`
走的是哪一分支。

## 5. `.env.example` 補充

```bash
# 正式環境上線前請務必調整下列變數（見 openspec/changes/harden-postgres-for-production/）：
# - POSTGRES_PASSWORD：換成正式密碼，不要用這份範例值
# - SEED_DEMO_DATA=false：正式環境不要自動產生測試帳號/NPC假會員
# - SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD：換成正式管理帳號，不要用預設的 admin@example.com/123456
SEED_DEMO_DATA=true
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=123456
```

## 6. 正式環境部署檢查清單（文件大綱，實際內容於 Implementation 階段撰寫）

規劃放在 `docs/deployment/postgres-production-checklist.md`（沿用專案 `docs/` 既有文件慣例）：

1. **密碼與帳號**
   - [ ] `POSTGRES_PASSWORD` 已更換，非範例值
   - [ ] `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 已設定為正式管理帳號
   - [ ] `SEED_DEMO_DATA=false`
   - [ ] 首次開機後，用正式管理帳號登入確認可用，再視需要自行調整密碼（`setPassword` API）
2. **網路/防火牆**
   - [ ] `docker-compose.yml` 的 `ports` 不對外網開放（移除 `5432:5432` 的公開綁定，改用
     Docker network 內部連線，或至少用雲端防火牆規則限制來源 IP）
   - [ ] 應用程式與 Postgres 在同一台 VM／同一個私有網路內
3. **備份**
   - [ ] 排程 `pg_dump` 定期備份（建議每日一次），輸出上傳到 Cloud Storage 或等效物件儲存
   - [ ] 備份保留天數策略（例如保留最近 30 天）
   - [ ] 至少手動演練過一次「從備份還原」，確認備份真的可用
4. **監控（最小）**
   - [ ] 確認 `docker compose ps` 的 healthcheck 狀態可被觀察到（例如排進既有監控或至少文件化手動
     檢查方式）

## 7. 測試與驗證策略（規劃用，待 Implementation 階段才執行）

- 單元/整合測試：
  - `SEED_DEMO_DATA=false` 時，`setStartData()` 不建立 test01~05/NPC 帳號，但 2 筆 admin 帳號仍
    正確寫入 DB 且可登入
  - `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` 有設定時，種子 admin 帳號確實用這組帳密可以登入
    （而非預設值）
  - 兩個環境變數都未設定時，行為與現狀完全一致（向下相容驗證）
  - **`hasExistingAdmin()` 四種情境矩陣**（見第 4 節表格）都要各自驗證一次，尤其是「已有會員但
    沒有 admin」這個新修正的缺口：手動在 DB 塞一筆非 admin 的 member、不存在任何 admin 列，重啟後
    確認系統會補建一筆 admin，而不是維持「完全沒有 admin 可登入」的狀態
- 手動測試案例：
  - 全新 DB + `SEED_DEMO_DATA=false` + 自訂 `SEED_ADMIN_EMAIL`/`PASSWORD`：開機後確認 `members`
    表只有 2 筆（`U0xA000001` 用自訂帳密、`U0xA666666` 維持固定值，兩者皆不受 `SEED_DEMO_DATA`
    影響），且能用自訂帳密登入 `U0xA000001`
  - 既有 `npm test`（含 `test:roles`）在未設定這些新環境變數時全數通過，確認無回歸
- 回歸風險與檢查點：
  - 確認本機開發（不設定任何新環境變數）行為與 Phase 2/3 完成時完全一致
