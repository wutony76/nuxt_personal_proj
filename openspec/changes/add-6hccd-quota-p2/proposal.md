# Proposal

## 變更名稱

`add-6hccd-quota-p2` — 6hc-cd 新增「跨分頁單期總上限」+「玩家層級限額覆寫」

## 背景

六合彩信用盤（6hc-cd）的投注限額目前只做到「分頁層級」：每個分頁（特碼A、特碼B、正碼A…
共 18 玩法 66 個分頁）各自有單注上下限（`item.min`/`item.max`）與單期上限
（`issue.max`，同玩家+同期+**同分頁**累計），寫死在 `shared/config/cd/c_*.js` 靜態檔，
沒有後台介面可調。這是 2026-08-06 盤點時明確記錄為「P2，使用者決定暫不處理」的待辦（見
`project_quota_p2_pending` 記憶），這次使用者主動要求規劃。

**尚未實作的兩層：**
1. 跨分頁單期總上限：例如同一期在「特碼A + 特碼B + 正碼A…」全部分頁合計投注額的上限
2. 玩家層級限額：依帳號個別調整上述的跨分頁總上限（覆寫全站預設值）

## 重要發現：enforcement 不需要新表，只有「設定值」需要持久化

深入研究既有程式碼後發現：
- `server/services/game/lottery/bg/orders.ts` 的 `get.members.issue(issue, userId)`
  **已經是**「同一玩家、同一期、跨所有分頁」的累計投注額計算器（現在只用在會員資訊顯示，
  沒用在限額驗證），不需要新增任何計算邏輯或新表
- 當期注單只存在記憶體（`game_orders` 是批次同步、只歸檔已結算期別，當期/前一期刻意不同步
  見 Phase 3 design.md），所以 enforcement 本來就該讀記憶體，不是讀 DB
- 真正欠缺的只有「上限數值」本身：目前完全沒有地方可以設定這個新的跨分頁上限，連寫死的
  常數都沒有

## 範圍

**新增一張全站預設值 singleton 表**（比照 `toy_shop_settings`/`npc_settings` 的
`id='default'` 模式）：`sixhccd_quota_settings`，存跨分頁單期總上限（`crossTabIssueMax`，
`0` = 不限），write-through，後台可調。

**新增一張玩家層級覆寫表**（比照 `retro_game_rates` 的 override-only 稀疏模式）：
`sixhccd_member_quota`，PK `user_id`（FK → `members.id` CASCADE），只存
`crossTabIssueMax` 的個別覆寫值；缺列 = 套用全站預設值。

**不擴充** `CreditQuota`/`creditQuotaOf()`（shared 純函式，前後端共用，無法做 DB I/O）：
跨分頁總上限是遊戲層級的新概念，不是任何單一分頁的屬性，獨立於 `creditQuotaOf()` 之外，
在 `validateBetQuota()` 裡額外檢查一段，解析順序「玩家覆寫 → 全站預設 → 不限」。

**不覆寫既有 66 個分頁的單注/單期限額「數值」**（`item.min`/`item.max`/`issue.max` 繼續
寫死在 config，不搬進 DB）——但既有 per-tab 單期檢查的「已用額度」**計算方式**會跟著這次
一起改成 write-through counter（見下一點第 3 項決策），不是全部重寫。

## 設計決策（2026-10-07 已與使用者確認）

1. 全站預設跨分頁上限種子值：**`0`（不限）**，上線後由管理員視需求調整
2. 後台 UI：**本批不做**，先完成 schema + enforcement + API；UI 之後再補一個 change
3. 「記憶體重啟後當期已用額度歸零」：**一併解決**——不只是新的跨分頁檢查，連既有的
   per-tab 單期檢查也要一起修掉這個繼承的舊限制（見 design.md 第 6 節的 write-through
   counter 設計）

## 驗證方式（待 Implementation 階段）

- 設定跨分頁總上限後，同玩家在不同分頁下注加總超過上限時正確拒單，訊息正確
- 玩家個別覆寫生效（覆寫值 ≠ 全站預設時，以覆寫值為準）
- 未覆寫的玩家正確 fallback 到全站預設
- 既有單注/單期（per-tab）限額行為不受影響
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] 兩張新表 + 開機回填 + `validateBetQuota()` 新增跨分頁檢查完成並驗證
- [ ] 後台可調整全站預設值與個別玩家覆寫值
- [ ] 既有測試無回歸
