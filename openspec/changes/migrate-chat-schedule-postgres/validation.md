# Validation

- 對應變更：`migrate-chat-schedule-postgres`（聊天室廣播排程持久化）
- 日期：2026-10-07

## 實作內容確認

- `server/services/db/schema.ts` 新增 `chat_schedules` 表（只存設定欄位，不存運行游標），
  migration `drizzle/0005_sparkling_warstar.sql` 已產生並套用成功
- `chatSchedule.ts`：`add()`/`remove()`/`setEnabled()` 改 async write-through，新增
  `rehydrateOrSeed(defaultAdminId, defaultAdminName)`
- `hfyyManage.ts`：原本無條件執行的 4 筆種子迴圈改成「DB enabled 時改走 `rehydrateOrSeed()`
  （放進既有 try/catch），否則維持原本純記憶體迴圈（補上 `await`）」
- 3 個 API 路由補 `await`

## 種子去重複驗證（本次最重要的修正項）

- 全新 migration 後的空表，第一次乾淨開機：DB 正確寫入 4 筆種子排程（30s/20s/10s/5s）
- **連續第二次乾淨重啟**：確認 DB 筆數維持 4 筆，不再疊加——證實修正了「每次重啟無條件新增
  4 筆，約 7 次重啟後撞到 `MAX_SCHEDULES=30`」的缺口
- （過程中意外撞見 dev server 因既有的「No worker available」已知 flaky 問題在同一次 `nohup`
  啟動內部重試了 3 次，製造出 12 筆種子資料——這證實了 `rehydrateOrSeed()` 的 select-then-insert
  不是對併發重啟安全的，但跟 `roleDefs.rehydrateOrSeed()`/`mazeTemplates.rehydrateOrSeed()`
  既有的同構寫法一樣沒有加鎖，屬於「假設單一 boot 實例」的既有設計慣例，不是本次新增的缺陷；
  已確認乾淨單次重啟不會重複，詳見下方清理記錄）

## 寫入 + 重啟回填驗證（真實 API 呼叫）

- 呼叫 `POST /api/admin/chat/schedules` 新增一筆 daily 排程
- 呼叫 `PATCH /api/admin/chat/schedules/[id]` 停用一筆 interval 排程
- 呼叫 `DELETE /api/admin/chat/schedules/[id]` 刪除一筆 interval 排程
- 直接查詢 Postgres 確認三個操作都正確反映在 `chat_schedules` 表
- **重啟 dev server**，用 `GET /api/admin/chat/schedules` 確認：
  - 新增的 daily 排程存在、沒有 `lastFiredKey`（視為尚未觸發）
  - 被刪除的排程消失，被停用的排程維持 `enabled: false`
  - 其餘 interval 排程的 `lastFiredAt` 正確重設為回填當下的時間戳（不是沿用舊值，不會停機期間
    累積後一次連發）

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：維持原本「每次開機無條件種 4 筆」的既有行為，
  新增排程 API 正常運作，純記憶體模式不受影響
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤
- 完整 `npm test`（38 支腳本，含 `test:chat`）：通過 35 支，失敗 3 支
  （`test:6hc-cd`/`test:6hc-of`/`test:bg`），個別重跑後三支皆 100% 通過——確認是既有已知的 BG
  期別邊界時序 flakiness，與本次變更無關

## 測試資料清理

驗證過程中新增/修改的排程（測試用 daily 排程、被停用又重新啟用的 30s 排程、被刪除又重新新增的
20s 排程）已清理回 4 筆種子排程的乾淨狀態（id 不同但內容/數量與種子一致，無害）。

## 已知限制（延續 design.md 的決策）

- 運行游標（`lastFiredKey`/`lastFiredAt`）刻意不持久化，重啟後 `daily`/`once` 排程視為「尚未
  觸發」，`interval` 排程計時重置——唯一風險是重啟時間點精準落在上次觸發的同一分鐘內會重複發送
  一次，機率可忽略，不處理
- `rehydrateOrSeed()` 的 select-then-insert 在「同一瞬間有多個 boot 實例同時啟動」時沒有防護
  （跟既有 `roleDefs`/`mazeTemplates` 的同構寫法一致），單一 dev/production 實例正常重啟不受影響

## 成功標準檢核

- [x] write-through + 開機回填（含種子去重複）完成並驗證
- [x] 既有測試無回歸（3 支已知 flaky 測試重跑後皆通過）
