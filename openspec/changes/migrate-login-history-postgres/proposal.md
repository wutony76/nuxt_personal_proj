# Proposal

## 變更名稱

`migrate-login-history-postgres` — 登入紀錄持久化

## 背景

`server/services/loginHistory.ts` 的登入稽核紀錄（`byUser: Map<userId, LoginHistoryEntry[]>`，
每人上限 100 筆）目前純記憶體，重啟歸零。使用者盤點後台功能持久化優先序時，把這項列為第二優先。

## 決策：批次同步，不是 write-through

跟 Phase 2（members/role-defs）、`roleGamePerms` 不同，登入紀錄是**附加型事件記錄**（append-only），
跟 Phase 3 的 `pool_audit_*`/`retro_game_history` 同一類：
- 若做 write-through，每次登入都要等 DB 寫入完成才能回應，會拖慢登入流程，且稽核寫入失敗不該讓
  使用者登入失敗（登入本身是主流程，稽核是附帶動作）
- 遺失幾分鐘的稽核紀錄可接受（不影響任何業務邏輯判斷，純粹是給管理員查閱用）

因此套用 Phase 3 既有的「批次同步、全量快照」模式（跟 `retro_game_history` 同構：記憶體本身已有
「每人 100 筆」上限保護，同步只是備份，不裁剪記憶體）。

## 範圍

- 包含：
  - `login_history` 表（扁平化，`user_id` 欄位取代現有 `Map` 分桶）
  - 新增 `SyncSource`，全量快照同步（沿用 `retro_game_history`/`pool_audit_*` 的註冊模式）
- 不包含：
  - 開機回填（沿用 `retro_game_history` 的既有precedent：重啟後記憶體清空，要等累積到新的登入事件
    才會再出現在管理員查詢畫面，DB 裡的歷史資料只作為永久備份，不影響任何業務邏輯）

## 驗證方式

- 登入後確認下一輪同步，DB 正確寫入
- DB enabled/disabled 兩種設定下 `npm test` 皆通過

## 成功標準

- [ ] SyncSource 實作完成並驗證
- [ ] 既有測試無回歸
