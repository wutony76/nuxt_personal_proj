# Tasks

- [x] `server/services/db/schema.ts` 新增 4 張表 + `npm run db:generate` + `npm run db:migrate`
- [x] `retroGameRates.ts`：`setRates()` 改 async write-through，新增 `rehydrateFromDb()`
- [x] `toyShop.ts`：`setOdds()`/`setGameEnabled()`/`setEnabled()` 改 async write-through，
      新增 `rehydrateFromDb()`
- [x] `mazeTemplates.ts`：`add()`/`remove()` 改 async write-through，新增 `rehydrateOrSeed()`
- [x] `hfyyManage.ts` 的 `setStartData()` 呼叫上述三個 rehydrate 函式
- [x] 6 個 API 路由補 `await`（含 `maze-templates/[id].delete.ts` 改成 async handler）
- [x] 驗證：三個模組個別寫入 API 確認 DB 正確寫入
- [x] 驗證：重啟後正確回填（含 Pac-Man 樣板全新 DB 種子情境）
- [x] DB enabled/disabled 兩種設定下 `npm test` 通過
- [x] 補齊 validation.md / engineering-evidence.md
