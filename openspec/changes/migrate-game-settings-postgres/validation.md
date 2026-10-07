# Validation

- 對應變更：`migrate-game-settings-postgres`（遊戲設定持久化：復古遊戲賠率/柑仔店/Pac-Man 迷宮樣板）
- 日期：2026-10-07

## 實作內容確認

- `server/services/db/schema.ts` 新增 4 張表：`retro_game_rates`、`toy_shop_games`、
  `toy_shop_settings`、`pacman_maze_templates`，migration `drizzle/0004_plain_dazzler.sql`
  已產生並套用成功
- `retroGameRates.ts`/`toyShop.ts`/`mazeTemplates.ts` 三個模組皆改 write-through，新增對應
  `rehydrateFromDb()`/`rehydrateOrSeed()`
- `hfyyManage.ts` 的 `setStartData()` 在既有 try/catch 區塊內呼叫三個 rehydrate 函式
- 6 個 API 路由（`rates.put.ts`/`toy-shop/settings.patch.ts`/`toy-shop/odds/[slug].put.ts`/
  `toy-shop/games/[slug].patch.ts`/`maze-templates.post.ts`/`maze-templates/[id].delete.ts`）
  補上 `await`，`maze-templates/[id].delete.ts` 改成 async handler

## 寫入 + 重啟回填驗證（真實 API 呼叫）

- 乾淨重啟 dev server（DB 已啟用，全新 migration 後的空表）
- 呼叫寫入 API：
  - `PUT /api/admin/games/retro/pong/rates`（coinRate=99/coinCapPerRun=500/coinDailyCap=50000）
  - `PATCH /api/admin/toy-shop/settings`（enabled=false）
  - `PUT /api/admin/toy-shop/odds/big-pig`（multiplier=2.5/difficulty=1.2）
  - `PATCH /api/admin/toy-shop/games/big-pig`（enabled=false）
  - `POST /api/admin/games/pacman/maze-templates`（新增 test-maze，通過連通性驗證）
- 直接查詢 Postgres 確認 4 張表皆正確寫入（`pacman_maze_templates` 同時確認 `classic-01` 在
  第一次開機時已被種子寫入，證實「空則種子」分支有執行）
- **重啟 dev server**，用 GET 端點（`/api/games/retro/rates`、`/api/admin/toy-shop/settings`、
  `/api/games/retro/pacman/maze-templates`）確認：
  - `pong` 的三常數維持剛才設定的值，其餘 29 款復古遊戲維持程式碼預設值（override-only 正確）
  - 柑仔店全站開關維持 `false`，`big-pig` 維持 multiplier 2.5/difficulty 1.2/enabled false，
    其餘 7 款維持預設值
  - Pac-Man 樣板清單同時包含 `classic-01` 與 `test-maze`（DB 已有資料時的「覆蓋記憶體」分支
    正確執行，不是重複種子）

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：三個模組的寫入 API（`snake` 賠率、`gummy` 賠率、
  新增 Pac-Man 樣板）皆正常運作，純記憶體模式不受影響
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤
- 完整 `npm test`（38 支腳本）：通過 35 支，失敗 3 支（`test:6hc-cd`/`test:6hc-of`/`test:bg`），
  個別重跑後三支皆 100% 通過——確認是既有已知的 BG 期別邊界時序 flakiness，與本次變更無關
  （`test:toy-big-pig` 等玩具測試在賠率/上下架被本次測試調整過的情況下仍全數通過，確認測試本身
  是動態讀取目前設定值斷言，不是寫死預期值）

## 測試資料清理

驗證過程中寫入的測試值（`pong`/`snake` 賠率、`big-pig`/`gummy` 賠率與開關、`test-maze` 樣板）
已全部透過 API 呼叫重設回程式碼預設值並刪除，DB 目前狀態：`retro_game_rates`/`toy_shop_games`
各留 2 筆（值等於預設值，無害）、`pacman_maze_templates` 僅剩 `classic-01`。

## 已知限制（延續 design.md 的決策）

- 復古遊戲賠率的讀取路徑（`settleReward()`）維持讀記憶體，不读 DB——DB 只在寫入時同步、開機時
  回填，避免每次結算都多一次 DB 往返
- 三張 override-only 表（`retro_game_rates`/`toy_shop_games`/`toy_shop_settings`）本身沒有
  任何清理殘留列的機制：若玩法/遊戲 key 未來被下架，對應列會變成永久無效殘留（`rehydrateFromDb()`
  找不到對應實例時安全跳過，不影響運作，但列不會自動刪除）——跟既有 `role_game_perms` 的風格
  一致，暫不處理

## 成功標準檢核

- [x] 三個模組皆完成 write-through + 開機回填
- [x] 既有測試無回歸（3 支已知 flaky 測試重跑後皆通過）
