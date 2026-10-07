# Tasks

- [x] `server/services/db/schema.ts` 新增 `chat_schedules` 表 + migration
- [x] `chatSchedule.ts`：`add()`/`remove()`/`setEnabled()` 改 async write-through
- [x] `chatSchedule.ts`：新增 `rehydrateOrSeed(defaultAdminId, defaultAdminName)`
- [x] `hfyyManage.ts`：無條件種子迴圈改成「DB enabled 呼叫 rehydrateOrSeed，否則維持原本迴圈」
- [x] API 路由（`schedules.post.ts`/`schedules/[id].patch.ts`/`schedules/[id].delete.ts`）補 `await`
- [x] 驗證：新增/刪除/切換排程，DB 正確寫入
- [x] 驗證：重啟後正確回填，且不重複疊加種子排程（連續重啟 2 次確認筆數不增加）
- [x] DB enabled/disabled 兩種設定下 `npm test` 通過
- [x] 補齊 validation.md / engineering-evidence.md
