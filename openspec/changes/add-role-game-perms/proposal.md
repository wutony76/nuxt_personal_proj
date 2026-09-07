## Why

[[add-dynamic-roles]] 已把角色從二元 admin/user 擴充成可自訂清單（種子 Admin／User／NPC，可再新增如 VIP），
但角色目前只是一個標籤，彼此之間沒有實際行為差異（除了 `admin` id）。營運需要「自訂角色」能真的限制
可玩的範圍（例如 VIP 專屬幾款、活動帳號只能玩特定遊戲），涵蓋「遊戲管理」底下已存在的兩個分類——
BG 彩票（`/admin/bg-lottery`）與遊戲中心／經典遊戲（`/admin/games`）。`/admin/roles` 的角色列表
「資訊」分頁需要補上這塊功能選單，而且切換結果必須真的擋住前台，不能只是後台顯示用的假開關。

## What Changes

- 新增「角色 × 玩法權限」服務，以**分類（category）**為單位登記可控制的項目，本次涵蓋兩類：
  - `bg`（BG 彩票）：15 個盤口項目（`app/config/constants.js` 的 `LOTTERY` 全部 key，
    CD／OF 分開獨立開關——`LHC-CD`／`LHC-OF`／`K3-CD`／`K3-OF`／`PK10-CD`／`PK10-OF`／`SSC-CD`／
    `SSC-OF`／`X5-CD`／`X5-OF`／`EGGS`／`KL10`／`KL8`／`FC3D`／`PL3`；只有信用盤或只有官方盤的
    玩法（`EGGS`／`KL10`／`KL8`／`FC3D`／`PL3`）本來就只有一個 key，不受影響）
  - `retro`（遊戲中心）：26 款小遊戲（`Storage.retroGames.instances` 現有清單）
  - 資料結構保留第三個分類 `taiwan`（彩運來）的擴充空間，但**本次不實作**（見 Out of Scope）
  - 記錄每個**自訂角色**被關閉的項目；內建角色（Admin／User／NPC）不受限、永遠全部可玩
  - 新角色預設全部項目開啟，管理員再個別關閉
- `/admin/roles` 角色列表「資訊」分頁：角色為自訂角色時，分兩區塊（BG 彩票／遊戲中心）顯示開啟／關閉清單，可即時切換
- 新增查詢／切換 API：
  - `GET /api/admin/games`：回傳 `bg`＋`retro` 兩分類的 `{category, key, name}` 清單（後台用，admin-only）
  - `GET /api/admin/role-defs/:id/games`：回傳指定角色每個項目的開啟狀態
  - `PATCH /api/admin/role-defs/:id/games`：切換指定角色的單一項目開關（僅限自訂角色）
- 前台強制生效：
  - 新增會員自查 API `GET /api/games/access`：依登入者當前角色回傳被關閉的 `{category, key}` 清單
  - 新增全域路由 middleware，攔截 `/game/:slug`（遊戲中心）與 `/lottery/bg/:slug`（BG 彩票，含
    `6hc-cd` 底下的巢狀頁），若該項目被目前角色關閉則導回對應大廳（`/game-hall` 或 BG 彩票大廳）
  - 同步在後端加上角色關卡：`/api/games/retro/:key/*`（遊戲中心）與 `/api/lottery/bet`（BG 彩票下注，
    `payload.lottery.key` 即盤口 key，直接查權限，不需反查玩法），避免略過前端直接打 API
  - 訪客（未登入）與內建角色會員不受影響，沿用現況

## Capabilities

### New Capabilities

- `role-game-perms`：自訂角色與「BG 彩票／遊戲中心」兩分類項目的開關綁定，含後台管理與前台強制生效
  （資料結構預留「彩運來」分類供後續擴充）

## Impact

- 新增 `server/services/admin/modules/roleGamePerms.ts`
- 新增 `server/api/admin/games.get.ts`
- 新增 `server/api/admin/role-defs/[id]/games.get.ts`、`server/api/admin/role-defs/[id]/games.patch.ts`
- 新增 `server/api/games/access.get.ts`
- `server/middleware/auth.ts`：`/api/games/retro/:key/*` 加角色關卡
- `server/api/lottery/bet.post.ts`：下注前加角色關卡
- 新增 `shared/config/gameSlugs.js`（`{category, slug, key}[]` 對照表，涵蓋 `retro` 與 `bg` 兩分類，
  頁面 middleware 與 server middleware 共用；保留讓 `taiwan` 分類未來加進同一份檔案）
- 新增 `app/middleware/game-access.global.ts`
- 新增 `app/composables/useGameAccess.ts`
- 新增 `app/components/admin/RoleGamesPanel.vue`
- `app/components/admin/RoleList.vue`：資訊分頁掛上 `RoleGamesPanel`（僅自訂角色顯示）
- `app/services/api.ts`：新增對應型別與 API wrapper

## Out of Scope

- 內建角色（Admin／User／NPC）的權限限制（維持全開）
- 「彩運來」（Taiwan Lottery）分類的實際權限控管——資料結構與共用設定檔預留分類欄位，
  但本次不填入清單、不做前後台開關與強制生效，待該分類的玩法清單/頁面路由穩定後另開 change
- 「遊戲試算」（`/admin/game-simulator`）等後台工具頁不在權限控管範圍內
- 遊戲大廳／BG 彩票大廳對「已關閉」項目的視覺標示（灰階/鎖頭圖示等），本次僅確保導向攔截，
  UI 提示留待後續 change 視需要再做
- 角色遊戲權限的操作紀錄／稽核軌跡
