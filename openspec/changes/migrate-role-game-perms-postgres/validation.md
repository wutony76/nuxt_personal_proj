# Validation

## 驗證範圍

- 對應變更：`migrate-role-game-perms-postgres`（角色遊戲權限開關持久化）
- 驗證環境：本機 dev，沿用既有 Postgres 連線層與 schema 基礎

## 功能驗證

- [x] write-through + 開機回填實作完成
- [x] 重啟後設定正確存活
- [x] 既有測試無回歸

## 核心驗證

- **write-through**：透過 API 建立自訂角色 → 關閉該角色的 `retro:snake` 權限 → 關閉 `retro:pacman`
  全站總閘，查詢 DB 確認 `role_game_perms`/`game_global_disabled` 各有 1 筆資料
- **開機回填**：乾淨重啟後，查詢 `GET /api/admin/role-defs/:id/games` 與 `GET /api/admin/games`，
  確認兩項設定（`snake.enabled === false`、`pacman.enabled === false`）都正確從 DB 回填回記憶體
- **cascade 刪除**：刪除上述自訂角色後，查詢 DB 確認 `role_game_perms` 筆數歸零（`ON DELETE
  CASCADE` 正確觸發，不需要應用層額外呼叫 DB 刪除）
- **回歸**：DB enabled/disabled 兩種設定下 `npm test`（38 支）皆通過（各自一輪遇到既有時序性
  flaky，重跑即恢復，與本次變更無關）

## 結論

- 是否通過：是
- 已知限制：無新增限制，沿用 Phase 2 既有的 write-through/rehydrate 模式
- 後續追蹤：盤點清單中其餘項目（F幣餘額、登入紀錄、遊戲紀錄查詢路徑等）視需求另行決定
