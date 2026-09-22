## Context

NPC 自動遊玩服務（`npcAutoPlay.ts`）每次心跳觸發 NPC 行動後，會透過 `walletBalanceService.appendChange()` 寫入 `user.record.balanceChanges`。目前該陣列只能在個別會員的後台詳情頁查看，管理員無法一次看到所有 NPC 的活動。

現有 `balanceChanges` 型別：`game-reward`（經典遊戲結算）、`admin-topup`（自動/手動儲值）、`admin-deduct`（扣款）、`toy-bet`／`toy-reward`（柑仔店）、以及 BG 下注。

## Goals / Non-Goals

**Goals:**
- 後端 API 彙整所有 NPC 會員的 balanceChanges，支援分頁（最多 200 筆/頁）
- 前端新增「活動日誌」tab，呈現跨 NPC 的統合紀錄
- 支援依 NPC 會員、依類型篩選
- 每筆顯示：時間、NPC 名稱、類型標籤、金額（+/-）、餘額、備註

**Non-Goals:**
- 不修改現有 balanceChanges 資料結構
- 不做即時推播，手動 Refresh 即可
- 不提供匯出（CSV 等）

## Decisions

### D1：純 in-memory 彙整，不另開儲存
直接在 API handler 中遍歷所有 NPC user 的 `record.balanceChanges`，合併後排序回傳。
理由：資料量有限（每 user 上限 5000 筆，NPC 數通常 <50），每次查詢即時計算夠快；避免引入額外快取或資料表。

### D2：分頁用 cursor（createdAt + id），不用 offset
回傳最新 N 筆 + `nextCursor`；前端「載入更多」時帶 cursor 繼續取。
理由：插入新紀錄時 offset 會漂移；cursor 穩定且效能好。

### D3：篩選在後端做
API 接受 `memberId`（單一 NPC）與 `types`（逗號分隔類型）查詢參數，後端篩後再回傳。
理由：全量回傳再前端篩會讓初始 payload 過大。

## Risks / Trade-offs

- [Risk] NPC 數量大或每人紀錄接近上限時，第一次彙整略慢 → 前端加 loading 即可，後端上限設 200 筆/請求
- [Risk] `balanceChanges` 不含遊戲名稱，只有 `note` 欄位 → 前端直接顯示 note，不另行解析

## Migration Plan

無資料遷移。新增一個 GET endpoint + 前端新 tab，不影響既有功能。
