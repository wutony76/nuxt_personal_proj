## 1. Server：排程服務與 API

- [x] 1.1 擴充 `ChatScheduleRepeat` 與 `ChatSchedule`：支援 `interval`、`intervalSeconds`、`lastFiredAt`
- [x] 1.2 `add()`：`interval` 驗證 `intervalSeconds`（5–86400）、寫入 `lastFiredAt = createdAt`；daily／once 維持原邏輯
- [x] 1.3 `tick()`：interval 以 `nowMs - lastFiredAt >= intervalSeconds * 1000` 觸發並更新 `lastFiredAt`；daily／once 分支不變
- [x] 1.4 `schedules.post.ts`：解析 `repeat: interval` + `intervalSeconds`；非 interval 仍解析時間

## 2. Frontend：型別與後台 UI

- [x] 2.1 `api.ts`：更新 `ChatSchedule`／`ChatScheduleRepeat` 與 `addSchedule` payload
- [x] 2.2 `AdminChatSchedule.vue`：重複選項加「間隔」、條件顯示秒數輸入／隱藏時間、列表顯示「每 N 秒」

## 3. 驗證

- [ ] 3.1 手動：新增「每 5 秒」排程，確認約 5 秒後開始重複出現「管理者: 排程」訊息，刪除後停止
- [ ] 3.2 手動：確認 daily／once 新增與觸發仍正常
