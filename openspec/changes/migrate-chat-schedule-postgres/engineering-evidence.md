# Engineering Evidence

## 變更摘要

- 對應變更：`migrate-chat-schedule-postgres`
- 變更檔案清單：
  - `server/services/db/schema.ts`（新增 `chat_schedules` 表）
  - `drizzle/0005_sparkling_warstar.sql` + `drizzle/meta/`
  - `server/services/social/chatSchedule.ts`（`add`/`remove`/`setEnabled` 改 async
    write-through，新增 `rehydrateOrSeed()`、`_toDbRow()`/`_toMemoryRow()`）
  - `server/services/admin/hfyyManage.ts`（種子邏輯改依 `isDbEnabled()` 分流）
  - `server/api/admin/chat/schedules.post.ts`、
    `server/api/admin/chat/schedules/[id].patch.ts`、
    `server/api/admin/chat/schedules/[id].delete.ts`（補 `await`）
- Commit 參考：（待下一輪 commit 附上）

## 驗證佐證

- 對應 `validation.md` 結論：通過
- write-through 實測：新增/停用/刪除排程皆正確反映到 DB
- 開機回填實測：重啟後排程清單正確從 DB 回填，運行游標正確重置（不沿用舊值）
- **種子去重複實測**：連續 2 次乾淨重啟，DB 筆數維持 4 筆不疊加（修正原本每次重啟無條件新增
  4 筆、約 7 次重啟後撞上限的缺口）
- `npm test`（38 支，含 `test:chat`）DB enabled/disabled 兩種設定下皆通過（3 支已知 BG flaky
  測試重跑後正常）
- 驗證用測試資料已清理回種子排程的乾淨狀態

## 封存前檢查

- [x] validation.md 已完成且結論為「通過」
- [x] 變更檔案與風險說明已整理完成
- [x] `npm run dev` 已確認正常（DB enabled/disabled 皆測試過）
- [ ] 可執行 `openspec archive` — 待使用者確認盤點清單最後一項（NPC 設定）是否要繼續處理
