# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-npc-settings-postgres`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `npc_settings`/`npc_game_presets`/
    `npc_member_settings`/`npc_member_games`/`npc_daily_spent` 五張表）
  - `drizzle/0006_lean_marvex.sql` + `drizzle/meta/`
  - `server/services/admin/modules/npcAutoPlay.ts`（大量方法改 async write-through，新增
    `rehydrateOrSeed()`/`_toDbSchedule`/`_fromDbSchedule`/`_toDbMemberSetting`/
    `_fromDbMemberSetting` 等 helper）
  - `server/services/admin/hfyyManage.ts`（呼叫 `rehydrateOrSeed()`，結尾 `setEnabled(true)`
    改條件式執行）
  - 9 個 `server/api/admin/npc/**` 路由補 `await`
  - **順手修正 Area 1 遺留 bug**：`server/services/admin/modules/retroGameRates.ts`、
    `server/services/admin/modules/toyShop.ts`（numeric 欄位 number→string 轉換）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- write-through 實測：新建 NPC 的 `_assignArchetype()`、個別設定、勾選遊戲、範本儲存/套用/
  刪除、全域設定、單字庫，全部確認 DB 正確寫入
- 開機回填實測：重啟後既有 NPC 的個別設定/勾選遊戲正確回填，**沒有**被打回「全選+同權重」
  的 fallback 狀態（本次變更的核心驗證目標）；`enabled: false` 正確維持管理員設定，不會被
  舊的無條件 `setEnabled(true)` 蓋回開啟；`_gamePresetSeq` 正確避免 id 衝突
  （`preset-2` 不是 `preset-1`）
- 意外驗證到 `_addSpent()` 的 fire-and-forget write-through 在真實背景 tick 中確實運作
  （`spentToday` 於重啟前已從 0 累積到 10，DB 查詢確認同步）
- `npm test`（38 支）DB enabled/disabled 兩種設定下皆通過（2 支已知 BG flaky 測試重跑後正常）
- typecheck：修正本次新增程式碼與 Area 1 遺留的 numeric 欄位型別錯誤後，專案其餘 typecheck
  錯誤皆為既有、與本次變更無關的項目（已逐一核對檔案清單）
- 驗證用測試資料已清理（範本已刪除、全域設定/單字庫已還原預設值），僅 1 筆測試 NPC 會員因
  既有「無刪除會員 API」限制暫時保留

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認：盤點清單四項（遊戲設定/聊天室排程/NPC 設定/
      登入紀錄）皆已完成，是否要一併封存全部 openspec changes
