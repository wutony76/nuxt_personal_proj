## Context

[[add-dynamic-roles]] 建立了 `roleDefsService`（角色清單）與 `RoleList.vue`（左列表右「資訊／新增」分頁）。
「資訊」分頁目前只顯示角色 id／類型／說明文字。這次要在自訂角色的「資訊」分頁補上可玩項目的開關選單，
並讓關閉的項目在前台真的進不去。

範圍涵蓋「遊戲管理」既有的兩個分類（見 `GameNav.vue` 的 SUBNAV）：

- **BG 彩票**：15 個盤口項目，權威清單是 `app/config/constants.js` 的 `LOTTERY` 全部 key（不過濾
  `sub`）——`LHC-CD`／`LHC-OF`／`K3-CD`／`K3-OF`／`PK10-CD`／`PK10-OF`／`SSC-CD`／`SSC-OF`／
  `X5-CD`／`X5-OF`／`EGGS`／`KL10`／`KL8`／`FC3D`／`PL3`。這份設定檔本來就同時被 server
  （`~/config/constants` alias）與前端 import，不用另外複製一份
- **遊戲中心**：26 款小遊戲，權威清單是 `Storage.retroGames.instances`（`server/services/storage.ts`）
- **彩運來**（Taiwan Lottery）：本次保留分類欄位、不實作清單與開關（見 proposal Out of Scope）

BG 彩票權限**分盤口（CD／OF 各自獨立開關）**，不是玩法層級——例如可以只關 `LHC-CD`、留著
`LHC-OF` 開放。雖然 CD／OF 兩個盤口在下注、彩池、報表上共用同一份開獎號（見
`server/services/game/lottery/bg/*Shared.ts`），但那是「資料」共用，跟「這個角色能不能進這個
盤口」的權限判斷是兩回事，選擇跟著前台頁面粒度（一個盤口一個路由）走，管理員操作時也比較直覺——
後台介面上看到的就是實際的頁面清單。只有信用盤或只有官方盤的玩法（`EGGS`／`KL10`／`KL8`／
`FC3D`／`PL3`）本來就只有一個 key，行為不變。

## Goals / Non-Goals

**Goals:**

- 自訂角色可個別開關「BG 彩票」15 個盤口（CD／OF 各自獨立）與「遊戲中心」26 款小遊戲，預設全開
- 後台「資訊」分頁分兩區塊即時查詢／切換，內建角色不顯示此選單（維持全開、不可調整）
- 前台強制生效：頁面導向與對應 API 兩層都擋，避免只擋 UI 入口被繞過
- 資料結構與共用設定檔用「分類（category）」欄位設計，讓「彩運來」日後能直接掛進同一份清單，
  不用重新設計儲存格式

**Non-Goals:**

- 不做內建角色的權限限制
- 不實作「彩運來」分類的清單、開關與強制生效（僅保留欄位）
- 不做大廳頁面的視覺標示（灰階、鎖頭），只做導向攔截
- 不持久化到檔案／DB，沿用 in-memory、重啟回種子（此處種子＝「無記錄＝全開」）的專案慣例

## Decisions

### 1. 資料結構：分類＋key 的複合識別，只記錄「被關閉」的項目

`roleGamePermsService` 內部維護 `Map<roleId, Set<string>>`，Set 存的是 `` `${category}:${key}` ``
複合字串（例如 `bg:K3`、`retro:pacman`），值是該角色**被關閉**的項目。

- 好處 1：新角色不需要任何初始化動作就是「全開」（map 裡沒有該 roleId＝全部沒關）
- 好處 2：`category` 前綴讓 `bg` 與 `retro` 的 key 命名空間互不衝突（兩邊剛好目前也不重複，
  但未來加入 `taiwan` 分類後不用擔心撞 key），也讓「彩運來」日後只要多一個 `category` 值即可掛入
  同一個 Map，不用改資料結構
- `isEnabled(roleId, category, key)`：內建角色一律 `true`；自訂角色查
  `!disabledSet.has(`${category}:${key}`)`
- `toggle(roleId, category, key, enabled)`：`enabled === false` 時 `add`，`true` 時 `delete`

### 2. 清單來源：直接讀既有權威設定，不新增第二份

- `bg`：`app/config/constants.js` 的 `LOTTERY`，但取法跟 `GET_CONT.lotteryAll()` 相反——後者過濾掉
  `sub`（只留「玩法本身」10 筆，給大廳分組用），這裡反過來**只留有對應實際頁面的 15 筆**：
  五組雙盤口玩法取各自的 `-CD`／`-OF`（`LHC-CD`／`LHC-OF`／`K3-CD`／`K3-OF`／`PK10-CD`／`PK10-OF`／
  `SSC-CD`／`SSC-OF`／`X5-CD`／`X5-OF`，共 10 筆），單盤口玩法（`EGGS`／`KL10`／`KL8`／`FC3D`／`PL3`，
  本來就沒有 `sub`）直接採用（5 筆）；`LOTTERY` 裡另外 5 筆沒有 `sub` 的「玩法本身」占位 key
  （`6HC`／`K3`／`PK10`／`SSC`／`X5`，只給大廳分組用、沒有對應頁面）要排除，不能誤當成第 16-20 筆
- `retro`：`Storage.retroGames.instances`（`server/services/storage.ts`，已存在）
- `GET /api/admin/games` 把兩者映射成統一格式 `{category, key, name}[]` 回傳，避免另建一份會跟
  既有清單漂移的複本

### 3. Slug ↔ Key 對照：新增 `shared/config/gameSlugs.js`，一份涵蓋兩分類

