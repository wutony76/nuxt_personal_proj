# Proposal

## 變更名稱

`migrate-chat-schedule-postgres` — 聊天室廣播排程持久化

## 背景

`server/services/social/chatSchedule.ts` 的排程清單（`schedules: ChatSchedule[]`，上限 30 筆）
純記憶體，重啟歸零。使用者盤點後，指定「遊戲的設定」做完後接著處理這項。

## 決策：設定欄位 write-through，運行游標不持久化

一筆排程混合兩種截然不同的寫入頻率：
- **設定欄位**（`text`/`hour`/`minute`/`repeat`/`intervalSeconds`/`enabled`/`createdBy*`）：
  admin 操作才變更，低頻，適用 write-through
- **運行游標**（`lastFiredKey`/`lastFiredAt`）：由 300ms tick 迴圈在排程觸發當下寫入，`interval`
  模式最快每 5 秒寫一次——不適合 write-through（會在熱路徑上多一次 DB 往返），也不適合批次同步
  （batch sync 的 5 分鐘間隔對「觸發判斷」毫無意義）

因此本次**只持久化設定欄位**，運行游標完全不進 DB。重啟後的行為：
- `interval` 排程：回填時把 `lastFiredAt` 重設為「回填當下」（等同 `setEnabled(true)` 重新開啟時
  的既有語意：重置計時，不會因為停機期間累積而一次連發）
- `daily`/`once` 排程：`lastFiredKey` 清空，等同「還沒發過」。唯一的理論風險是重啟時間點剛好落在
  跟上次觸發同一分鐘內，會導致重複發送一次——機率極低且後果僅止於聊天室多一則提示訊息，不影響
  任何業務邏輯，不處理

## 重要地雷：開機種子邏輯必須加「DB 是否已有資料」判斷

`hfyyManage.ts` 的 `setStartData()` 目前**每次開機都無條件新增 4 筆** interval 測試排程
（30s/20s/10s/5s 發送測試訊息）。持久化後如果不處理，每次重啟都會再疊加 4 筆，約 7 次重啟後
撞到 `MAX_SCHEDULES=30` 直接報錯。修正方式：比照 `roleDefs.rehydrateOrSeed()` 的「空則種子、
有則用 DB 覆蓋記憶體」模式——DB 是空的（全新環境）才寫入這 4 筆預設測試排程，DB 已有資料就直接
回填，不再重複呼叫 `add()`。

## 範圍

- 包含：`chat_schedules` 表（只存設定欄位），`add()`/`remove()`/`setEnabled()` 改 write-through，
  開機回填（空則種子 4 筆測試排程、有則覆蓋記憶體），修正無限疊加種子的缺口
- 不包含：`lastFiredKey`/`lastFiredAt` 持久化（如上決策）

## 驗證方式

- 新增/刪除/切換排程，確認 DB 正確寫入
- 重啟後排程清單正確回填，且不會重複疊加種子排程
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] write-through + 開機回填（含種子去重複）完成並驗證
- [ ] 既有測試無回歸
