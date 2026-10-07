# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-game-settings-postgres`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `retro_game_rates`/`toy_shop_games`/
    `toy_shop_settings`/`pacman_maze_templates` 四張表）
  - `drizzle/0004_plain_dazzler.sql` + `drizzle/meta/`
  - `server/services/admin/modules/retroGameRates.ts`（`setRates()` 改 async write-through，
    新增 `rehydrateFromDb()`）
  - `server/services/admin/modules/toyShop.ts`（`setOdds`/`setGameEnabled`/`setEnabled` 改
    async write-through，新增 `rehydrateFromDb()`）
  - `server/services/game/retro/mazeTemplates.ts`（`add`/`remove` 改 async write-through，
    新增 `rehydrateOrSeed()`）
  - `server/services/admin/hfyyManage.ts`（呼叫三個 rehydrate 函式）
  - `server/api/admin/games/retro/[key]/rates.put.ts`、
    `server/api/admin/toy-shop/settings.patch.ts`、
    `server/api/admin/toy-shop/odds/[slug].put.ts`、
    `server/api/admin/toy-shop/games/[slug].patch.ts`、
    `server/api/admin/games/pacman/maze-templates.post.ts`、
    `server/api/admin/games/pacman/maze-templates/[id].delete.ts`（補 `await`）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- write-through 實測：三個模組個別寫入 API 確認 DB 正確寫入
- 開機回填實測：重啟後 `pong`/`snake` 賠率、`big-pig` 賠率與開關、全站總開關、Pac-Man 樣板
  （含 `classic-01` 種子 + 新增的 `test-maze`）皆正確從 DB 回填，override-only 語意正確
  （未調整過的項目維持程式碼預設值）
- `npm test`（38 支）DB enabled/disabled 兩種設定下皆通過（3 支已知 BG flaky 測試重跑後正常）
- 驗證用測試資料已清理回預設狀態

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認盤點清單其餘項目（聊天室排程、NPC 設定）是否
      要繼續處理