前台路由 slug 跟後端 key 的拼法不一致，且兩個分類都有這問題：

- 遊戲中心：`RetroGameKey`（如 `pacman`、`whackAMole`）vs 路由 slug（如 `pac-man`、`whack-a-mole`）
- BG 彩票：盤口 key（如 `LHC-CD`、`X5-OF`、`EGGS`）vs 路由 slug（如 `6hc-cd`、`11x5-of`、
  `egg`〔注意不是 `eggs`〕）——由於權限已經是盤口層級（Decision 1），這裡是單純的 1 對 1 對照，
  不用處理一個 key 對多個 slug 的狀況

新增 `shared/config/gameSlugs.js`（純 JS、無 import，比照 `shared/config/plays.js` 慣例，見
`project.md` 的 Nitro shared 限制），內容是 `{ category, slug, key }[]` 陣列（每筆 1 對 1）。
給以下三處共用：

- `app/middleware/game-access.global.ts`（前台路由攔截，兩分類都查這份表）
- `server/middleware/auth.ts` 與 `server/api/lottery/bet.post.ts`（API 層攔截）
- `app/composables/useGameAccess.ts`（比對目前路由對應的 category/key）

保留給未來 `taiwan` 分類直接在同一個陣列多加幾筆，不用另開檔案。

### 4. 前台攔截：全域 middleware＋單一會員自查 API，依路徑前綴分流兩分類

- `app/middleware/game-access.global.ts`：
  - 路徑符合 `/game/:slug` → 用 `gameSlugs` 查 `category: 'retro'` 的 key
  - 路徑符合 `/lottery/bg/:slug`（含 `6hc-cd` 底下的巢狀頁，例如 `/lottery/bg/6hc-cd/xxx`，用
    `startsWith('/lottery/bg/6hc-cd')` 而非精準比對）→ 查 `category: 'bg'` 的 key
  - 其餘路徑直接放行
  - 命中被關閉項目 → `retro` 導回 `/game-hall`；`bg` 導回 BG 彩票大廳（沿用現有大廳路由）
- 選擇「全域 middleware + 內部路徑判斷」而非替每個遊戲/玩法頁面各自加
  `definePageMeta({ middleware: 'game-access' })`：新增遊戲或玩法頁面時不會忘記加、也不會漏改
- `useGameAccess()` 呼叫 `GET /api/games/access`（需登入；middleware 對未登入訪客直接放行，
  訪客與內建角色現況不變，一律可玩）；結果比照 `useRoleDefs()` 用單例 reactive 快取
- **middleware 只在 client 端執行**（`if (import.meta.server) return`）：全站既有的登入檢查慣例
  （各 `lottery/bg/*.vue` 頁面「先 `await useAuth().init()` 確認登入狀態」）都刻意只寫在
  `onMounted`，因為 SSR 這裡用的是裸 `$fetch`，不會自動帶上瀏覽器目前的 session cookie——
  在 middleware 裡實測發現：SSR 端呼叫 `GET /api/games/access` 一律被判定成訪客（拿到空的
  disabled 清單），導致 SSR 完全攔不住，只有 client 重新執行一次才抓得到真正的 session。
  拆成「SSR 放行、client 攔截」後，關閉項目的頁面在**第一次整頁載入**時會有短暫的 hydration
  mismatch（SSR 吐出原頁面 markup，client 決定改導向大廳），純屬 console 警告、不影響功能，
  真正的安全邊界仍在 Decision 5 的後端關卡；SPA 內部導覽（點連結切頁）則不受影響，
  因為那些導覽本來就是純 client-side 路由，不會經過 SSR

### 5. API 層防線：兩個攔截點，形狀不同

- **遊戲中心**：`server/middleware/auth.ts` 既有 `PROTECTED_PREFIXES` 已涵蓋 `/api/games`，在
  `sessionController.require(event)` 之後，路徑符合 `/api/games/retro/<key>/...` 時查
  `roleGamePermsService.isEnabled(member.roleId, 'retro', key)`，`false` 則 403
- **BG 彩票**：下注是單一共用路由 `POST /api/lottery/bet`（見 `server/api/lottery/bet.post.ts`），
  key 來自 request body 的 `payload.lottery.key`（例如 `'LHC-CD'`），不是路徑——因此這關卡直接寫在
  `bet.post.ts` handler 內，而不是 middleware：由於權限已經是盤口層級（Decision 1），
  `payload.lottery.key` 本身就是 `roleGamePermsService` 要查的 key，不需要任何反查或對照表，直接
  `isEnabled(member.roleId, 'bg', payload.lottery.key)`，`false` 則拒絕下注
- 這兩層都是實際安全邊界；前台 middleware 只是使用者體驗（避免點進去才被彈回）

## Risks / Trade-offs

- [Risk] in-memory 儲存重啟即回到「全開」，跟現有角色清單/白名單重啟回種子的慣例一致，但如果營運
  已經關掉特定項目、伺服器重啟會悄悄恢復開放——跟現有其餘 in-memory 設定風險相同，非本次新增風險
- [Risk] 「彩運來」欄位保留但不實作，若後續需求提前到來，需要先確認該分類的玩法清單/頁面路由是否
  已穩定，否則現在生出的 `category: 'taiwan'` 空殼可能跟實際實作對不上

## Open Questions

- 若未來要支援刪除自訂角色，需同步清掉 `roleGamePermsService` 裡對應的 Set，留給刪除角色的
  change 一併處理
- 「彩運來」分類實際要控管到玩法層級還是更細（例如依開獎時段），待該分類需求明確後再設計
