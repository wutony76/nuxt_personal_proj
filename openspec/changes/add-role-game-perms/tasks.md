## 1. Server：角色權限服務

- [ ] 1.1 新增 `roleGamePermsService`（`Map<roleId, Set<string>>` 記被關閉的 `` `${category}:${key}` ``；`isEnabled`／`toggle`／`listForRole`；內建角色一律回全開）
- [ ] 1.2 新增 `shared/config/gameSlugs.js`（`{category, slug, key}[]`，涵蓋 `retro` 26 筆與 `bg` 15 筆頁面 slug，1 對 1；純 JS 無 import）
- [ ] 1.3 `HFYYManage` 或對應 module 掛上 `roleGamePerms`
- [ ] 1.4 新增 `GET /api/admin/games`（合併 `bg`：`LOTTERY` 中 15 個有對應頁面的盤口 key〔排除 5 個無 `sub` 的玩法占位 key〕與 `retro`：`Storage.retroGames.instances`，回傳 `{category, key, name}[]`，admin-only）
- [ ] 1.5 新增 `GET /api/admin/role-defs/:id/games`（回傳該角色兩分類全部項目的 `{category, key, name, enabled}[]`；內建角色回全開且不可切換）
- [ ] 1.6 新增 `PATCH /api/admin/role-defs/:id/games`（body `{category, key, enabled}`；驗證角色存在、非內建、category/key 合法）

## 2. Server：前台強制生效

- [ ] 2.1 新增 `GET /api/games/access`（需登入；依 session 對應會員角色，回傳被關閉的 `{category, key}[]`；內建角色回空陣列）
- [ ] 2.2 `server/middleware/auth.ts`：`/api/games/retro/:key/*` 請求在 `sessionController.require` 之後，加角色關卡查 `roleGamePermsService.isEnabled(roleId, 'retro', key)`，未開放回 403
- [ ] 2.3 `server/api/lottery/bet.post.ts`：下注前直接用 `payload.lottery.key` 查 `roleGamePermsService.isEnabled(roleId, 'bg', payload.lottery.key)`（盤口層級，key 即權限 key，不需轉換），未開放拒絕下注

## 3. Frontend：後台管理 UI

- [ ] 3.1 `api.ts`：新增 `RoleGamePerm` 型別（含 `category`）、`api.admin.games()`／`api.admin.roleGames(id)`／`api.admin.setRoleGame(id, category, key, enabled)`
- [ ] 3.2 新增 `RoleGamesPanel.vue`（props: `roleId`；內部 `state` 含 loading/success/error 三段、分 `BG 彩票`／`遊戲中心` 兩區塊、切換中的項目）
- [ ] 3.3 `RoleList.vue`：「資訊」分頁在 `!selected.builtin` 時掛 `<AdminRoleGamesPanel :role-id="selected.id" />`；內建角色維持原本說明文字

## 4. Frontend：前台強制生效

- [ ] 4.1 新增 `useGameAccess()` composable（單例快取，呼叫 `GET /api/games/access`，比照 `useRoleDefs()` pattern）
- [ ] 4.2 新增 `app/middleware/game-access.global.ts`：
  - `/game/:slug` → 查 `retro` 分類，未開放導回 `/game-hall`
  - `/lottery/bg/:slug`（含 `6hc-cd` 巢狀頁，前綴比對）→ 查 `bg` 分類，未開放導回 `/lottery-hall`
  - 其餘路徑放行

## 5. 驗證

- [ ] 5.1 API 手動測試：`GET/PATCH role-defs/:id/games` 涵蓋兩分類、內建角色拒絕切換、無效 category/key 拒絕
- [ ] 5.2 瀏覽器手動測試：自訂角色關閉一款遊戲中心項目 → 該角色會員直接訪問 `/game/<slug>` 被導回 `/game-hall`
- [ ] 5.3 瀏覽器手動測試：自訂角色關閉某玩法的單一盤口（例如只關 `LHC-CD`）→ 該角色會員訪問該盤口頁面被導回 `/lottery-hall`，另一盤口（`LHC-OF`）不受影響仍可進入
- [ ] 5.4 API 手動測試：關閉遊戲中心項目後直接呼叫 `/api/games/retro/<key>/history`（略過前端）應回 403
- [ ] 5.5 API 手動測試：關閉某 BG 盤口後直接呼叫 `/api/lottery/bet` 對該盤口下注（略過前端）應拒絕，另一盤口不受影響
- [ ] 5.6 回歸測試：內建角色（Admin／User／NPC）與訪客不受影響，兩分類全部項目可正常進入
