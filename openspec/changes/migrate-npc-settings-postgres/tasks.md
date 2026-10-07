# Tasks

- [x] `server/services/db/schema.ts` 新增 5 張表 + migration
- [x] `setEnabled`/`updateSchedule`/`setNameWords` 改 async write-through（`npc_settings`）
- [x] `_assignArchetype()` 改 async write-through（`npc_member_settings` + `npc_member_games`），
      `autoCreateMember()` 補 `await`
- [x] `setMemberGameAllowed`/`setMemberGamesBulk`/`applyGamePreset` 改 async write-through
      （`npc_member_games`）
- [x] `saveGamePreset`/`deleteGamePreset` 改 async write-through（`npc_game_presets`）
- [x] `setMemberSetting()` 改 async write-through（`npc_member_settings`）
- [x] `_addSpent()` 改 async write-through（`npc_daily_spent`），同步呼叫端改 fire-and-forget，
      `testPlayAll()` 改 `await`
- [x] 新增 `rehydrateOrSeed()`（全域設定空則種子、個別設定/勾選/範本/今日花費皆回填）
- [x] `hfyyManage.ts`：呼叫 `rehydrateOrSeed()`，結尾無條件 `setEnabled(true)` 改成只在 DB 未
      啟用或回填失敗時執行
- [x] 9 個 API 路由補 `await`
- [x] 額外修正：numeric 欄位需要 string（drizzle 型別要求），順便修正 Area 1 遺留的
      `retroGameRates.ts`/`toyShop.ts` 同款 bug
- [x] 驗證：各 write 方法呼叫後 DB 正確寫入
- [x] 驗證：重啟後既有 NPC 的 allowedGames/個別權重維持（不會被打回「全選+同權重」fallback）
- [x] 驗證：`_gamePresetSeq` 重啟後不會跟既有範本 id 衝突
- [x] DB enabled/disabled 兩種設定下 `npm test` 通過
- [x] 補齊 validation.md / engineering-evidence.md
