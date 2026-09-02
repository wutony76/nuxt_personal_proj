## Context

既有 `chatScheduleService` 僅支援 `daily`／`once`＋`hour`/`minute`，以 `lastFiredKey`（`YYYYMMDDHHMM`）防同一分鐘重複觸發；`tick()` 掛在 `runCircle`（約 300ms）上。本次在同一服務內擴充「每 N 秒」間隔模式，不另開 timer。

## Goals / Non-Goals

**Goals:**

- 新增 `repeat: 'interval'`，搭配必填正整數 `intervalSeconds`
- 間隔排程在新增後依秒數週期發送，直到手動刪除
- 後台表單可設定並顯示間隔排程
- 既有 daily／once 行為與 API 相容（未傳 interval 時行為不變）

**Non-Goals:**

- 不持久化排程（仍 in-memory，重啟清空）
- 不支援 cron／多時段／隨機間隔
- 不改聊天室發言身分或廣播路徑（仍走 `pushAdminMessage`）

## Decisions

### 1. 用 `repeat: 'interval'` + `intervalSeconds`，不用獨立 schedule type

- **做法**：擴充 `ChatScheduleRepeat = 'daily' | 'once' | 'interval'`；`interval` 時必填 `intervalSeconds`，`hour`/`minute` 可存 `0` 佔位但不參與比對。
- **理由**：列表／刪除／上限邏輯共用；前端只需在「重複」選單多一個選項。
- **替代**：另建 `intervalSchedules` 陣列 → 雙份 tick／API，維護成本高，不採用。

### 2. 觸發判斷用 `lastFiredAt`（epoch ms），不用分鐘 key

- **做法**：`interval` 排程以 `lastFiredAt` 記錄上次發送時間；`tick(now)` 當 `nowMs - (lastFiredAt ?? 0) >= intervalSeconds * 1000` 時發送並更新 `lastFiredAt = nowMs`。新增當下不立即發送（`lastFiredAt` 初值設為 `createdAt`），第一次發送約在 `createdAt + intervalSeconds`。
- **理由**：心跳約 300ms，秒級間隔用 timestamp 比對即可；若用 `lastFiredKey` 分鐘字串無法表達秒級。
- **替代**：為每筆 interval 開 `setInterval` → 與既有「掛在 runCircle」架構不一致，且刪除／重啟清理更麻煩，不採用。

### 3. 秒數上下限

- **下限 `MIN_INTERVAL_SECONDS = 5`**：避免過短間隔洗版聊天室；心跳 300ms 理論可更短，但產品上 5 秒已夠測試用途。
- **上限 `MAX_INTERVAL_SECONDS = 86400`**（24 小時）：超過可用 daily 排程；防止異常大數。

### 4. API body 形狀

- `repeat: 'interval'` 時必填 `intervalSeconds`（number）；可不傳／忽略 `time`/`hour`/`minute`。
- `daily`／`once` 仍要求時間，忽略 `intervalSeconds`。

### 5. UI

- 「重複」選單新增「間隔」；選中時隱藏時間 picker、顯示「每 N 秒」數字輸入。
- 列表 meta：`每 {n} 秒` tag，不顯示 HH:mm。

## Risks / Trade-offs

- [Risk] 多筆短間隔排程可能讓聊天室刷屏 → Mitigation：下限 5 秒 + 既有 `MAX_SCHEDULES = 30`；管理員可手動刪除。
- [Risk] 伺服器短暫卡頓可能讓實際間隔略大於設定值 → Mitigation：可接受；以「距上次發送已滿 N 秒」補齊，不會連發補漏。
- [Trade-off] 新增當下不立刻發第一則 → 行為可預期，避免「一按新增就洗一則」；若日後要「立即發一次」可另加選項。

## Migration Plan

- 純擴充，無 DB migration；舊排程無 `intervalSeconds` 仍為 daily／once。
- 回滾：還原型別與 UI 選項即可；記憶體中的 interval 排程重啟後本來就會消失。

## Open Questions

- （無；下限 5 秒已定，若產品要改再調常數。）
