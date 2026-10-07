# Validation

- 對應變更：`migrate-npc-settings-postgres`（NPC 設定持久化，盤點清單最後一項）
- 日期：2026-10-07

## 實作內容確認

- `server/services/db/schema.ts` 新增 5 張表：`npc_settings`（全域設定單例）、
  `npc_game_presets`、`npc_member_settings`（全列寫入）、`npc_member_games`（稀疏表示法，
  列存在＝允許）、`npc_daily_spent`（PK 只用 user_id）。Migration
  `drizzle/0006_lean_marvex.sql` 已產生並套用成功
- `npcAutoPlay.ts`：`setEnabled`/`updateSchedule`/`setNameWords`/`_assignArchetype`/
  `setMemberGameAllowed`/`setMemberGamesBulk`/`applyGamePreset`/`saveGamePreset`/
  `deleteGamePreset`/`setMemberSetting`/`_addSpent` 全部改 async write-through；新增
  `rehydrateOrSeed()`
- `_addSpent()` 的同步呼叫端（`_playRandomBg`/`_playRandomTw`/`_playRandomToys`，`tick()` 的
  同步路徑）改 fire-and-forget（`void ...catch(...)`），`testPlayAll()`（本來就 async）改
  `await`
- `hfyyManage.ts`：新增 `rehydrateOrSeed()` 呼叫；結尾無條件 `setEnabled(true)` 改成只在
  DB 未啟用、或 DB 啟用但開機回填失敗時才執行（用 `dbInitSucceeded` 旗標判斷）
- 9 個 API 路由補 `await`

## 額外發現並修正：numeric 欄位型別 bug（含 Area 1 遺留）

實作過程中 typecheck 發現 drizzle 的 `numeric()` 欄位型別是 `string`，直接塞 `number` 會在
`onConflictDoUpdate` 處報型別錯誤（`insert().values()` 本身不會報，但會連帶讓整個
`onConflictDoUpdate()` 呼叫的 overload 解析失敗）。這個問題**不是本次新增的**——Area 1
（`migrate-game-settings-postgres`）的 `retroGameRates.ts`/`toyShop.ts` 已經有相同 bug，只是
當時 `npx nuxi typecheck` 的輸出沒有仔細全部核對到，這次趁 npcAutoPlay.ts 大量使用 numeric
欄位才完整暴露出來。已一併修正三個檔案（`retroGameRates.ts`/`toyShop.ts`/`npcAutoPlay.ts`），
一律在組 DB row 時用 `String(n)` 轉換。順手修正另一處無關的既有型別缺口：
`_playRandomRetro()` 的 inline 型別標註 `record: (...) => unknown` 應為
`=> Promise<unknown>`（呼叫端對它 `.catch()`，缺標註導致型別檢查失敗）。

`npm run dev`/`npm test` 的實際執行結果不受影響（postgres.js 驅動本來就會把 number 轉成
字串送出，只是 TypeScript 編譯期型別檢查過不了），但既然要做六階段流程就應該連同 typecheck
一起修乾淨，不留技術債。

## 寫入 + 重啟回填驗證（真實 API 呼叫）

- 呼叫 `POST /api/admin/npc/members/auto-create` 新建一個 NPC，確認 `_assignArchetype()`
  正確 write-through：`npc_member_settings` 有完整一列、`npc_member_games` 有對應的勾選
  （本次抽到「雜食玩家」原型，25 款遊戲）
- 呼叫 `PATCH .../settings`（`dailyMaxSpend`/`actionIntervalSec`）、
  `PUT .../games/retro/pong`（取消勾選）、`PATCH /api/admin/npc/settings`
  （`enabled`/`schedule`）、`PATCH /api/admin/npc/name-words`、
  `POST /api/admin/npc/game-presets`（儲存範本）、
  `PUT .../games/apply-preset`（套用範本，整份覆蓋），逐一查詢 Postgres 確認全部正確寫入
- **重啟 dev server**，確認：
  - `npc_settings` 正確回填（`enabled: false`、`tickIntervalSec: 45`、自訂 `nameWords`、
    已儲存的範本），且 `enabled` 維持管理員手動關閉的狀態，**沒有**被打回 true
  - 該 NPC 的 `dailyMaxSpend`/`actionIntervalSec`/`allowedGames`（套用範本後的 2 款遊戲）
    全部正確回填——**這正是本次要修正的核心問題**：重啟後沒有被 `_allowedGamesOf()`/
    `_memberSettingOf()` 的 fallback 邏輯打回「全選+同權重」
  - 新存一個範本得到 `preset-2`（不是 `preset-1`），確認 `_gamePresetSeq` 正確從 DB 既有
    資料回復，避免跟 `preset-1` 撞號
  - 意外觀察到該 NPC 的 `spentToday` 在重啟前已經是 10——證實 `_addSpent()` 的
    fire-and-forget write-through在真實背景 tick 活動中確實有觸發並正確寫入 DB
    （`npc_daily_spent` 查詢確認）

## DB enabled/disabled 迴歸驗證

- **DB disabled**（暫時移除 `.env`，重啟）：`autoCreateMember()`、`setEnabled()` 等寫入操作
  皆正常運作，純記憶體模式不受影響
- **DB enabled**（還原 `.env`，重啟）：乾淨開機無錯誤
- 完整 `npm test`（38 支腳本）：通過 36 支，失敗 2 支（`test:6hc-cd`/`test:bg`），個別重跑後
  皆 100% 通過——確認是既有已知的 BG 期別邊界時序 flakiness，與本次變更無關

## 測試資料清理

- `npc_settings` 的 `enabled`/`tickIntervalSec` 重設回 `true`/`30`，`nameWords` 還原成完整
  656 個預設單字（原本測試時只存了 20 個截斷清單，已重新用完整清單覆蓋回去）
- 2 個測試用遊戲範本已刪除
- 1 個測試 NPC 會員（`U0XA0C21016C43`）因為後台沒有刪除會員的 API（既有已知功能缺口，
  `test-roles.mjs` 的臨時帳號清理也受此限制），暫時保留，不影響任何功能

## 已知限制（延續 design.md 的決策）

- `_nextActionAt`/`_lastTickAt` 不持久化：重啟後每個 NPC 視為立即可行動，無害
- 既有（本次功能上線前就存在）的 NPC 若從未被 `setMemberSetting()`/`_assignArchetype()`
  寫入過，DB 裡沒有對應列，重啟後仍會维持原本的 fallback 行為（套用全域設定）——這份資料
  沒有「回溯性修復」機制，只對「本次上線後新建或被管理員調整過」的 NPC 生效

## 成功標準檢核

- [x] 7 個 store 依分類完成 write-through/不處理
- [x] 既有測試無回歸（2 支已知 flaky 測試重跑後皆通過）
- [x] 重啟後既有 NPC（本次測試建立的）不會被打回「全選+同權重」的 fallback 狀態
